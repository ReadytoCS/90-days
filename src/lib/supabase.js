import { createClient } from '@supabase/supabase-js'

// Get Supabase URL and key from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Create Supabase client (will be null if credentials not provided)
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Check if Supabase is configured
export const isSupabaseConfigured = () => !!supabase

// Check if user is authenticated
export const getUserId = async () => {
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id || null
}

// Initialize auth (anonymous or email)
export const initAuth = async () => {
  if (!supabase) return null
  
  // Check if user exists
  const { data: { user } } = await supabase.auth.getUser()
  if (user) return user.id
  
  // Create anonymous user for this device
  const deviceId = localStorage.getItem('device_id') || crypto.randomUUID()
  localStorage.setItem('device_id', deviceId)
  
  // Sign in anonymously
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) {
    console.error('Auth error:', error)
    return null
  }
  
  return data.user?.id || null
}

