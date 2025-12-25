# Reflect

A minimal 90-day goal tracking app with daily intentions and reflections.

## Features

### Core Flow
- **Morning**: Set your intention (60 seconds)
- **Evening**: Reflect on your day (90 seconds)
- **Quarterly**: Review progress and start fresh

### Key Features
- ✅ 3 quarterly goals with weighted objectives (easy/medium/hard)
- ✅ Week-by-week activity tracking with colored status dots
- ✅ Browse past weeks and quarters
- ✅ "Same as yesterday" quick start
- ✅ Skip day option for rest days
- ✅ Auto-close missed days
- ✅ Undo for deleted objectives
- ✅ Encouraging messages for partial/missed days
- ✅ Quarter insights with personalized analytics
- ✅ iOS safe areas and haptic feedback
- ✅ Timezone-aware date handling
- ✅ Offline-first with localStorage

## Quick Start

### Option 1: Run Locally

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open http://localhost:3000
```

### Option 2: Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Option 3: Use as PWA on iOS

1. Deploy to any hosting (Vercel, Netlify, etc.)
2. Open in Safari on iPhone
3. Tap Share → Add to Home Screen
4. App runs fullscreen like native app

## Project Structure

```
reflect-app/
├── index.html          # HTML entry with iOS meta tags
├── package.json        # Dependencies
├── vite.config.js      # Vite configuration
├── public/
│   └── manifest.json   # PWA manifest
└── src/
    ├── main.jsx        # React entry point
    └── ReflectApp.jsx  # Main app component
```

## File Setup

Move `ReflectApp.jsx` to `src/` folder:

```bash
mkdir -p src
mv ReflectApp.jsx src/
```

## iOS PWA Icons

Create app icons and place in `/public`:
- `icon-192.png` (192×192)
- `icon-512.png` (512×512)

Use a gradient background (#3b82f6 → #8b5cf6) with "◯" symbol.

## Data Storage

All data stored in localStorage:
- `r_goals`: Goals with objectives (tagged by quarter)
- `r_logs`: Daily logs with intentions and reflections

Data persists across sessions. Export feature not included (future enhancement).

## Customization

### Change Quarter Cycle
Edit `utils.quarter()` to customize:
- Start date
- Duration
- Labels

### Adjust Difficulty Weights
Edit `utils.progress()`:
```javascript
const w = { easy: 1, medium: 2, hard: 4 };
```

### Max Objectives Per Goal
Change the limit in `addObjective()` (default: 7)

## Browser Support

- ✅ iOS Safari 14+
- ✅ Chrome 90+
- ✅ Firefox 90+
- ✅ Edge 90+

## Fixes Implemented

### P0 — Ship Blockers
- [x] Timezone handling (uses local date, not UTC)
- [x] iOS safe area padding
- [x] Undo for objective deletion (3-second toast)
- [x] Storage error handling

### P1 — Week 1 Retention
- [x] "Same as yesterday" quick-start option
- [x] Week dots show status color (green/yellow/red)
- [x] Auto-close missed days at midnight
- [x] Skip day option for breaks

### P2 — Month 1 Retention
- [x] Limit objectives to 7 per goal
- [x] Haptic feedback on key actions
- [x] Encouragement for partial/no days
- [x] Past quarters browsing

## License

MIT
