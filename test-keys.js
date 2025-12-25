// Quick test to see if these keys work
const SUPABASE_URL = 'https://bsoqgfryliphvvmqxryu.supabase.co'
const PUBLISHABLE_KEY = 'sb_publishable_gf8LCC10Qd32Ou9-UTZXrA_r-rF9EoA'
const SECRET_KEY = 'sb_secret_MtmR4z30Tj9E2suxZn4CVQ_ysp-zvNs'

console.log('Testing keys...')
console.log('URL:', SUPABASE_URL)
console.log('Publishable key format:', PUBLISHABLE_KEY.substring(0, 20) + '...')
console.log('Secret key format:', SECRET_KEY.substring(0, 20) + '...')

// Try a simple API call
fetch(`${SUPABASE_URL}/rest/v1/`, {
  headers: {
    'apikey': PUBLISHABLE_KEY,
    'Authorization': `Bearer ${PUBLISHABLE_KEY}`
  }
})
.then(r => r.text())
.then(text => {
  console.log('Response:', text.substring(0, 200))
})
.catch(e => console.error('Error:', e.message))
