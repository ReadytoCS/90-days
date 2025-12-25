import React from 'react'
import ReactDOM from 'react-dom/client'
import ReflectApp from './ReflectApp'

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration.scope)
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error)
      })
  })
  
  // Listen for messages from service worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'navigate') {
      // Handle navigation from notification click
      let view = event.data.view
      if (!view && event.data.url) {
        const url = new URL(event.data.url, window.location.origin)
        view = url.searchParams.get('view')
      }
      if (view) {
        // Dispatch custom event for ReflectApp to handle
        window.dispatchEvent(new CustomEvent('navigate', { detail: { view } }))
      }
    }
  })
  
  // Also listen for service worker controller changes (for iOS PWA)
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'navigate') {
        let view = event.data.view
        if (!view && event.data.url) {
          const url = new URL(event.data.url, window.location.origin)
          view = url.searchParams.get('view')
        }
        if (view) {
          window.dispatchEvent(new CustomEvent('navigate', { detail: { view } }))
        }
      }
    })
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ReflectApp />
)
