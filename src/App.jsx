import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import HomePage from './pages/HomePage.jsx'
import ParcoursPage from './pages/ParcoursPage.jsx'
import ReaderPage from './pages/ReaderPage.jsx'

export default function App() {
  return (
    <div className="min-h-full flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/parcours/:parcoursId" element={<ParcoursPage />} />
          <Route path="/parcours/:parcoursId/livre/:livreId" element={<ReaderPage />} />
        </Routes>
      </main>
    </div>
  )
}
