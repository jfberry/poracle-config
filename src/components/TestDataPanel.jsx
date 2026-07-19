import { useState, useEffect } from 'react';
import RawEditor from './RawEditor';

export default function TestDataPanel({
  testData,
  onTestDataChange,
  scenarios,
  currentScenario,
  onScenarioChange,
  // API-powered features (null when not connected)
  apiScenarios,       // [{type, test, webhook}, ...] from /api/dts/testdata
  onEnrich,           // (rawWebhook) => Promise — enrich a raw webhook
  onLoadApiScenario,  // (scenarioName) => void — load an API test scenario
}) {
  const [mode, setMode] = useState('enriched'); // 'enriched' | 'webhook'
  const [rawWebhook, setRawWebhook] = useState(null);
  const [selectedTest, setSelectedTest] = useState('');
  const [enriching, setEnriching] = useState(false);

  // When the API scenarios change (e.g. the template type was switched), default
  // the selection to the first scenario and load its webhook. Without this the
  // previously selected scenario's webhook lingers and Enrich sends the wrong
  // type's data — most visibly when the new type has a single scenario the user
  // doesn't manually re-select.
  useEffect(() => {
    if (apiScenarios && apiScenarios.length > 0) {
      setSelectedTest(apiScenarios[0].test);
      setRawWebhook(apiScenarios[0].webhook);
    } else {
      setSelectedTest('');
      setRawWebhook(null);
    }
  }, [apiScenarios]);

  const jsonStr = typeof testData === 'string' ? testData : JSON.stringify(testData, null, 2);

  const handleEditorChange = (newStr) => {
    try {
      const parsed = JSON.parse(newStr);
      if (mode === 'webhook') {
        setRawWebhook(parsed);
      } else {
        onTestDataChange(parsed);
      }
    } catch {
      // Keep raw string in editor but don't update until valid JSON
    }
  };

  const handleEnrich = async () => {
    if (!onEnrich) return;
    const webhook = rawWebhook || testData;
    setEnriching(true);
    try {
      await onEnrich(webhook);
      setMode('enriched');
    } finally {
      setEnriching(false);
    }
  };

  const handleApiScenarioSelect = (scenarioName) => {
    setSelectedTest(scenarioName);
    const scenario = apiScenarios?.find((s) => s.test === scenarioName);
    if (scenario) {
      setRawWebhook(scenario.webhook);
      setMode('webhook');
    }
  };

  const hasApiScenarios = apiScenarios && apiScenarios.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Scenario selector */}
      <div className="px-2 py-1.5 border-b border-gray-700 shrink-0 space-y-1.5">
        {/* API test scenarios (from PoracleNG testdata.json) */}
        {hasApiScenarios && (
          <div>
            <label className="text-[10px] text-gray-500 uppercase block mb-0.5">API Test Scenarios</label>
            <select
              value={selectedTest || (apiScenarios[0] && apiScenarios[0].test) || ''}
              onChange={(e) => handleApiScenarioSelect(e.target.value)}
              className="w-full bg-gray-800 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 mb-1"
            >
              {apiScenarios.map((s) => (
                <option key={s.test} value={s.test}>{s.test}</option>
              ))}
            </select>
            {onEnrich && (
              <button
                onClick={handleEnrich}
                disabled={enriching}
                className="w-full text-xs py-1 bg-blue-900/30 text-blue-300 border border-blue-700 rounded hover:bg-blue-900/50 disabled:opacity-50"
              >
                {enriching ? 'Enriching...' : 'Enrich via PoracleNG'}
              </button>
            )}
          </div>
        )}

        {/* Static fallback scenarios */}
        <div>
          <label className="text-[10px] text-gray-500 uppercase block mb-0.5">
            {hasApiScenarios ? 'Static Scenarios' : 'Scenario'}
          </label>
          <select
            value={currentScenario}
            onChange={(e) => { onScenarioChange(e.target.value); setMode('enriched'); }}
            className="w-full bg-gray-800 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600"
          >
            {scenarios.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Enrich button (when viewing raw webhook without API scenarios) */}
      {onEnrich && !hasApiScenarios && (
        <div className="px-2 py-1.5 border-b border-gray-700 shrink-0">
          <button
            onClick={handleEnrich}
            disabled={enriching}
            className="w-full text-xs py-1 bg-blue-900/30 text-blue-300 border border-blue-700 rounded hover:bg-blue-900/50 disabled:opacity-50"
          >
            {enriching ? 'Enriching...' : 'Enrich via PoracleNG'}
          </button>
        </div>
      )}

      {/* Mode indicator */}
      <div className="px-2 py-1 border-b border-gray-700 shrink-0 flex gap-2 text-[10px] whitespace-nowrap">
        <button
          onClick={() => setMode('enriched')}
          className={mode === 'enriched' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}
        >
          Enriched
        </button>
        <button
          onClick={() => setMode('webhook')}
          className={mode === 'webhook' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}
        >
          Raw Webhook
        </button>
      </div>

      {/* JSON editor */}
      <div className="flex-1 min-h-0">
        <RawEditor
          value={mode === 'webhook' && rawWebhook
            ? JSON.stringify(rawWebhook, null, 2)
            : jsonStr
          }
          onChange={handleEditorChange}
        />
      </div>
    </div>
  );
}
