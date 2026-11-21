import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installImageFallback } from './lib/imageFallback.js'

installImageFallback()

if (import.meta.env.PROD) {
  const insights = document.createElement('script')
  insights.src = '/_vercel/insights/script.js'
  insights.defer = true
  insights.dataset.sdk = 'connect767-vite'
  document.head.appendChild(insights)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
