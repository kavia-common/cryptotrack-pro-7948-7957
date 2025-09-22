/**
 * Simple localStorage-based store for portfolio and alerts.
 * Replace with real backend integration when available.
 */

const KEYS = {
  portfolio: 'ct_portfolio_v1',
  alerts: 'ct_alerts_v1',
};

// PUBLIC_INTERFACE
export function getPortfolio() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.portfolio) || '[]');
  } catch {
    return [];
  }
}

// PUBLIC_INTERFACE
export function savePortfolio(list) {
  localStorage.setItem(KEYS.portfolio, JSON.stringify(list || []));
}

// PUBLIC_INTERFACE
export function getAlerts() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.alerts) || '[]');
  } catch {
    return [];
  }
}

// PUBLIC_INTERFACE
export function saveAlerts(list) {
  localStorage.setItem(KEYS.alerts, JSON.stringify(list || []));
}
