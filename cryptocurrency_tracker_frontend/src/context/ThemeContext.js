import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

/**
 * ThemeContext provides light/dark toggle and applies dataset attributes.
 */
const ThemeContext = createContext({
  theme: 'dark',
  toggle: () => {},
});

// PUBLIC_INTERFACE
export const ThemeProvider = ({ children }) => {
  /** Persist theme to localStorage for a cohesive experience. */
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    toggle: () => setTheme(t => (t === 'dark' ? 'light' : 'dark')),
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// PUBLIC_INTERFACE
export const useTheme = () => useContext(ThemeContext);
