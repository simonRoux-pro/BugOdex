import { GoogleGenerativeAI } from '@google/generative-ai'

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

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: process.env.AI_MODEL ?? 'gemini-1.5-flash',
    })

    const result = await model.generateContent([
      { inlineData: { data: base64Image, mimeType } },
      PROMPT,
    ])

    const raw = result.response.text().trim()
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(cleaned)

    if (!parsed.isAnimal) return res.status(422).json({ error: 'NOT_AN_ANIMAL' })

    return res.status(200).json(parsed)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
