import React, { useEffect, useMemo, useState } from 'react';
import { fetchCoinHistory, fetchMarket } from '../utils/api';
import { Card, Loading, ErrorState } from '../components/ui';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAppState } from '../context/AppStateContext';

/**
 * Analysis - interactive chart with selectable coin and timeframe.
 * Enhancements:
 * - Wrap KPIs and chart in Card components for consistent UI.
 * - Standardize loading/error/empty states using shared components.
 * - Use AppStateContext cached markets list when available; fall back to API fetch.
 */
const Analysis = () => {
  const [coins, setCoins] = useState([]);
  const [coinId, setCoinId] = useState('bitcoin');
  const [days, setDays] = useState(30);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [currency] = useState('usd');

  // Access app-level cache for markets if seeded by other pages
  const { getCached, setCached } = useAppState();
  const MARKETS_CACHE_KEY = `markets:${currency}:150:1`;

  // Seed markets from cache and then refresh in background
  useEffect(() => {
    const seed = getCached?.(MARKETS_CACHE_KEY);
    if (seed && Array.isArray(seed)) {
      setCoins(seed);
      // Keep default coinId if present; otherwise ensure 'bitcoin' is present
      const hasSelected = seed.find((c) => c?.id === coinId);
      if (!hasSelected) {
        const btc = seed.find((c) => c?.id === 'bitcoin');
        if (btc) setCoinId('bitcoin');
      }
    }

    const load = async () => {
      try {
        // Fetch a broader set so it benefits other pages too
        const res = await fetchMarket({
          vs_currency: currency,
          per_page: 150,
          page: 1,
          sparkline: false,
        });
        setCached?.(MARKETS_CACHE_KEY, res, 120_000); // cache for 2 minutes
        setCoins(res);
      } catch {
        // ignore transient errors; keep any seeded list
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency]);

  const loadSeries = async () => {
    try {
      setErr('');
      setLoading(true);
      const res = await fetchCoinHistory(coinId, days, currency);
      const points = (res?.prices || []).map(([t, p]) => ({ t, p }));
      setSeries(points);
    } catch (e) {
      setErr(e?.message || 'Failed loading series');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSeries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coinId, days, currency]);

  const stats = useMemo(() => {
    if (!series.length) return { min: 0, max: 0, change: 0 };
    const prices = series.map((s) => s.p);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const change = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;
    return { min, max, change };
  }, [series]);

  const hasData = series.length > 0;

  return (
    <div className="col" style={{ gap: 20 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div className="col">
          <div className="section-title">📈 Market Analysis</div>
          <div className="section-subtitle">Select a coin and timeframe to explore price trends.</div>
        </div>
        <div className="row">
          <select
            className="select"
            value={coinId}
            onChange={(e) => setCoinId(e.target.value)}
            aria-label="Select coin"
          >
            {coins.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            {!coins.length && <option value="bitcoin">Bitcoin</option>}
          </select>
          <select
            className="select"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            aria-label="Select timeframe"
          >
            <option value={7}>7d</option>
            <option value={14}>14d</option>
            <option value={30}>30d</option>
            <option value={90}>90d</option>
            <option value={180}>180d</option>
            <option value={365}>1y</option>
          </select>
          <button className="btn" onClick={loadSeries}>
            Refresh
          </button>
        </div>
      </div>

      <Card title="Key Metrics" subtitle="Stats over the selected timeframe">
        <div className="grid grid-3">
          <div className="kpi">
            <div className="label">Range Min</div>
            <div className="value">
              ${stats.min.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="kpi">
            <div className="label">Range Max</div>
            <div className="value">
              ${stats.max.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="kpi">
            <div className="label">Change</div>
            <div className="value">
              <span className={`badge ${stats.change >= 0 ? 'up' : 'down'}`}>
                {stats.change.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Price Chart" subtitle="Interactive line chart of historical prices">
        {loading && <Loading text="Loading chart..." />}
        {err && <ErrorState message={err} onRetry={loadSeries} />}
        {!loading && !err && !hasData && (
          <div className="small muted" style={{ padding: 16, textAlign: 'center' }}>
            No data to display. Try a different timeframe or refresh.
          </div>
        )}
        {!loading && !err && hasData && (
          <div style={{ height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <XAxis
                  dataKey="t"
                  tickFormatter={(t) => new Date(t).toLocaleDateString()}
                  hide
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tickFormatter={(v) => `$${v.toLocaleString()}`}
                />
                <Tooltip
                  formatter={(value) => `$${Number(value).toLocaleString()}`}
                  labelFormatter={(t) => new Date(t).toLocaleString()}
                />
                <Line type="monotone" dataKey="p" stroke="#10B981" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Analysis;
