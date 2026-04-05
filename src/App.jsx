import { useState, useMemo, useCallback } from 'react';
import TopBar from './components/TopBar';
import TemplateEditor from './components/TemplateEditor';
import TagPicker from './components/TagPicker';
import TestDataPanel from './components/TestDataPanel';
import DiscordPreview from './components/DiscordPreview';
import StatusBar from './components/StatusBar';
import { useDts } from './hooks/useDts';
import { useHandlebars } from './hooks/useHandlebars';
import { useApi } from './hooks/useApi';

export default function App() {
  const dts = useDts();
  const { render, renderError } = useHandlebars();
  const api = useApi();
  const [middleTab, setMiddleTab] = useState('tags');
  const [showMiddle, setShowMiddle] = useState(true);
  const [customTestData, setCustomTestData] = useState(null);

  const activeTestData = customTestData || dts.currentTestData;

  const renderedData = useMemo(() => {
    if (!dts.currentTemplate?.template) return {};
    if (!activeTestData || Object.keys(activeTestData).length === 0) return {};
    try {
      return render(dts.currentTemplate.template, activeTestData) || {};
    } catch (err) {
      console.error('Render error:', err);
      return {};
    }
  }, [dts.currentTemplate, activeTestData, render]);

  const handleScenarioChange = useCallback((scenario) => {
    dts.setTestScenario(scenario);
    setCustomTestData(null);
  }, [dts.setTestScenario]);

  const handleConnect = useCallback(async (url, secret) => {
    const client = await api.connect(url, secret);
    if (client) {
      try {
        const result = await client.getTemplates();
        if (result.templates) {
          dts.loadTemplates(result.templates);
        }
      } catch (err) {
        console.error('Failed to load templates:', err);
      }
    }
  }, [api, dts]);

  const handleInsertTag = useCallback((tag) => {
    // For now, just copy to clipboard. Future: insert at cursor in active editor field.
    navigator.clipboard?.writeText(tag).catch(() => {});
  }, []);

  const handleLoadFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          const entries = Array.isArray(parsed) ? parsed : [parsed];
          dts.loadTemplates(entries);
        } catch (err) {
          alert('Invalid JSON file: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleSave = () => {
    const blob = new Blob([JSON.stringify(dts.templates, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dts.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-200">
      <TopBar filters={dts.filters} setFilters={dts.setFilters}
        availableTypes={dts.availableTypes} availableIds={dts.availableIds}
        onLoadFile={handleLoadFile} onSave={handleSave}
        showMiddle={showMiddle} onToggleMiddle={() => setShowMiddle((v) => !v)} />
      <div className="flex flex-1 min-h-0">
        {/* Left panel — Template Editor */}
        <div className="flex-1 min-w-0 border-r border-gray-700">
          <TemplateEditor template={dts.currentTemplate?.template} onChange={dts.updateTemplate} />
        </div>
        {/* Middle panel — Tags / Test Data (collapsible) */}
        {showMiddle && (
          <div className="w-64 border-r border-gray-700 flex flex-col min-h-0 shrink-0">
            <div className="flex shrink-0 border-b border-gray-700">
              <button
                onClick={() => setMiddleTab('tags')}
                className={`flex-1 text-xs py-1.5 text-center transition-colors ${
                  middleTab === 'tags'
                    ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-900'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Tags
              </button>
              <button
                onClick={() => setMiddleTab('data')}
                className={`flex-1 text-xs py-1.5 text-center transition-colors ${
                  middleTab === 'data'
                    ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-900'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Test Data
              </button>
            </div>
            <div className="flex-1 min-h-0">
              {middleTab === 'tags' ? (
                <TagPicker type={dts.filters.type} onInsertTag={handleInsertTag} />
              ) : (
                <TestDataPanel
                  testData={activeTestData}
                  onTestDataChange={setCustomTestData}
                  scenarios={dts.availableScenarios}
                  currentScenario={dts.testScenario}
                  onScenarioChange={handleScenarioChange}
                />
              )}
            </div>
          </div>
        )}
        {/* Right panel — Discord Preview */}
        <div className="flex-1 min-w-0">
          <DiscordPreview data={renderedData} error={renderError} />
        </div>
      </div>
      <StatusBar connected={api.connected} url={api.url} testScenario={dts.testScenario}
        error={renderError || api.error} onConnect={handleConnect} onDisconnect={api.disconnect} />
    </div>
  );
}
