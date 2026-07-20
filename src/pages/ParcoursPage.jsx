import { Link, useParams } from 'react-router-dom'
import { useParcours } from '../hooks/useParcours.js'
import BookCard from '../components/BookCard.jsx'

export default function ParcoursPage() {
  const { parcoursId } = useParams()
  const parcours = useParcours(parcoursId)

  if (!parcours) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center">
        <p className="text-ink-600 mb-4">Ce parcours est introuvable.</p>
        <Link to="/" className="underline">
          Retour à l'accueil
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link to="/" className="text-sm text-ink-500 hover:underline">
        ← Tous mes parcours
      </Link>
      <h1 className="font-serif text-3xl mt-2 mb-1 dark:text-ink-50">{parcours.titre}</h1>
      <p className="text-ink-600 dark:text-ink-300 mb-8">{parcours.sousTitre}</p>

      <div className="space-y-3">
        {parcours.livres.map((livre) => (
          <BookCard key={livre.id} parcoursId={parcours.id} livre={livre} />
        ))}
      </div>
    </div>
  )
}
