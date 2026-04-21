import { useState, useCallback, useRef, useMemo } from 'react';
import { PoracleApiClient } from '../lib/api-client';

export function useApi() {
  const [connected, setConnected] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState(null);
  const clientRef = useRef(null);

  const connect = useCallback(async (baseUrl, secret) => {
    try {
      const client = new PoracleApiClient(baseUrl, secret);
      await client.health();
      clientRef.current = client;
      setUrl(baseUrl);
      setConnected(true);
      setError(null);
      return client;
    } catch (err) {
      setConnected(false);
      setError(err.message);
      clientRef.current = null;
      return null;
    }
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current = null;
    setConnected(false);
    setUrl('');
    setError(null);
  }, []);

  return useMemo(
    () => ({ connected, url, error, setError, client: clientRef.current, connect, disconnect }),
    [connected, url, error, setError, connect, disconnect]
  );
}
