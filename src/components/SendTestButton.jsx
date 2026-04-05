import { useState, useCallback } from 'react';

export default function SendTestButton({ onSend, disabled }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [userId, setUserId] = useState(() => localStorage.getItem('poracle-test-uid') || '');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const handleSend = useCallback(async () => {
    if (!userId.trim()) return;
    localStorage.setItem('poracle-test-uid', userId.trim());
    setSending(true);
    setResult(null);
    try {
      await onSend(userId.trim());
      setResult({ ok: true, message: 'Sent!' });
      setTimeout(() => setResult(null), 3000);
      setShowPrompt(false);
    } catch (err) {
      setResult({ ok: false, message: err.message });
    } finally {
      setSending(false);
    }
  }, [userId, onSend]);

  if (!showPrompt) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowPrompt(true)}
          disabled={disabled}
          className="bg-gray-800 text-orange-300 px-3 py-0.5 rounded text-sm border border-gray-600 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Send Test
        </button>
        {result && (
          <span className={`text-xs ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
            {result.message}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        placeholder="Discord User ID"
        className="bg-gray-800 text-gray-200 px-2 py-0.5 rounded border border-gray-600 text-sm w-44"
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        autoFocus
      />
      <button
        onClick={handleSend}
        disabled={sending || !userId.trim()}
        className="text-green-400 hover:text-green-300 text-sm disabled:opacity-40"
      >
        {sending ? '...' : 'Send'}
      </button>
      <button
        onClick={() => { setShowPrompt(false); setResult(null); }}
        className="text-gray-500 hover:text-gray-300 text-sm"
      >
        Cancel
      </button>
      {result && !result.ok && (
        <span className="text-xs text-red-400">{result.message}</span>
      )}
    </div>
  );
}
