import React, { useMemo, useState } from 'react';
import { useLivePrices } from '../hooks/useLivePrices';
import Loading from '../components/ui/Loading';
import ErrorState from '../components/ui/ErrorState';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

/**
 * LivePrices - shows live market data with auto-refresh and sparklines.
 */
const LivePrices = () => {
  const [currency, setCurrency] = useState('usd');
  const { data, loading, error, refresh } = useLivePrices({ vs_currency: currency, per_page: 50, intervalMs: 15000 });

  const marketCaps = useMemo(() => data.reduce((acc, c) => acc + (c.market_cap || 0), 0), [data]);
  const volume24h = useMemo(() => data.reduce((acc, c) => acc + (c.total_volume || 0), 0), [data]);

  return (
    <div className="col" style={{ gap: 20 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div className="col">
          <div className="section-title">⚡ Live Prices</div>
          <div className="section-subtitle">Auto-updating every 15s • Data from CoinGecko</div>
        </div>
        <div className="row">
          <select className="select" value={currency} onChange={e => setCurrency(e.target.value)}>
            <option value="usd">USD</option>
            <option value="eur">EUR</option>
          </select>
          <button className="btn" onClick={refresh}>Refresh</button>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="kpi">
          <div className="label">Total Market Cap (top {data.length})</div>
          <div className="value">${(marketCaps / 1e12).toFixed(2)}T</div>
        </div>
        <div className="kpi">
          <div className="label">24h Volume</div>
          <div className="value">${(volume24h / 1e9).toFixed(2)}B</div>
        </div>
        <div className="kpi">
          <div className="label">Assets Tracked</div>
          <div className="value">{data.length}</div>
        </div>
      </div>

      {loading && <Loading text="Fetching live market data..." />}
      {error && <ErrorState message={error} onRetry={refresh} />}

      {!loading && !error && (
        <div className="neon-surface-card" style={{ padding: 12, borderRadius: 16 }}>
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Coin</th>
                <th>Price</th>
                <th>1h</th>
                <th>24h</th>
                <th>7d</th>
                <th>Sparkline</th>
                <th>Market Cap</th>
                <th>24h Volume</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c, idx) => {
                const oneH = c.price_change_percentage_1h_in_currency;
                const twenty4 = c.price_change_percentage_24h_in_currency;
                const sevenD = c.price_change_percentage_7d_in_currency;
                const spark = (c.sparkline_in_7d?.price || []).slice(-40).map((p, i) => ({ i, p }));
                return (
                  <tr key={c.id}>
                    <td>{idx + 1}</td>
                    <td className="row" style={{ gap: 10 }}>
                      <img src={c.image} alt={c.name} width={20} height={20} style={{ borderRadius: 6 }} />
                      <div className="row" style={{ gap: 8 }}>
                        <strong>{c.name}</strong>
                        <span className="muted">{c.symbol?.toUpperCase()}</span>
                      </div>
                    </td>
                    <td>${c.current_price?.toLocaleString()}</td>
                    <td>
                      <span className={`badge ${oneH >= 0 ? 'up' : 'down'}`}>{oneH?.toFixed(2)}%</span>
                    </td>
                    <td>
                      <span className={`badge ${twenty4 >= 0 ? 'up' : 'down'}`}>{twenty4?.toFixed(2)}%</span>
                    </td>
                    <td>
                      <span className={`badge ${sevenD >= 0 ? 'up' : 'down'}`}>{sevenD?.toFixed(2)}%</span>
                    </td>
                    <td style={{ width: 120, height: 40 }}>
                      <ResponsiveContainer width="100%" height={40}>
                        <AreaChart data={spark}>
                          <Area type="monotone" dataKey="p" stroke={sevenD >= 0 ? '#10B981' : '#EF4444'} fillOpacity={0.2} fill={sevenD >= 0 ? '#10B981' : '#EF4444'} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </td>
                    <td>${c.market_cap?.toLocaleString()}</td>
                    <td>${c.total_volume?.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LivePrices;
