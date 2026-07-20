// Cherche une source lisible/téléchargeable pour un livre donné : Project
// Gutenberg (via Gutendex) puis Internet Archive.

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { auteur, titre } = req.body ?? {}
  if (!auteur || !titre) return res.status(400).json({ error: 'MISSING_FIELDS' })

  try {
    const result = (await searchGutendex(auteur, titre)) ?? (await searchArchiveOrg(auteur, titre))

    if (!result) {
      return res.status(200).json({
        url: null,
        raison: 'Aucune source gratuite trouvée automatiquement sur Gutenberg ou Internet Archive.',
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
