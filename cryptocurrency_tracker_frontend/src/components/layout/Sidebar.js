import React from 'react';
import { NavLink } from 'react-router-dom';

/**
 * Sidebar - playful neon navigation pane.
 */
const Sidebar = () => {
  return (
    <aside className="sidebar neon-surface-card">
      <div className="nav-section-title">Navigation</div>
      <nav className="col">
        <NavLink to="/live" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span>⚡</span>
          <span>Live Prices</span>
        </NavLink>
        <NavLink to="/portfolio" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span>💼</span>
          <span>Portfolio</span>
        </NavLink>
        <NavLink to="/alerts" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span>🔔</span>
          <span>Price Alerts</span>
        </NavLink>
        <NavLink to="/analysis" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span>📈</span>
          <span>Analysis</span>
        </NavLink>
      </nav>
    </aside>
  );
};

export default Sidebar;
