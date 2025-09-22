import React from 'react';

/**
 * Loading - playful spinner text.
 */
const Loading = ({ text = 'Loading...' }) => {
  return (
    <div className="col" style={{ alignItems: 'center', padding: 24 }}>
      <div className="brand-badge" style={{ width: 48, height: 48, borderRadius: 16, animation: 'spin 1.2s linear infinite' }}>⚙️</div>
      <div className="small" style={{ marginTop: 8 }}>{text}</div>
      <style>{`@keyframes spin { from{transform: rotate(0)} to{transform: rotate(360deg)} }`}</style>
    </div>
  );
};

export default Loading;
