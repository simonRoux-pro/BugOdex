import { Link } from 'react-router-dom'

export default function Navbar() {
  return (
    <header className="bg-ink-900 text-ink-50 px-4 py-3 flex items-center justify-between shadow">
      <Link to="/" className="font-serif text-lg tracking-wide">
        📖 Parcours de Lecture
      </Link>
    </header>
  )
}
