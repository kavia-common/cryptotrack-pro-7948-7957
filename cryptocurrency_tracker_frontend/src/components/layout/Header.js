import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAppState } from '../../context/AppStateContext';

/**
 * Header - playful brand bar with theme toggle and quick actions.
 * Adds a subtle favorites indicator sourced from AppStateContext.
 */
const Header = () => {
  const { theme, toggle } = useTheme();
  const { favorites } = useAppState();
  const favCount = Array.isArray(favorites) ? favorites.length : 0;

  return (
    <header className="header">
      <div className="brand">
        <div className="brand-badge">₿</div>
        CryptoTrack

        {/* Live badge remains for playful activity indicator */}
        <span className="badge" style={{ marginLeft: 10 }}>
          <span>Live</span>
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: '#22c55e',
              display: 'inline-block',
            }}
          />
        </span>

        {/* Favorites badge: hidden when 0 to avoid noise */}
        {favCount > 0 && (
          <span
            className="badge"
            aria-label={`${favCount} favorites`}
            title={`${favCount} favorites`}
            style={{
              marginLeft: 10,
              background: 'rgba(245,158,11,0.15)',
              color: '#F59E0B',
              borderColor: 'rgba(245,158,11,0.35)',
            }}
          >
            <span aria-hidden>★</span>
            <span>{favCount}</span>
          </span>
        )}
      </div>

      <div className="row">
        {/* Keep ThemeContext toggle behavior intact */}
        <button
          className="btn"
          onClick={toggle}
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
        <a
          className="btn btn-primary"
          href="https://www.coingecko.com/en/api"
          target="_blank"
          rel="noreferrer"
          aria-label="Open CoinGecko API documentation"
          title="Open CoinGecko API documentation"
        >
          CoinGecko API
        </a>
      </div>
    </header>
  );
};

export default Header;
