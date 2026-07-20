// Chaîne de repli : chaque modèle a son propre quota gratuit séparé, donc si le
// premier est momentanément saturé (429), on retente avec le suivant plutôt que
// d'échouer directement.
const MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash']

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.GOOGLE_AI_KEY
  if (!apiKey) return res.status(500).json({ error: 'NO_API_KEY' })

  const theme = (req.body?.theme ?? '').toString().trim()
  if (!theme) return res.status(400).json({ error: 'MISSING_THEME' })
  if (theme.length > 500) return res.status(400).json({ error: 'THEME_TOO_LONG' })

  let lastErr = null

  for (const model of MODELS) {
    try {
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
        throw Object.assign(new Error(errData.error?.message ?? `Gemini HTTP ${geminiRes.status}`), {
          status: geminiRes.status,
        })
      }

      const data = await geminiRes.json()

      if (data.promptFeedback?.blockReason) {
        return res.status(422).json({ error: 'REFUSED' })
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) throw Object.assign(new Error('Réponse vide'), { status: 502 })

      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed.livres) || parsed.livres.length < 10) {
        throw Object.assign(new Error('Parcours incomplet'), { status: 502 })
      }

      return res.status(200).json(parsed)
    } catch (err) {
      console.error(`Gemini error (${model}):`, err?.message)
      lastErr = err
      // Quota atteint sur ce modèle : on tente le suivant, qui a son propre quota.
      if (err.status === 429) continue
      break
    }
  }

  if (lastErr?.status === 429) {
    return res.status(429).json({ error: 'QUOTA_DEPASSE' })
  }
  const status = lastErr?.status && Number.isInteger(lastErr.status) ? lastErr.status : 500
  return res.status(status >= 400 && status < 600 ? status : 500).json({
    error: 'GEMINI_ERROR',
    detail: lastErr?.message ?? 'Erreur inconnue',
  })
}
