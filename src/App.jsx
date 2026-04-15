import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import CapturePage    from './pages/CapturePage'
import CollectionPage from './pages/CollectionPage'
import DetailPage     from './pages/DetailPage'
import { useCollection } from './hooks/useCollection'

export default function App() {
  const { collection, addEntry, removeEntry, getEntry } = useCollection()

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar collectionCount={collection.length} />
      <main className="flex-1">
        <Routes>
          <Route path="/"               element={<CapturePage    onAdd={addEntry} />} />
          <Route path="/collection"     element={<CollectionPage collection={collection} />} />
          <Route path="/detail/:id"     element={<DetailPage     getEntry={getEntry} removeEntry={removeEntry} />} />
        </Routes>
      </main>
    </div>
  )
}
