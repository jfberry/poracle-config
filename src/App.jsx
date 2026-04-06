import { useState, useMemo, useCallback, useEffect } from 'react';
import TopBar from './components/TopBar';
import TemplateEditor from './components/TemplateEditor';
import TagPicker from './components/TagPicker';
import TestDataPanel from './components/TestDataPanel';
import DiscordPreview from './components/DiscordPreview';
import SendTestButton from './components/SendTestButton';
import StatusBar from './components/StatusBar';
import { useDts } from './hooks/useDts';
import { useHandlebars } from './hooks/useHandlebars';
import { useApi } from './hooks/useApi';
import { useInsertAtCursor } from './hooks/useInsertAtCursor';

export default function App() {
  const dts = useDts();
  const { render, renderError, setPartials } = useHandlebars();
  const api = useApi();
  const { containerRef: editorContainerRef, insertAtCursor, blockContext } = useInsertAtCursor();
  const [middleTab, setMiddleTab] = useState('tags');
  const [showMiddle, setShowMiddle] = useState(true);
  const [customTestData, setCustomTestData] = useState(null);
  const [apiFields, setApiFields] = useState(null);
  const [apiTestScenarios, setApiTestScenarios] = useState(null);

  // DTS template types → testdata webhook types
  const dtsToWebhookType = {
    monster: 'pokemon',
    monsterNoIv: 'pokemon',
    raid: 'raid',
    egg: 'raid',
    invasion: 'pokestop',
    lure: 'pokestop',
    quest: 'quest',
    nest: 'nest',
    gym: 'gym',
    'fort-update': 'fort_update',
    maxbattle: 'max_battle',
  };

  // Fetch fields and test scenarios from API when connected and type changes
  useEffect(() => {
    if (!api.connected || !api.client) {
      setApiFields(null);
      setApiTestScenarios(null);
      return;
    }
    api.client.getFields(dts.filters.type)
      .then((result) => setApiFields(result.fields || null))
      .catch(() => setApiFields(null));
    const webhookType = dtsToWebhookType[dts.filters.type] || dts.filters.type;
    api.client.getTestdata(webhookType)
      .then((result) => setApiTestScenarios(result.testdata || null))
      .catch(() => setApiTestScenarios(null));
  }, [api.connected, api.client, dts.filters.type]);

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
      // Fetch and register Handlebars partials
      try {
        const result = await client.getPartials();
        if (result.partials) {
          setPartials(result.partials);
        }
      } catch (err) {
        console.error('Failed to load partials:', err);
      }
    }
  }, [api, dts, setPartials]);

  const handleEnrich = useCallback(async (webhookData) => {
    if (!api.client) return;
    try {
      const webhookType = dtsToWebhookType[dts.filters.type] || dts.filters.type;
      const result = await api.client.enrichWebhook(webhookType, webhookData || activeTestData, dts.filters.language);
      if (result.variables) {
        setCustomTestData(result.variables);
      }
    } catch (err) {
      console.error('Enrich failed:', err);
    }
  }, [api.client, dts.filters.type, activeTestData]);

  const handleSendTest = useCallback(async (targetId) => {
    if (!api.client || !dts.currentTemplate?.template) return;
    await api.client.sendTest(
      dts.currentTemplate.template,
      activeTestData,
      targetId,
      { language: dts.filters.language, platform: dts.filters.platform }
    );
  }, [api.client, dts.currentTemplate, activeTestData, dts.filters.language, dts.filters.platform]);

  const handleInsertTag = useCallback((tag) => {
    // Try to insert at cursor in the active form field
    const inserted = insertAtCursor(tag);
    if (!inserted) {
      // Fallback: copy to clipboard
      navigator.clipboard?.writeText(tag).catch(() => {});
    }
    return inserted;
  }, [insertAtCursor]);

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
      <TopBar
        templates={dts.templates}
        currentTemplate={dts.currentTemplate}
        onSelectTemplate={dts.selectTemplate}
        onLoadFile={handleLoadFile} onSave={handleSave}
        showMiddle={showMiddle} onToggleMiddle={() => setShowMiddle((v) => !v)}
        sendTestButton={api.connected && <SendTestButton onSend={handleSendTest} />} />
      <div className="flex flex-1 min-h-0">
        {/* Left panel — Template Editor */}
        <div ref={editorContainerRef} className="flex-1 min-w-0 border-r border-gray-700">
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
                <TagPicker type={dts.filters.type} onInsertTag={handleInsertTag} apiFields={apiFields} blockContext={blockContext} />
              ) : (
                <TestDataPanel
                  testData={activeTestData}
                  onTestDataChange={setCustomTestData}
                  scenarios={dts.availableScenarios}
                  currentScenario={dts.testScenario}
                  onScenarioChange={handleScenarioChange}
                  apiScenarios={apiTestScenarios}
                  onEnrich={api.connected ? handleEnrich : null}
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
