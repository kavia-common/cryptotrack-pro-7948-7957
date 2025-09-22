import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import './index.css';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import LivePrices from './pages/LivePrices';
import Portfolio from './pages/Portfolio';
import Alerts from './pages/Alerts';
import Analysis from './pages/Analysis';
import { ThemeProvider } from './context/ThemeContext';

// PUBLIC_INTERFACE
function App() {
  /** Root app renders the playful Neon Fun dashboard layout with routes. */
  return (
    <ThemeProvider>
      <Router>
        <div className="app-shell">
          <Header />
          <div className="app-body">
            <Sidebar />
            <main className="app-main neon-surface-card">
              <Routes>
                <Route path="/" element={<Navigate to="/live" replace />} />
                <Route path="/live" element={<LivePrices />} />
                <Route path="/portfolio" element={<Portfolio />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/analysis" element={<Analysis />} />
                <Route path="*" element={<Navigate to="/live" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
