import { useState, useCallback, useRef, useMemo } from 'react';
import { PoracleApiClient } from '../lib/api-client';

// Older PoracleNG binaries don't return a capabilities object on /health,
// so unknown features default to false — the editor hides the corresponding UI
// rather than letting operators author state that would silently vanish on save.
const EMPTY_CAPS = {};

export function useApi() {
  const [connected, setConnected] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState(null);
  const [capabilities, setCapabilities] = useState(EMPTY_CAPS);
  const [version, setVersion] = useState(null);
  const clientRef = useRef(null);

  const connect = useCallback(async (baseUrl, secret) => {
    try {
      const client = new PoracleApiClient(baseUrl, secret);
      const health = await client.health();
      // Verify auth with an authenticated endpoint before marking connected.
      // This prevents the UI from flashing the editor then bouncing back
      // to the connect screen when the secret is wrong.
      await client.getConfigSchema();
      clientRef.current = client;
      setUrl(baseUrl);
      setConnected(true);
      setError(null);
      setCapabilities(health?.capabilities || EMPTY_CAPS);
      setVersion(health?.version || null);
      return client;
    } catch (err) {
      setConnected(false);
      setError(err.message);
      clientRef.current = null;
      setCapabilities(EMPTY_CAPS);
      setVersion(null);
      return null;
    }
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current = null;
    setConnected(false);
    setUrl('');
    setError(null);
    setCapabilities(EMPTY_CAPS);
    setVersion(null);
  }, []);

  return useMemo(
    () => ({ connected, url, error, setError, capabilities, version, client: clientRef.current, connect, disconnect }),
    [connected, url, error, setError, capabilities, version, connect, disconnect]
  );
}
