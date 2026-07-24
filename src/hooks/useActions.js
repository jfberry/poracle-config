import { useState, useCallback } from 'react';

/**
 * Holds the button-action registry fetched from /api/dts/actions.
 *
 * actions: Array<{ name: string, scopes: string[], required_scope?: boolean, params?: string[] }>
 * Treats 503 (snapshots disabled) and 404 (older PoracleNG) as "no registry" —
 * actions stays [] and the editor falls back to the four hardcoded action
 * names with no hints. reason carries a coarse classification for UI copy.
 */
export function useActions() {
  const [actions, setActions] = useState([]);
  const [error, setError] = useState(null);
  const [reason, setReason] = useState(null); // 'snapshots-disabled' | 'older-poracleng' | 'network' | null

  const load = useCallback(async (client) => {
    if (!client) return;
    try {
      const result = await client.getActions();
      setActions(result.actions || []);
      setError(null);
      setReason(null);
    } catch (err) {
      const msg = err?.message || String(err);
      setActions([]);
      setError(msg);
      if (msg.includes('503')) setReason('snapshots-disabled');
      else if (msg.includes('404')) setReason('older-poracleng');
      else setReason('network');
    }
  }, []);

  const reset = useCallback(() => {
    setActions([]);
    setError(null);
    setReason(null);
  }, []);

  return { actions, error, reason, load, reset };
}
