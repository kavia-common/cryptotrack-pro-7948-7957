import React from 'react';

/**
 * ErrorState - basic error display.
 */
const ErrorState = ({ message = 'Something went wrong', onRetry }) => {
  return (
    <div className="neon-surface-card" style={{ padding: 16, borderRadius: 16, border: '1px solid rgba(239,68,68,0.35)' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="col">
          <div className="card-title">🚨 Error</div>
          <div className="small">{message}</div>
        </div>
        {onRetry && <button className="btn" onClick={onRetry}>Retry</button>}
      </div>
    </div>
  );
};

export default ErrorState;
