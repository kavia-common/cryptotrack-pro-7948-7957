import React, { useEffect, useMemo, useState } from 'react';
import { getPortfolio, savePortfolio } from '../utils/storage';
import { fetchMarket } from '../utils/api';

/**
 * Portfolio - manage holdings locally (CRUD), estimate values and P/L.
 */
const Portfolio = () => {
  const [holdings, setHoldings] = useState(getPortfolio());
  const [form, setForm] = useState({ coinId: '', symbol: '', name: '', qty: '', buyPrice: '' });
  const [prices, setPrices] = useState({});
  const [currency] = useState('usd');

  useEffect(() => {
    savePortfolio(holdings);
  }, [holdings]);

  useEffect(() => {
    const load = async () => {
      try {
        // Fetch top 150 to cover common holdings, map by symbol
        const res = await fetchMarket({ vs_currency: currency, per_page: 150, page: 1, sparkline: false });
        const map = {};
        res.forEach(c => { map[c.symbol.toLowerCase()] = c; map[c.id] = c; });
        setPrices(map);
      } catch {
        // ignore errors, keep previous prices
      }
    };
    load();
  }, [currency]);

  const add = () => {
    if (!form.symbol || !form.qty) return;
    setHoldings(prev => [...prev, { id: crypto.randomUUID(), ...form, qty: Number(form.qty), buyPrice: Number(form.buyPrice || 0) }]);
    setForm({ coinId: '', symbol: '', name: '', qty: '', buyPrice: '' });
  };

  const remove = (id) => {
    setHoldings(prev => prev.filter(h => h.id !== id));
  };

  const totals = useMemo(() => {
    let invested = 0;
    let value = 0;
    holdings.forEach(h => {
      const sym = (h.symbol || '').toLowerCase();
      const price = prices[sym]?.current_price || prices[h.coinId]?.current_price || h.buyPrice || 0;
      invested += (h.buyPrice || 0) * (h.qty || 0);
      value += price * (h.qty || 0);
    });
    return {
      invested,
      value,
      pnl: value - invested,
      pnlPct: invested > 0 ? ((value - invested) / invested) * 100 : 0,
    };
  }, [holdings, prices]);

  return (
    <div className="col" style={{ gap: 20 }}>
      <div className="section-title">💼 Portfolio</div>
      <div className="grid grid-3">
        <div className="kpi">
          <div className="label">Invested</div>
          <div className="value">${totals.invested.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        </div>
        <div className="kpi">
          <div className="label">Current Value</div>
          <div className="value">${totals.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        </div>
        <div className="kpi">
          <div className="label">PnL</div>
          <div className="value">
            <span className={`badge ${totals.pnl >= 0 ? 'up' : 'down'}`}>
              ${totals.pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })} ({totals.pnlPct.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>

      <div className="neon-surface-card" style={{ padding: 16, borderRadius: 16 }}>
        <div className="card-title">Add Holding</div>
        <div className="grid grid-3" style={{ marginTop: 8 }}>
          <input className="input" placeholder="Symbol (e.g., btc)" value={form.symbol} onChange={e => setForm({ ...form, symbol: e.target.value })} />
          <input className="input" placeholder="Name (optional)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Coin ID (optional, e.g., bitcoin)" value={form.coinId} onChange={e => setForm({ ...form, coinId: e.target.value })} />
          <input className="input" type="number" placeholder="Quantity" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} />
          <input className="input" type="number" placeholder="Buy Price (USD)" value={form.buyPrice} onChange={e => setForm({ ...form, buyPrice: e.target.value })} />
          <button className="btn btn-primary" onClick={add}>Add</button>
        </div>
      </div>

      <div className="neon-surface-card" style={{ padding: 12, borderRadius: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Coin</th>
              <th>Qty</th>
              <th>Buy Price</th>
              <th>Current Price</th>
              <th>Value</th>
              <th>PnL</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {holdings.map(h => {
              const sym = (h.symbol || '').toLowerCase();
              const live = prices[sym] || prices[h.coinId];
              const price = live?.current_price ?? h.buyPrice ?? 0;
              const value = price * (h.qty || 0);
              const invested = (h.buyPrice || 0) * (h.qty || 0);
              const pnl = value - invested;
              const pct = invested > 0 ? (pnl / invested) * 100 : 0;
              return (
                <tr key={h.id}>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <strong>{h.name || (live?.name || h.symbol?.toUpperCase())}</strong>
                      <span className="muted">{(h.symbol || '').toUpperCase()}</span>
                    </div>
                  </td>
                  <td>{h.qty}</td>
                  <td>${(h.buyPrice || 0).toLocaleString()}</td>
                  <td>${price?.toLocaleString()}</td>
                  <td>${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td>
                    <span className={`badge ${pnl >= 0 ? 'up' : 'down'}`}>
                      ${pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })} ({pct.toFixed(2)}%)
                    </span>
                  </td>
                  <td><button className="btn" onClick={() => remove(h.id)}>Remove</button></td>
                </tr>
              );
            })}
            {holdings.length === 0 && (
              <tr><td colSpan="7" className="small">No holdings yet. Add some above!</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Portfolio;
