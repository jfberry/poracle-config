import RawEditor from './RawEditor';

export default function TestDataPanel({ testData, onTestDataChange, scenarios, currentScenario, onScenarioChange }) {
  const jsonStr = typeof testData === 'string' ? testData : JSON.stringify(testData, null, 2);

  const handleEditorChange = (newStr) => {
    try {
      const parsed = JSON.parse(newStr);
      onTestDataChange(parsed);
    } catch {
      // Keep raw string in editor but don't update parsed data until valid
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Scenario selector */}
      <div className="px-2 py-1.5 border-b border-gray-700 shrink-0">
        <label className="text-[11px] text-gray-500 block mb-1">Scenario</label>
        <select
          value={currentScenario}
          onChange={(e) => onScenarioChange(e.target.value)}
          className="w-full bg-gray-800 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none"
        >
          {scenarios.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* JSON editor */}
      <div className="flex-1 min-h-0">
        <RawEditor value={jsonStr} onChange={handleEditorChange} />
      </div>
    </div>
  );
}
