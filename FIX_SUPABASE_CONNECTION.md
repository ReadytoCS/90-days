# Fix Supabase Connection for Push Notifications

## ⚠️ Issue: API Key Format

Your current API key format (`sb_publishable_...`) is **not** the standard Supabase anon key.

## Step 1: Get the Correct API Key

1. Go to: https://app.supabase.com/project/bsoqgfryliphvvmqxryu/settings/api
2. Under **Project API keys**, find:
   - **anon** or **public** key
   - It should look like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzb3FnZnJ5bGlwaHZ2bXF4cnl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTgwMDAwMDAwMH0...`
3. Copy that key

## Step 2: Update .env File

Update your `.env` file:

```env
VITE_SUPABASE_URL=https://bsoqgfryliphvvmqxryu.supabase.co
VITE_SUPABASE_ANON_KEY=<paste-the-correct-anon-key-here>
```

## Step 3: Verify Database Table Exists

1. Go to: https://app.supabase.com/project/bsoqgfryliphvvmqxryu/editor
2. Look for **Table Editor** in the left sidebar
3. Check if you see `push_subscriptions` table

**If the table doesn't exist:**

1. Go to **SQL Editor**
2. Click **New Query**
3. Copy and paste the **entire** `supabase-schema.sql` file
4. Click **Run**

## Step 4: Check Edge Functions

1. Go to: https://app.supabase.com/project/bsoqgfryliphvvmqxryu/functions
2. You should see 4 functions:
   - `upsert_subscription`
   - `send_push`
   - `send_morning`
   - `send_evening`

**If they don't exist, you need to deploy them** (see below).

## Step 5: Deploy Edge Functions

### Install Supabase CLI

```bash
npm install -g supabase
```

### Login

```bash
supabase login
```

### Link Your Project

```bash
cd "/Users/aimaanshergill/Downloads/Just 90 Days"
supabase link --project-ref bsoqgfryliphvvmqxryu
```

### Deploy Functions

```bash
supabase functions deploy upsert_subscription
supabase functions deploy send_push
supabase functions deploy send_morning
supabase functions deploy send_evening
```

## Step 6: Test the Connection

1. Restart your dev server:
   ```bash
   npm run dev
   ```

2. Open the app in browser
3. Open DevTools → Console
4. Go to Settings and toggle a notification
5. Check console for errors
6. Go to Supabase Dashboard → **Table Editor** → `push_subscriptions`
7. You should see a row with your subscription

## What You Should See in Supabase

### ✅ Database (Table Editor)
- Table: `push_subscriptions`
- Columns: `user_id`, `endpoint`, `p256dh_key`, `auth_key`, `timezone`, `morning_enabled`, `evening_enabled`

### ✅ Edge Functions
- 4 functions listed
- Can click to see logs

### ❌ NOT "Files"
- Supabase doesn't store files for this
- Everything is in the database or Edge Functions

## Quick Verification Script

After updating your `.env` file, test in browser console:

```javascript
// In browser console on your app
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('Supabase Key exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY)
console.log('Key starts with eyJ:', import.meta.env.VITE_SUPABASE_ANON_KEY?.startsWith('eyJ'))
```

If the key doesn't start with `eyJ`, it's wrong!

