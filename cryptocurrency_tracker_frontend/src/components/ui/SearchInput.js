import React from 'react';

/**
 * SearchInput - Text input with leading search icon and trailing clear button.
 * Accessible with proper labels.
 */

// PUBLIC_INTERFACE
export default function SearchInput({ value, onChange, placeholder = 'Search...', onClear }) {
  /** Controlled input with icon affordances. */
  const hasValue = !!value;

  const handleChange = (e) => {
    onChange?.(e.target.value);
  };

  const handleClear = () => {
    onChange?.('');
    onClear?.();
  };

  const inputId = React.useId();

  return (
    <div className="neon-search">
      <label htmlFor={inputId} className="sr-only">Search</label>
      <span className="neon-search-icon" aria-hidden>🔎</span>
      <input
        id={inputId}
        className="neon-input"
        type="text"
        role="searchbox"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label="Search"
      />
      {hasValue && (
        <button
          type="button"
          className="icon-btn"
          aria-label="Clear search"
          onClick={handleClear}
          title="Clear"
        >
          ✕
        </button>
      )}
    </div>
  );
}
