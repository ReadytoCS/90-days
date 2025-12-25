import { supabase, isSupabaseConfigured, getUserId, initAuth } from './supabase'

// VAPID public key from environment
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

// Check if push notifications are supported
export const isPushSupported = () => {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// Get user's timezone
export const getUserTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

// Convert VAPID key from base64 URL to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/')
  
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// Request notification permission
export const requestPermission = async () => {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported in this browser')
  }
  
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission denied')
  }
  
  return permission
}

// Subscribe to push notifications
export const subscribeToPush = async () => {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported')
  }
  
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('VAPID public key not configured')
  }
  
  // Request permission first
  await requestPermission()
  
  // Register service worker if not already registered
  let registration = await navigator.serviceWorker.getRegistration()
  if (!registration) {
    registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    })
    // Wait for service worker to be ready
    await navigator.serviceWorker.ready
  }
  
  // Subscribe to push
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  })
  
  // Get subscription details
  const subscriptionData = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
      auth: arrayBufferToBase64(subscription.getKey('auth'))
    }
  }
  
    // Store in Supabase via Edge Function (preferred) or direct insert
    if (isSupabaseConfigured()) {
      const userId = await getUserId()
      if (!userId) {
        // Try to initialize auth
        const initUserId = await initAuth()
        if (!initUserId) {
          throw new Error('User not authenticated')
        }
      }
      
      const finalUserId = await getUserId()
      const timezone = getUserTimezone()
      const currentPrefs = await getNotificationPreferences()
      
      // Try Edge Function first
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const { data: { session } } = await supabase.auth.getSession()
      
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/upsert_subscription`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${supabaseKey}`,
            'apikey': supabaseKey
          },
          body: JSON.stringify({
            endpoint: subscriptionData.endpoint,
            keys: subscriptionData.keys,
            timezone: timezone,
            morning_enabled: currentPrefs.morning || false,
            evening_enabled: currentPrefs.evening || false
          })
        })
        
        if (response.ok) {
          const result = await response.json()
          console.log('Subscription stored via Edge Function:', result)
        } else {
          throw new Error(`Edge Function failed: ${response.status}`)
        }
      } catch (edgeError) {
        console.warn('Edge Function not available, using direct insert:', edgeError)
        // Fallback to direct insert
        const { error } = await supabase
          .from('push_subscriptions')
          .upsert({
            user_id: finalUserId,
            endpoint: subscriptionData.endpoint,
            p256dh_key: subscriptionData.keys.p256dh,
            auth_key: subscriptionData.keys.auth,
            timezone: timezone,
            morning_enabled: currentPrefs.morning || false,
            evening_enabled: currentPrefs.evening || false,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          })
        
        if (error) {
          console.error('Error storing subscription:', error)
          throw error
        }
      }
    }
  
  return subscription
}

// Unsubscribe from push notifications
export const unsubscribeFromPush = async () => {
  if (!isPushSupported()) {
    return
  }
  
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) {
    return
  }
  
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) {
    await subscription.unsubscribe()
  }
  
  // Remove from Supabase
  if (isSupabaseConfigured()) {
    const userId = await getUserId()
    if (userId) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
    }
  }
}

// Check current subscription status
export const getSubscriptionStatus = async () => {
  if (!isPushSupported()) {
    return { subscribed: false, permission: 'denied' }
  }
  
  const permission = Notification.permission
  if (permission !== 'granted') {
    return { subscribed: false, permission }
  }
  
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) {
    return { subscribed: false, permission }
  }
  
  const subscription = await registration.pushManager.getSubscription()
  return {
    subscribed: !!subscription,
    permission,
    endpoint: subscription?.endpoint
  }
}

// Update notification preferences
export const updateNotificationPreferences = async (morningEnabled, eveningEnabled) => {
  if (!isSupabaseConfigured()) {
    // Store locally if Supabase not configured
    localStorage.setItem('notif_morning', morningEnabled ? 'true' : 'false')
    localStorage.setItem('notif_evening', eveningEnabled ? 'true' : 'false')
    return
  }
  
  const userId = await getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }
  
  const { error } = await supabase
    .from('push_subscriptions')
    .update({
      morning_enabled: morningEnabled,
      evening_enabled: eveningEnabled,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
  
  if (error) {
    console.error('Error updating preferences:', error)
    throw error
  }
}

// Get notification preferences
export const getNotificationPreferences = async () => {
  if (!isSupabaseConfigured()) {
    return {
      morning: localStorage.getItem('notif_morning') === 'true',
      evening: localStorage.getItem('notif_evening') === 'true'
    }
  }
  
  const userId = await getUserId()
  if (!userId) {
    return { morning: false, evening: false }
  }
  
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('morning_enabled, evening_enabled')
    .eq('user_id', userId)
    .single()
  
  if (error || !data) {
    return { morning: false, evening: false }
  }
  
  return {
    morning: data.morning_enabled || false,
    evening: data.evening_enabled || false
  }
}

// Helper: Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

// Send test push notification
export const sendTestPush = async () => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured')
  }
  
  const userId = await getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const { data: { session } } = await supabase.auth.getSession()
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send_push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${supabaseKey}`,
        'apikey': supabaseKey
      },
      body: JSON.stringify({
        subscription_id: userId,
        payload: {
          title: 'Reflect - Test',
          body: 'This is a test notification!',
          tag: 'test-notification',
          data: {
            type: 'test',
            url: '/?view=home'
          }
        }
      })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `Push failed: ${response.statusText}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error sending test push:', error)
    throw error
  }
}

