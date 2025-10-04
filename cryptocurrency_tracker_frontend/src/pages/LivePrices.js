import React, { useMemo, useState } from 'react';
import { useLivePrices } from '../hooks/useLivePrices';
import { SearchInput, Table, Pagination, Loading, ErrorState, ToggleButton } from '../components/ui';
import { useAppState } from '../context/AppStateContext';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

/**
 * LivePrices - shows live market data with auto-refresh and sparklines,
 * enhanced with client-side search, sorting, pagination, and favorites toggle.
 */
const LivePrices = () => {
  // Currency controls polling via useLivePrices (preserved)
  const [currency, setCurrency] = useState('usd');

  // Local UI state: search, sort, favorites filter, pagination
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('market_cap'); // 'price' | 'change24h' | 'market_cap'
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showFavsOnly, setShowFavsOnly] = useState(false);

  // Use global favorites from context
  const { favorites, toggleFavorite, isFavorite } = useAppState();

  // Poll data
  const { data, loading, error, refresh } = useLivePrices({
    vs_currency: currency,
    per_page: 50,
    intervalMs: 15000,
  });

  // KPIs
  const marketCaps = useMemo(
    () => data.reduce((acc, c) => acc + (c.market_cap || 0), 0),
    [data]
  );
  const volume24h = useMemo(
    () => data.reduce((acc, c) => acc + (c.total_volume || 0), 0),
    [data]
  );

  // Derived: filter by favorites and search
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = showFavsOnly ? data.filter((c) => isFavorite?.(c.id)) : data;
    if (!q) return base;
    return base.filter((c) => {
      const name = (c.name || '').toLowerCase();
      const sym = (c.symbol || '').toLowerCase();
      return name.includes(q) || sym.includes(q);
    });
  }, [data, query, isFavorite, showFavsOnly]);

  // Sorting: price, 24h change, market cap
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let av = 0;
      let bv = 0;
      if (sortKey === 'price') {
        av = a.current_price ?? 0; bv = b.current_price ?? 0;
      } else if (sortKey === 'change24h') {
        av = a.price_change_percentage_24h_in_currency ?? 0;
        bv = b.price_change_percentage_24h_in_currency ?? 0;
      } else { // market_cap default
        av = a.market_cap ?? 0; bv = b.market_cap ?? 0;
      }
      if (av === bv) return 0;
      return av > bv ? dir : -dir;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // Reset to first page when filters/sorts change
  React.useEffect(() => { setPage(1); }, [query, sortKey, sortDir, showFavsOnly, pageSize]);

  // Pagination
  const total = sorted.length;
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return sorted.slice(start, end);
  }, [sorted, page, pageSize]);

  // Columns for Table
  const columns = useMemo(() => {
    return [
      { key: 'rank', label: '#', render: (row, idx) => {
          const absoluteIndex = (page - 1) * pageSize + idx + 1;
          return absoluteIndex;
        }
      },
      { key: 'coin', label: 'Coin', render: (c) => (
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <button
              className="icon-btn"
              aria-label={isFavorite?.(c.id) ? 'Unfavorite' : 'Favorite'}
              title={isFavorite?.(c.id) ? 'Unfavorite' : 'Favorite'}
              onClick={(e) => { e.stopPropagation(); toggleFavorite?.(c.id); }}
            >
              {isFavorite?.(c.id) ? '★' : '☆'}
            </button>
            <img src={c.image} alt={c.name} width={20} height={20} style={{ borderRadius: 6 }} />
            <div className="row" style={{ gap: 8 }}>
              <strong>{c.name}</strong>
              <span className="muted">{c.symbol?.toUpperCase()}</span>
            </div>
          </div>
        )
      },
      { key: 'price', label: sortHeader('Price', 'price', sortKey, sortDir, setSortKey, setSortDir), render: (c) => `$${(c.current_price ?? 0).toLocaleString()}` },
      { key: 'change1h', label: '1h', render: (c) => {
          const v = c.price_change_percentage_1h_in_currency;
          const cls = v >= 0 ? 'up' : 'down';
          return <span className={`badge ${cls}`}>{isFiniteNum(v) ? v.toFixed(2) : '0.00'}%</span>;
        }
      },
      { key: 'change24h', label: sortHeader('24h', 'change24h', sortKey, sortDir, setSortKey, setSortDir), render: (c) => {
          const v = c.price_change_percentage_24h_in_currency;
          const cls = v >= 0 ? 'up' : 'down';
          return <span className={`badge ${cls}`}>{isFiniteNum(v) ? v.toFixed(2) : '0.00'}%</span>;
        }
      },
      { key: 'change7d', label: '7d', render: (c) => {
          const v = c.price_change_percentage_7d_in_currency;
          const cls = v >= 0 ? 'up' : 'down';
          return <span className={`badge ${cls}`}>{isFiniteNum(v) ? v.toFixed(2) : '0.00'}%</span>;
        }
      },
      { key: 'spark', label: 'Sparkline', render: (c) => {
          const sevenD = c.price_change_percentage_7d_in_currency ?? 0;
          const spark = (c.sparkline_in_7d?.price || []).slice(-40).map((p, i) => ({ i, p }));
          return (
            <div style={{ width: 120, height: 40 }}>
              <ResponsiveContainer width="100%" height={40}>
                <AreaChart data={spark}>
                  <Area
                    type="monotone"
                    dataKey="p"
                    stroke={sevenD >= 0 ? '#10B981' : '#EF4444'}
                    fillOpacity={0.2}
                    fill={sevenD >= 0 ? '#10B981' : '#EF4444'}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          );
        }
      },
      { key: 'market_cap', label: sortHeader('Market Cap', 'market_cap', sortKey, sortDir, setSortKey, setSortDir), render: (c) => `$${(c.market_cap ?? 0).toLocaleString()}` },
      { key: 'vol24h', label: '24h Volume', render: (c) => `$${(c.total_volume ?? 0).toLocaleString()}` },
    ];
  }, [page, pageSize, sortKey, sortDir, isFavorite, toggleFavorite]);

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

      {/* Controls: search, favorites-only, sort selects (optional), keep compact */}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1, maxWidth: 420 }}>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search by name or symbol..."
          />
        </div>
        <div className="row">
          <ToggleButton
            active={showFavsOnly}
            onToggle={() => setShowFavsOnly(v => !v)}
            onLabel="★ Favorites"
            offLabel="☆ Favorites"
          />
        </div>
      </div>

      {loading && <Loading text="Fetching live market data..." />}
      {error && <ErrorState message={error} onRetry={refresh} />}

      {!loading && !error && (
        <div className="col" style={{ gap: 10 }}>
          <Table
            columns={columns}
            data={paged}
            keyField="id"
            emptyText={filtered.length === 0 ? 'No assets match your filters.' : 'No data to display.'}
          />

          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50, 100]}
          />
        </div>
      )}
    </div>
  );
};

function isFiniteNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function sortHeader(label, key, activeKey, dir, setKey, setDir) {
  const isActive = activeKey === key;
  const arrow = isActive ? (dir === 'asc' ? '▲' : '▼') : '⇅';
  const title = `Sort by ${label}`;
  const onClick = (e) => {
    e.preventDefault();
    if (isActive) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setKey(key);
      setDir('desc');
    }
  };
  // Render as a button-like header label
  return (
    <span>
      <button
        type="button"
        className="icon-btn"
        onClick={onClick}
        title={title}
        aria-label={title}
        style={{ padding: '6px 8px' }}
      >
        {arrow}
      </button>{' '}
      {label}
    </span>
  );
}

export default LivePrices;
