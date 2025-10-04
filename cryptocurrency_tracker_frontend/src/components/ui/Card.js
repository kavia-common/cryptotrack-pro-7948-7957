import React from 'react';

/**
 * Card - Playful neon card wrapper with optional header for title/subtitle/actions.
 * Provides consistent padding, rounded corners, and glow on hover.
 */

// PUBLIC_INTERFACE
export default function Card({ title, subtitle, actions, children, className = '' }) {
  /** Render a neon card surface with optional header area. */
  return (
    <section
      className={`neon-card ${className}`}
      role="region"
      aria-label={title ? String(title) : undefined}
    >
      {(title || subtitle || actions) && (
        <div className="neon-card-header">
          <div className="neon-card-header-titles">
            {title && <div className="card-title">{title}</div>}
            {subtitle && <div className="card-subtitle">{subtitle}</div>}
          </div>
          {actions && <div className="neon-card-actions">{actions}</div>}
        </div>
      )}
      <div className="neon-card-body">{children}</div>
    </section>
  );
}
