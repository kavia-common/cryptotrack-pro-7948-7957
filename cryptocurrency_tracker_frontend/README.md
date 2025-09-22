# Cryptocurrency Tracker Frontend (Neon Fun)

A playful React dashboard that tracks live crypto prices, manages a local portfolio, sets simple price alerts, and performs basic market analysis using CoinGecko.

## Features

- Live Prices with auto-refresh (15s), sparklines, KPIs
- Portfolio Manager (localStorage CRUD, live valuation)
- Price Alerts (client-side checks while page is open)
- Market Analysis (interactive chart with Recharts)
- Vibrant Neon Fun theme with gradients, rounded corners, and dynamic visuals
- Modular structure: components, hooks, utils

## Quick Start

1. Install dependencies
   - npm install
2. Start development server
   - npm start
3. Open http://localhost:3000

## Project Structure

- src/components/layout: Header, Sidebar
- src/components/ui: small reusable UI pieces
- src/context/ThemeContext.js: light/dark toggle and persistence
- src/hooks/useLivePrices.js: CoinGecko polling
- src/utils/api.js: API helpers for CoinGecko
- src/utils/storage.js: localStorage helpers
- src/pages/: LivePrices, Portfolio, Alerts, Analysis

## CoinGecko API

This app uses the public CoinGecko API (no credentials needed). If your environment or proxy requires a base URL or API key:

Environment variables (optional):
- REACT_APP_COINGECKO_BASE_URL=https://api.coingecko.com/api/v3
- REACT_APP_COINGECKO_API_KEY=your_key_if_you_have_one

Create a .env file in the project root (same folder as package.json) and add the variables. Do not commit real secrets.

Code reference:
- src/utils/api.js reads the environment variables and adds header `x-cg-pro-api-key` if provided.

## Theming

The Neon Fun theme lives in src/App.css using CSS variables and gradients. Theme toggle is in the header (stored in localStorage).

## Notes and Limitations

- Alerts are evaluated client-side only when the Alerts page is open; for production use, integrate server-side schedulers/webhooks/push notifications.
- Portfolio data is stored locally (localStorage). Integrate a backend/database for multi-device persistence.

## Scripts

- npm start: Start dev server
- npm run build: Production build
- npm test: Run tests

## License

MIT
