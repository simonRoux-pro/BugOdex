import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { findCoverUrl } from '../services/openLibrary.js'

const DIFFICULTE_LABEL = {
  facile: 'Facile',
  intermediaire: 'Intermédiaire',
  avance: 'Avancé',
}

export default function BookCard({ parcoursId, livre }) {
  const [cover, setCover] = useState(null)

  useEffect(() => {
    let cancelled = false
    findCoverUrl(livre.auteur, livre.titre).then((url) => {
      if (!cancelled) setCover(url)
    })
    return () => {
      cancelled = true
    }
  }, [livre.auteur, livre.titre])

  return (
    <Link
      to={`/parcours/${parcoursId}/livre/${livre.id}`}
      className="flex gap-4 bg-white dark:bg-ink-800 rounded-lg border border-ink-200 dark:border-ink-700 p-4 hover:border-ink-400 dark:hover:border-ink-500 hover:shadow-md transition"
    >
      <div className="shrink-0 w-16 h-24 bg-ink-100 dark:bg-ink-900 rounded flex items-center justify-center overflow-hidden">
        {cover ? (
          <img src={cover} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl">📕</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400 mb-1">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-ink-800 dark:bg-ink-600 text-ink-50 font-semibold">
            {livre.ordre}
          </span>
          <span>{DIFFICULTE_LABEL[livre.difficulte] ?? livre.difficulte}</span>
        </div>
        <h3 className="font-serif text-lg leading-snug dark:text-ink-50">{livre.titre}</h3>
        <p className="text-sm text-ink-600 dark:text-ink-300 mb-1">
          {livre.auteur} · {livre.annee}
        </p>
        <p className="text-sm text-ink-700 dark:text-ink-200 line-clamp-2">{livre.resumeCourt}</p>
        <p className="text-xs text-ink-500 dark:text-ink-400 italic mt-1">{livre.pourquoiCetOrdre}</p>
      </div>
    </Link>
  )
}
