/**
 * Compresse une image via canvas avant stockage.
 * Limite la largeur à maxWidth px et applique une qualité JPEG.
 */
export function compressImage(file, maxWidth = 900, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const ratio = Math.min(maxWidth / img.width, 1)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * ratio)
      canvas.height = Math.round(img.height * ratio)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Canvas toBlob failed')); return }
          const reader = new FileReader()
          reader.onload  = () => resolve(reader.result)   // data:image/jpeg;base64,...
          reader.onerror = reject
          reader.readAsDataURL(blob)
        },
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')) }
    img.src = objectUrl
  })
}

/** Extrait le base64 pur (sans le préfixe data:…;base64,) et le mime type. */
export function parseDataUrl(dataUrl) {
  const [header, data] = dataUrl.split(',')
  const mimeType = header.match(/:(.*?);/)[1]
  return { base64: data, mimeType }
}
