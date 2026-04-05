import { useState } from 'react';

export default function StatusBar({ connected, url, testScenario, error, onConnect, onDisconnect }) {
  const [showConnect, setShowConnect] = useState(false);
  const [apiUrl, setApiUrl] = useState('http://localhost:3030');
  const [apiSecret, setApiSecret] = useState('');

  return (
    <div className="flex items-center justify-between px-3 py-1 bg-gray-900 border-t border-gray-700 text-xs">
      <div className="flex items-center gap-3">
        {connected ? (
          <>
            <span className="text-green-400">● Connected to PoracleNG</span>
            <span className="text-gray-500">{url}</span>
            <button onClick={onDisconnect} className="text-gray-500 hover:text-red-400">Disconnect</button>
          </>
        ) : (
          <>
            <span className="text-gray-500">● Standalone mode</span>
            <button onClick={() => setShowConnect(!showConnect)} className="text-blue-400 hover:text-blue-300">Connect</button>
          </>
        )}
        {showConnect && !connected && (
          <div className="flex items-center gap-2">
            <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="http://localhost:3030"
              className="bg-gray-800 text-gray-200 px-2 py-0.5 rounded border border-gray-600 text-xs w-48" />
            <input value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="API secret" type="password"
              className="bg-gray-800 text-gray-200 px-2 py-0.5 rounded border border-gray-600 text-xs w-24" />
            <button onClick={() => { onConnect(apiUrl, apiSecret); setShowConnect(false); }}
              className="text-green-400 hover:text-green-300">Go</button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        {error && <span className="text-red-400">{error}</span>}
        {testScenario && <span className="text-yellow-300">Test: {testScenario}</span>}
      </div>
    </div>
  );
}
