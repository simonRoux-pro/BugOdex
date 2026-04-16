import { useParams, useNavigate, Link } from 'react-router-dom'
import ConservationBadge from '../components/ConservationBadge'

const CATEGORY_EMOJI = {
  insecte:    '🦋',
  mammifère:  '🦊',
  oiseau:     '🐦',
  reptile:    '🦎',
  amphibien:  '🐸',
  poisson:    '🐟',
  arachnide:  '🕷️',
  crustacé:   '🦀',
  mollusque:  '🐌',
  autre:      '🐾',
}

const CONFIDENCE_LABEL = {
  high:   { text: 'Confiance élevée',   color: 'text-green-700 bg-green-100' },
  medium: { text: 'Confiance moyenne',  color: 'text-yellow-700 bg-yellow-100' },
  low:    { text: 'Confiance faible',   color: 'text-red-700 bg-red-100' },
}

export default function DetailPage({ getEntry, removeEntry }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const entry = getEntry(id)

  if (!entry) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center gap-4 text-forest-600">
        <span className="text-6xl">🔍</span>
        <p className="text-lg font-semibold">Entrée introuvable</p>
        <Link to="/collection" className="text-forest-500 underline text-sm">Retour à la collection</Link>
      </div>
    )
  }

  const { species, userPhoto, officialImage, wikiUrl, capturedAt } = entry
  const catEmoji = CATEGORY_EMOJI[species.category] ?? '🐾'
  const conf     = CONFIDENCE_LABEL[species.confidence] ?? CONFIDENCE_LABEL.medium
  const date     = new Date(capturedAt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const handleDelete = () => {
    if (confirm(`Supprimer ${species.commonName} de ta collection ?`)) {
      removeEntry(id)
      navigate('/collection')
    }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-forest-50 pb-10">
      {/* Header */}
      <div className="bg-forest-800 text-white px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-forest-300 hover:text-white transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
            Retour
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-1 text-red-300 hover:text-red-100 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Supprimer
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 space-y-5 pt-5">

        {/* Photos côte à côte */}
        <div className="grid grid-cols-2 gap-3">
          <PhotoCard
            src={userPhoto}
            label="Ta photo"
            icon="📷"
            sublabel={date}
          />
          <PhotoCard
            src={officialImage}
            label="Photo officielle"
            icon="📚"
            sublabel={species.scientificName}
            href={wikiUrl}
            placeholder="Aucune image Wikipedia disponible"
          />
        </div>

        {/* Nom + badges */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-4xl">{species.emoji ?? catEmoji}</span>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-forest-900 leading-tight">{species.commonName}</h1>
              <p className="text-forest-500 text-sm italic">{species.scientificName}</p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <ConservationBadge status={species.conservationStatus} />
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${conf.color}`}>
              {conf.text}
            </span>
          </div>

          {/* Taxonomie */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { label: 'Classe',  value: species.class  },
              { label: 'Ordre',   value: species.order  },
              { label: 'Famille', value: species.family },
            ].map(({ label, value }) => value && (
              <div key={label} className="bg-forest-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-forest-500 uppercase tracking-wide">{label}</p>
                <p className="text-xs font-semibold text-forest-800 mt-0.5 truncate">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        {species.description && (
          <InfoSection icon="📋" title="Description">
            <p className="text-forest-700 text-sm leading-relaxed">{species.description}</p>
          </InfoSection>
        )}

        {/* Habitat */}
        {species.habitat && (
          <InfoSection icon="🌿" title="Habitat">
            <p className="text-forest-700 text-sm leading-relaxed">{species.habitat}</p>
          </InfoSection>
        )}

        {/* Alimentation */}
        {species.diet && (
          <InfoSection icon="🍃" title="Régime alimentaire">
            <p className="text-forest-700 text-sm leading-relaxed">{species.diet}</p>
          </InfoSection>
        )}

        {/* Fun facts */}
        {species.funFacts?.length > 0 && (
          <InfoSection icon="✨" title="Le saviez-vous ?">
            <ul className="space-y-2">
              {species.funFacts.map((fact, i) => (
                <li key={i} className="flex gap-2 text-sm text-forest-700">
                  <span className="text-forest-400 mt-0.5 shrink-0">▸</span>
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </InfoSection>
        )}

        {/* Lien Wikipedia */}
        {wikiUrl && (
          <a
            href={wikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 border-2 border-forest-200 rounded-xl text-forest-600 hover:bg-forest-100 text-sm font-medium transition-colors"
          >
            <span>🔗</span>
            Voir sur Wikipedia
          </a>
        )}

      </div>
    </div>
  )
}

/* ---- sous-composants ---- */

function PhotoCard({ src, label, icon, sublabel, href, placeholder }) {
  const inner = src ? (
    <img src={src} alt={label} className="w-full h-full object-cover" />
  ) : (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-forest-400 p-3 text-center">
      <span className="text-3xl">🖼️</span>
      <p className="text-xs">{placeholder}</p>
    </div>
  )

  return (
    <div className="space-y-1.5">
      <div className="aspect-square rounded-xl overflow-hidden bg-forest-100 shadow-sm">
        {href && src ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
            {inner}
          </a>
        ) : inner}
      </div>
      <div className="flex items-center gap-1 px-1">
        <span className="text-sm">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-forest-700">{label}</p>
          {sublabel && <p className="text-[10px] text-forest-500 truncate italic">{sublabel}</p>}
        </div>
      </div>
    </div>
  )
}

function InfoSection({ icon, title, children }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-bold text-forest-800 uppercase tracking-wide">
        <span>{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  )
}
