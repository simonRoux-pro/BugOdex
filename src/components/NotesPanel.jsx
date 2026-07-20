import { useState } from 'react'

export default function NotesPanel({ notes, onAddNote, onDeleteNote }) {
  const suggestion = notes.length === 0
    ? 'Paragraphe 1'
    : `Paragraphes 1 à ${notes.length + 1}`

  const [portee, setPortee] = useState(suggestion)
  const [texte, setTexte] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!texte.trim()) return
    onAddNote(portee.trim() || suggestion, texte.trim())
    setTexte('')
    setPortee(`Paragraphes 1 à ${notes.length + 2}`)
  }

  return (
    <aside className="w-full md:w-80 shrink-0 border-l border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-900 flex flex-col h-full">
      <div className="p-4 border-b border-ink-200 dark:border-ink-700">
        <h2 className="font-serif text-lg dark:text-ink-50">Mes résumés</h2>
        <p className="text-xs text-ink-600 dark:text-ink-400 mt-1">
          Résume ce que tu as compris, étape par étape : d'abord le paragraphe 1, puis 1+2, puis 1+2+3…
          Ça t'oblige à reformuler et à consolider au fur et à mesure.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {notes.length === 0 && (
          <p className="text-sm text-ink-500 dark:text-ink-400 italic">Pas encore de résumé pour ce texte.</p>
        )}
        {notes.map((note) => (
          <div key={note.id} className="bg-white dark:bg-ink-800 rounded border border-ink-200 dark:border-ink-700 p-3 group relative">
            <p className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1">{note.portee}</p>
            <p className="text-sm whitespace-pre-wrap dark:text-ink-100">{note.texte}</p>
            <button
              onClick={() => onDeleteNote(note.id)}
              className="absolute top-2 right-2 text-ink-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition text-xs"
              aria-label="Supprimer ce résumé"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-ink-200 dark:border-ink-700 space-y-2">
        <input
          type="text"
          value={portee}
          onChange={(e) => setPortee(e.target.value)}
          placeholder="Ex. Paragraphes 1 à 3"
          className="w-full text-xs border border-ink-300 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-50 rounded px-2 py-1"
        />
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="Qu'as-tu compris jusqu'ici ?"
          rows={4}
          className="w-full text-sm border border-ink-300 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-50 rounded px-2 py-1 resize-none"
        />
        <button
          type="submit"
          className="w-full bg-ink-800 text-ink-50 rounded py-1.5 text-sm hover:bg-ink-900 transition"
        >
          Ajouter ce résumé
        </button>
      </form>
    </aside>
  )
}
