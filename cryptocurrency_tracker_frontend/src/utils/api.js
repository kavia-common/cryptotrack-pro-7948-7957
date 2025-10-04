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
     throw new Error(`Failed market fetch: ${res.status} ${res.statusText || ''}`.trim());
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
   if (!res.ok) throw new Error(`Failed coin history: ${res.status} ${res.statusText || ''}`.trim());
   return res.json();
 }

 // PUBLIC_INTERFACE
 export async function fetchTrending() {
   /**
    * Fetch trending coins from CoinGecko (/search/trending)
    * Returns a standardized array of coin entries:
    * [{ id, symbol, name, market_cap_rank, image: { small, thumb } }]
    */
   const url = `${BASE_URL}/search/trending`;
   const res = await fetch(url, { headers: buildHeaders() });
   if (!res.ok) {
     throw new Error(`Failed trending fetch: ${res.status} ${res.statusText || ''}`.trim());
   }
   const json = await res.json();
   const coins = Array.isArray(json?.coins) ? json.coins : [];
   // Normalize shape defensively
   return coins
     .map((c) => c?.item || c)
     .filter(Boolean)
     .map((item) => ({
       id: item.id,
       symbol: item.symbol,
       name: item.name,
       market_cap_rank: item.market_cap_rank,
       image: {
         small: item.small || item.thumb || '',
         thumb: item.thumb || item.small || '',
       },
     }));
 }

 // PUBLIC_INTERFACE
 export async function fetchCoinDetail(coinId) {
   /**
    * Fetch detailed coin info with market_data but without heavy sections.
    * GET /coins/{id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false
    * Returns essential fields:
    * {
    *   id, symbol, name,
    *   image: { small },
    *   market_data: {
    *     current_price, market_cap, price_change_percentage_24h
    *   }
    * }
    */
   if (!coinId) throw new Error('coinId is required');
   const params = new URLSearchParams({
     localization: 'false',
     tickers: 'false',
     market_data: 'true',
     community_data: 'false',
     developer_data: 'false',
     sparkline: 'false',
   });
   const url = `${BASE_URL}/coins/${encodeURIComponent(coinId)}?${params.toString()}`;
   const res = await fetch(url, { headers: buildHeaders() });
   if (!res.ok) {
     throw new Error(`Failed coin detail: ${res.status} ${res.statusText || ''}`.trim());
   }
   const json = await res.json();

   // Defensive extraction of essential fields
   const md = json?.market_data || {};
   const image = json?.image || {};
   return {
     id: json?.id,
     symbol: json?.symbol,
     name: json?.name,
     image: { small: image.small || '' },
     market_data: {
       current_price: md.current_price || {},
       market_cap: md.market_cap || {},
       price_change_percentage_24h:
         typeof md.price_change_percentage_24h === 'number'
           ? md.price_change_percentage_24h
           : (md.price_change_percentage_24h_in_currency?.usd ?? null),
     },
   };
 }
