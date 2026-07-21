// Cherche une source lisible/téléchargeable pour un livre donné : d'abord
// Project Gutenberg et Internet Archive (fiables, structurés), puis en
// dernier recours une recherche web générale (DuckDuckGo, sans clé) pour
// couvrir les textes que ces deux bibliothèques n'indexent pas mais qu'une
// simple recherche trouve facilement (éditions universitaires, associations,
// maisons d'édition qui diffusent librement un texte).

const FORMAT_PRIORITY = [
  { prefix: 'application/pdf', type: 'pdf' },
  { prefix: 'application/epub+zip', type: 'epub' },
  { prefix: 'text/html', type: 'html' },
  { prefix: 'text/plain', type: 'texte' },
]

async function searchGutendex(auteur, titre) {
  const q = encodeURIComponent(`${titre} ${auteur}`)
  const res = await fetch(`https://gutendex.com/books?search=${q}`)
  if (!res.ok) return null
  const data = await res.json()
  const book = data.results?.[0]
  if (!book) return null

  const formats = book.formats ?? {}
  for (const { prefix, type } of FORMAT_PRIORITY) {
    const key = Object.keys(formats).find((k) => k.startsWith(prefix))
    if (key) {
      return {
        url: formats[key],
        type,
        titreSource: `${book.title} — Project Gutenberg (domaine public)`,
      }
    }
  }
  return null
}

async function searchArchiveOrg(auteur, titre) {
  const q = encodeURIComponent(`${titre} ${auteur}`)
  const searchRes = await fetch(
    `https://archive.org/advancedsearch.php?q=${q}&fl[]=identifier&fl[]=title&rows=3&page=1&output=json&mediatype=texts`
  )
  if (!searchRes.ok) return null
  const searchData = await searchRes.json()
  const docs = searchData.response?.docs ?? []

  for (const doc of docs) {
    const identifier = doc.identifier
    if (!identifier) continue
    const metaRes = await fetch(`https://archive.org/metadata/${identifier}`)
    if (!metaRes.ok) continue
    const meta = await metaRes.json()
    const files = meta.files ?? []
    const pdfFile = files.find(
      (f) => f.name?.toLowerCase().endsWith('.pdf') && f.source === 'original'
    ) ?? files.find((f) => f.name?.toLowerCase().endsWith('.pdf'))

    if (pdfFile) {
      return {
        url: `https://archive.org/download/${identifier}/${encodeURIComponent(pdfFile.name)}`,
        type: 'pdf',
        titreSource: `${doc.title ?? titre} — Internet Archive`,
      }
    }
  }
  return null
}

/** Décode une URL de résultat DuckDuckGo (souvent enveloppée dans /l/?uddg=...). */
function decodeDuckDuckGoHref(rawHref) {
  // Le href brut extrait du HTML contient encore les entités HTML (ex. &amp;
  // entre les paramètres de la query string) — il faut les résoudre avant de
  // construire une URL, sinon new URL() traite "&amp;autre=..." comme faisant
  // partie de la valeur du paramètre précédent au lieu d'un séparateur.
  const href = rawHref.replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"')
  try {
    const asUrl = new URL(href, 'https://duckduckgo.com')
    const wrapped = asUrl.searchParams.get('uddg')
    if (wrapped) {
      const real = wrapped.startsWith('http') ? wrapped : decodeURIComponent(wrapped)
      return new URL(real).toString()
    }
    return asUrl.protocol.startsWith('http') ? asUrl.toString() : null
  } catch {
    return null
  }
}

async function searchDuckDuckGo(auteur, titre) {
  const query = encodeURIComponent(`${titre} ${auteur} pdf`)
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36',
    },
  })
  if (!res.ok) return null
  const html = await res.text()

  const hrefRe = /class="result__a"[^>]*href="([^"]+)"/g
  const candidates = []
  let match
  while ((match = hrefRe.exec(html)) !== null) {
    const url = decodeDuckDuckGoHref(match[1])
    if (url) candidates.push(url)
  }

  const pdfUrl = candidates.find((u) => /\.pdf(?:[?#]|$)/i.test(u))
  if (pdfUrl) {
    return { url: pdfUrl, type: 'pdf', titreSource: `${titre} — trouvé via recherche web` }
  }
  return null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { auteur, titre } = req.body ?? {}
  if (!auteur || !titre) return res.status(400).json({ error: 'MISSING_FIELDS' })

  try {
    const result = (await searchGutendex(auteur, titre))
      ?? (await searchArchiveOrg(auteur, titre))
      ?? (await searchDuckDuckGo(auteur, titre).catch((err) => {
        console.error('Recherche web (DuckDuckGo) — erreur :', err?.message)
        return null
      }))

    if (!result) {
      return res.status(200).json({
        url: null,
        raison: 'Aucune source trouvée automatiquement (Gutenberg, Internet Archive, recherche web).',
      })
    }

    return res.status(200).json(result)
  } catch (err) {
    console.error('Recherche de source — erreur :', err?.message)
    return res.status(200).json({
      url: null,
      raison: 'La recherche automatique a échoué (service momentanément indisponible).',
    })
  }
}
