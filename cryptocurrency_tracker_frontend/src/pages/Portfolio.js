import React, { useEffect, useMemo, useState } from 'react';
import { getPortfolio, savePortfolio } from '../utils/storage';
import { fetchMarket } from '../utils/api';
import { Card, Table } from '../components/ui';
import { useAppState } from '../context/AppStateContext';

/**
 * Portfolio - manage holdings locally (CRUD), estimate values and P/L.
 * Enhancements:
 * - Wrap sections in shared Card components.
 * - Validate inputs (non-negative qty and price) with inline hints.
 * - Autofill coin name/id when symbol matches cached markets via AppStateContext cache.
 */
const Portfolio = () => {
  const [holdings, setHoldings] = useState(getPortfolio());
  const [form, setForm] = useState({ coinId: '', symbol: '', name: '', qty: '', buyPrice: '' });
  const [prices, setPrices] = useState({});
  const [currency] = useState('usd');

  // Access app-level cache for markets
  const { getCached, setCached } = useAppState();
  const CACHE_KEY = `markets:${currency}:150:1`;

  // Persist holdings to localStorage on change
  useEffect(() => {
    savePortfolio(holdings);
  }, [holdings]);

  // Load market snapshot; prefer cached via AppStateContext
  useEffect(() => {
    const seed = getCached?.(CACHE_KEY);
    if (seed && Array.isArray(seed)) {
      const m = {};
      seed.forEach((c) => {
        if (!c) return;
        if (c.symbol) m[c.symbol.toLowerCase()] = c;
        if (c.id) m[c.id] = c;
      });
      setPrices(m);
    }

    const load = async () => {
      try {
        const res = await fetchMarket({ vs_currency: currency, per_page: 150, page: 1, sparkline: false });
        // Cache markets for 2 minutes for re-use across pages
        setCached?.(CACHE_KEY, res, 120_000);
        const map = {};
        res.forEach((c) => {
          map[c.symbol.toLowerCase()] = c;
          map[c.id] = c;
        });
        setPrices(map);
      } catch {
        // ignore errors, keep previous prices
      }
    };
    // Always try to refresh in background to keep values fresh
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency]);

  // Validation helpers
  const qtyNum = Number(form.qty);
  const buyPriceNum = Number(form.buyPrice);
  const qtyInvalid = form.qty !== '' && (!isFinite(qtyNum) || qtyNum < 0);
  const priceInvalid = form.buyPrice !== '' && (!isFinite(buyPriceNum) || buyPriceNum < 0);

  // Derived: symbol suggestion and autofill
  const matchedAsset = useMemo(() => {
    const sym = (form.symbol || '').trim().toLowerCase();
    if (!sym) return null;
    // Try symbol match then coinId if typed in symbol
    return prices[sym] || prices[form.coinId] || null;
  }, [form.symbol, form.coinId, prices]);

  useEffect(() => {
    // Autofill when symbol matches cached markets
    if (!form.symbol) return;
    const sym = form.symbol.trim().toLowerCase();
    const coin = prices[sym];
    if (coin) {
      setForm((prev) => ({
        ...prev,
        coinId: prev.coinId || coin.id || '',
        name: prev.name || coin.name || '',
      }));
    }
  }, [form.symbol, prices]);

  const canAdd =
    !!form.symbol &&
    form.qty !== '' &&
    !qtyInvalid &&
    !priceInvalid;

  const add = () => {
    if (!canAdd) return;
    setHoldings((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        coinId: form.coinId,
        symbol: form.symbol,
        name: form.name,
        qty: Number(form.qty),
        buyPrice: Number(form.buyPrice || 0),
      },
    ]);
    setForm({ coinId: '', symbol: '', name: '', qty: '', buyPrice: '' });
  };

  const remove = (id) => {
    setHoldings((prev) => prev.filter((h) => h.id !== id));
  };

  const totals = useMemo(() => {
    let invested = 0;
    let value = 0;
    holdings.forEach((h) => {
      const sym = (h.symbol || '').toLowerCase();
      const price =
        prices[sym]?.current_price || prices[h.coinId]?.current_price || h.buyPrice || 0;
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

  const columns = useMemo(() => {
    return [
      {
        key: 'coin',
        label: 'Coin',
        render: (h) => {
          const sym = (h.symbol || '').toLowerCase();
          const live = prices[sym] || prices[h.coinId];
          return (
            <div className="row" style={{ gap: 8 }}>
              <strong>{h.name || live?.name || (h.symbol || '').toUpperCase()}</strong>
              <span className="muted">{(h.symbol || '').toUpperCase()}</span>
            </div>
          );
        },
      },
      { key: 'qty', label: 'Qty' },
      {
        key: 'buy',
        label: 'Buy Price',
        render: (h) => `$${(h.buyPrice || 0).toLocaleString()}`,
      },
      {
        key: 'live',
        label: 'Current Price',
        render: (h) => {
          const sym = (h.symbol || '').toLowerCase();
          const live = prices[sym] || prices[h.coinId];
          const price = live?.current_price ?? h.buyPrice ?? 0;
          return `$${price.toLocaleString()}`;
        },
      },
      {
        key: 'value',
        label: 'Value',
        render: (h) => {
          const sym = (h.symbol || '').toLowerCase();
          const live = prices[sym] || prices[h.coinId];
          const price = live?.current_price ?? h.buyPrice ?? 0;
          const value = price * (h.qty || 0);
          return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        },
      },
      {
        key: 'pnl',
        label: 'PnL',
        render: (h) => {
          const sym = (h.symbol || '').toLowerCase();
          const live = prices[sym] || prices[h.coinId];
          const price = live?.current_price ?? h.buyPrice ?? 0;
          const value = price * (h.qty || 0);
          const invested = (h.buyPrice || 0) * (h.qty || 0);
          const pnl = value - invested;
          const pct = invested > 0 ? (pnl / invested) * 100 : 0;
          return (
            <span className={`badge ${pnl >= 0 ? 'up' : 'down'}`}>
              ${pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })} ({pct.toFixed(2)}%)
            </span>
          );
        },
      },
      {
        key: 'actions',
        label: '',
        render: (h) => (
          <button className="btn" onClick={() => remove(h.id)}>
            Remove
          </button>
        ),
      },
    ];
  }, [prices]);

  return (
    <div className="col" style={{ gap: 20 }}>
      <div className="section-title">💼 Portfolio</div>

      <div className="grid grid-3">
        <div className="kpi">
          <div className="label">Invested</div>
          <div className="value">
            ${totals.invested.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="kpi">
          <div className="label">Current Value</div>
          <div className="value">
            ${totals.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="kpi">
          <div className="label">PnL</div>
          <div className="value">
            <span className={`badge ${totals.pnl >= 0 ? 'up' : 'down'}`}>
              ${totals.pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })} (
              {totals.pnlPct.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>

      <Card
        title="Add Holding"
        subtitle="Enter a coin symbol — we'll autofill if it matches cached markets."
      >
        <div className="grid grid-3">
          <div className="col">
            <input
              className="input"
              placeholder="Symbol (e.g., btc)"
              value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value })}
              aria-label="Symbol"
            />
            {matchedAsset && (
              <div className="small">
                Suggestion: {matchedAsset.name} • id: {matchedAsset.id}
              </div>
            )}
          </div>

          <div className="col">
            <input
              className="input"
              placeholder="Name (optional)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              aria-label="Name"
            />
            {!form.name && matchedAsset?.name && (
              <div className="small">Autofill ready: {matchedAsset.name}</div>
            )}
          </div>

          <div className="col">
            <input
              className="input"
              placeholder="Coin ID (optional, e.g., bitcoin)"
              value={form.coinId}
              onChange={(e) => setForm({ ...form, coinId: e.target.value })}
              aria-label="Coin ID"
            />
            {!form.coinId && matchedAsset?.id && (
              <div className="small">Autofill ready: {matchedAsset.id}</div>
            )}
          </div>

          <div className="col">
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder="Quantity"
              value={form.qty}
              onChange={(e) => setForm({ ...form, qty: e.target.value })}
              aria-invalid={qtyInvalid}
              aria-label="Quantity"
            />
            {qtyInvalid && (
              <div className="small" style={{ color: 'var(--error)' }}>
                Quantity must be a non-negative number.
              </div>
            )}
          </div>

          <div className="col">
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder="Buy Price (USD)"
              value={form.buyPrice}
              onChange={(e) => setForm({ ...form, buyPrice: e.target.value })}
              aria-invalid={priceInvalid}
              aria-label="Buy Price (USD)"
            />
            {priceInvalid && (
              <div className="small" style={{ color: 'var(--error)' }}>
                Buy price must be a non-negative number.
              </div>
            )}
          </div>

          <div className="col">
            <button
              className="btn btn-primary"
              onClick={add}
              disabled={!canAdd}
              title={!canAdd ? 'Enter valid symbol and non-negative quantity/price.' : 'Add'}
            >
              Add
            </button>
            <div className="small">
              {matchedAsset
                ? `Matched: ${matchedAsset.name} (${(matchedAsset.symbol || '').toUpperCase()})`
                : 'Tip: try a known symbol like btc, eth, sol'}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Holdings">
        <Table
          columns={columns}
          data={holdings}
          keyField="id"
          emptyText="No holdings yet. Add some above!"
        />
      </Card>
    </div>
  );
};

export default Portfolio;
