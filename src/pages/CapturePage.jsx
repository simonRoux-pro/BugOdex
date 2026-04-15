import { useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { compressImage, parseDataUrl } from '../utils/imageUtils'
import { identifyAnimal } from '../services/identifyAnimal'
import { fetchOfficialImage } from '../services/fetchOfficialImage'
import LoadingScreen from '../components/LoadingScreen'

export default function CapturePage({ onAdd }) {
  const navigate = useNavigate()
  const fileInputRef   = useRef(null)
  const cameraInputRef = useRef(null)

  const [preview, setPreview]   = useState(null)   // data URL
  const [rawFile, setRawFile]   = useState(null)
  const [loading, setLoading]   = useState(false)
  const [loadMsg, setLoadMsg]   = useState('')
  const [error, setError]       = useState(null)

  /* ---- helpers ---- */

  const handleFile = useCallback(async (file) => {
    if (!file) return
    setError(null)
    const dataUrl = await compressImage(file, 1200, 0.85)
    setPreview(dataUrl)
    setRawFile(file)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (file && file.type.startsWith('image/')) handleFile(file)
  }, [handleFile])

  /* ---- identify ---- */

  const identify = async () => {
    if (!preview) return
    setLoading(true)
    setError(null)

    try {
      // Compresse pour l'API (plus petit = moins de tokens)
      setLoadMsg('Compression de l\'image…')
      const compressed   = await compressImage(rawFile, 900, 0.75)
      const { base64, mimeType } = parseDataUrl(compressed)

      // Identification IA
      setLoadMsg('Identification par IA…')
      const species = await identifyAnimal(base64, mimeType)

      // Image officielle Wikipedia
      setLoadMsg('Recherche de l\'image officielle…')
      const official = await fetchOfficialImage(species.scientificName, species.commonName)

      // Sauvegarde
      const entry = onAdd({
        userPhoto:    preview,
        officialImage: official?.imageUrl ?? null,
        wikiUrl:       official?.wikiUrl  ?? null,
        species,
      })

      navigate(`/detail/${entry.id}`)
    } catch (err) {
      setLoading(false)
      if (err.message === 'NO_API_KEY') {
        setError(
          'Clé API manquante. Crée un fichier .env avec VITE_ANTHROPIC_API_KEY=sk-ant-…\n' +
          'Redémarre ensuite le serveur Vite.'
        )
      } else if (err.message === 'NOT_AN_ANIMAL') {
        setError('Aucun animal reconnu sur cette photo. Essaie avec une autre image !')
      } else {
        setError(`Erreur : ${err.message}`)
      }
    }
  }

  /* ---- render ---- */

  if (loading) return <LoadingScreen message={loadMsg} />

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-forest-50 flex flex-col items-center px-4 py-6 gap-6">
      <div className="w-full max-w-md space-y-2 text-center">
        <h1 className="text-2xl font-bold text-forest-800">Scanner un animal</h1>
        <p className="text-forest-600 text-sm">
          Prends en photo un animal ou un insecte pour obtenir sa fiche d'espèce.
        </p>
      </div>

      {/* Zone de dépôt / prévisualisation */}
      <div
        className={`w-full max-w-md aspect-[4/3] rounded-2xl overflow-hidden border-2 border-dashed transition-colors
          ${preview ? 'border-transparent' : 'border-forest-300 bg-white hover:border-forest-500 cursor-pointer'}`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !preview && fileInputRef.current?.click()}
      >
        {preview ? (
          <div className="relative w-full h-full">
            <img src={preview} alt="Aperçu" className="w-full h-full object-cover" />
            {/* Overlay bouton changer */}
            <button
              onClick={(e) => { e.stopPropagation(); setPreview(null); setRawFile(null) }}
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors"
              title="Changer la photo"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-forest-400 p-6">
            <span className="text-6xl">📷</span>
            <p className="font-medium text-forest-600">Glisse une photo ici</p>
            <p className="text-sm">ou utilise les boutons ci-dessous</p>
          </div>
        )}
      </div>

      {/* Boutons capture */}
      <div className="w-full max-w-md flex gap-3">
        {/* Caméra (mobile) */}
        <button
          onClick={() => cameraInputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 bg-forest-700 hover:bg-forest-600 active:bg-forest-800 text-white font-semibold py-3 rounded-xl transition-colors shadow"
        >
          <span className="text-xl">📷</span>
          <span>Appareil photo</span>
        </button>

        {/* Fichier */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-forest-50 border-2 border-forest-300 hover:border-forest-500 text-forest-700 font-semibold py-3 rounded-xl transition-colors"
        >
          <span className="text-xl">🖼️</span>
          <span>Galerie</span>
        </button>
      </div>

      {/* Inputs cachés */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {/* Erreur */}
      {error && (
        <div className="w-full max-w-md bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 whitespace-pre-wrap">
          {error}
        </div>
      )}

      {/* Bouton identifier */}
      {preview && (
        <button
          onClick={identify}
          className="w-full max-w-md flex items-center justify-center gap-3 bg-forest-600 hover:bg-forest-500 active:bg-forest-700 text-white text-lg font-bold py-4 rounded-2xl transition-colors shadow-lg shadow-forest-600/30"
        >
          <span className="text-2xl">🔍</span>
          Identifier cette espèce
        </button>
      )}

      {/* Tip */}
      <p className="text-xs text-forest-500 text-center max-w-xs">
        Astuce : une photo nette avec l'animal bien visible donnera de meilleurs résultats.
      </p>
    </div>
  )
}
