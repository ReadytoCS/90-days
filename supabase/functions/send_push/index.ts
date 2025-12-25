import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Web Push encryption utilities
async function encrypt(
  userPublicKey: string,
  userAuth: string,
  payload: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!vapidPrivateKey) {
    throw new Error('VAPID_PRIVATE_KEY not set')
  }

  // Convert keys
  const publicKeyBytes = Uint8Array.from(atob(userPublicKey), c => c.charCodeAt(0))
  const authBytes = Uint8Array.from(atob(userAuth), c => c.charCodeAt(0))
  const privateKeyBytes = Uint8Array.from(atob(vapidPrivateKey), c => c.charCodeAt(0))

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // Generate shared secret (simplified - in production use proper ECDH)
  // This is a simplified version - for production, use web-push library
  const sharedSecret = await crypto.subtle.deriveBits(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
      public: await crypto.subtle.importKey(
        'raw',
        publicKeyBytes,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
      ),
    },
    await crypto.subtle.importKey(
      'pkcs8',
      privateKeyBytes,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits']
    ),
    256
  )

  // HKDF to derive encryption key
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    { name: 'HKDF', hash: 'SHA-256' },
    false,
    ['deriveBits']
  )

  const encryptionKey = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt,
      info: new TextEncoder().encode('Content-Encoding: aes128gcm\0'),
    },
    keyMaterial,
    128
  )

  // Encrypt payload (AES-GCM)
  const encoder = new TextEncoder()
  const payloadBytes = encoder.encode(payload)
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await crypto.subtle.importKey(
      'raw',
      encryptionKey,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    ),
    payloadBytes
  )

  return {
    ciphertext: new Uint8Array(encrypted),
    salt,
    serverPublicKey: new Uint8Array(), // VAPID public key
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { subscription_id, payload } = await req.json()
    const authHeader = req.headers.get('Authorization')

    if (!authHeader || !authHeader.includes('Bearer')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use service role or secret key for reading subscriptions
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? ''
    )

    // Get subscription
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', subscription_id)
      .single()

    if (subError || !subscription) {
      throw new Error('Subscription not found')
    }

    // Encrypt payload
    const encrypted = await encrypt(
      subscription.p256dh_key,
      subscription.auth_key,
      JSON.stringify(payload)
    )

    // Send push notification
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'TTL': '86400',
        'Authorization': `vapid t=${Date.now()}, k=${Deno.env.get('VAPID_PUBLIC_KEY')}`,
      },
      body: encrypted.ciphertext,
    })

    if (!response.ok) {
      throw new Error(`Push failed: ${response.statusText}`)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

