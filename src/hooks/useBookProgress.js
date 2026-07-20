import { useCallback, useEffect, useState } from 'react'

const STORAGE_PREFIX = 'parcours-lecture:progression:'

function keyFor(parcoursId, livreId) {
  return `${STORAGE_PREFIX}${parcoursId}:${livreId}`
}

function defaultProgress() {
  return {
    pageMarquee: 1,
    zoom: 1,
    notes: [], // [{ id, portee: 'Paragraphes 1 à 3', texte, creeLe }]
    source: null, // { url, type, sourceNote } — mis en cache après recherche
  }
}

/** Progression de lecture (marque-page, zoom, notes, source trouvée) pour un livre donné. */
export function useBookProgress(parcoursId, livreId) {
  const storageKey = keyFor(parcoursId, livreId)

  const [progress, setProgress] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? { ...defaultProgress(), ...JSON.parse(raw) } : defaultProgress()
    } catch {
      return defaultProgress()
    }
  })

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      setProgress(raw ? { ...defaultProgress(), ...JSON.parse(raw) } : defaultProgress())
    } catch {
      setProgress(defaultProgress())
    }
  }, [storageKey])

  const persist = useCallback((next) => {
    localStorage.setItem(storageKey, JSON.stringify(next))
    setProgress(next)
  }, [storageKey])

  const setPageMarquee = useCallback((page) => {
    persist({ ...progress, pageMarquee: page })
  }, [progress, persist])

  const setZoom = useCallback((zoom) => {
    persist({ ...progress, zoom })
  }, [progress, persist])

  const setSource = useCallback((source) => {
    persist({ ...progress, source })
  }, [progress, persist])

  const addNote = useCallback((portee, texte) => {
    const note = { id: crypto.randomUUID(), portee, texte, creeLe: Date.now() }
    persist({ ...progress, notes: [...progress.notes, note] })
  }, [progress, persist])

  const deleteNote = useCallback((noteId) => {
    persist({ ...progress, notes: progress.notes.filter((n) => n.id !== noteId) })
  }, [progress, persist])

  return { progress, setPageMarquee, setZoom, setSource, addNote, deleteNote }
}
