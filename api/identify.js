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

/** Récupère dynamiquement les modèles vision gratuits disponibles sur OpenRouter. */
async function listFreeVisionModels(apiKey) {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })
    if (!res.ok) return []
    const { data } = await res.json()

    const free = (data ?? []).filter((m) => {
      const cost = parseFloat(m.pricing?.prompt ?? '1')
      // Détecte la capacité image via plusieurs champs possibles
      const modality = (m.architecture?.modality ?? '').toLowerCase()
      const inputMods = (m.architecture?.input_modalities ?? [])
      const hasImage = modality.includes('image') ||
                       inputMods.includes('image') ||
                       m.id.includes('vision') ||
                       m.id.includes('vl-') ||
                       m.id.includes('pixtral') ||
                       m.id.includes('llava')
      return cost === 0 && hasImage
    })

    free.sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0))
    const ids = free.slice(0, 6).map((m) => m.id)
    console.log('Free vision models found:', ids)
    return ids
  } catch (e) {
    console.error('Could not list models:', e.message)
    return []
  }
}

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

  // Modèle forcé via env, ou découverte dynamique
  let models
  if (process.env.AI_MODEL) {
    models = [process.env.AI_MODEL]
  } else {
    models = await listFreeVisionModels(apiKey)
    if (models.length === 0) {
      return res.status(500).json({
        error: 'NO_FREE_VISION_MODELS',
        detail: 'Aucun modèle vision gratuit trouvé sur OpenRouter. Vérifie ta clé sur openrouter.ai/keys.',
      })
    }
  }

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

    console.log(`✓ [${model}]`, parsed.scientificName)
    return res.status(200).json({ ...parsed, _model: model })
  }

  console.error('All models failed:', JSON.stringify(attempts))
  return res.status(500).json({ error: 'ALL_MODELS_FAILED', attempts })
}
