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

// Modèles vision gratuits sur OpenRouter (marqués :free)
const FREE_MODELS = [
  'google/gemini-2.0-flash-exp:free',
  'qwen/qwen-2.5-vl-72b-instruct:free',
  'meta-llama/llama-3.2-11b-vision-instruct:free',
  'mistralai/pixtral-12b:free',
]

async function callOpenRouter(apiKey, model, base64Image, mimeType) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'BugOdex',
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          { type: 'text', text: PROMPT },
        ],
      }],
      temperature: 0.2,
    }),
  })

  const payload = await res.json().catch(() => null)

  if (!res.ok) {
    const msg = payload?.error?.message ?? `HTTP ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    throw err
  }

  return payload?.choices?.[0]?.message?.content ?? ''
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'NO_API_KEY' })

  const { base64Image, mimeType = 'image/jpeg' } = req.body ?? {}
  if (!base64Image) return res.status(400).json({ error: 'Missing base64Image' })

  const models = process.env.AI_MODEL ? [process.env.AI_MODEL] : FREE_MODELS
  const attempts = []

  for (const model of models) {
    let text = ''
    try {
      text = await callOpenRouter(apiKey, model, base64Image, mimeType)
    } catch (err) {
      attempts.push({ model, error: err.message, status: err.status })
      console.error(`[${model}] ${err.status ?? ''}: ${err.message}`)
      continue
    }

    if (!text) {
      attempts.push({ model, error: 'empty response' })
      console.error(`[${model}] Empty response`)
      continue
    }

    let parsed
    try {
      const cleaned = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      parsed = JSON.parse(cleaned)
    } catch {
      attempts.push({ model, error: `JSON parse failed: ${text.slice(0, 100)}` })
      console.error(`[${model}] JSON parse failed:`, text.slice(0, 100))
      continue
    }

    if (!parsed.isAnimal) return res.status(422).json({ error: 'NOT_AN_ANIMAL' })

    console.log(`[${model}] Success:`, parsed.scientificName)
    return res.status(200).json({ ...parsed, _model: model })
  }

  console.error('All models failed:', JSON.stringify(attempts))
  return res.status(500).json({ error: 'ALL_MODELS_FAILED', attempts })
}
