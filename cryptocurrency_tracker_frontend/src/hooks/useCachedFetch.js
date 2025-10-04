import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '../context/AppStateContext';

/**
 * useCachedFetch
 * A hook to fetch data with caching via AppStateContext's getCached/setCached.
 *
 * Behavior:
 * - Accepts a cache key, an async fetcher, a TTL (default 30s), dep array, and an `immediate` flag.
 * - On mount and whenever key/deps change (and immediate is true), tries to serve from cache.
 * - If cache miss or stale, calls fetcher, stores the result in cache with provided TTL.
 * - Provides { data, loading, error, refetch }.
 * - Uses AbortController to avoid state updates after unmount or when new requests supersede old ones.
 *
 * @param {Object} params
 * @param {string} params.key - Unique cache key for this resource.
 * @param {function(AbortSignal): Promise<any>} params.fetcher - Async function to fetch data. Receives an AbortSignal.
 * @param {number} [params.ttlMs=30000] - Cache TTL in milliseconds.
 * @param {Array<any>} [params.deps=[]] - Additional dependencies to trigger effect.
 * @param {boolean} [params.immediate=true] - If false, don't auto-run; only run on refetch().
 *
 * @returns {{ data: any, loading: boolean, error: string, refetch: () => Promise<void> }}
 */

// PUBLIC_INTERFACE
export default function useCachedFetch({
  key,
  fetcher,
  ttlMs = 30_000,
  deps = [],
  immediate = true,
}) {
  /** Provides cached fetching with TTL and safe unmount handling. */
  const { getCached, setCached } = useAppState();
  const [data, setData] = useState(() => (key ? getCached?.(key) : undefined));
  const [loading, setLoading] = useState(Boolean(immediate));
  const [error, setError] = useState('');
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  const stableDeps = useMemo(() => deps, deps);

  const load = useCallback(async () => {
    if (!key || typeof fetcher !== 'function') return;

    // If cache has a fresh entry, use it and avoid network call.
    const cached = getCached?.(key);
    if (cached !== undefined) {
      setData(cached);
      setError('');
      setLoading(false);
      return;
    }

    // Abort any in-flight request before starting a new one.
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError('');
      const result = await fetcher(controller.signal);
      if (!mountedRef.current || controller.signal.aborted) return;
      setData(result);
      setCached?.(key, result, ttlMs);
    } catch (e) {
      if (!mountedRef.current || controller.signal.aborted) return;
      setError(e?.message || 'Failed to fetch');
    } finally {
      if (mountedRef.current && !controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [key, fetcher, ttlMs, getCached, setCached, ...stableDeps]);

  // Auto-run on mount and when inputs change if immediate is true.
  useEffect(() => {
    if (!immediate) {
      // When not immediate, still attempt to seed from cache if available
      if (key) {
        const cached = getCached?.(key);
        if (cached !== undefined) {
          setData(cached);
          setError('');
          setLoading(false);
        } else {
          setLoading(false);
        }
      }
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, immediate, ...stableDeps]);

  const refetch = useCallback(async () => {
    // Force a refresh bypassing the cache by simply loading (load checks cache first;
    // to force bypass, we can temporarily invalidate by not using cached if present).
    // Here we explicitly ignore cached value by clearing it from state and then running fetcher.
    // However, cache in context remains; to guarantee fresh fetch, we run fetch regardless.
    if (!key || typeof fetcher !== 'function') return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError('');
      const result = await fetcher(controller.signal);
      if (!mountedRef.current || controller.signal.aborted) return;
      setData(result);
      setCached?.(key, result, ttlMs);
    } catch (e) {
      if (!mountedRef.current || controller.signal.aborted) return;
      setError(e?.message || 'Failed to fetch');
    } finally {
      if (mountedRef.current && !controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [key, fetcher, ttlMs, setCached]);

  return { data, loading, error, refetch: refetch };
}
