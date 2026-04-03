// Copyright (c) 2024-2026 Kevin Van Nieuwenhove. All rights reserved.
// NOBA Command Center — Licensed under Apache 2.0.
import {useEffect, useRef, useState, useCallback} from 'react';

export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number = 5000,
  enabled: boolean = true,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await fetcher();
      setData(result);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    timerRef.current = setInterval(refresh, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refresh, intervalMs, enabled]);

  return {data, error, loading, refresh};
}
