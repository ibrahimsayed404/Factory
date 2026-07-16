import { useState, useEffect, useCallback } from 'react';

export const useFetch = (fetcher, deps = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (opts = {}) => {
    const silent = Boolean(opts?.silent);
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
      return result;
    } catch (e) {
      setError(e.message);
      if (silent) throw e;
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load };
};
