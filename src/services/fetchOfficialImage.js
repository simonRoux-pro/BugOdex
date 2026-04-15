/**
 * Cherche une photo officielle sur iNaturalist pour un nom scientifique donné.
 * iNaturalist est 100% gratuit, aucune clé requise.
 */
export async function fetchOfficialImage(scientificName, commonName) {
  const terms = [scientificName, commonName].filter(Boolean)

  for (const term of terms) {
    try {
      const url =
        `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(term)}` +
        `&per_page=1&locale=fr`
      const res = await fetch(url)
      if (!res.ok) continue
      const data = await res.json()
      const taxon = data.results?.[0]
      if (taxon?.default_photo?.medium_url) {
        return {
          imageUrl:    taxon.default_photo.medium_url,
          wikiUrl:     taxon.wikipedia_url ?? null,
          attribution: taxon.default_photo.attribution ?? null,
        }
      }
    } catch {
      // essaie le terme suivant
    }
  }

  return null
}
