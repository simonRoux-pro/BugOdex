import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useParcoursList } from '../hooks/useParcours.js'
import { generateParcours } from '../services/generateParcours.js'
import LoadingScreen from '../components/LoadingScreen.jsx'

const ERROR_MESSAGES = {
  MISSING_THEME: 'Merci de préciser un thème.',
  THEME_TOO_LONG: 'Ce thème est trop long, essaie de le résumer.',
  NO_API_KEY: "La clé API Gemini (GOOGLE_AI_KEY) n'est pas configurée sur ce déploiement.",
  REFUSED: "Gemini n'a pas pu générer de parcours pour ce thème.",
  INCOMPLETE_PARCOURS: 'Le parcours généré était incomplet, réessaie.',
  QUOTA_DEPASSE: "L'API est momentanément saturée après plusieurs tentatives — réessaie dans une minute.",
  GEMINI_ERROR: 'Une erreur est survenue en contactant Gemini.',
}

export default function HomePage() {
  const navigate = useNavigate()
  const { parcoursList, saveParcours, deleteParcours } = useParcoursList()
  const [theme, setTheme] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!theme.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const parcours = await generateParcours(theme.trim())
      saveParcours(parcours)
      navigate(`/parcours/${parcours.id}`)
    } catch (err) {
      setError(ERROR_MESSAGES[err.code] ?? err.message ?? 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingScreen message="Construction de ton parcours de lecture…" />
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="font-serif text-3xl mb-2 dark:text-ink-50">Quel sujet veux-tu maîtriser ?</h1>
      <p className="text-ink-600 dark:text-ink-300 mb-6">
        Donne un thème. Tu recevras un parcours de lecture ordonné — des textes fondateurs
        jusqu'aux plus exigeants — pour te former en profondeur, à ton rythme.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="Ex. Apprendre les bases de l'astrophysique en autodidacte"
          rows={3}
          className="w-full border border-ink-300 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-50 rounded-lg px-4 py-3 font-serif text-lg resize-none focus:outline-none focus:ring-2 focus:ring-ink-500"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={!theme.trim()}
          className="bg-ink-800 text-ink-50 rounded-lg px-6 py-3 font-serif text-lg hover:bg-ink-900 transition disabled:opacity-40"
        >
          Générer mon parcours
        </button>
      </form>

      {parcoursList.length > 0 && (
        <div className="mt-12">
          <h2 className="font-serif text-xl mb-3 dark:text-ink-50">Mes parcours</h2>
          <ul className="space-y-2">
            {parcoursList.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-lg px-4 py-3"
              >
                <button
                  onClick={() => navigate(`/parcours/${p.id}`)}
                  className="text-left flex-1 min-w-0"
                >
                  <p className="font-serif truncate dark:text-ink-50">{p.titre}</p>
                  <p className="text-xs text-ink-500 dark:text-ink-400 truncate">{p.theme}</p>
                </button>
                <button
                  onClick={() => deleteParcours(p.id)}
                  className="text-ink-400 hover:text-red-600 text-sm ml-3"
                  aria-label="Supprimer ce parcours"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
