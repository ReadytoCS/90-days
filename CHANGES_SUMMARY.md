# Web Push Notifications - Changes Summary

## Files Created

### 1. `src/lib/pushNotifications.js`
- Push notification service with VAPID support
- Functions: `subscribeToPush`, `unsubscribeFromPush`, `getSubscriptionStatus`, `updateNotificationPreferences`
- Handles permission requests and subscription management

### 2. `public/sw.js`
- Service worker for push notification handling
- Handles `push` events to display notifications
- Handles `notificationclick` to open app to correct screen
- Includes caching for offline support

### 3. `supabase/functions/upsert_subscription/index.ts`
- Edge Function to store/update push subscriptions
- Stores endpoint, keys, timezone, and preferences
- Keyed by anonymous user ID

### 4. `supabase/functions/send_push/index.ts`
- Edge Function to send push notifications
- Encrypts payload using Web Push protocol
- **Note:** Current implementation is simplified - should use web-push library for production

### 5. `supabase/functions/send_morning/index.ts`
- Scheduled function for morning reminders (8:00 AM)
- Queries subscriptions with `morning_enabled = true`
- Checks if it's 8:00 AM in each user's timezone
- Calls `send_push` for matching users

### 6. `supabase/functions/send_evening/index.ts`
- Scheduled function for evening reminders (8:00 PM)
- Queries subscriptions with `evening_enabled = true`
- Checks if it's 8:00 PM in each user's timezone
- Calls `send_push` for matching users

## Files Modified

### 1. `src/ReflectApp.jsx`
- Added imports for push notification functions
- Added state: `notifMorning`, `notifEvening`, `pushSupported`, `pushSubscribed`
- Added `Settings` view component with toggles
- Added navigation button to Settings (⚙️ icon)
- Added useEffect to load push notification status
- Added useEffect to handle navigation from notification clicks
- Updated view routing to include `settings`

### 2. `src/main.jsx`
- Added service worker registration
- Added message listener for navigation from notifications
- Handles URL params for deep linking

### 3. `public/manifest.json`
- Added `gcm_sender_id` for push notifications

### 4. `supabase-schema.sql`
- Added `push_subscriptions` table with:
  - `user_id` (UUID, primary key)
  - `endpoint` (TEXT)
  - `p256dh_key` (TEXT)
  - `auth_key` (TEXT)
  - `timezone` (TEXT)
  - `morning_enabled` (BOOLEAN)
  - `evening_enabled` (BOOLEAN)
  - Timestamps
- Added RLS policies
- Added index on timezone
- Added service role policy for scheduled jobs

## Environment Variables

### Client (.env)
```
VITE_VAPID_PUBLIC_KEY=<vapid-public-key>
```

### Supabase Edge Functions Secrets
```
VAPID_PUBLIC_KEY=<vapid-public-key>
VAPID_PRIVATE_KEY=<vapid-private-key>
CRON_SECRET=<random-secret-string>
```

## Database Changes

New table: `push_subscriptions`
- Stores Web Push subscription details
- Links to anonymous user IDs
- Stores timezone and preferences
- Protected by RLS policies

## User Flow

1. User opens Settings
2. Toggles "Morning reminder" or "Evening reminder"
3. If not subscribed, requests notification permission
4. Subscribes to Web Push with VAPID public key
5. Stores subscription in Supabase
6. Scheduled jobs check every minute
7. When it's 8:00 AM/PM in user's timezone, sends push
8. Service worker receives push and displays notification
9. User clicks notification → app opens to correct screen

## Testing Checklist

- [ ] Generate VAPID keys
- [ ] Set environment variables
- [ ] Run updated database schema
- [ ] Deploy Edge Functions
- [ ] Set up scheduled jobs
- [ ] Test subscription in app
- [ ] Test push notification delivery
- [ ] Test notification click navigation
- [ ] Test timezone handling
- [ ] Test on iOS PWA (if applicable)

## Production Notes

1. **send_push function** should use proper web-push library (see PUSH_NOTIFICATIONS_SETUP.md)
2. **Cron jobs** should run every minute (not just at 8:00 AM/PM UTC)
3. **Error handling** should log failures and retry logic
4. **Rate limiting** may be needed for high user counts
5. **Monitoring** should track delivery success rates

