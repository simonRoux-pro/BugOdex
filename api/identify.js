const CATEGORY_MAP = {
  Insecta: 'insecte', Arachnida: 'arachnide', Aves: 'oiseau',
  Mammalia: 'mammifère', Reptilia: 'reptile', Amphibia: 'amphibien',
  Actinopterygii: 'poisson', Malacostraca: 'crustacé', Gastropoda: 'mollusque',
}
const EMOJI_MAP = {
  insecte: '🦋', arachnide: '🕷️', oiseau: '🐦', mammifère: '🦊',
  reptile: '🦎', amphibien: '🐸', poisson: '🐟', crustacé: '🦀',
  mollusque: '🐌', autre: '🐾',
}
const IUCN_LABEL = {
  LC: 'Préoccupation mineure', NT: 'Quasi menacé', VU: 'Vulnérable',
  EN: 'En danger', CR: 'En danger critique', EW: 'Éteint à l\'état sauvage',
  EX: 'Éteint', DD: 'Données insuffisantes', NE: 'Non évalué',
}

/** Envoie l'image à l'API iNaturalist Computer Vision. */
async function scoreImage(token, base64Image, mimeType) {
  const boundary = 'BugOdex' + Date.now()
  const imageBuffer = Buffer.from(base64Image, 'base64')
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="image"; filename="photo.jpg"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
    ),
    imageBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])

  const res = await fetch('https://api.inaturalist.org/v1/computervision/score_image', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw Object.assign(
      new Error(data.error ?? `iNaturalist CV HTTP ${res.status}`),
      { status: res.status }
    )
  }
  return res.json()
}

/** Récupère les détails complets d'un taxon (ancêtres, statut, résumé Wikipedia). */
async function getTaxon(token, taxonId) {
  const res = await fetch(
    `https://api.inaturalist.org/v1/taxa/${taxonId}?locale=fr`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  )
  if (!res.ok) return null
  const data = await res.json()
  return data.results?.[0] ?? null
}

/** Construit l'objet espèce à partir des données iNaturalist. */
function buildSpecies(topResult, taxon) {
  const score = topResult.combined_score ?? 0
  const ancestors = taxon?.ancestors ?? []

  const find = (rank) => ancestors.find((a) => a.rank === rank)?.name ?? null

  const iconicName = topResult.taxon?.iconic_taxon_name ?? ''
  const category = CATEGORY_MAP[iconicName] ?? 'autre'

  // Statut de conservation (premier statut IUCN trouvé)
  const iucnCode = taxon?.conservation_statuses?.find((s) => s.iucn)?.[
    'iucn'
  ] ?? 'NE'

  // Photo officielle
  const photo =
    taxon?.taxon_photos?.[0]?.photo ??
    topResult.taxon?.default_photo ??
    null
  const officialImageUrl = photo?.medium_url ?? null

  return {
    isAnimal: true,
    confidence: score > 0.65 ? 'high' : score > 0.35 ? 'medium' : 'low',
    commonName:
      topResult.taxon?.preferred_common_name ??
      topResult.taxon?.name ??
      'Espèce inconnue',
    scientificName: topResult.taxon?.name ?? '',
    family: find('family'),
    order: find('order'),
    class: find('class') ?? iconicName ?? null,
    description: taxon?.wikipedia_summary ?? null,
    habitat: null,
    diet: null,
    funFacts: [],
    conservationStatus: iucnCode,
    conservationLabel: IUCN_LABEL[iucnCode] ?? 'Non évalué',
    emoji: EMOJI_MAP[category] ?? '🐾',
    category,
    // Transmis directement au client pour éviter un second fetch
    _officialImageUrl: officialImageUrl,
    _wikiUrl: topResult.taxon?.wikipedia_url ?? null,
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = process.env.INAT_TOKEN
  if (!token) return res.status(500).json({ error: 'NO_API_KEY' })

  const { base64Image, mimeType = 'image/jpeg' } = req.body ?? {}
  if (!base64Image) return res.status(400).json({ error: 'Missing base64Image' })

  try {
    console.log('Calling iNaturalist CV API…')
    const scoreData = await scoreImage(token, base64Image, mimeType)
    const topResult = scoreData.results?.[0]

    if (!topResult || (topResult.combined_score ?? 0) < 0.05) {
      return res.status(422).json({ error: 'NOT_AN_ANIMAL' })
    }

    console.log(`Top match: ${topResult.taxon?.name} (score ${topResult.combined_score})`)

    // Détails complets du taxon
    const taxonDetails = await getTaxon(token, topResult.taxon?.id)
    const species = buildSpecies(topResult, taxonDetails)

    console.log('✓ Success:', species.scientificName)
    return res.status(200).json(species)
  } catch (err) {
    console.error('iNaturalist error:', err.message)
    if (err.status === 401) {
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        detail: 'Token iNaturalist invalide ou expiré. Régénère-le sur inaturalist.org/users/api_token',
      })
    }
    return res.status(500).json({ error: err.message })
  }
}
