/** Appelle l'API serverless qui cherche une source lisible/téléchargeable gratuite
 * d'un livre donné (Project Gutenberg, Internet Archive, puis recherche web). */
export async function findSource(livre) {
  const res = await fetch('/api/find-source', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auteur: livre.auteur,
      titre: livre.titre,
      annee: livre.annee,
      motsClesRecherche: livre.motsClesRecherche,
    }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw Object.assign(new Error(data.error ?? `Erreur HTTP ${res.status}`), {
      code: data.error,
      status: res.status,
    })
  }

  return res.json()
}

/** Construit l'URL du proxy pour lire un document distant sans être bloqué par le CORS. */
export function proxyUrlFor(remoteUrl) {
  return `/api/proxy-pdf?url=${encodeURIComponent(remoteUrl)}`
}
