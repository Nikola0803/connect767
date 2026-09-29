import { useEffect, useState, useCallback } from "react";

/**
 * Runs an async data-fetching function and tracks loading/error/data state
 * consistently across pages. Re-runs whenever `deps` changes.
 *
 * const { data, loading, error, reload } = useAsync(() => getProducts(), []);
 */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  const run = useCallback(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    fn()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ data: null, loading: false, error });
      });

    return () => {
      cancelled = true;
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => run(), [run]);

  return { ...state, reload: run };
}
