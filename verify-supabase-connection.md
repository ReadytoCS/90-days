# Verify Supabase Connection for Push Notifications

## What to Check in Supabase Dashboard

### 1. Database Table (NOT files)

Go to: **Supabase Dashboard → Table Editor**

You should see a table called `push_subscriptions`. If you don't see it:

**Run this SQL in Supabase SQL Editor:**

```sql
-- Check if table exists
SELECT * FROM information_schema.tables 
WHERE table_name = 'push_subscriptions';

-- If it doesn't exist, run the full schema
-- Copy and paste the entire supabase-schema.sql file
```

### 2. Edge Functions (Need to be deployed)

Go to: **Supabase Dashboard → Edge Functions**

You should see 4 functions:
- `upsert_subscription`
- `send_push`
- `send_morning`
- `send_evening`

**If they're not there, you need to deploy them** (see below).

### 3. Check Your Environment Variables

Your `.env` file has:
- ✅ `VITE_SUPABASE_URL` - Set
- ✅ `VITE_SUPABASE_ANON_KEY` - Set (but this might be wrong format - see below)
- ❓ `VITE_VAPID_PUBLIC_KEY` - Not set yet (needed for push)

## Potential Issues

### Issue 1: Wrong API Key Format

Your key `sb_publishable_gf8LCC10Qd32Ou9-UTZXrA_r-rF9EoA` looks like it might be a publishable key, not the anon key.

**To get the correct anon key:**
1. Go to Supabase Dashboard → **Settings** → **API**
2. Under **Project API keys**, find **anon** or **public** key
3. It should look like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (a JWT token)
4. Update your `.env` file with the correct key

### Issue 2: Database Schema Not Run

The `push_subscriptions` table might not exist. Check and run the schema.

### Issue 3: Edge Functions Not Deployed

The Edge Functions need to be deployed to Supabase. They're not automatically there.

## Quick Test

Open your browser console (F12) and run:

```javascript
// Check if Supabase is configured
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Missing')

// Try to connect
import { supabase, isSupabaseConfigured } from './lib/supabase'
console.log('Supabase configured:', isSupabaseConfigured())
```

## Next Steps

1. **Verify database table exists**
2. **Check API key format**
3. **Deploy Edge Functions** (if not done)
4. **Test subscription in app**

