import { useState, useCallback } from 'react';

/**
 * Holds the button-action registry fetched from /api/dts/actions.
 *
 * actions: Array<{ name: string, scopes: string[], required_scope?: boolean, params?: string[] }>
 * Treats 503 (snapshots disabled) as "no registry" — actions stays []
 * and the editor falls back to the four hardcoded action names with no hints.
 */
export function useActions() {
  const [actions, setActions] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(async (client) => {
    if (!client) return;
    try {
      const result = await client.getActions();
      setActions(result.actions || []);
      setError(null);
    } catch (err) {
      // 503 = snapshots disabled; other errors are network/config issues.
      // Either way: no registry → editor falls back to hardcoded action names.
      setActions([]);
      setError(err.message || String(err));
    }
  }, []);

  const reset = useCallback(() => {
    setActions([]);
    setError(null);
  }, []);

  return { actions, error, load, reset };
}
