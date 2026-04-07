import { useState, useMemo, useCallback, useEffect } from 'react';
import ConnectScreen from './components/ConnectScreen';
import TopBar from './components/TopBar';
import TemplateEditor from './components/TemplateEditor';
import TagPicker from './components/TagPicker';
import TestDataPanel from './components/TestDataPanel';
import DiscordPreview from './components/DiscordPreview';
import TelegramPreview from './components/TelegramPreview';
import SendTestButton from './components/SendTestButton';
import ConfigEditor from './components/ConfigEditor';
import StatusBar from './components/StatusBar';
import { useDts } from './hooks/useDts';
import { useConfig } from './hooks/useConfig';
import { useHandlebars } from './hooks/useHandlebars';
import { useApi } from './hooks/useApi';
import { useInsertAtCursor } from './hooks/useInsertAtCursor';

// DTS template types -> testdata webhook types
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
  const [partials, setPartialsState] = useState(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [activeTab, setActiveTab] = useState('templates');
  const config = useConfig(api.connected ? api.client : null);

  // Fetch fields and test scenarios from API when connected and type changes
  useEffect(() => {
    if (!api.connected || !api.client) {
      setApiFields(null);
      setApiTestScenarios(null);
      return;
    }
    let cancelled = false;
    api.client.getFields(dts.filters.type)
      .then((result) => { if (!cancelled) setApiFields(result.fields || null); })
      .catch(() => { if (!cancelled) setApiFields(null); });
    const webhookType = dtsToWebhookType[dts.filters.type] || dts.filters.type;
    api.client.getTestdata(webhookType)
      .then((result) => { if (!cancelled) setApiTestScenarios(result.testdata || null); })
      .catch(() => { if (!cancelled) setApiTestScenarios(null); });
    return () => { cancelled = true; };
  }, [api.connected, api.client, dts.filters.type]);

  // Load config when connected and switching to config tab
  useEffect(() => {
    if (api.connected && activeTab === 'config' && !config.schema) {
      config.load();
    }
  }, [api.connected, activeTab]);

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
      try {
        const result = await client.getPartials();
        if (result.partials) {
          setPartials(result.partials);
          setPartialsState(result.partials);
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
  }, [api.client, dts.filters.type, dts.filters.language, activeTestData]);

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
    const inserted = insertAtCursor(tag);
    if (!inserted) {
      navigator.clipboard?.writeText(tag).catch(() => {});
    }
    return inserted;
  }, [insertAtCursor]);

  const handleConfigSave = useCallback(async () => {
    try {
      const result = await config.save();
      if (result.restart_required) {
        alert(`Saved ${result.saved} change(s). Restart PoracleNG for these to take effect:\n${result.restart_fields?.join('\n') || ''}`);
      } else {
        alert(`Saved ${result.saved} change(s).`);
      }
    } catch (err) {
      alert('Failed to save config: ' + err.message);
    }
  }, [config]);

  // Import a single template entry from a local file
  const handleImport = () => {
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
          // Find entries that look like DTS entries (have type + template)
          const valid = entries.filter((e) => e.type && (e.template || e.templateFile));
          if (valid.length === 0) {
            alert('No valid DTS template entries found in file');
            return;
          }
          if (api.connected) {
            // Merge into current template set
            dts.importTemplates(valid);
          } else {
            // Offline mode — load as the full set
            dts.loadTemplates(valid);
            setOfflineMode(true);
          }
        } catch (err) {
          alert('Invalid JSON file: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Export current template as a single JSON entry
  const handleExport = () => {
    if (!dts.currentTemplate) {
      alert('No template selected');
      return;
    }
    const entry = { ...dts.currentTemplate };
    delete entry.readonly; // Don't export readonly flag
    const blob = new Blob([JSON.stringify(entry, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entry.type}-${entry.id || 'default'}-${entry.platform || 'discord'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Save current template to PoracleNG
  const handleSave = async () => {
    if (!api.connected || !api.client) return;
    if (!dts.currentTemplate) {
      alert('No template selected');
      return;
    }
    try {
      const entry = {
        id: String(dts.currentTemplate.id || ''),
        type: dts.currentTemplate.type,
        platform: dts.currentTemplate.platform,
        language: dts.currentTemplate.language || '',
        template: dts.currentTemplate.template,
      };
      if (dts.currentTemplate.name) entry.name = dts.currentTemplate.name;
      if (dts.currentTemplate.description) entry.description = dts.currentTemplate.description;
      if (dts.currentTemplate.default) entry.default = true;

      const result = await api.client.saveTemplates([entry]);
      alert(`Saved to PoracleNG (${result.saved || 0} template${result.saved !== 1 ? 's' : ''})`);
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
  };

  // Show connect screen if not connected and not in offline mode
  if (!api.connected && !offlineMode) {
    return (
      <ConnectScreen
        onConnect={handleConnect}
        onImportFile={handleImport}
        error={api.error}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-200">
      <TopBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        templates={dts.templates}
        currentTemplate={dts.currentTemplate}
        onSelectTemplate={dts.selectTemplate}
        onImport={handleImport}
        onExport={handleExport}
        onSave={api.connected ? handleSave : null}
        connected={api.connected}
        showMiddle={showMiddle}
        onToggleMiddle={() => setShowMiddle((v) => !v)}
        sendTestButton={api.connected && <SendTestButton onSend={handleSendTest} />}
        configDirtyCount={config.dirtyFields.count}
        configRestartRequired={config.restartRequired.required}
        onConfigSave={api.connected ? handleConfigSave : null}
      />
      {activeTab === 'templates' ? (
        <div className="flex flex-1 min-h-0">
          {/* Left panel — Template Editor */}
          <div ref={editorContainerRef} className="flex-1 min-w-0 border-r border-gray-700">
            <TemplateEditor template={dts.currentTemplate?.template} onChange={dts.updateTemplate} platform={dts.filters.platform} />
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
                  <TagPicker type={dts.filters.type} onInsertTag={handleInsertTag} apiFields={apiFields} blockContext={blockContext} partials={partials} />
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
            {dts.filters.platform === 'telegram' ? (
              <TelegramPreview data={renderedData} />
            ) : (
              <DiscordPreview data={renderedData} error={renderError} />
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ConfigEditor config={config} />
        </div>
      )}
      <StatusBar
        connected={api.connected}
        url={api.url}
        testScenario={activeTab === 'templates' ? dts.testScenario : null}
        error={activeTab === 'templates' ? (renderError || api.error) : api.error}
        configDirtyCount={activeTab === 'config' ? config.dirtyFields.count : 0}
        onConnect={handleConnect}
        onDisconnect={() => { api.disconnect(); setOfflineMode(false); }}
      />
    </div>
  );
}
