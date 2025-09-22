import React from 'react';
import { useTheme } from '../../context/ThemeContext';

/**
 * Header - playful brand bar with theme toggle and quick actions.
 */
const Header = () => {
  const { theme, toggle } = useTheme();
  return (
    <header className="header">
      <div className="brand">
        <div className="brand-badge">₿</div>
        CryptoTrack
        <span className="badge" style={{ marginLeft: 10 }}>
          <span>Live</span>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: '#22c55e', display: 'inline-block' }} />
        </span>
      </div>
      <div className="row">
        <button className="btn" onClick={toggle} aria-label="Toggle theme">
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
        <a className="btn btn-primary" href="https://www.coingecko.com/en/api" target="_blank" rel="noreferrer">CoinGecko API</a>
      </div>
    </header>
  );
};

export default Header;
