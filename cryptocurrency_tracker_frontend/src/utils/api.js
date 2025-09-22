 /**
  * CoinGecko API client helpers.
  * CoinGecko is public; no credentials required.
  *
  * Environment override (optional):
  * - PUBLIC_INTERFACE
  *   To use a different API base or credentials, define:
  *   REACT_APP_COINGECKO_BASE_URL
  *   REACT_APP_COINGECKO_API_KEY   (if a gateway requires a header)
  * Add these to a local .env file at the project root (do not commit secrets).
  */

 const BASE_URL = process.env.REACT_APP_COINGECKO_BASE_URL || 'https://api.coingecko.com/api/v3';

 /**
  * INTERNAL: Build headers including optional API key.
  */
 function buildHeaders() {
   const headers = {};
   const key = process.env.REACT_APP_COINGECKO_API_KEY;
   if (key) headers['x-cg-pro-api-key'] = key;
   return headers;
 }

 // PUBLIC_INTERFACE
 export async function fetchMarket(params = {}) {
   /**
    * Fetch market data for coins with price and sparkline.
    * Params:
    *  - vs_currency: 'usd' | 'eur' | ...
    *  - order: 'market_cap_desc' | ...
    *  - per_page: number
    *  - page: number
    *  - price_change_percentage: '1h,24h,7d'
    *  - sparkline: boolean
    */
   const search = new URLSearchParams({
     vs_currency: params.vs_currency || 'usd',
     order: params.order || 'market_cap_desc',
     per_page: String(params.per_page || 50),
     page: String(params.page || 1),
     price_change_percentage: params.price_change_percentage || '1h,24h,7d',
     sparkline: String(params.sparkline ?? true),
     locale: 'en',
   });

   const res = await fetch(`${BASE_URL}/coins/markets?${search.toString()}`, {
     headers: buildHeaders(),
   });
   if (!res.ok) {
     throw new Error(`Failed market fetch: ${res.status}`);
   }
   return res.json();
 }

 // PUBLIC_INTERFACE
 export async function fetchCoinHistory(coinId, days = 30, vs_currency = 'usd') {
   /**
    * Fetch market chart data (prices, market_caps, total_volumes).
    * Returns: { prices: [ [timestamp, price], ... ], market_caps: [...], total_volumes: [...] }
    */
   if (!coinId) throw new Error('coinId is required');
   const res = await fetch(
     `${BASE_URL}/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=${encodeURIComponent(vs_currency)}&days=${encodeURIComponent(days)}`,
     { headers: buildHeaders() }
   );
   if (!res.ok) throw new Error(`Failed coin history: ${res.status}`);
   return res.json();
 }
