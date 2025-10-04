import React from 'react';

/**
 * ToggleButton - Small toggleable button with active state.
 * Props:
 *  - active (boolean)
 *  - onToggle() -> toggles state
 *  - onLabel, offLabel (strings)
 *  - icon (optional node)
 */

// PUBLIC_INTERFACE
export default function ToggleButton({ active, onToggle, onLabel = 'On', offLabel = 'Off', icon = null }) {
  /** Render a pill-like toggle button. */
  const label = active ? onLabel : offLabel;
  return (
    <button
      type="button"
      className={`toggle-btn ${active ? 'active' : ''}`}
      aria-pressed={!!active}
      onClick={onToggle}
      title={label}
    >
      {icon && <span className="toggle-icon" aria-hidden>{icon}</span>}
      <span>{label}</span>
    </button>
  );
}
