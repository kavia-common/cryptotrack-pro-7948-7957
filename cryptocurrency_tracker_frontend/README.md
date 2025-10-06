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

## Environment Variables

CoinGecko is public and works out of the box with defaults. In corporate networks or when using a proxy/gateway, you can override the base URL and optionally pass an API key header.

Supported variables (CoinGecko):
- REACT_APP_COINGECKO_BASE_URL: defaults to https://api.coingecko.com/api/v3
- REACT_APP_COINGECKO_API_KEY: if set, will be sent as header x-cg-pro-api-key

Jira integration (optional; enables Jira Burndown page):
- REACT_APP_JIRA_SITE_DOMAIN: your Jira Cloud domain (e.g., your-company.atlassian.net)
- REACT_APP_JIRA_PROJECT_KEY: default project key (e.g., CRYPTO)
- REACT_APP_JIRA_EMAIL: Jira account email used to generate API token
- REACT_APP_JIRA_API_TOKEN: Jira API token from https://id.atlassian.com/manage-profile/security/api-tokens

How to set:
- Copy .env.example to .env in the project root (same folder as package.json).
- Fill in the Jira variables. Never commit real secrets.
- Restart the dev server after changing .env.

Development proxy for Jira (avoids CORS):
- We ship src/setupProxy.js (Create React App) to proxy /jira/* to https://{REACT_APP_JIRA_SITE_DOMAIN}/* and inject Basic Auth on the server-side.
- The frontend calls /jira/rest/... during development, so browser CORS is avoided and secrets are not present in JS requests.
- Ensure .env has all Jira vars set. Then run `npm start`. If you change .env, restart the dev server.

Diagnostics & troubleshooting:
- Open Integrations > Jira > Jira Burndown. Toggle "Show Diagnostics".
- The panel shows which env vars are present (boolean), whether proxy mode is active, and a health check via /rest/api/3/myself.
- Common issues:
  - CORS or "Failed to fetch": Ensure proxy is enabled (development only) and .env is filled. Restart `npm start`.
  - 401/403: Verify REACT_APP_JIRA_EMAIL and REACT_APP_JIRA_API_TOKEN are correct and belong to an account with API access.
  - Board list empty: Confirm project key exists and has a Scrum board. We query /rest/agile/1.0/board?projectKeyOrId={key}.
  - No active sprint: Start a sprint on the board or select a different sprint when available.

Security note:
- This app is frontend-only; using Jira credentials from the browser is not secure for production.
- We strongly recommend adding a backend proxy to store secrets server-side and forward Jira requests.
- The UI shows a warning when running without a backend; a demo mode is available to preview the burndown page.

Code references:
- src/utils/api.js reads CoinGecko env vars.
- src/client/jiraClient.js reads Jira env vars and prefers the /jira proxy during development; it also provides a mock fallback when env vars are missing.
- src/utils/burndown.js computes daily remaining vs ideal lines for the sprint duration.
- src/pages/JiraBurndown.js renders the Jira burndown chart and issues table and includes a diagnostics panel.

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
