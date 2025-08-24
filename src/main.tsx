import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const root = createRoot(document.getElementById('root')!)
root.render(<App />)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = new URL('sw.js', import.meta.env.BASE_URL).toString()
    navigator.serviceWorker.register(swUrl, { scope: import.meta.env.BASE_URL })
      .catch((e) => console.warn('SW registration failed', e))
  })
}
