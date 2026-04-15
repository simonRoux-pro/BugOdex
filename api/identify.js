import { GoogleGenAI } from '@google/genai'

const PROMPT = `
Analyse cette photo et identifie l'animal, l'insecte, l'arachnide, le reptile, le mammifère ou tout autre animal visible.

Réponds UNIQUEMENT avec un objet JSON valide (sans markdown, sans backticks, sans texte autour). Structure exacte :
{
  "isAnimal": true,
  "confidence": "high",
  "commonName": "Nom commun en français",
  "scientificName": "Nom scientifique binomial",
  "family": "Famille taxonomique",
  "order": "Ordre taxonomique",
  "class": "Classe (Insecta, Mammalia, Aves, Reptilia, Amphibia, Arachnida, etc.)",
  "description": "Description détaillée en 2-3 phrases en français.",
  "habitat": "Description de l'habitat naturel en français.",
  "diet": "Régime alimentaire en français.",
  "funFacts": [
    "Fait intéressant 1",
    "Fait intéressant 2",
    "Fait intéressant 3"
  ],
  "conservationStatus": "LC",
  "conservationLabel": "Préoccupation mineure",
  "emoji": "🐛",
  "category": "insecte"
}

Valeurs autorisées pour conservationStatus : LC, NT, VU, EN, CR, EW, EX, DD, NE
Valeurs autorisées pour category : insecte, mammifère, oiseau, reptile, amphibien, poisson, arachnide, crustacé, mollusque, autre
Valeurs autorisées pour confidence : high, medium, low

Si aucun animal n'est visible ou reconnaissable dans l'image, retourne uniquement :
{"isAnimal": false}
`.trim()

// Modèles à essayer dans l'ordre (du plus récent au plus stable)
const FALLBACK_MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
]

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.GOOGLE_AI_KEY
  if (!apiKey) return res.status(500).json({ error: 'NO_API_KEY' })

  const { base64Image, mimeType = 'image/jpeg' } = req.body ?? {}
  if (!base64Image) return res.status(400).json({ error: 'Missing base64Image' })

  const ai = new GoogleGenAI({ apiKey })
  const models = process.env.AI_MODEL
    ? [process.env.AI_MODEL]
    : FALLBACK_MODELS

  let lastError = null

  for (const modelName of models) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: base64Image } },
              { text: PROMPT },
            ],
          },
        ],
      })

      const raw = response.text.trim()
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      const parsed = JSON.parse(cleaned)

      if (!parsed.isAnimal) return res.status(422).json({ error: 'NOT_AN_ANIMAL' })

      // Retourne aussi le modèle utilisé (utile pour déboguer)
      return res.status(200).json({ ...parsed, _model: modelName })
    } catch (err) {
      lastError = err
      // 404 = modèle inexistant → essaie le suivant
      // 429 avec limit 0 = pas de quota → essaie le suivant
      const msg = err.message ?? ''
      if (msg.includes('404') || (msg.includes('429') && msg.includes('limit: 0'))) {
        continue
      }
      // Autre erreur (réseau, JSON invalide…) → on arrête
      break
    }
  }

  // Tous les modèles ont échoué
  const errMsg = lastError?.message ?? 'Unknown error'
  if (errMsg.includes('limit: 0') || errMsg.includes('quota')) {
    return res.status(429).json({
      error: 'QUOTA',
      detail: 'Aucun modèle Gemini disponible sur le tier gratuit. Vérifie que ta clé vient bien de aistudio.google.com et non de console.cloud.google.com.',
    })
  }
  return res.status(500).json({ error: errMsg })
}
