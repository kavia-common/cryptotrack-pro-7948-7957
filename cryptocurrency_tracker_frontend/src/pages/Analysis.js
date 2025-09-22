import React, { useEffect, useMemo, useState } from 'react';
import { fetchCoinHistory, fetchMarket } from '../utils/api';
import Loading from '../components/ui/Loading';
import ErrorState from '../components/ui/ErrorState';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/**
 * Analysis - interactive chart with selectable coin and timeframe.
 */
const Analysis = () => {
  const [coins, setCoins] = useState([]);
  const [coinId, setCoinId] = useState('bitcoin');
  const [days, setDays] = useState(30);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchMarket({ per_page: 100, page: 1, sparkline: false, vs_currency: 'usd' });
        setCoins(res);
      } catch {
        // ignore
      }
    };
    load();
  }, []);

  const loadSeries = async () => {
    try {
      setErr(''); setLoading(true);
      const res = await fetchCoinHistory(coinId, days, 'usd');
      const points = res.prices.map(([t, p]) => ({ t, p }));
      setSeries(points);
    } catch (e) {
      setErr(e.message || 'Failed loading series');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSeries();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coinId, days]);

  const stats = useMemo(() => {
    if (!series.length) return { min: 0, max: 0, change: 0 };
    const prices = series.map(s => s.p);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const change = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;
    return { min, max, change };
  }, [series]);

  return (
    <div className="col" style={{ gap: 20 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div className="col">
          <div className="section-title">📈 Market Analysis</div>
          <div className="section-subtitle">Select a coin and timeframe to explore price trends.</div>
        </div>
        <div className="row">
          <select className="select" value={coinId} onChange={e => setCoinId(e.target.value)}>
            {coins.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            {!coins.length && <option value="bitcoin">Bitcoin</option>}
          </select>
          <select className="select" value={days} onChange={e => setDays(Number(e.target.value))}>
            <option value={7}>7d</option>
            <option value={14}>14d</option>
            <option value={30}>30d</option>
            <option value={90}>90d</option>
            <option value={180}>180d</option>
            <option value={365}>1y</option>
          </select>
          <button className="btn" onClick={loadSeries}>Refresh</button>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="kpi">
          <div className="label">Range Min</div>
          <div className="value">${stats.min.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        </div>
        <div className="kpi">
          <div className="label">Range Max</div>
          <div className="value">${stats.max.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        </div>
        <div className="kpi">
          <div className="label">Change</div>
          <div className="value"><span className={`badge ${stats.change >= 0 ? 'up' : 'down'}`}>{stats.change.toFixed(2)}%</span></div>
        </div>
      </div>

      {loading && <Loading text="Loading chart..." />}
      {err && <ErrorState message={err} onRetry={loadSeries} />}

      {!loading && !err && (
        <div className="neon-surface-card" style={{ padding: 8, borderRadius: 16, height: 360 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleDateString()} hide />
              <YAxis domain={['auto', 'auto']} tickFormatter={(v) => `$${v.toLocaleString()}`} />
              <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} labelFormatter={(t) => new Date(t).toLocaleString()} />
              <Line type="monotone" dataKey="p" stroke="#10B981" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default Analysis;
