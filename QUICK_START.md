# Quick Start: Supabase + Offline Support

## ✅ What's Been Set Up

1. **Supabase Client** - Installed and configured
2. **Offline-First Storage** - Works completely offline, syncs when online
3. **Database Schema** - Ready to run in Supabase
4. **Auto-Sync** - Background synchronization when online
5. **Anonymous Auth** - Each device gets unique user ID

## 🚀 Quick Setup (5 minutes)

### 1. Create `.env` file:
```bash
cd "/Users/aimaanshergill/Downloads/Just 90 Days"
```

Create `.env` with:
```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Run SQL in Supabase:
- Go to Supabase Dashboard → SQL Editor
- Copy/paste `supabase-schema.sql`
- Click Run

### 3. Enable Anonymous Auth:
- Supabase Dashboard → Authentication → Providers
- Enable "Anonymous"

### 4. Restart dev server:
```bash
npm run dev
```

## 📱 Offline Features

**Everything works offline:**
- ✅ View goals and objectives
- ✅ Create/edit goals
- ✅ Set daily intentions
- ✅ Log reflections
- ✅ View history
- ✅ All features work without internet

**Auto-syncs when online:**
- Data syncs automatically when you come back online
- No manual sync needed
- Local data takes precedence (conflict resolution)

## 🔧 Files Created

- `src/lib/supabase.js` - Supabase client configuration
- `src/lib/storage.js` - Offline-first storage service
- `supabase-schema.sql` - Database schema
- `SUPABASE_SETUP.md` - Detailed setup guide

## 📊 Data Structure

**Goals Table:**
- id, user_id, name, quarter, objectives (JSON), timestamps

**Logs Table:**
- id, user_id, date, goal_id, objective_id, intention, reflection, status, closed, timestamps

## 🔒 Security

- Row Level Security (RLS) enabled
- Users can only access their own data
- Anonymous authentication per device
- Secure by default

## 🐛 Troubleshooting

**Not syncing?**
1. Check `.env` file exists and has correct values
2. Check browser console for errors
3. Verify SQL schema was run
4. Check Anonymous auth is enabled

**Still having issues?**
See `SUPABASE_SETUP.md` for detailed troubleshooting.

