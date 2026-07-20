const cache = new Map()

/** Cherche une couverture de livre gratuitement via l'API publique Open Library. */
export async function findCoverUrl(auteur, titre) {
  const cacheKey = `${auteur}::${titre}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  try {
    const query = encodeURIComponent(`${titre} ${auteur}`)
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${query}&limit=1&fields=cover_i`
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const coverId = data.docs?.[0]?.cover_i
    const url = coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
      : null
    cache.set(cacheKey, url)
    return url
  } catch {
    cache.set(cacheKey, null)
    return null
  }
}
