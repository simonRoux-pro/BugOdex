import Anthropic from '@anthropic-ai/sdk'

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

export async function identifyAnimal(base64Image, mimeType = 'image/jpeg') {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('NO_API_KEY')
  }

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  })

  const model = import.meta.env.VITE_AI_MODEL
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64Image },
          },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
  })

  const raw = response.content[0].text.trim()
  // Nettoie d'éventuels backticks markdown
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  const result = JSON.parse(cleaned)

  if (!result.isAnimal) {
    throw new Error('NOT_AN_ANIMAL')
  }
  return result
}
