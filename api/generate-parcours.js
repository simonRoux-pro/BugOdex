import { getApiKeys } from './_lib/geminiKeys.js'

// On ne fige plus une liste de noms de modèles en dur : Google renomme,
// restreint ("no longer available to new users") ou retire des modèles sans
// préavis, ce qui cassait silencieusement l'app à chaque fois qu'on devinait
// un nom. À la place, pour chaque clé API on interroge l'endpoint ListModels
// de Google pour savoir CE QUE CETTE CLÉ PEUT RÉELLEMENT UTILISER MAINTENANT,
// et on essaie ces modèles-là, dans un ordre de préférence raisonnable.
const FALLBACK_MODEL = 'gemini-2.0-flash' // utilisé seulement si ListModels échoue

const modelListCache = new Map() // clé API -> { models, expiresAt } (cache mémoire du warm start)
const CACHE_TTL_MS = 5 * 60 * 1000

function scoreModelName(name) {
  // Plus le score est bas, plus on essaie ce modèle tôt.
  const excluded = /embedding|aqa|vision|tts|audio|image-generation|imagen|veo|live|gemma/i.test(name)
  if (excluded) return 999
  let score = 100
  if (/flash/i.test(name)) score -= 50 // rapide et moins cher, privilégié
  if (/pro/i.test(name)) score -= 20
  if (/preview|exp|thinking/i.test(name)) score += 30 // moins stable, en dernier recours
  if (/\d+\.\d+/.test(name)) score -= 5 // versions numérotées stables plutôt que "-latest" vague
  return score
}

async function listModelsForKey(apiKey) {
  const cached = modelListCache.get(apiKey)
  if (cached && cached.expiresAt > Date.now()) return cached.models

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    if (!res.ok) throw new Error(`ListModels HTTP ${res.status}`)
    const data = await res.json()
    const models = (data.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .sort((a, b) => scoreModelName(a) - scoreModelName(b))

    modelListCache.set(apiKey, { models, expiresAt: Date.now() + CACHE_TTL_MS })
    return models
  } catch (err) {
    console.error('ListModels a échoué, repli sur le modèle statique:', err?.message)
    return [FALLBACK_MODEL]
  }
}

const PARCOURS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    titre: { type: 'STRING', description: 'Titre court et parlant du parcours' },
    sousTitre: { type: 'STRING', description: "Une phrase décrivant l'objectif pédagogique du parcours" },
    livres: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          ordre: { type: 'INTEGER', description: 'Position dans le parcours, à partir de 1' },
          auteur: { type: 'STRING' },
          titre: { type: 'STRING' },
          annee: { type: 'STRING', description: "Année ou période de publication d'origine" },
          langueOriginale: { type: 'STRING' },
          difficulte: { type: 'STRING', enum: ['facile', 'intermediaire', 'avance'] },
          resumeCourt: { type: 'STRING', description: 'Résumé en 2-3 phrases, en français' },
          pourquoiCetOrdre: {
            type: 'STRING',
            description: "Pourquoi lire ce texte à cette étape précise du parcours (1-2 phrases)",
          },
          motsClesRecherche: {
            type: 'STRING',
            description: "Requête de recherche efficace pour retrouver une version en ligne de ce texte (titre + auteur)",
          },
        },
        required: [
          'ordre', 'auteur', 'titre', 'annee', 'langueOriginale',
          'difficulte', 'resumeCourt', 'pourquoiCetOrdre', 'motsClesRecherche',
        ],
      },
    },
  },
  required: ['titre', 'sousTitre', 'livres'],
}

const SYSTEM_PROMPT = `Tu es un bibliothécaire pédagogue et formateur, spécialiste de la construction de parcours de lecture auto-didactes.

On te donne un thème. Ta mission : construire un parcours de lecture rigoureux d'AU MOINS 10 textes (livres, essais, articles clés, pamphlets…) qui, lus dans l'ordre précis que tu proposes, forment quelqu'un en profondeur et efficacement sur ce thème — en partant de zéro.

Règles impératives :
- Choisis des textes réels, identifiables (auteur et titre exacts), qui existent vraiment — jamais d'œuvres inventées.
- Privilégie, quand c'est pertinent pour le thème, des textes anciens ou classiques tombés dans le domaine public ou largement diffusés gratuitement (cela facilitera la recherche d'une version en ligne), sans sacrifier la pertinence pédagogique.
- Ordonne les textes du plus accessible/fondateur au plus exigeant/théorique, en construisant une progression cohérente (chaque texte doit s'appuyer sur les acquis des précédents).
- Varie les formats si pertinent (texte fondateur, contre-point critique, application concrète, synthèse contemporaine).
- Sois concret et concis dans les résumés et justifications, en français, sans blabla.`

async function tryGenerate(apiKey, model, theme) {
  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: `Thème du parcours : "${theme}"` }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: PARCOURS_SCHEMA,
        },
      }),
    }
  )

  if (!geminiRes.ok) {
    const errData = await geminiRes.json().catch(() => ({}))
    throw Object.assign(new Error(errData.error?.message ?? `HTTP ${geminiRes.status}`), {
      status: geminiRes.status,
    })
  }

  const data = await geminiRes.json()
  const candidate = data.candidates?.[0]

  const BLOCK_REASONS = ['SAFETY', 'PROHIBITED_CONTENT', 'RECITATION', 'SPII', 'BLOCKLIST', 'OTHER']
  if (data.promptFeedback?.blockReason || BLOCK_REASONS.includes(candidate?.finishReason)) {
    throw Object.assign(new Error('Contenu bloqué'), {
      status: 422,
      contentBlock: true,
    })
  }

  const text = candidate?.content?.parts?.[0]?.text
  if (!text) throw Object.assign(new Error('Réponse vide'), { status: 502 })

  const parsed = JSON.parse(text)
  if (!Array.isArray(parsed.livres) || parsed.livres.length < 10) {
    throw Object.assign(new Error('Parcours incomplet'), { status: 502 })
  }

  return parsed
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKeys = getApiKeys()
  if (apiKeys.length === 0) return res.status(500).json({ error: 'NO_API_KEY' })

  const theme = (req.body?.theme ?? '').toString().trim()
  if (!theme) return res.status(400).json({ error: 'MISSING_THEME' })
  if (theme.length > 500) return res.status(400).json({ error: 'THEME_TOO_LONG' })

  const attempts = []
  let anyContentBlock = false
  let anyQuota = false

  for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex += 1) {
    const apiKey = apiKeys[keyIndex]
    const models = await listModelsForKey(apiKey)

    for (const model of models) {
      try {
        const parsed = await tryGenerate(apiKey, model, theme)
        return res.status(200).json(parsed)
      } catch (err) {
        const label = `clé ${keyIndex + 1} / ${model}`
        console.error(`Échec (${label}):`, err?.message)
        attempts.push(`${label}: ${err.message}`)
        if (err.status === 429) anyQuota = true
        if (err.contentBlock) anyContentBlock = true
      }
    }
  }

  // Priorité de diagnostic : un quota atteint sur au moins une tentative est
  // le signal le plus actionnable (réessayer plus tard) ; sinon un blocage de
  // contenu ; sinon le détail complet de chaque tentative, pour ne plus jamais
  // avoir à deviner ce qui s'est passé.
  const fullDetail = attempts.join(' | ')
  if (anyQuota) {
    return res.status(429).json({ error: 'QUOTA_DEPASSE', detail: fullDetail })
  }
  if (anyContentBlock) {
    return res.status(422).json({ error: 'REFUSED', detail: fullDetail })
  }
  return res.status(502).json({
    error: 'GEMINI_ERROR',
    detail: fullDetail || 'Erreur inconnue',
  })
}
