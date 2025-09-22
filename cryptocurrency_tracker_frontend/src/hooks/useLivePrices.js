 /**
  * useLivePrices - polls CoinGecko for live market prices.
  * Provides loading/error states and a manual refresh function.
  */
 import { useEffect, useRef, useState } from 'react';
 import { fetchMarket } from '../utils/api';
 
 // PUBLIC_INTERFACE
 export function useLivePrices({ intervalMs = 15000, per_page = 50, vs_currency = 'usd' } = {}) {
   const [data, setData] = useState([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState('');
   const timer = useRef(null);
 
   const load = async () => {
     try {
       setError('');
       const res = await fetchMarket({ per_page, vs_currency, sparkline: true, price_change_percentage: '1h,24h,7d' });
       setData(res);
     } catch (e) {
       setError(e.message || 'Failed fetching prices');
     } finally {
       setLoading(false);
     }
   };
 
   useEffect(() => {
     load();
     timer.current = setInterval(load, intervalMs);
     return () => clearInterval(timer.current);
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [intervalMs, per_page, vs_currency]);
 
   return { data, loading, error, refresh: load };
 }
