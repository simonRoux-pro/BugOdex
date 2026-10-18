import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// Le service worker (registerType: 'autoUpdate') active la nouvelle version
// en tâche de fond, mais sans ça l'onglet déjà ouvert continue d'exécuter le
// vieux JavaScript jusqu'à être rouvert — parfois plusieurs fois de suite.
// En rechargeant dès que le nouveau SW prend le contrôle, une seule
// réouverture de l'app suffit toujours à avoir la dernière version.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
