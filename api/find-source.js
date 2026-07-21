// Cherche une source lisible/téléchargeable pour un livre donné, dans cet
// ordre : Project Gutenberg, Internet Archive, une recherche Google faite
// PAR GEMINI (grounding — l'appel part de l'infrastructure de Google, pas de
// l'IP du serveur, donc pas soumis aux blocages anti-bot ci-dessous), puis en
// tout dernier recours DuckDuckGo et Bing grattés en HTML. Ces deux derniers
// sont connus pour bloquer les requêtes venant d'IP de datacenter (Vercel)
// sans prévenir — un problème classique du scraping depuis du serverless,
// indépendant du parsing HTML. Chaque étape échouée laisse une trace dans
// "raison" pour diagnostiquer précisément si tout échoue, plutôt que deviner.

import { getApiKeys } from './_lib/geminiKeys.js'

const FORMAT_PRIORITY = [
  { prefix: 'application/pdf', type: 'pdf' },
  { prefix: 'application/epub+zip', type: 'epub' },
  { prefix: 'text/html', type: 'html' },
  { prefix: 'text/plain', type: 'texte' },
]

const BROWSER_UA = 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36'
const GEMINI_SEARCH_MODEL = 'gemini-2.0-flash'

async function searchGutendex(auteur, titre) {
  const q = encodeURIComponent(`${titre} ${auteur}`)
  const res = await fetch(`https://gutendex.com/books?search=${q}`, {
    headers: { 'User-Agent': BROWSER_UA },
  })
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
}

async function queryArchiveOrg(query) {
  const q = encodeURIComponent(query)
  const searchRes = await fetch(
    `https://archive.org/advancedsearch.php?q=${q}&fl[]=identifier&fl[]=title&rows=3&page=1&output=json&mediatype=texts`,
    { headers: { 'User-Agent': BROWSER_UA } }
  )
  if (!searchRes.ok) return { debug: `Internet Archive HTTP ${searchRes.status}` }
  const searchData = await searchRes.json()
  const docs = searchData.response?.docs ?? []
  if (docs.length === 0) return { debug: null } // pas d'erreur, juste rien trouvé pour cette requête

  for (const doc of docs) {
    const identifier = doc.identifier
    if (!identifier) continue
    const metaRes = await fetch(`https://archive.org/metadata/${identifier}`, {
      headers: { 'User-Agent': BROWSER_UA },
    })
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
}

async function searchArchiveOrg(auteur, titre) {
  // Requête précise d'abord, puis repli sur le titre seul (une requête trop
  // longue/spécifique — titre + auteur(s) — peut ne rien matcher alors que
  // le titre seul trouve l'édition numérisée).
  const precise = await queryArchiveOrg(`${titre} ${auteur}`)
  if (precise.result) return precise
  const broad = await queryArchiveOrg(titre)
  if (broad.result) return broad
  const debug = [precise.debug, broad.debug].filter(Boolean).join(' / ')
  return { debug: `Internet Archive: ${debug || 'aucun résultat'}` }
}

/** Demande à Gemini de chercher lui-même un lien PDF direct (recherche Google
 * exécutée côté Google, donc jamais bloquée pour "IP de datacenter"). */
async function searchViaGeminiGrounding(auteur, titre) {
  const apiKeys = getApiKeys()
  if (apiKeys.length === 0) return { debug: 'Gemini+recherche: pas de clé API' }

  const prompt = `Cherche sur le web un lien direct vers un fichier PDF téléchargeable de ce texte :
Titre : ${titre}
Auteur : ${auteur}

Réponds UNIQUEMENT par l'URL directe du PDF (elle doit commencer par http:// ou https:// et se terminer par .pdf), sans aucun autre texte, aucune explication. Si tu ne trouves vraiment aucun lien PDF direct fiable, réponds exactement : NONE`

  for (const apiKey of apiKeys) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_SEARCH_MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
          }),
        }
      )
      if (!res.ok) continue

      const data = await res.json()
      const text = (data.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p.text)
        .filter(Boolean)
        .join(' ')
      const match = text.match(/https?:\/\/\S+?\.pdf\b/i)
      if (match) {
        return {
          result: { url: match[0], type: 'pdf', titreSource: `${titre} — trouvé via recherche Google (Gemini)` },
        }
      }
    } catch {
      // clé suivante
    }
  }
  return { debug: 'Gemini+recherche Google: aucun lien PDF trouvé' }
}

function decodeHtmlEntities(str) {
  return str.replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"')
}

/** Décode une URL de résultat DuckDuckGo (souvent enveloppée dans /l/?uddg=...). */
function decodeDuckDuckGoHref(rawHref) {
  const href = decodeHtmlEntities(rawHref)
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

/** Filet de sécurité indépendant du balisage : cherche n'importe quelle URL
 * ".pdf" directement dans le HTML brut. Résiste aux changements de classes
 * CSS ou de structure d'un moteur de recherche. */
function findRawPdfUrls(html) {
  const matches = html.match(/https?:\/\/[^\s"'<>()]+\.pdf(?:[?#][^\s"'<>()]*)?/gi) ?? []
  return matches.map(decodeHtmlEntities)
}

async function searchDuckDuckGo(query) {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': BROWSER_UA },
  })
  if (!res.ok) return { debug: `DuckDuckGo HTTP ${res.status}` }
  const html = await res.text()

  const hrefRe = /class="result__a"[^>]*href="([^"]+)"/g
  const structured = []
  let match
  while ((match = hrefRe.exec(html)) !== null) {
    const url = decodeDuckDuckGoHref(match[1])
    if (url) structured.push(url)
  }

  const pdfUrl = structured.find((u) => /\.pdf(?:[?#]|$)/i.test(u)) ?? findRawPdfUrls(html)[0]
  if (pdfUrl) {
    return { result: { url: pdfUrl, type: 'pdf', titreSource: 'Trouvé via recherche web (DuckDuckGo)' } }
  }
  return { debug: `DuckDuckGo: ${structured.length} lien(s) mais aucun .pdf` }
}

async function searchBing(query) {
  const res = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': BROWSER_UA },
  })
  if (!res.ok) return { debug: `Bing HTTP ${res.status}` }
  const html = await res.text()

  const hrefRe = /<li class="b_algo">[\s\S]{0,400}?<a[^>]+href="([^"]+)"/g
  const structured = []
  let match
  while ((match = hrefRe.exec(html)) !== null) {
    structured.push(decodeHtmlEntities(match[1]))
  }

  const pdfUrl = structured.find((u) => /\.pdf(?:[?#]|$)/i.test(u)) ?? findRawPdfUrls(html)[0]
  if (pdfUrl) {
    return { result: { url: pdfUrl, type: 'pdf', titreSource: 'Trouvé via recherche web (Bing)' } }
  }
  return { debug: `Bing: ${structured.length} lien(s) mais aucun .pdf` }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { auteur, titre } = req.body ?? {}
  if (!auteur || !titre) return res.status(400).json({ error: 'MISSING_FIELDS' })

  const debugTrail = []
  const searchQuery = `${titre} ${auteur} pdf`

  const stages = [
    () => searchGutendex(auteur, titre),
    () => searchArchiveOrg(auteur, titre),
    () => searchViaGeminiGrounding(auteur, titre),
    () => searchDuckDuckGo(searchQuery),
    () => searchBing(searchQuery),
  ]

  try {
    for (const stage of stages) {
      const { result, debug } = await stage().catch((err) => ({ debug: `erreur: ${err?.message}` }))
      if (result) return res.status(200).json(result)
      if (debug) debugTrail.push(debug)
    }

    return res.status(200).json({
      url: null,
      raison: `Aucune source trouvée automatiquement. Détail : ${debugTrail.join(' | ')}`,
    })
  } catch (err) {
    console.error('Recherche de source — erreur :', err?.message)
    return res.status(200).json({
      url: null,
      raison: `La recherche automatique a échoué : ${err?.message ?? 'erreur inconnue'}`,
    })
  }
}
