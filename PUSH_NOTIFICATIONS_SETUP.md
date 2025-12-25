# Web Push Notifications Setup Guide

This guide covers setting up Web Push notifications for the Reflect app, including VAPID keys, Supabase Edge Functions, and scheduled jobs.

## Overview

The app supports push notifications for:
- **Morning reminders** at 8:00 AM (user's timezone)
- **Evening reminders** at 8:00 PM (user's timezone)

## Prerequisites

1. Supabase project with Edge Functions enabled
2. VAPID key pair (public/private)
3. Cron job scheduler (Supabase cron or external)

## Step 1: Generate VAPID Keys

VAPID (Voluntary Application Server Identification) keys are required for Web Push.

### Option A: Using web-push npm package

```bash
npm install -g web-push
web-push generate-vapid-keys
```

This will output:
```
Public Key: <your-public-key>
Private Key: <your-private-key>
```

### Option B: Using online generator

Visit: https://web-push-codelab.glitch.me/

Save both keys securely.

## Step 2: Update Environment Variables

### Client-Side (.env file)

Add to your `.env` file:

```env
VITE_VAPID_PUBLIC_KEY=<your-vapid-public-key>
```

**Note:** Only the public key goes in the client. The private key stays server-side.

### Supabase Edge Functions Secrets

In Supabase Dashboard → **Settings** → **Edge Functions** → **Secrets**, add:

1. `VAPID_PUBLIC_KEY` - Your VAPID public key
2. `VAPID_PRIVATE_KEY` - Your VAPID private key
3. `CRON_SECRET` - A random secret string for cron job authentication (generate with: `openssl rand -hex 32`)

## Step 3: Update Database Schema

Run the updated `supabase-schema.sql` which includes the `push_subscriptions` table:

```sql
-- Already included in supabase-schema.sql
-- Just run the full schema file
```

## Step 4: Deploy Supabase Edge Functions

### Install Supabase CLI

```bash
npm install -g supabase
```

### Login and Link Project

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

### Deploy Functions

```bash
# Deploy all functions
supabase functions deploy upsert_subscription
supabase functions deploy send_push
supabase functions deploy send_morning
supabase functions deploy send_evening
```

## Step 5: Set Up Scheduled Jobs

You need to call `send_morning` and `send_evening` every minute to check if it's 8:00 AM/PM in any user's timezone.

### Option A: Supabase Cron (Recommended)

In Supabase Dashboard → **Database** → **Cron Jobs**, create:

**Morning Job:**
```sql
SELECT cron.schedule(
  'send-morning-reminders',
  '* * * * *', -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://<your-project>.supabase.co/functions/v1/send_morning',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
    )
  ) AS request_id;
  $$
);
```

**Evening Job:**
```sql
SELECT cron.schedule(
  'send-evening-reminders',
  '* * * * *', -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://<your-project>.supabase.co/functions/v1/send_evening',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
    )
  ) AS request_id;
  $$
);
```

### Option B: External Cron Service

Use a service like:
- **GitHub Actions** (with scheduled workflows)
- **Cron-job.org**
- **EasyCron**
- **Vercel Cron** (if deploying there)

Configure to call:
- `https://<your-project>.supabase.co/functions/v1/send_morning` (every minute)
- `https://<your-project>.supabase.co/functions/v1/send_evening` (every minute)

With header:
```
Authorization: Bearer <CRON_SECRET>
```

## Step 6: Update send_push Function

**Important:** The current `send_push` implementation is simplified. For production, you should use a proper web-push library.

### Recommended: Use web-push via npm

Update `supabase/functions/send_push/index.ts` to use:

```typescript
import { webpush } from 'https://esm.sh/web-push@3.6.6'

// Then use:
await webpush.sendNotification(
  {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh_key,
      auth: subscription.auth_key,
    },
  },
  JSON.stringify(payload),
  {
    vapidDetails: {
      subject: 'mailto:your-email@example.com',
      publicKey: Deno.env.get('VAPID_PUBLIC_KEY')!,
      privateKey: Deno.env.get('VAPID_PRIVATE_KEY')!,
    },
  }
)
```

## Step 7: Test the Setup

1. **Enable notifications in app:**
   - Open app → Settings
   - Toggle "Morning reminder" or "Evening reminder"
   - Grant notification permission when prompted

2. **Verify subscription:**
   - Check Supabase Dashboard → **Table Editor** → `push_subscriptions`
   - Should see your user's subscription

3. **Test push manually:**
   ```bash
   curl -X POST https://<your-project>.supabase.co/functions/v1/send_push \
     -H "Authorization: Bearer <your-anon-key>" \
     -H "Content-Type: application/json" \
     -d '{
       "subscription_id": "<user-id>",
       "payload": {
         "title": "Test",
         "body": "Test notification",
         "data": {"type": "test"}
       }
     }'
   ```

## Troubleshooting

### Notifications not appearing

1. **Check browser permission:**
   - Browser Settings → Site Settings → Notifications
   - Ensure "Reflect" is allowed

2. **Check service worker:**
   - DevTools → Application → Service Workers
   - Should see `sw.js` registered

3. **Check subscription:**
   - DevTools → Application → Storage → IndexedDB
   - Look for push subscription

4. **Check Supabase logs:**
   - Supabase Dashboard → **Edge Functions** → **Logs**
   - Look for errors in `send_push`, `send_morning`, `send_evening`

### iOS PWA Notifications

iOS 16.4+ supports Web Push for PWAs. Ensure:
- App is installed as PWA (Add to Home Screen)
- Service worker is registered
- User granted notification permission
- VAPID keys are correctly configured

### Timezone Issues

The scheduled functions check each user's timezone. Verify:
- User's timezone is stored correctly in `push_subscriptions.timezone`
- Cron job runs every minute (not just at 8:00 AM/PM UTC)

## Security Notes

- **Never commit** VAPID private key to git
- **Never expose** VAPID private key to client
- Use **CRON_SECRET** to protect scheduled functions
- RLS policies ensure users can only access their own subscriptions

## Files Changed

1. `src/lib/pushNotifications.js` - Push notification service
2. `src/ReflectApp.jsx` - Settings view and notification toggles
3. `public/sw.js` - Service worker for push handling
4. `src/main.jsx` - Service worker registration
5. `public/manifest.json` - Updated for PWA
6. `supabase-schema.sql` - Added `push_subscriptions` table
7. `supabase/functions/upsert_subscription/index.ts` - Store subscriptions
8. `supabase/functions/send_push/index.ts` - Send push notifications
9. `supabase/functions/send_morning/index.ts` - Morning reminder scheduler
10. `supabase/functions/send_evening/index.ts` - Evening reminder scheduler

## Production Checklist

- [ ] VAPID keys generated and stored securely
- [ ] Environment variables set (client and server)
- [ ] Database schema updated
- [ ] Edge Functions deployed
- [ ] Scheduled jobs configured
- [ ] Service worker registered
- [ ] Test notifications working
- [ ] Timezone handling verified
- [ ] Error handling tested
- [ ] iOS PWA tested (if applicable)

