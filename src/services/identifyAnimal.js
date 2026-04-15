export async function identifyAnimal(base64Image, mimeType = 'image/jpeg') {
  const res = await fetch('/api/identify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Image, mimeType }),
  })

  const data = await res.json()

  if (!res.ok) {
    if (data.error === 'NO_API_KEY')     throw new Error('NO_API_KEY')
    if (data.error === 'NOT_AN_ANIMAL') throw new Error('NOT_AN_ANIMAL')
    throw new Error(data.error ?? `HTTP ${res.status}`)
  }

  return data
}
