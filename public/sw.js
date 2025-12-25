// Service Worker for Push Notifications
const CACHE_NAME = 'reflect-v1'
const STATIC_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_CACHE)
    })
  )
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  return self.clients.claim()
})

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'Reflect',
    body: 'You have a reminder',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'reflect-notification',
    requireInteraction: false,
    data: {}
  }
  
  if (event.data) {
    try {
      const payload = event.data.json()
      notificationData.title = payload.title || notificationData.title
      notificationData.body = payload.body || notificationData.body
      notificationData.data = payload.data || {}
      notificationData.tag = payload.tag || notificationData.tag
    } catch (e) {
      // If not JSON, use text
      notificationData.body = event.data.text()
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      data: notificationData.data,
      requireInteraction: notificationData.requireInteraction,
      vibrate: [200, 100, 200],
      actions: notificationData.data.action ? [
        {
          action: notificationData.data.action,
          title: notificationData.data.actionTitle || 'Open'
        }
      ] : []
    })
  )
})

// Notification click event - open app to correct screen
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  
  const notificationData = event.notification.data || {}
  const action = event.action || notificationData.action
  
  // Determine which screen to open based on action or type
  let url = '/'
  if (action === 'morning' || notificationData.type === 'morning') {
    url = '/?view=morning'
  } else if (action === 'evening' || notificationData.type === 'evening') {
    url = '/?view=evening'
  } else if (notificationData.url) {
    url = notificationData.url
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it and navigate
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i]
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => {
            // Send message to navigate
            const view = url.includes('view=morning') ? 'morning' : url.includes('view=evening') ? 'evening' : null
            if (view) {
              client.postMessage({ type: 'navigate', view })
            }
            // Also update URL
            client.navigate?.(url) || (client.url = url)
          })
        }
      }
      // Otherwise, open new window
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})

// Message event - handle messages from main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request)
    })
  )
})

