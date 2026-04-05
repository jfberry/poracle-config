export default function StatusBar({ connected, url, testScenario, error }) {
  return (
    <div className="flex items-center justify-between px-3 py-1 bg-gray-900 border-t border-gray-700 text-xs">
      <div className="flex items-center gap-3">
        {connected ? (
          <><span className="text-green-400">● Connected to PoracleNG</span><span className="text-gray-500">{url}</span></>
        ) : (
          <span className="text-gray-500">● Standalone mode</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {error && <span className="text-red-400">{error}</span>}
        {testScenario && <span className="text-yellow-300">Test: {testScenario}</span>}
      </div>
    </div>
  );
}
