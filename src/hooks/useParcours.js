import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'parcours-lecture:parcours'

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeAll(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

/** Liste des parcours sauvegardés (historique), triés du plus récent au plus ancien. */
export function useParcoursList() {
  const [parcoursList, setParcoursList] = useState(() => readAll())

  const refresh = useCallback(() => setParcoursList(readAll()), [])

  const saveParcours = useCallback((parcours) => {
    const all = readAll()
    const withoutExisting = all.filter((p) => p.id !== parcours.id)
    const next = [parcours, ...withoutExisting]
    writeAll(next)
    setParcoursList(next)
    return parcours
  }, [])

  const deleteParcours = useCallback((id) => {
    const next = readAll().filter((p) => p.id !== id)
    writeAll(next)
    setParcoursList(next)
  }, [])

  return {
    parcoursList: [...parcoursList].sort((a, b) => b.creeLe - a.creeLe),
    saveParcours,
    deleteParcours,
    refresh,
  }
}

/** Un seul parcours par id, avec mise à jour en direct depuis le localStorage. */
export function useParcours(parcoursId) {
  const [parcours, setParcours] = useState(() =>
    readAll().find((p) => p.id === parcoursId) ?? null
  )

  useEffect(() => {
    setParcours(readAll().find((p) => p.id === parcoursId) ?? null)
  }, [parcoursId])

  return parcours
}
