/**
 * @fileoverview Generic API data-fetching hook.
 * Provides { data, loading, error, refetch } for any async API function.
 * Handles loading states, error extraction, and manual refresh.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { parseApiError } from '../utils/errorHandler';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Generic hook for fetching data from any async function.
 * Re-fetches whenever the `deps` array changes (like useEffect deps).
 *
 * @param asyncFn - an async function returning the data (wrapped in useCallback)
 * @param deps - dependency array to trigger re-fetch (pass [] for mount-only)
 * @param immediate - if false, don't fetch on mount (default: true)
 *
 * @example
 * const { data, loading, error, refetch } = useApi(
 *   useCallback(() => userService.getAllUsers({ page: 1 }), [page]),
 *   [page]
 * );
 */
export function useApi<T>(
  asyncFn: () => Promise<T>,
  deps: unknown[] = [],
  immediate = true
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(immediate);
  const [error, setError] = useState<string | null>(null);

  // use a ref to track if the component is still mounted before state updates
  const isMountedRef = useRef(true);
  // track the current fetch sequence to ignore stale responses
  const fetchCountRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const execute = useCallback(async () => {
    const currentFetch = ++fetchCountRef.current;
    setLoading(true);
    setError(null);

    try {
      const result = await asyncFn();
      // only update state if this is still the latest fetch and component is mounted
      if (isMountedRef.current && currentFetch === fetchCountRef.current) {
        setData(result);
      }
    } catch (err: unknown) {
      if (isMountedRef.current && currentFetch === fetchCountRef.current) {
        setError(parseApiError(err));
      }
    } finally {
      if (isMountedRef.current && currentFetch === fetchCountRef.current) {
        setLoading(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asyncFn, ...deps]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execute]);

  return { data, loading, error, refetch: execute };
}

export default useApi;
