import { Link, useLocation } from 'react-router-dom'

export default function Navbar({ collectionCount = 0 }) {
  const { pathname } = useLocation()

  return (
    <nav className="sticky top-0 z-50 bg-forest-800 text-white shadow-lg">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <span className="text-2xl">🐛</span>
          <span className="text-forest-200">Bug</span>
          <span className="text-white -ml-1">Odex</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          <NavLink to="/" active={pathname === '/'}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs">Scanner</span>
          </NavLink>

          <NavLink to="/collection" active={pathname.startsWith('/collection')}>
            <div className="relative">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              {collectionCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-forest-400 text-forest-900 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {collectionCount > 99 ? '99+' : collectionCount}
                </span>
              )}
            </div>
            <span className="text-xs">Collection</span>
          </NavLink>
        </div>
      </div>
    </nav>
  )
}

function NavLink({ to, active, children }) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
        active
          ? 'bg-forest-600 text-white'
          : 'text-forest-300 hover:text-white hover:bg-forest-700'
      }`}
    >
      {children}
    </Link>
  )
}
