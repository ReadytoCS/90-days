# Verify Your Supabase Setup

## ✅ Environment Variables Set

Your `.env` file has been created with:
- **URL**: https://bsoqgfryliphvvmqxryu.supabase.co
- **Key**: sb_publishable_gf8LCC10Qd32Ou9-UTZXrA_r-rF9EoA

## ⚠️ Important: Verify Your API Key

The key format you provided (`sb_publishable_...`) might be a different type of key. 

**To get the correct anon/public key:**

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Go to **Settings** → **API**
4. Under **Project API keys**, find:
   - **anon** or **public** key (this is what you need)
   - It should look like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (a JWT token)

5. If your key is different, update `.env`:
   ```
   VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here
   ```

## Next Steps

1. **Run the Database Schema:**
   - Go to Supabase Dashboard → **SQL Editor**
   - Copy/paste contents of `supabase-schema.sql`
   - Click **Run**

2. **Enable Anonymous Auth:**
   - Go to **Authentication** → **Providers**
   - Find **Anonymous** and enable it
   - Save

3. **Restart Dev Server:**
   ```bash
   npm run dev
   ```

4. **Test the Connection:**
   - Open the app in browser
   - Open DevTools → Console
   - Create a goal or log an intention
   - Check for any errors
   - Go to Supabase Dashboard → **Table Editor** → Check `goals` or `logs` tables

## Troubleshooting

**If you see auth errors:**
- Make sure Anonymous auth is enabled
- Verify you're using the correct anon/public key (not service_role key)

**If data isn't syncing:**
- Check browser console for errors
- Verify SQL schema was run successfully
- Check Supabase Dashboard → **Table Editor** to see if tables exist

**If the key format is wrong:**
- The anon key should be a JWT token (starts with `eyJ`)
- Update `.env` with the correct key
- Restart the dev server

