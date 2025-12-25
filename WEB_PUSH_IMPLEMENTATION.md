# Web Push Implementation - Complete

## Files Changed

### 1. `src/lib/supabase.js`
- ✅ Already uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- ✅ No eyJ validation (accepts any key format)
- ✅ Exports `initAuth` function

### 2. `src/lib/pushNotifications.js`
- ✅ Added `initAuth` import
- ✅ Updated `subscribeToPush()` to:
  - Request permission on user gesture
  - Register service worker at `/sw.js`
  - Wait for `navigator.serviceWorker.ready`
  - Subscribe with VAPID public key
  - Store subscription via Edge Function `upsert_subscription` (with fallback to direct insert)
  - Stores: endpoint, keys.p256dh, keys.auth, timezone
- ✅ Added `sendTestPush()` function to call Edge Function `send_push`

### 3. `src/ReflectApp.jsx`
- ✅ Added `sendTestPush` import
- ✅ Settings component has "Enable notifications" toggles
- ✅ Toggles trigger `subscribeToPush()` on first enable
- ✅ Added "Send test push" button in Settings (only shown when subscribed)
- ✅ Handles navigation from notification clicks via URL params

### 4. `src/main.jsx`
- ✅ Registers service worker at `/sw.js` on app load
- ✅ Listens for messages from service worker for navigation
- ✅ Handles URL params for deep linking

### 5. `public/sw.js`
- ✅ Handles `push` event to show notifications
- ✅ Handles `notificationclick` to open app and route to `/morning` or `/evening`
- ✅ Routes based on payload `data.type` or `action`

## Environment Variables Required

Create `.env.local` file (or update `.env`):

```env
VITE_SUPABASE_URL=https://bsoqgfryliphvvmqxryu.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_gf8LCC10Qd32Ou9-UTZXrA_r-rF9EoA
VITE_VAPID_PUBLIC_KEY=<your-vapid-public-key>
```

**To generate VAPID keys:**
```bash
npm install -g web-push
web-push generate-vapid-keys
```

## How It Works

### 1. User Enables Notifications
- User goes to Settings
- Toggles "Morning reminder" or "Evening reminder"
- Browser requests notification permission (on user gesture)
- Service worker registers at `/sw.js`
- Push subscription created with VAPID key
- Subscription stored in Supabase via Edge Function

### 2. Subscription Storage
- Calls Edge Function: `upsert_subscription`
- Falls back to direct Supabase insert if Edge Function unavailable
- Stores: `endpoint`, `p256dh_key`, `auth_key`, `timezone`, `user_id`

### 3. Test Push
- "Send test push" button in Settings
- Calls Edge Function: `send_push`
- Sends test notification immediately

### 4. Notification Handling
- Service worker receives push event
- Shows notification with title/body
- User clicks notification
- App opens to correct screen (`/morning` or `/evening`)

## iOS PWA Requirements

For iOS PWA (iOS 16.4+):
1. ✅ App must be installed via "Add to Home Screen"
2. ✅ Service worker must be registered
3. ✅ User must grant notification permission
4. ✅ VAPID keys must be configured
5. ✅ HTTPS required (automatic with Supabase)

## Testing Steps

1. **Set environment variables** in `.env.local`
2. **Restart dev server**: `npm run dev`
3. **Open app** in browser (or iOS PWA)
4. **Go to Settings** (⚙️ button)
5. **Toggle a notification** (morning or evening)
6. **Grant permission** when prompted
7. **Check Supabase** → Table Editor → `push_subscriptions` (should see new row)
8. **Click "Send test push"** button
9. **Verify notification appears**
10. **Click notification** → should open to correct screen

## Edge Functions Required

Make sure these Edge Functions are deployed in Supabase:

1. **`upsert_subscription`** - Stores/updates push subscriptions
2. **`send_push`** - Sends push notifications

If Edge Functions are not deployed, the app will fall back to direct Supabase inserts (which also works).

## Troubleshooting

### Notifications not appearing
- Check browser notification permissions
- Verify service worker is registered (DevTools → Application → Service Workers)
- Check VAPID keys are set correctly
- Verify Edge Functions are deployed (or direct insert will be used)

### Subscription not stored
- Check browser console for errors
- Verify Supabase connection (check `.env.local`)
- Check `push_subscriptions` table exists
- Verify RLS policies allow inserts

### iOS PWA not working
- Ensure app is installed via "Add to Home Screen"
- Check iOS version (16.4+ required)
- Verify service worker is registered
- Check notification permission is granted

## Production Checklist

- [ ] VAPID keys generated and set in `.env.local`
- [ ] Edge Functions deployed (or using direct insert)
- [ ] Service worker registered
- [ ] Test push works
- [ ] Notification click routing works
- [ ] iOS PWA tested (if applicable)

