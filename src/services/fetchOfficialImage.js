/**
 * Cherche une image officielle sur Wikipedia pour un nom scientifique donné.
 * Essaie d'abord le nom scientifique, puis le nom commun en fallback.
 */
export async function fetchOfficialImage(scientificName, commonName) {
  const candidates = [scientificName, commonName].filter(Boolean)

  for (const term of candidates) {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`
      const res = await fetch(url)
      if (!res.ok) continue
      const data = await res.json()
      if (data.thumbnail?.source) {
        // Demande une image plus grande (500px)
        const biggerUrl = data.thumbnail.source.replace(/\/\d+px-/, '/500px-')
        return {
          imageUrl: biggerUrl,
          wikiUrl:  data.content_urls?.desktop?.page ?? null,
          extract:  data.extract ?? null,
        }
      }
    } catch {
      // essaie le suivant
    }
  }

  // Fallback : recherche via l'API MediaWiki
  try {
    const searchUrl =
      `https://en.wikipedia.org/w/api.php?action=query&list=search` +
      `&srsearch=${encodeURIComponent(scientificName)}&format=json&origin=*&srlimit=1`
    const res = await fetch(searchUrl)
    if (res.ok) {
      const data = await res.json()
      const pageTitle = data?.query?.search?.[0]?.title
      if (pageTitle) {
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`
        const res2 = await fetch(summaryUrl)
        if (res2.ok) {
          const data2 = await res2.json()
          if (data2.thumbnail?.source) {
            return {
              imageUrl: data2.thumbnail.source.replace(/\/\d+px-/, '/500px-'),
              wikiUrl:  data2.content_urls?.desktop?.page ?? null,
              extract:  data2.extract ?? null,
            }
          }
        }
      }
    }
  } catch {
    // rien
  }

  return null
}
