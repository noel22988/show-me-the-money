# Show Me The Money

Personal finance app — import bank statements, track spending across categories, manage multiple income streams, and get AI-powered insights.

## Features
- Upload PDF or CSV bank statements — Claude parses and categorises everything
- Review checklist with habit learning (remembers what you always exclude)
- Multiple income streams (fixed, variable, one-off)
- Fixed commitments tracking (insurance, investments, loans)
- Financial goals with progress tracking
- Month-over-month comparisons
- Claude-powered spending insights
- Custom accent + background colour theming
- CSV data export

## Deploy to Vercel (recommended)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import your GitHub repo
4. Vercel auto-detects Vite — no config needed
5. Click Deploy

Done. Your app is live.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build for production

```bash
npm run build
npm run preview
```

## Tech stack
- React 18
- Vite 5
- Anthropic Claude API (statement parsing + insights)
- localStorage for data persistence
- Zero external UI dependencies
