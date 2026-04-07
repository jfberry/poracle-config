import { useState } from 'react';

export default function ConnectScreen({ onConnect, onImportFile, error }) {
  const [url, setUrl] = useState(() => localStorage.getItem('poracle-api-url') || 'http://localhost:3030');
  const [secret, setSecret] = useState(() => sessionStorage.getItem('poracle-api-secret') || '');
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    if (!url.trim()) return;
    localStorage.setItem('poracle-api-url', url.trim());
    sessionStorage.setItem('poracle-api-secret', secret);
    setConnecting(true);
    try {
      await onConnect(url.trim(), secret);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950 text-gray-200">
      <div className="w-full max-w-md p-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-blue-400">Poracle Config</h1>
          <p className="text-gray-400 text-sm">Connect to your PoracleNG instance to edit DTS templates</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">PoracleNG URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:3030"
              className="w-full bg-gray-800 text-gray-200 px-3 py-2 rounded border border-gray-600 text-sm focus:border-blue-500 focus:outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">API Secret</label>
            <input
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Your api_secret from config"
              type="password"
              className="w-full bg-gray-800 text-gray-200 px-3 py-2 rounded border border-gray-600 text-sm focus:border-blue-500 focus:outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            />
          </div>

          <button
            onClick={handleConnect}
            disabled={connecting || !url.trim()}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {connecting ? 'Connecting...' : 'Connect'}
          </button>

          {error && (
            <div className="px-3 py-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
              {error}
            </div>
          )}
        </div>

        {/* SSH tunnel help */}
        <div className="bg-gray-900 rounded p-4 space-y-2 border border-gray-800">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Remote server?</h3>
          <p className="text-xs text-gray-500">
            If PoracleNG runs on a remote server without its API port exposed, use an SSH tunnel:
          </p>
          <code className="block bg-gray-800 rounded px-3 py-2 text-xs text-teal-300 font-mono">
            ssh -L 3030:localhost:3030 user@yourserver
          </code>
          <p className="text-xs text-gray-500">
            Then connect to <span className="text-gray-400">http://localhost:3030</span> above.
            The port should match your PoracleNG <span className="text-gray-400">[processor] port</span> setting.
          </p>
        </div>

        {/* Import option */}
        <div className="text-center pt-2 border-t border-gray-800">
          <button
            onClick={onImportFile}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Just want to view a template file? <span className="text-blue-400 underline">Import from file</span>
          </button>
        </div>
      </div>
    </div>
  );
}
