const FORMAT_PRIORITY = [
  { prefix: 'application/pdf', type: 'pdf' },
  { prefix: 'application/epub+zip', type: 'epub' },
  { prefix: 'text/html', type: 'html' },
  { prefix: 'text/plain', type: 'texte' },
]

// fetch() n'a pas de délai par défaut dans les navigateurs : une connexion
// qui ne répond jamais (filtrée silencieusement plutôt que refusée) bloque
// la recherche indéfiniment. On borne donc chaque requête explicitement.
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function describeFetchError(err, timeoutMs) {
  if (err.name === 'AbortError') return `délai dépassé (${Math.round(timeoutMs / 1000)}s)`
  return err.message
}

/** Project Gutenberg et Internet Archive exposent des API JSON ouvertes au
 * navigateur (CORS autorisé) : on les interroge directement depuis le
 * navigateur, avec l'IP de l'utilisateur — jamais bloquée, contrairement à
 * celle (de datacenter) du serveur, qui se fait régulièrement rejeter par
 * ces mêmes services. Si l'appel échoue pour une raison quelconque (pas de
 * CORS, réseau…), on bascule simplement sur la recherche côté serveur. */
async function searchGutendexClient(auteur, titre) {
  try {
    const q = encodeURIComponent(`${titre} ${auteur}`)
    const res = await fetchWithTimeout(`https://gutendex.com/books?search=${q}`)
    if (!res.ok) return { debug: `Gutenberg HTTP ${res.status}` }
    const data = await res.json()
    const book = data.results?.[0]
    if (!book) return { debug: 'Gutenberg: aucun résultat' }

    const formats = book.formats ?? {}
    for (const { prefix, type } of FORMAT_PRIORITY) {
      const key = Object.keys(formats).find((k) => k.startsWith(prefix))
      if (key) {
        return {
          result: {
            url: formats[key],
            type,
            titreSource: `${book.title} — Project Gutenberg (domaine public)`,
          },
        }
      }
    }
    return { debug: 'Gutenberg: résultat trouvé mais sans format utilisable' }
  } catch (err) {
    return { debug: `Gutenberg (navigateur): ${describeFetchError(err, 8000)}` }
  }
}

async function queryArchiveOrgClient(query) {
  try {
    const q = encodeURIComponent(query)
    const searchRes = await fetchWithTimeout(
      `https://archive.org/advancedsearch.php?q=${q}&fl[]=identifier&fl[]=title&rows=3&page=1&output=json&mediatype=texts`
    )
    if (!searchRes.ok) return { debug: `Internet Archive HTTP ${searchRes.status}` }
    const searchData = await searchRes.json()
    const docs = searchData.response?.docs ?? []
    if (docs.length === 0) return { debug: null } // pas d'erreur, juste rien trouvé pour cette requête

    for (const doc of docs) {
      const identifier = doc.identifier
      if (!identifier) continue
      const metaRes = await fetchWithTimeout(`https://archive.org/metadata/${identifier}`)
      if (!metaRes.ok) continue
      const meta = await metaRes.json()
      const files = meta.files ?? []
      const pdfFile = files.find(
        (f) => f.name?.toLowerCase().endsWith('.pdf') && f.source === 'original'
      ) ?? files.find((f) => f.name?.toLowerCase().endsWith('.pdf'))

      if (pdfFile) {
        return {
          result: {
            url: `https://archive.org/download/${identifier}/${encodeURIComponent(pdfFile.name)}`,
            type: 'pdf',
            titreSource: `${doc.title ?? query} — Internet Archive`,
          },
        }
      }
    }
    return { debug: `${docs.length} résultat(s) mais aucun PDF` }
  } catch (err) {
    return { debug: `Internet Archive (navigateur): ${describeFetchError(err, 8000)}` }
  }
}

async function searchArchiveOrgClient(auteur, titre) {
  // Expression exacte d'abord (le titre entre guillemets évite que des
  // mots-outils comme "du"/"le" dispersent le classement), puis repli sur
  // le titre seul non cité, puis titre+auteur non cité.
  const attempts = [
    () => queryArchiveOrgClient(`"${titre}"`),
    () => queryArchiveOrgClient(titre),
    () => queryArchiveOrgClient(`${titre} ${auteur}`),
  ]

  const debugs = []
  for (const attempt of attempts) {
    const { result, debug } = await attempt()
    if (result) return { result }
    if (debug) debugs.push(debug)
  }
  return { debug: `Internet Archive: ${debugs.join(' / ') || 'aucun résultat'}` }
}

const SERVER_SEARCH_TIMEOUT_MS = 25000 // le serveur enchaîne plusieurs étapes de recherche

async function requestServerSource(livre) {
  const res = await fetchWithTimeout(
    '/api/find-source',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auteur: livre.auteur,
        titre: livre.titre,
        annee: livre.annee,
        motsClesRecherche: livre.motsClesRecherche,
      }),
    },
    SERVER_SEARCH_TIMEOUT_MS
  )

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw Object.assign(new Error(data.error ?? `Erreur HTTP ${res.status}`), {
      code: data.error,
      status: res.status,
    })
  }

  return res.json()
}

/** Cherche une source lisible/téléchargeable gratuite pour un livre donné.
 * Essaie d'abord Project Gutenberg et Internet Archive depuis le navigateur,
 * puis retombe sur la recherche côté serveur (qui tente aussi Gutenberg et
 * Internet Archive, puis une recherche web grattée en dernier recours). */
export async function findSource(livre) {
  const debugTrail = []

  const gutendex = await searchGutendexClient(livre.auteur, livre.titre)
  if (gutendex.result) return gutendex.result
  if (gutendex.debug) debugTrail.push(gutendex.debug)

  const archive = await searchArchiveOrgClient(livre.auteur, livre.titre)
  if (archive.result) return archive.result
  if (archive.debug) debugTrail.push(archive.debug)

  try {
    const serverResult = await requestServerSource(livre)
    if (serverResult.url) return serverResult
    debugTrail.push(serverResult.raison)
  } catch (err) {
    debugTrail.push(`Recherche serveur : ${describeFetchError(err, SERVER_SEARCH_TIMEOUT_MS)}`)
  }

  return {
    url: null,
    raison: debugTrail.filter(Boolean).join(' | ') || 'Aucune source trouvée.',
  }
}

/** Construit l'URL du proxy pour lire un document distant sans être bloqué par le CORS. */
export function proxyUrlFor(remoteUrl) {
  return `/api/proxy-pdf?url=${encodeURIComponent(remoteUrl)}`
}
