import React, { useEffect, useMemo, useState } from 'react';
import { getAlerts, saveAlerts } from '../utils/storage';
import { fetchMarket } from '../utils/api';
import { Card, Table } from '../components/ui';
import { useAppState } from '../context/AppStateContext';

/**
 * Alerts - manage simple price alerts (local/client only).
 * Note: For production, move to server side jobs/webhooks or notifications.
 * Enhancements in this refactor:
 *  - Use shared Card and Table components for consistent UI.
 *  - Optionally validate entered symbol against cached markets via AppStateContext.
 *  - Preserve localStorage persistence and client-side evaluation behavior.
 *  - Standardize empty state messaging.
 */
const Alerts = () => {
  const [alerts, setAlerts] = useState(getAlerts());
  const [form, setForm] = useState({ symbol: '', direction: 'above', price: '' });
  const [liveMap, setLiveMap] = useState({});
  const [currency] = useState('usd');

  // Access app-level cache to optionally validate symbol and seed markets
  const { getCached, setCached } = useAppState();
  const CACHE_KEY = `markets:${currency}:150:1`;

  // Persist alerts to localStorage when they change
  useEffect(() => {
    saveAlerts(alerts);
  }, [alerts]);

  // Load/seed market snapshot: try cached first (non-blocking), then fetch and cache for reuse
  useEffect(() => {
    const seed = getCached?.(CACHE_KEY);
    if (seed && Array.isArray(seed)) {
      const map = {};
      seed.forEach((c) => {
        if (!c) return;
        if (c.symbol) map[c.symbol.toLowerCase()] = c;
        if (c.id) map[c.id] = c;
      });
      setLiveMap(map);
    }

    const load = async () => {
      try {
        const res = await fetchMarket({
          vs_currency: currency,
          per_page: 150,
          page: 1,
          sparkline: false,
        });
        // Cache for 2 minutes so other pages can reuse
        setCached?.(CACHE_KEY, res, 120_000);
        const map = {};
        res.forEach((c) => {
          map[c.symbol.toLowerCase()] = c;
          map[c.id] = c;
        });
        setLiveMap(map);
      } catch {
        // ignore transient errors; we keep any previously seeded map
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency]);

  const addAlert = () => {
    if (!form.symbol || form.price === '') return;
    const priceNum = Number(form.price);
    if (!Number.isFinite(priceNum) || priceNum < 0) return;
    setAlerts((prev) => [
      ...prev,
      { id: crypto.randomUUID(), symbol: form.symbol.trim(), direction: form.direction, price: priceNum },
    ]);
    setForm({ symbol: '', direction: 'above', price: '' });
  };

  const removeAlert = (id) => setAlerts((prev) => prev.filter((a) => a.id !== id));

  // Evaluate alerts against latest prices (client-side, only while page is open)
  const checks = useMemo(() => {
    return alerts.map((a) => {
      const sym = (a.symbol || '').toLowerCase();
      const coin = liveMap[sym] || liveMap[a.symbol];
      const price = coin?.current_price ?? 0;
      const hit = a.direction === 'above' ? price >= a.price : price <= a.price;
      return { ...a, live: price, hit };
    });
  }, [alerts, liveMap]);

  // Optional symbol validation hint using cached markets (non-blocking)
  const symbol = (form.symbol || '').trim();
  const symLower = symbol.toLowerCase();
  const matched = symLower ? liveMap[symLower] || liveMap[symbol] : null;
  const showSymbolWarning = symbol.length > 0 && !matched;

  // Columns for the alerts table
  const columns = useMemo(() => {
    return [
      { key: 'symbol', label: 'Symbol', render: (a) => (a.symbol || '').toUpperCase() },
      { key: 'direction', label: 'Direction' },
      {
        key: 'target',
        label: 'Target',
        render: (a) => `$${(a.price ?? 0).toLocaleString()}`,
      },
      {
        key: 'live',
        label: 'Live',
        render: (a) => `$${(a.live ?? 0).toLocaleString()}`,
      },
      {
        key: 'status',
        label: 'Status',
        render: (a) => (
          <span className={`badge ${a.hit ? 'up' : ''}`}>{a.hit ? 'Triggered' : 'Waiting'}</span>
        ),
      },
      {
        key: 'actions',
        label: '',
        render: (a) => (
          <button className="btn" onClick={() => removeAlert(a.id)}>
            Remove
          </button>
        ),
      },
    ];
  }, []);

  // Form validation
  const priceInvalid =
    form.price !== '' && (!Number.isFinite(Number(form.price)) || Number(form.price) < 0);

  return (
    <div className="col" style={{ gap: 20 }}>
      <div className="section-title">🔔 Price Alerts</div>

      <Card
        title="Create Alert"
        subtitle="Set a simple above/below price threshold. Alerts are evaluated locally while this page is open."
      >
        <div className="grid grid-3">
          <div className="col">
            <input
              className="input"
              placeholder="Symbol (e.g., eth)"
              value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value })}
              aria-label="Symbol"
            />
            {showSymbolWarning ? (
              <div className="small" style={{ color: 'var(--error)' }}>
                Unknown symbol in cached markets. You can still add it, but make sure it matches a
                tracked asset.
              </div>
            ) : symbol && matched ? (
              <div className="small">Matched: {matched.name} ({(matched.symbol || '').toUpperCase()})</div>
            ) : (
              <div className="small">Tip: try a known symbol like btc, eth, sol</div>
            )}
          </div>

          <div className="col">
            <select
              className="select"
              value={form.direction}
              onChange={(e) => setForm({ ...form, direction: e.target.value })}
              aria-label="Direction"
            >
              <option value="above">Above</option>
              <option value="below">Below</option>
            </select>
          </div>

          <div className="col">
            <input
              type="number"
              className="input"
              placeholder="Target Price (USD)"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              aria-label="Target Price (USD)"
              inputMode="decimal"
              step="any"
              min="0"
              aria-invalid={priceInvalid}
            />
            {priceInvalid && (
              <div className="small" style={{ color: 'var(--error)' }}>
                Target price must be a non-negative number.
              </div>
            )}
          </div>

          <div className="col">
            <button
              className="btn btn-primary"
              onClick={addAlert}
              disabled={!form.symbol || form.price === '' || priceInvalid}
              title={!form.symbol ? 'Enter a symbol' : priceInvalid ? 'Enter a valid target price' : 'Add Alert'}
            >
              Add Alert
            </button>
            <div className="small">
              Client-side only: keep this page open to continuously evaluate alerts.
            </div>
          </div>
        </div>
      </Card>

      <Card title="Your Alerts">
        <Table
          columns={columns}
          data={checks}
          keyField="id"
          emptyText={alerts.length === 0 ? 'No alerts yet. Create one above!' : 'No alerts to display.'}
        />
      </Card>
    </div>
  );
};

export default Alerts;
