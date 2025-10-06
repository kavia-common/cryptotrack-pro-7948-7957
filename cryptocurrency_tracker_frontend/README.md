# Cryptocurrency Tracker Frontend (Neon Fun)

A playful React dashboard for live crypto prices, a local portfolio, simple price alerts, and basic market analysis powered by the CoinGecko API. The app follows a vibrant Neon Fun theme and includes reusable UI components, cached fetching with TTL, and a small favorites/watchlist feature.

## Overview

Pages in the Neon Fun dashboard:
- Live Prices: Auto-updating market table with search, sorting, pagination, sparklines, and a favorites badge.
- Portfolio: Local holdings with validation, live valuation, and PnL calculation using latest prices.
- Alerts: Client-side price alerts persisted locally; evaluation occurs while the Alerts page is open.
- Analysis: Select a coin and timeframe to view a Recharts line chart with KPIs.

## Features

- Live prices with polling: useLivePrices polls CoinGecko every 15 seconds and surfaces loading/error state, plus manual refresh.
- Search and sort: client-side search by name/symbol and sorting by price, 24h change, and market cap (asc/desc).
- Pagination: configurable page size with range label and Prev/Next controls.
- Favorites/watchlist: mark coins with a star, filter by favorites only, and see a count badge in the header.
- Reusable UI components: Card, Table, SearchInput, Pagination, ToggleButton, Loading, ErrorState.
- Cached fetching with TTL: AppStateContext provides getCached/setCached and the useCachedFetch hook caches responses in sessionStorage with expiration. Market data is commonly cached under keys like markets:usd:150:1 to reduce network calls across pages.
- Portfolio: localStorage-based holdings with input validation and live valuation using the latest market snapshot.
- Alerts: client-side alerts stored in localStorage; simple “above/below” thresholds are evaluated while the Alerts page is open.
- Analysis: coin selector, timeframe selector, line chart via Recharts, and KPIs (min, max, change).

## Quick Start

- Install dependencies:
  - npm install
- Start the development server:
  - npm start
- Open http://localhost:3000 to view the Neon Fun dashboard (runs on port 3000 by default).

## Usage Tips

- Favorites/watchlist: click the star icon in the Live Prices table to add/remove a coin. Use the “Favorites” toggle to filter. The header shows a badge count when you have favorites.
- Search and sort: search by name or symbol (e.g., eth). Click the small sort icon in table headers “Price,” “24h,” and “Market Cap” to toggle the sort key and direction.
- Pagination: change the page size via the selector and navigate with Prev/Next. The range label shows which rows you are viewing.
- Portfolio: enter symbol, quantity, and buy price. Matching coin info is autofilled from cached markets when available. Data is stored in localStorage.
- Alerts: create “above/below” alerts. Alerts are checked against live snapshots while the page is open.
- Clear cache: reload the page to naturally clear in-memory cache; session-based TTL cleanup runs periodically and on reload.

## Environment Variables (optional)

CoinGecko is public and works out of the box with defaults. In corporate networks or when using a proxy/gateway, you can override the base URL and optionally pass an API key header.

Supported variables:
- REACT_APP_COINGECKO_BASE_URL: defaults to https://api.coingecko.com/api/v3
- REACT_APP_COINGECKO_API_KEY: if set, will be sent as header x-cg-pro-api-key

How to set:
- Create a .env file in the project root (same folder as package.json).
- Add lines such as:
  - REACT_APP_COINGECKO_BASE_URL=https://api.coingecko.com/api/v3
  - REACT_APP_COINGECKO_API_KEY=your_key_if_required
- Restart the dev server after changing .env. Never commit real secrets.

Code reference:
- src/utils/api.js reads REACT_APP_COINGECKO_BASE_URL and REACT_APP_COINGECKO_API_KEY and builds the request headers accordingly.

## Project Structure

- src/components/layout: Header (with theme toggle and favorites badge), Sidebar (navigation).
- src/components/ui: Card, Table, SearchInput, Pagination, ToggleButton, Loading, ErrorState.
- src/context:
  - ThemeContext.js: light/dark toggle persisted in localStorage.
  - AppStateContext.js: favorites, and a simple cache with TTL persisted via sessionStorage.
- src/hooks:
  - useLivePrices.js: polling for markets (15s) with sparkline support.
  - useCachedFetch.js: cached fetching with TTL and abort handling.
- src/utils:
  - api.js: CoinGecko helpers for markets, coin history, trending, and coin details.
  - storage.js: localStorage helpers for portfolio and alerts.
- src/pages: LivePrices, Portfolio, Alerts, Analysis.

## Theming

- The Neon Fun theme is defined in src/App.css using CSS variables, gradients, and playful accents.
- The theme toggle lives in the header via ThemeContext and persists to localStorage. Light and dark modes are supported using a data-theme attribute.

## Limitations

- Client-side only: portfolio and alerts live in localStorage without any backend. For multi-device sync, integrate a backend/database.
- Alerts evaluation: alerts run on the client and are evaluated while the Alerts page is open. For production-grade alerts, add server-side jobs/webhooks/push.
- CoinGecko rate limits: the app polls periodically and caches responses, but rate limits may still apply depending on usage and network conditions.

## Scripts

- npm start: Start dev server.
- npm run build: Production build.
- npm test: Run tests.

## License

MIT
