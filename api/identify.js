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

const MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro-latest',
]

async function callGemini(apiKey, model, base64Image, mimeType) {
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`
  const body = {
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: base64Image } },
        { text: PROMPT },
      ],
    }],
    generationConfig: { temperature: 0.2 },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const status = res.status
    const msg = err?.error?.message ?? res.statusText
    throw Object.assign(new Error(msg), { status, raw: err })
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

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

  const models = process.env.AI_MODEL ? [process.env.AI_MODEL] : MODELS
  let lastErr = null

  for (const model of models) {
    try {
      const raw = await callGemini(apiKey, model, base64Image, mimeType)
      const cleaned = raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      const parsed = JSON.parse(cleaned)

      if (!parsed.isAnimal) return res.status(422).json({ error: 'NOT_AN_ANIMAL' })
      return res.status(200).json({ ...parsed, _model: model })
    } catch (err) {
      lastErr = err
      // 404 = modèle absent, 429 limit 0 = pas de quota → essaie le suivant
      if (err.status === 404 || (err.status === 429 && JSON.stringify(err.raw).includes('limit: 0'))) {
        continue
      }
      break
    }
  }

  const msg = lastErr?.message ?? 'Unknown error'
  if (lastErr?.status === 429 || msg.toLowerCase().includes('quota')) {
    return res.status(429).json({
      error: 'QUOTA',
      detail: 'Quota épuisé sur tous les modèles Gemini. Vérifie ta clé sur aistudio.google.com/apikey.',
    })
  }
  return res.status(500).json({ error: msg })
}
