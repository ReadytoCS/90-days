# Supabase Setup Guide

This guide will help you set up Supabase for offline-first data synchronization in your Reflect app.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. A new Supabase project

## Step 1: Create Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in your project details
4. Wait for the project to be created

## Step 2: Set Up Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy and paste the contents of `supabase-schema.sql`
4. Click **Run** to execute the SQL
5. Verify the tables were created by going to **Table Editor**

You should see two tables:
- `goals` - Stores user goals and objectives
- `logs` - Stores daily intentions and reflections

## Step 3: Get Your API Keys

1. In Supabase dashboard, go to **Settings** → **API**
2. Copy the following:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (under Project API keys)

## Step 4: Configure Environment Variables

1. Create a `.env` file in the project root:
   ```bash
   cd "/Users/aimaanshergill/Downloads/Just 90 Days"
   touch .env
   ```

2. Add your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **Important**: Add `.env` to `.gitignore` to keep your keys secure:
   ```bash
   echo ".env" >> .gitignore
   ```

## Step 5: Enable Anonymous Authentication

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Enable **Anonymous** provider
3. Save the changes

## Step 6: Test the Connection

1. Restart your dev server:
   ```bash
   npm run dev
   ```

2. Open the app in your browser
3. Open browser DevTools → Console
4. You should see no errors related to Supabase
5. Create a goal or log an intention
6. Check Supabase dashboard → **Table Editor** → `goals` or `logs` to see your data

## How It Works

### Offline-First Architecture

- **Local Storage**: All data is saved to `localStorage` immediately (works offline)
- **Background Sync**: When online, data automatically syncs to Supabase
- **Conflict Resolution**: Local data takes precedence (last write wins)
- **Auto-Sync**: Data syncs when:
  - App starts (if online)
  - User comes back online
  - Data is created/updated

### Data Flow

1. User creates/updates data → Saved to `localStorage` immediately
2. If online → Queued for sync to Supabase
3. On app start → Pulls latest data from Supabase (if online)
4. Merges local and remote data (local takes precedence)

### What Works Offline

✅ **Fully Functional Offline:**
- View goals and objectives
- Create/edit goals
- Set daily intentions
- Log reflections
- View history
- All app features work without internet

✅ **Syncs When Online:**
- Goals and objectives
- Daily logs (intentions, reflections)
- All data automatically syncs

## Troubleshooting

### Data Not Syncing

1. Check browser console for errors
2. Verify environment variables are set correctly
3. Check Supabase dashboard → **Authentication** → **Users** (should see anonymous users)
4. Verify RLS policies are enabled (they should be from the SQL script)

### Anonymous Auth Not Working

1. Go to Supabase dashboard → **Authentication** → **Providers**
2. Make sure **Anonymous** is enabled
3. Check **Authentication** → **Users** for new anonymous users

### RLS Policy Issues

If you get permission errors:
1. Go to Supabase dashboard → **Table Editor**
2. Click on `goals` or `logs` table
3. Go to **Policies** tab
4. Verify policies exist and are enabled

## Security Notes

- The `anon` key is safe to expose in client-side code
- Row Level Security (RLS) ensures users can only access their own data
- Each device gets a unique anonymous user ID
- Data is encrypted in transit (HTTPS) and at rest (Supabase)

## Production Deployment

When deploying to production (Vercel, Netlify, etc.):

1. Add environment variables in your hosting platform:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

2. The app will automatically use these in production

## Support

If you encounter issues:
1. Check browser console for errors
2. Check Supabase dashboard → **Logs** for API errors
3. Verify your SQL schema was applied correctly

