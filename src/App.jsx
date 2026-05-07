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
import AutocreateEditor from './components/AutocreateEditor';
import StatusBar from './components/StatusBar';
import ResizeHandle from './components/ResizeHandle';
import ErrorBoundary from './components/ErrorBoundary';
import { useDts } from './hooks/useDts';
import { useConfig } from './hooks/useConfig';
import { useHandlebars } from './hooks/useHandlebars';
import { useApi } from './hooks/useApi';
import { useAutocreate } from './hooks/useAutocreate';
import { useInsertAtCursor } from './hooks/useInsertAtCursor';
import { tabClass } from './lib/styles';

// DTS template type -> testdata webhook type (used for GET /api/dts/testdata).
// The testdata.json file groups invasion/lure under "pokestop" because that's
// the upstream webhook type, so we have to ask for that bucket.
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

// DTS template type -> enrich type (used for POST /api/dts/enrich).
// Enrich understands the specific DTS types directly, so invasion stays
// as "invasion" (not "pokestop" which the enrich endpoint rejects).
const dtsToEnrichType = {
  monsterNoIv: 'pokemon',
  egg: 'raid',
  'fort-update': 'fort_update',
  maxbattle: 'max_battle',
};

function getEnrichType(dtsType) {
  return dtsToEnrichType[dtsType] || dtsType;
}

export default function App() {
  const dts = useDts();
  const { render, renderError, setPartials, setEmojis } = useHandlebars();
  const api = useApi();
  const { containerRef: editorContainerRef, insertAtCursor, blockContext } = useInsertAtCursor();
  const [middleTab, setMiddleTab] = useState('tags');
  const [showMiddle, setShowMiddle] = useState(true);
  const [customTestData, setCustomTestData] = useState(null);
  const [apiFields, setApiFields] = useState(null);
  const [apiBlockScopes, setApiBlockScopes] = useState(null);
  const [apiSnippets, setApiSnippets] = useState(null);
  const [apiTestScenarios, setApiTestScenarios] = useState(null);
  const [partials, setPartialsState] = useState(null);
  const [emojis, setEmojisState] = useState({ discord: {}, telegram: {} });
  const [offlineMode, setOfflineMode] = useState(false);
  const [activeTab, setActiveTab] = useState('templates');
  const config = useConfig(api.connected ? api.client : null);
  const autocreate = useAutocreate(api.connected ? api.client : null);

  // Panel widths in pixels (persisted)
  const [leftWidth, setLeftWidth] = useState(() => {
    const stored = localStorage.getItem('panel-left-width');
    return stored ? parseInt(stored, 10) : 480;
  });
  const [middleWidth, setMiddleWidth] = useState(() => {
    const stored = localStorage.getItem('panel-middle-width');
    return stored ? parseInt(stored, 10) : 256;
  });

  const resizeLeft = useCallback((delta) => {
    setLeftWidth((w) => {
      const next = Math.max(240, Math.min(w + delta, window.innerWidth - 400));
      localStorage.setItem('panel-left-width', String(next));
      return next;
    });
  }, []);

  const resizeMiddle = useCallback((delta) => {
    setMiddleWidth((w) => {
      const next = Math.max(160, Math.min(w + delta, 600));
      localStorage.setItem('panel-middle-width', String(next));
      return next;
    });
  }, []);

  // Fetch fields and test scenarios from API when connected and type changes
  useEffect(() => {
    if (!api.connected || !api.client) {
      setApiFields(null);
      setApiBlockScopes(null);
      setApiTestScenarios(null);
      return;
    }
    let cancelled = false;
    api.client.getFields(dts.filters.type)
      .then((result) => {
        if (cancelled) return;
        setApiFields(result.fields || null);
        setApiBlockScopes(result.blockScopes || null);
        setApiSnippets(result.snippets || null);
      })
      .catch(() => {
        if (cancelled) return;
        setApiFields(null);
        setApiBlockScopes(null);
        setApiSnippets(null);
      });
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

  // Load autocreate templates when connected and switching to autocreate tab
  useEffect(() => {
    if (api.connected && activeTab === 'autocreate' && !autocreate.loaded) {
      autocreate.load();
    }
  }, [api.connected, activeTab, autocreate.loaded]);

  const activeTestData = customTestData || dts.currentTestData;

  const renderedData = useMemo(() => {
    if (!activeTestData || Object.keys(activeTestData).length === 0) return {};

    // templateFile entries — render raw Handlebars text then parse as JSON
    if (dts.currentTemplate?.templateFileContent != null) {
      try {
        return render(null, activeTestData, dts.filters.platform, dts.currentTemplate.templateFileContent) || {};
      } catch (err) {
        console.error('Render error (templateFile):', err);
        return {};
      }
    }

    // Inline template entries
    if (!dts.currentTemplate?.template) return {};
    try {
      return render(dts.currentTemplate.template, activeTestData, dts.filters.platform) || {};
    } catch (err) {
      console.error('Render error:', err);
      return {};
    }
  }, [dts.currentTemplate, activeTestData, render, dts.filters.platform]);

  const handleScenarioChange = useCallback((scenario) => {
    dts.setTestScenario(scenario);
    setCustomTestData(null);
  }, [dts.setTestScenario]);

  const handleConnect = useCallback(async (url, secret) => {
    const client = await api.connect(url, secret);
    if (client) {
      // Auth already verified in api.connect() — load templates
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
      // Fetch per-platform emoji maps
      try {
        const [discordEmoji, telegramEmoji] = await Promise.all([
          client.getEmoji('discord').catch(() => ({})),
          client.getEmoji('telegram').catch(() => ({})),
        ]);
        const dMap = discordEmoji.emoji || {};
        const tMap = telegramEmoji.emoji || {};
        setEmojis('discord', dMap);
        setEmojis('telegram', tMap);
        setEmojisState({ discord: dMap, telegram: tMap });
      } catch (err) {
        console.error('Failed to load emojis:', err);
      }
    }
  }, [api.connect, dts.loadTemplates, setPartials, setEmojis]);

  const handleEnrich = useCallback(async (webhookData) => {
    if (!api.client) return;
    try {
      const enrichType = getEnrichType(dts.filters.type);
      const result = await api.client.enrichWebhook(enrichType, webhookData || activeTestData, dts.filters.language);
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

  const handleAutocreateSave = useCallback(async () => {
    try {
      const result = await autocreate.save();
      alert(`Saved ${result.saved || 0} autocreate template(s).`);
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
  }, [autocreate]);

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
      // templateFile entries — save raw content via PUT endpoint
      if (dts.currentTemplate.templateFile && dts.currentTemplate.templateFileContent != null) {
        await api.client.saveTemplateFile(
          dts.currentTemplate.type,
          dts.currentTemplate.platform,
          String(dts.currentTemplate.id || ''),
          dts.currentTemplate.language || '',
          dts.currentTemplate.templateFileContent
        );
        alert('Template file saved to PoracleNG');
        return;
      }

      // Inline template entries — save via POST
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
        configHasErrors={config.hasValidationErrors}
        onConfigSave={api.connected ? handleConfigSave : null}
        autocreateDirty={autocreate.isDirty}
        onAutocreateSave={api.connected ? handleAutocreateSave : null}
      />
      {activeTab === 'templates' ? (
        <ErrorBoundary>
        <div className="flex flex-1 min-h-0">
          {/* Left panel — Template Editor */}
          <div
            ref={editorContainerRef}
            className="min-w-0 shrink-0"
            style={{ width: `${leftWidth}px` }}
          >
            <TemplateEditor
              template={dts.currentTemplate?.template}
              templateFileContent={dts.currentTemplate?.templateFileContent ?? null}
              onChange={dts.updateTemplate}
              onFileContentChange={dts.updateTemplateFileContent}
              platform={dts.filters.platform}
            />
          </div>
          <ResizeHandle onResize={resizeLeft} />
          {/* Middle panel — Tags / Test Data (collapsible) */}
          {showMiddle && (
            <>
              <div
                className="flex flex-col min-h-0 shrink-0"
                style={{ width: `${middleWidth}px` }}
              >
                <div className="flex shrink-0 border-b border-gray-700">
                  <button
                    onClick={() => setMiddleTab('tags')}
                    className={`flex-1 text-xs py-1.5 text-center transition-colors ${tabClass(middleTab === 'tags')}`}
                  >
                    Tags
                  </button>
                  <button
                    onClick={() => setMiddleTab('data')}
                    className={`flex-1 text-xs py-1.5 text-center transition-colors ${tabClass(middleTab === 'data')}`}
                  >
                    Test Data
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  {middleTab === 'tags' ? (
                    <TagPicker
                      type={dts.filters.type}
                      platform={dts.filters.platform}
                      onInsertTag={handleInsertTag}
                      apiFields={apiFields}
                      apiBlockScopes={apiBlockScopes}
                      apiSnippets={apiSnippets}
                      blockContext={blockContext}
                      partials={partials}
                      emojis={emojis[dts.filters.platform] || {}}
                    />
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
              <ResizeHandle onResize={resizeMiddle} />
            </>
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
        </ErrorBoundary>
      ) : activeTab === 'autocreate' ? (
        <div className="flex-1 min-h-0">
          <AutocreateEditor autocreate={autocreate} />
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
