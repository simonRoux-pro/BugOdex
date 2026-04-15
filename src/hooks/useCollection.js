import { useState, useEffect } from 'react'

const STORAGE_KEY = 'bugodex_v1'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function useCollection() {
  const [collection, setCollection] = useState(loadFromStorage)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collection))
    } catch (e) {
      console.warn('localStorage full or unavailable', e)
    }
  }, [collection])

  /** Ajoute une entrée et retourne l'entrée créée. */
  function addEntry(entry) {
    const newEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      capturedAt: new Date().toISOString(),
      ...entry,
    }
    setCollection((prev) => [newEntry, ...prev])
    return newEntry
  }

  /** Supprime une entrée par id. */
  function removeEntry(id) {
    setCollection((prev) => prev.filter((e) => e.id !== id))
  }

  /** Récupère une entrée par id. */
  function getEntry(id) {
    return collection.find((e) => e.id === id) ?? null
  }

  return { collection, addEntry, removeEntry, getEntry }
}
