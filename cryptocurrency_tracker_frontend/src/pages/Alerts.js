import React, { useEffect, useMemo, useState } from 'react';
import { getAlerts, saveAlerts } from '../utils/storage';
import { fetchMarket } from '../utils/api';

/**
 * Alerts - manage simple price alerts (local/client only).
 * Note: For production, move to server side jobs/webhooks or notifications.
 */
const Alerts = () => {
  const [alerts, setAlerts] = useState(getAlerts());
  const [form, setForm] = useState({ symbol: '', direction: 'above', price: '' });
  const [liveMap, setLiveMap] = useState({});
  const [currency] = useState('usd');

  useEffect(() => { saveAlerts(alerts); }, [alerts]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchMarket({ vs_currency: currency, per_page: 150, page: 1, sparkline: false });
        const map = {};
        res.forEach(c => { map[c.symbol.toLowerCase()] = c; map[c.id] = c; });
        setLiveMap(map);
      } catch {
        // ignore
      }
    };
    load();
  }, [currency]);

  const addAlert = () => {
    if (!form.symbol || !form.price) return;
    setAlerts(prev => [...prev, { id: crypto.randomUUID(), ...form, price: Number(form.price) }]);
    setForm({ symbol: '', direction: 'above', price: '' });
  };

  const removeAlert = (id) => setAlerts(prev => prev.filter(a => a.id !== id));

  const checks = useMemo(() => {
    return alerts.map(a => {
      const coin = liveMap[(a.symbol || '').toLowerCase()] || liveMap[a.symbol];
      const price = coin?.current_price ?? 0;
      const hit = a.direction === 'above' ? price >= a.price : price <= a.price;
      return { ...a, live: price, hit };
    });
  }, [alerts, liveMap]);

  return (
    <div className="col" style={{ gap: 20 }}>
      <div className="section-title">🔔 Price Alerts</div>
      <div className="neon-surface-card" style={{ padding: 16, borderRadius: 16 }}>
        <div className="card-title">Create Alert</div>
        <div className="grid grid-3" style={{ marginTop: 8 }}>
          <input className="input" placeholder="Symbol (e.g., eth)" value={form.symbol} onChange={e => setForm({ ...form, symbol: e.target.value })} />
          <select className="select" value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value })}>
            <option value="above">Above</option>
            <option value="below">Below</option>
          </select>
          <input type="number" className="input" placeholder="Target Price (USD)" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
          <button className="btn btn-primary" onClick={addAlert}>Add Alert</button>
        </div>
        <div className="small" style={{ marginTop: 8 }}>
          Alerts are evaluated client-side when this page is open. Implement server-side schedulers or push notifications for production.
        </div>
      </div>

      <div className="neon-surface-card" style={{ padding: 12, borderRadius: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Direction</th>
              <th>Target</th>
              <th>Live</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {checks.map(a => (
              <tr key={a.id}>
                <td>{(a.symbol || '').toUpperCase()}</td>
                <td>{a.direction}</td>
                <td>${a.price.toLocaleString()}</td>
                <td>${(a.live || 0).toLocaleString()}</td>
                <td>
                  <span className={`badge ${a.hit ? 'up' : ''}`}>{a.hit ? 'Triggered' : 'Waiting'}</span>
                </td>
                <td><button className="btn" onClick={() => removeAlert(a.id)}>Remove</button></td>
              </tr>
            ))}
            {alerts.length === 0 && <tr><td colSpan="6" className="small">No alerts yet. Create one above!</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Alerts;
