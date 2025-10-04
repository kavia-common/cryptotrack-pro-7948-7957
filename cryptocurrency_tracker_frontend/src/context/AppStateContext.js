import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

/**
 * AppStateContext
 * Provides:
 *  - Favorites management with localStorage persistence (ct_favs_v1)
 *  - Simple in-memory + sessionStorage backed cache with TTL (ct_cache_v1)
 *
 * Storage keys:
 *  - Favorites: localStorage['ct_favs_v1'] -> string[] of ids
 *  - Cache: sessionStorage['ct_cache_v1'] -> { [key]: { data: any, expiresAt: number } }
 */

const FAVORITES_KEY = 'ct_favs_v1';
const CACHE_KEY = 'ct_cache_v1';

const AppStateContext = createContext({
  favorites: [],
  toggleFavorite: () => {},
  isFavorite: () => false,
  getCached: () => undefined,
  setCached: () => {},
  clearStale: () => {},
});

/**
 * INTERNAL: Safe JSON parse with fallback.
 */
function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

// PUBLIC_INTERFACE
export function AppStateProvider({ children }) {
  /**
   * Context provider that initializes favorites from localStorage and a cache map
   * from sessionStorage, and syncs them back when changed.
   */
  // Favorites state
  const [favorites, setFavorites] = useState(() => {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const list = safeParse(raw, []);
    return Array.isArray(list) ? list : [];
  });

  // Cache: keep a fast in-memory ref mirror, and also persist to sessionStorage
  const cacheRef = useRef(() => {
    const raw = sessionStorage.getItem(CACHE_KEY);
    const parsed = safeParse(raw, {});
    return typeof parsed === 'object' && parsed ? parsed : {};
  });
  // Initialize ref with actual object, not a function
  if (typeof cacheRef.current === 'function') {
    cacheRef.current = cacheRef.current();
  }

  // Sync favorites to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites || []));
    } catch {
      // ignore write failures
    }
  }, [favorites]);

  // Helper: persist cache ref to sessionStorage
  const persistCache = () => {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheRef.current));
    } catch {
      // ignore write failures
    }
  };

  /**
   * Toggle a coin/item id in the favorites list.
   * @param {string} id - Unique identifier for the favorite item.
   */
  const toggleFavorite = (id) => {
    if (!id) return;
    setFavorites((prev) => {
      const set = new Set(prev || []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return Array.from(set);
    });
  };

  /**
   * Check if an id is currently in favorites.
   * @param {string} id - Unique identifier.
   * @returns {boolean}
   */
  const isFavorite = (id) => {
    if (!id) return false;
    return (favorites || []).includes(id);
  };

  /**
   * PUBLIC_INTERFACE
   * Get a cached value by key if it exists and has not expired.
   * @param {string} key - The cache key.
   * @returns {any | undefined} - Cached data or undefined if missing/expired.
   */
  const getCached = (key) => {
    if (!key) return undefined;
    const entry = cacheRef.current[key];
    if (!entry) return undefined;
    const now = Date.now();
    if (typeof entry.expiresAt === 'number' && entry.expiresAt > now) {
      return entry.data;
    }
    // Expired: remove it
    delete cacheRef.current[key];
    persistCache();
    return undefined;
  };

  /**
   * PUBLIC_INTERFACE
   * Set a cached value by key with a TTL (milliseconds).
   * @param {string} key - The cache key.
   * @param {any} data - Data to store (must be JSON-serializable for persistence).
   * @param {number} ttlMs - Time-to-live in milliseconds.
   */
  const setCached = (key, data, ttlMs = 60_000) => {
    if (!key || typeof ttlMs !== 'number' || ttlMs <= 0) return;
    const expiresAt = Date.now() + ttlMs;
    cacheRef.current[key] = { data, expiresAt };
    persistCache();
  };

  /**
   * PUBLIC_INTERFACE
   * Clears stale entries (expired) from the cache. Optional housekeeping.
   */
  const clearStale = () => {
    const now = Date.now();
    let changed = false;
    Object.keys(cacheRef.current).forEach((k) => {
      const entry = cacheRef.current[k];
      if (!entry || typeof entry.expiresAt !== 'number' || entry.expiresAt <= now) {
        delete cacheRef.current[k];
        changed = true;
      }
    });
    if (changed) persistCache();
  };

  // Periodically clear stale cache entries to keep sessionStorage lean (optional)
  useEffect(() => {
    const id = setInterval(clearStale, 60_000); // every 1 min
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      favorites,
      toggleFavorite,
      isFavorite,
      getCached,
      setCached,
      clearStale,
    }),
    [favorites]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

/**
 * PUBLIC_INTERFACE
 * useAppState - Hook to access the AppState context.
 * @returns {{
 *  favorites: string[],
 *  toggleFavorite: (id: string) => void,
 *  isFavorite: (id: string) => boolean,
 *  getCached: (key: string) => any,
 *  setCached: (key: string, data: any, ttlMs?: number) => void,
 *  clearStale: () => void
 * }}
 */
export function useAppState() {
  return useContext(AppStateContext);
}
