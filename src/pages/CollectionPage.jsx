import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'

const CATEGORIES = ['tous', 'insecte', 'mammifère', 'oiseau', 'reptile', 'amphibien', 'poisson', 'arachnide', 'autre']

const CATEGORY_EMOJI = {
  insecte:   '🦋',
  mammifère: '🦊',
  oiseau:    '🐦',
  reptile:   '🦎',
  amphibien: '🐸',
  poisson:   '🐟',
  arachnide: '🕷️',
  crustacé:  '🦀',
  mollusque: '🐌',
  autre:     '🐾',
}

const STATUS_DOT = {
  LC: 'bg-green-400',
  NT: 'bg-lime-400',
  VU: 'bg-yellow-400',
  EN: 'bg-orange-400',
  CR: 'bg-red-500',
  EX: 'bg-gray-500',
  default: 'bg-gray-300',
}

export default function CollectionPage({ collection }) {
  const [filter, setFilter] = useState('tous')
  const [search, setSearch] = useState('')

  const displayed = useMemo(() => {
    return collection.filter((e) => {
      const matchCat   = filter === 'tous' || e.species?.category === filter
      const matchQuery = !search || (
        e.species?.commonName?.toLowerCase().includes(search.toLowerCase()) ||
        e.species?.scientificName?.toLowerCase().includes(search.toLowerCase())
      )
      return matchCat && matchQuery
    })
  }, [collection, filter, search])

  // Stats
  const uniqueSpecies = new Set(collection.map((e) => e.species?.scientificName)).size
  const catCounts = useMemo(() => {
    const counts = {}
    for (const e of collection) {
      const cat = e.species?.category ?? 'autre'
      counts[cat] = (counts[cat] ?? 0) + 1
    }
    return counts
  }, [collection])

  if (collection.length === 0) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center gap-5 px-6 text-center bg-forest-50">
        <span className="text-8xl">🔭</span>
        <div>
          <h2 className="text-xl font-bold text-forest-800">Collection vide</h2>
          <p className="text-forest-500 text-sm mt-1">Scanne ton premier animal pour commencer ta collection !</p>
        </div>
        <Link
          to="/"
          className="flex items-center gap-2 bg-forest-700 hover:bg-forest-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          <span>📷</span> Scanner un animal
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-forest-50 pb-10">
      {/* Stats header */}
      <div className="bg-forest-800 text-white px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-lg font-bold text-forest-100">Ma Collection</h1>
          <div className="flex gap-4 mt-2 text-sm text-forest-300">
            <span><strong className="text-white">{collection.length}</strong> captures</span>
            <span><strong className="text-white">{uniqueSpecies}</strong> espèces uniques</span>
          </div>
          {/* Catégorie breakdown */}
          <div className="flex flex-wrap gap-2 mt-3">
            {Object.entries(catCounts).map(([cat, count]) => (
              <button
                key={cat}
                onClick={() => setFilter(filter === cat ? 'tous' : cat)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors
                  ${filter === cat ? 'bg-forest-400 text-forest-900 font-bold' : 'bg-forest-700 text-forest-300 hover:bg-forest-600'}`}
              >
                {CATEGORY_EMOJI[cat] ?? '🐾'} {count}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Recherche */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            type="text"
            placeholder="Rechercher une espèce…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-forest-200 rounded-xl bg-white text-forest-800 text-sm focus:outline-none focus:border-forest-500 placeholder-forest-400"
          />
        </div>

        {/* Filtre catégories */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.filter((c) => c === 'tous' || catCounts[c]).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize
                ${filter === cat
                  ? 'bg-forest-700 text-white'
                  : 'bg-white border border-forest-200 text-forest-600 hover:border-forest-400'}`}
            >
              {cat !== 'tous' && (CATEGORY_EMOJI[cat] ?? '🐾')} {cat}
            </button>
          ))}
        </div>

        {/* Grille */}
        {displayed.length === 0 ? (
          <div className="text-center py-12 text-forest-400">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-sm">Aucun résultat pour cette recherche</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {displayed.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EntryCard({ entry }) {
  const { id, species, userPhoto, capturedAt } = entry
  const dot = STATUS_DOT[species?.conservationStatus] ?? STATUS_DOT.default
  const date = new Date(capturedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

  return (
    <Link
      to={`/detail/${id}`}
      className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-forest-100"
    >
      {/* Image */}
      <div className="aspect-square bg-forest-100 overflow-hidden relative">
        {userPhoto ? (
          <img
            src={userPhoto}
            alt={species?.commonName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">
            {species?.emoji ?? CATEGORY_EMOJI[species?.category] ?? '🐾'}
          </div>
        )}
        {/* Status dot */}
        <div className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${dot} ring-2 ring-white`} />
      </div>

      {/* Info */}
      <div className="p-2.5 space-y-0.5">
        <p className="text-xs font-bold text-forest-800 leading-tight truncate">{species?.commonName ?? '—'}</p>
        <p className="text-[10px] text-forest-500 italic truncate">{species?.scientificName ?? '—'}</p>
        <p className="text-[10px] text-forest-400">{date}</p>
      </div>
    </Link>
  )
}
