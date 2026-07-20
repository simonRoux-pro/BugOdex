const RETRY_DELAYS_MS = [3000, 8000] // tentatives supplémentaires si l'API est momentanément saturée

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function requestParcours(theme) {
  const res = await fetch('/api/generate-parcours', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw Object.assign(new Error(data.error ?? `Erreur HTTP ${res.status}`), {
      code: data.error,
      status: res.status,
    })
  }

  return res.json()
}

/** Appelle l'API serverless pour générer un parcours de lecture sur un thème donné.
 * Réessaie automatiquement en cas de saturation momentanée de l'API (429). */
export async function generateParcours(theme) {
  let data
  let lastError

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      data = await requestParcours(theme)
      lastError = null
      break
    } catch (err) {
      lastError = err
      if (err.status !== 429 || attempt === RETRY_DELAYS_MS.length) break
      await sleep(RETRY_DELAYS_MS[attempt])
    }
  }

  if (lastError) throw lastError

  const livres = data.livres
    .slice()
    .sort((a, b) => a.ordre - b.ordre)
    .map((livre) => ({ id: crypto.randomUUID(), ...livre }))

  return {
    id: crypto.randomUUID(),
    theme,
    titre: data.titre,
    sousTitre: data.sousTitre,
    livres,
    creeLe: Date.now(),
  }
}
