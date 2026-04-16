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
  "funFacts": ["Fait 1", "Fait 2", "Fait 3"],
  "conservationStatus": "LC",
  "conservationLabel": "Préoccupation mineure",
  "emoji": "🐛",
  "category": "insecte"
}

Valeurs pour conservationStatus : LC, NT, VU, EN, CR, EW, EX, DD, NE
Valeurs pour category : insecte, mammifère, oiseau, reptile, amphibien, poisson, arachnide, crustacé, mollusque, autre
Valeurs pour confidence : high, medium, low

Si aucun animal visible, retourne uniquement : {"isAnimal": false}
`.trim()

// Modèles vision sur HuggingFace (gratuits, aucune CB requise)
const HF_MODELS = [
  'Qwen/Qwen2.5-VL-7B-Instruct',
  'meta-llama/Llama-3.2-11B-Vision-Instruct',
  'microsoft/Phi-3.5-vision-instruct',
]

async function callHuggingFace(token, model, base64Image, mimeType) {
  const url = `https://api-inference.huggingface.co/models/${model}/v1/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
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
      max_tokens: 1024,
      temperature: 0.2,
    }),
  })

  const payload = await res.json().catch(() => null)

  if (!res.ok) {
    const raw = payload?.error ?? payload?.message ?? `HTTP ${res.status}`
    const msg = typeof raw === 'string' ? raw : JSON.stringify(raw)
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

  const token = process.env.HF_TOKEN
  if (!token) return res.status(500).json({ error: 'NO_API_KEY' })

  const { base64Image, mimeType = 'image/jpeg' } = req.body ?? {}
  if (!base64Image) return res.status(400).json({ error: 'Missing base64Image' })

  const models = process.env.AI_MODEL ? [process.env.AI_MODEL] : HF_MODELS
  const attempts = []

  for (const model of models) {
    let text = ''
    try {
      console.log(`Trying ${model}…`)
      text = await callHuggingFace(token, model, base64Image, mimeType)
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
