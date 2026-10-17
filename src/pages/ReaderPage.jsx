import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useParcours } from '../hooks/useParcours.js'
import { useBookProgress } from '../hooks/useBookProgress.js'
import { findSource, proxyUrlFor } from '../services/findSource.js'
import PdfViewer from '../components/PdfViewer.jsx'
import NotesPanel from '../components/NotesPanel.jsx'

function SourceIntrouvable({ livre, onRetry, recherche, onManualUrl, raison }) {
  const [manualUrl, setManualUrl] = useState('')
  const googleQuery = encodeURIComponent(`${livre.titre} ${livre.auteur} pdf`)

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="font-serif text-lg">
        {recherche ? 'Aucune source fiable trouvée automatiquement.' : 'Recherche en cours…'}
      </p>
      {recherche && raison && (
        <p className="text-xs text-ink-500 dark:text-ink-400 max-w-md">{raison}</p>
      )}
      {recherche && (
        <>
          <button onClick={onRetry} className="underline text-sm">
            Relancer la recherche
          </button>
          <a
            href={`https://www.google.com/search?q=${googleQuery}`}
            target="_blank"
            rel="noreferrer"
            className="underline text-sm"
          >
            Chercher moi-même sur Google →
          </a>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (manualUrl.trim()) onManualUrl(manualUrl.trim())
            }}
            className="flex gap-2 mt-2 w-full max-w-md"
          >
            <input
              type="url"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              placeholder="Colle ici un lien direct vers un PDF"
              className="flex-1 border border-ink-300 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-50 rounded px-3 py-2 text-sm"
            />
            <button type="submit" className="bg-ink-800 text-ink-50 rounded px-3 py-2 text-sm">
              Utiliser
            </button>
          </form>
        </>
      )}
    </div>
  )
}

/** Lecteur de repli : affiche le PDF directement via le visualiseur natif du
 * navigateur (iframe), en pointant sur l'URL d'origine — exactement ce qui
 * marche déjà quand on ouvre le lien dans un nouvel onglet. Ça ne passe pas
 * par notre proxy ni par pdf.js, donc ça ne peut pas être bloqué par les
 * mêmes restrictions. En contrepartie, pas de suivi automatique de page : on
 * laisse l'utilisateur noter lui-même où il s'est arrêté. */
function LecteurSimplifie({ source, pageMarquee, onPageMarqueeChange, onReessayer, erreur }) {
  const [pageSaisie, setPageSaisie] = useState(String(pageMarquee || 1))

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 dark:text-ink-50 flex-wrap text-sm">
        <div className="flex items-center gap-2">
          <span className="text-ink-500 dark:text-ink-400">Mode simplifié —</span>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const n = Number(pageSaisie)
              if (n > 0) onPageMarqueeChange(n)
            }}
            className="flex items-center gap-1"
          >
            Page actuelle :
            <input
              type="number"
              min="1"
              value={pageSaisie}
              onChange={(e) => setPageSaisie(e.target.value)}
              className="w-14 border border-ink-300 dark:border-ink-600 dark:bg-ink-900 rounded px-1 text-center"
            />
            <button type="submit" className="underline">Enregistrer</button>
          </form>
        </div>
        <div className="flex items-center gap-3">
          <a href={source.url} target="_blank" rel="noreferrer" className="underline">
            Ouvrir dans un nouvel onglet ↗
          </a>
          <button onClick={onReessayer} className="underline">
            Réessayer le lecteur intégré
          </button>
        </div>
      </div>
      {erreur && (
        <p className="text-xs text-ink-500 dark:text-ink-400 px-4 py-1 bg-ink-50 dark:bg-ink-900 border-b border-ink-200 dark:border-ink-700">
          Le lecteur intégré n'a pas pu charger ce document ({erreur}) — affichage direct à la place.
        </p>
      )}
      <iframe
        src={source.url}
        title={source.titreSource || 'Document'}
        className="flex-1 w-full border-0 bg-ink-100 dark:bg-ink-900"
      />
    </div>
  )
}

export default function ReaderPage() {
  const { parcoursId, livreId } = useParams()
  const parcours = useParcours(parcoursId)
  const livre = parcours?.livres.find((l) => l.id === livreId)

  const { progress, setPageMarquee, setZoom, setSource, addNote, deleteNote } =
    useBookProgress(parcoursId, livreId)

  const [recherche, setRecherche] = useState(false)
  const [erreurRecherche, setErreurRecherche] = useState(null)
  const [lecteurSimplifie, setLecteurSimplifie] = useState(false)
  const [erreurLecteur, setErreurLecteur] = useState(null)
  const [tentative, setTentative] = useState(0)

  useEffect(() => {
    // On ne relance la recherche que si on n'a pas encore d'URL utilisable ET
    // qu'aucune tentative n'est déjà en cours/terminée pour ce montage (sinon un
    // résultat "rien trouvé" — un objet source valide mais avec url: null —
    // relancerait la recherche en boucle).
    if (!livre || progress.source?.url || recherche) return
    let cancelled = false
    setErreurRecherche(null)
    findSource(livre)
      .then((result) => {
        if (!cancelled) setSource(result)
      })
      .catch((err) => {
        if (!cancelled) setErreurRecherche(err.message)
      })
      .finally(() => {
        if (!cancelled) setRecherche(true)
      })
    return () => {
      cancelled = true
    }
  }, [livre?.id, progress.source?.url, recherche, setSource]) // eslint-disable-line react-hooks/exhaustive-deps

  // Si la source change (nouvelle recherche, URL manuelle…), on redonne sa
  // chance au lecteur intégré plutôt que de rester bloqué en mode simplifié.
  useEffect(() => {
    setLecteurSimplifie(false)
    setErreurLecteur(null)
  }, [progress.source?.url])

  if (!parcours || !livre) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center">
        <p className="text-ink-600 mb-4">Ce livre est introuvable.</p>
        <Link to="/" className="underline">
          Retour à l'accueil
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800">
        <div className="min-w-0">
          <Link to={`/parcours/${parcoursId}`} className="text-xs text-ink-500 dark:text-ink-400 hover:underline">
            ← {parcours.titre}
          </Link>
          <h1 className="font-serif truncate dark:text-ink-50">
            {livre.titre} <span className="text-ink-500 dark:text-ink-400 font-sans text-sm">— {livre.auteur}</span>
          </h1>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        {erreurRecherche && !progress.source?.url && (
          <div className="flex-1 flex items-center justify-center text-red-600 text-sm p-8">
            {erreurRecherche}
          </div>
        )}

        {!erreurRecherche && !progress.source?.url && (
          <SourceIntrouvable
            livre={livre}
            recherche={recherche}
            raison={progress.source?.raison}
            onRetry={() => {
              setRecherche(false)
              setSource(null)
            }}
            onManualUrl={(url) => setSource({ url, type: 'pdf', titreSource: 'Source manuelle' })}
          />
        )}

        {progress.source?.url && progress.source.type === 'pdf' && lecteurSimplifie && (
          <LecteurSimplifie
            source={progress.source}
            pageMarquee={progress.pageMarquee}
            onPageMarqueeChange={setPageMarquee}
            onReessayer={() => {
              setLecteurSimplifie(false)
              setErreurLecteur(null)
              setTentative((t) => t + 1)
            }}
            erreur={erreurLecteur}
          />
        )}

        {progress.source?.url && progress.source.type === 'pdf' && !lecteurSimplifie && (
          <PdfViewer
            key={tentative}
            fileUrl={proxyUrlFor(progress.source.url)}
            initialPage={progress.pageMarquee}
            initialZoom={progress.zoom}
            onPageChange={setPageMarquee}
            onZoomChange={setZoom}
            onLoadError={(message) => {
              setErreurLecteur(message)
              setLecteurSimplifie(true)
            }}
          />
        )}

        {progress.source?.url && progress.source.type !== 'pdf' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="font-serif text-lg">
              Une source a été trouvée, mais le lecteur intégré ne gère que les PDF pour l'instant.
            </p>
            <p className="text-sm text-ink-500 dark:text-ink-400">{progress.source.titreSource}</p>
            <a
              href={progress.source.url}
              target="_blank"
              rel="noreferrer"
              className="underline text-sm"
            >
              Ouvrir la source dans un nouvel onglet →
            </a>
            <button
              onClick={() => setSource(null)}
              className="text-xs text-ink-500 underline"
            >
              Chercher une autre source
            </button>
          </div>
        )}

        <NotesPanel
          notes={progress.notes}
          onAddNote={addNote}
          onDeleteNote={deleteNote}
          currentPage={progress.pageMarquee}
        />
      </div>
    </div>
  )
}
