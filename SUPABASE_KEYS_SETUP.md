# Supabase Keys Setup - New Format

## ✅ Keys Updated

Your keys are in the **new Supabase format** and have been configured:

- **Publishable Key** (Client-side): `sb_publishable_gf8LCC10Qd32Ou9-UTZXrA_r-rF9EoA`
- **Secret Key** (Server-side): `sb_secret_MtmR4z30Tj9E2suxZn4CVQ_ysp-zvNs`

## Environment Variables Set

### Client (.env file)
```env
VITE_SUPABASE_URL=https://bsoqgfryliphvvmqxryu.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_gf8LCC10Qd32Ou9-UTZXrA_r-rF9EoA
VITE_VAPID_PUBLIC_KEY=  # (Add when you generate VAPID keys)
```

## Supabase Edge Functions Secrets

Go to: **Supabase Dashboard → Settings → Edge Functions → Secrets**

Add these secrets:

1. **SUPABASE_URL**
   ```
   https://bsoqgfryliphvvmqxryu.supabase.co
   ```

2. **SUPABASE_ANON_KEY** or **SUPABASE_PUBLISHABLE_KEY**
   ```
   sb_publishable_gf8LCC10Qd32Ou9-UTZXrA_r-rF9EoA
   ```

3. **SUPABASE_SECRET_KEY** or **SUPABASE_SERVICE_ROLE_KEY**
   ```
   sb_secret_MtmR4z30Tj9E2suxZn4CVQ_ysp-zvNs
   ```

4. **VAPID_PUBLIC_KEY** (Add when you generate VAPID keys)
   ```
   (your-vapid-public-key)
   ```

5. **VAPID_PRIVATE_KEY** (Add when you generate VAPID keys)
   ```
   (your-vapid-private-key)
   ```

6. **CRON_SECRET** (Generate a random secret)
   ```bash
   openssl rand -hex 32
   ```
   Then add the output as `CRON_SECRET`

## Next Steps

### 1. Verify Database Table

1. Go to: https://app.supabase.com/project/bsoqgfryliphvvmqxryu/editor
2. Check **Table Editor** for `push_subscriptions` table
3. If missing, go to **SQL Editor** and run `supabase-schema.sql`

### 2. Deploy Edge Functions

```bash
cd "/Users/aimaanshergill/Downloads/Just 90 Days"

# Install Supabase CLI (if not already)
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref bsoqgfryliphvvmqxryu

# Deploy functions
supabase functions deploy upsert_subscription
supabase functions deploy send_push
supabase functions deploy send_morning
supabase functions deploy send_evening
```

### 3. Test Connection

1. Restart dev server:
   ```bash
   npm run dev
   ```

2. Open app in browser
3. Open DevTools → Console
4. Go to Settings and toggle a notification
5. Check console for errors
6. Check Supabase Dashboard → **Table Editor** → `push_subscriptions` for new rows

## What to Check in Supabase Dashboard

### ✅ Database
- **Table Editor** → `push_subscriptions` table exists
- When you toggle notifications, a row should appear here

### ✅ Edge Functions
- **Edge Functions** → Should see 4 functions after deployment
- Can click each to see logs

### ✅ Settings
- **Settings → API** → Your keys are listed here
- **Settings → Edge Functions → Secrets** → All secrets should be set

## Troubleshooting

### "Subscription not found" errors
- Check if `push_subscriptions` table exists
- Verify RLS policies are set correctly
- Check browser console for auth errors

### Edge Functions not working
- Verify all secrets are set in Supabase Dashboard
- Check Edge Functions logs for errors
- Ensure functions are deployed

### Notifications not appearing
- Check browser notification permissions
- Verify service worker is registered (DevTools → Application → Service Workers)
- Check VAPID keys are set (when you add them)

