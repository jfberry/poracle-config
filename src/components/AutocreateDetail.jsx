import { useState, useCallback, useRef, useEffect } from 'react';
import AutocreateChannelForm from './AutocreateChannelForm';
import AutocreateCategoryForm from './AutocreateCategoryForm';
import { inputClass, labelClass } from '../lib/styles';

export default function AutocreateDetail({
  selectedTemplate, selectedNode, schema, validation,
  onUpdateTemplate, onUpdateDefinition, onUpdateTemplateName,
  onSave, isDirty, selectedTemplateIndex,
}) {
  const [mode, setMode] = useState('form');
  const [rawText, setRawText] = useState('');
  const [rawError, setRawError] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (mode === 'json' && selectedTemplate) {
      setRawText(JSON.stringify(selectedTemplate, null, 2));
      setRawError(null);
    }
  }, [mode, selectedTemplate?.name]);

  const handleRawChange = useCallback((text) => {
    setRawText(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        const parsed = JSON.parse(text);
        if (!parsed.name || !parsed.definition) {
          setRawError('JSON must have "name" and "definition" fields');
          return;
        }
        setRawError(null);
        onUpdateTemplate(parsed);
      } catch (err) {
        setRawError(err.message);
      }
    }, 800);
  }, [onUpdateTemplate]);

  const switchToForm = useCallback(() => {
    if (rawText && mode === 'json') {
      try {
        const parsed = JSON.parse(rawText);
        if (parsed.name && parsed.definition) {
          onUpdateTemplate(parsed);
        }
      } catch {
        // ignore parse errors when switching
      }
    }
    setMode('form');
  }, [rawText, mode, onUpdateTemplate]);

  const handleSave = useCallback(async () => {
    try {
      const result = await onSave();
      alert(`Saved ${result.saved || 0} template(s) to PoracleNG`);
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
  }, [onSave]);

  if (!selectedTemplate) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
        Select or create a template to begin editing
      </div>
    );
  }

  const def = selectedTemplate.definition || {};
  const channels = def.channels || [];
  const schemaFlags = schema?.permissionFlags || null;

  let nodeLabel = selectedTemplate.name;
  let nodeType = '';
  let formContent = null;

  if (selectedNode.type === 'category') {
    nodeLabel = def.category ? `Category: ${def.category.categoryName || '(unnamed)'}` : 'Add Category';
    nodeType = 'category';

    if (!def.category) {
      formContent = (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
          <p className="text-sm">This template has no category wrapper.</p>
          <button
            type="button"
            onClick={() => onUpdateDefinition((d) => ({ ...d, category: { categoryName: '', roles: [] } }))}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-500"
          >
            Add Category
          </button>
        </div>
      );
    } else {
      formContent = (
        <AutocreateCategoryForm
          category={def.category}
          onChange={(cat) => onUpdateDefinition((d) => ({ ...d, category: cat }))}
          schemaFlags={schemaFlags}
        />
      );
    }
  } else if (selectedNode.type === 'channel' && selectedNode.index != null && channels[selectedNode.index]) {
    const ch = channels[selectedNode.index];
    const ci = selectedNode.index;
    nodeLabel = `# ${ch.channelName || '(unnamed)'}`;
    nodeType = ch.controlType ? `${ch.controlType} channel` : 'channel';

    formContent = (
      <AutocreateChannelForm
        channel={ch}
        onChange={(updated) => {
          onUpdateDefinition((d) => {
            const chs = [...d.channels];
            chs[ci] = updated;
            return { ...d, channels: chs };
          });
        }}
        schemaFlags={schemaFlags}
        schema={schema}
      />
    );
  } else {
    nodeLabel = selectedTemplate.name;
    nodeType = 'template';
    formContent = (
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Template Name</label>
          <input
            className={inputClass}
            value={selectedTemplate.name || ''}
            onChange={(e) => onUpdateTemplateName(e.target.value)}
            placeholder="e.g. pokemon-alerts"
          />
          <div className="text-[10px] text-gray-600 mt-0.5">
            Referenced by <code className="bg-gray-800 px-0.5 rounded">!autocreate {selectedTemplate.name}</code> and <code className="bg-gray-800 px-0.5 rounded">template = "{selectedTemplate.name}"</code> in rules
          </div>
        </div>
        {def.category && (
          <div className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded p-2">
            <span className="text-xs text-gray-300">{'\uD83D\uDCC1'} Category: {def.category.categoryName || '(unnamed)'}</span>
            <button
              type="button"
              onClick={() => {
                if (confirm('Remove category wrapper? Channels will be created at top level.')) {
                  onUpdateDefinition((d) => { const { category, ...rest } = d; return rest; });
                }
              }}
              className="text-[10px] text-gray-500 hover:text-red-400"
            >
              Remove
            </button>
          </div>
        )}
        <div className="text-xs text-gray-500">
          {channels.length} channel{channels.length !== 1 ? 's' : ''}
          {def.category ? ' under a category' : ' at top level'}
        </div>

        <details className="text-xs text-gray-500 border border-gray-800 rounded p-2">
          <summary className="cursor-pointer hover:text-gray-300">Placeholder reference</summary>
          <div className="mt-2 space-y-1">
            <p><code className="bg-gray-800 px-0.5 rounded">{'{0}'}</code>, <code className="bg-gray-800 px-0.5 rounded">{'{1}'}</code>, ... substitute arg slots positionally.</p>
            <p><strong>Interactive:</strong> <code className="bg-gray-800 px-0.5 rounded">!autocreate {selectedTemplate.name} arg0 arg1</code> {'\u2014'} {'{0}'} = arg0 (which is args[1] in the command).</p>
            <p><strong>Bulk:</strong> <code className="bg-gray-800 px-0.5 rounded">params = ["{'{'}{'{'} group {'}'}{'}'}", "{'{'}{'{'} name {'}'}{'}'}"]</code> {'\u2014'} each element becomes a positional slot.</p>
            <p>Supported in: categoryName, channelName, topic, commands, thread names, button labels, picker title/description.</p>
          </div>
        </details>
      </div>
    );
  }

  const errorCount = validation.errors.length;
  const warnCount = validation.warnings.length;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-700 bg-gray-900 shrink-0">
        <span className="text-gray-400 text-xs truncate">{nodeLabel}</span>
        {nodeType && (
          <span className="text-[9px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded shrink-0">{nodeType}</span>
        )}
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={switchToForm}
            className={`px-2 py-0.5 rounded text-[11px] border ${mode === 'form' ? 'bg-gray-800 text-gray-200 border-gray-600' : 'text-gray-500 border-gray-700 hover:border-gray-600'}`}
          >
            Form
          </button>
          <button
            type="button"
            onClick={() => { setRawText(JSON.stringify(selectedTemplate, null, 2)); setRawError(null); setMode('json'); }}
            className={`px-2 py-0.5 rounded text-[11px] border ${mode === 'json' ? 'bg-gray-800 text-gray-200 border-gray-600' : 'text-gray-500 border-gray-700 hover:border-gray-600'}`}
          >
            JSON
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {mode === 'form' ? (
          formContent
        ) : (
          <div className="h-full flex flex-col">
            <textarea
              className="w-full flex-1 bg-gray-800 text-gray-200 border border-gray-600 rounded p-2 font-mono text-xs resize-none focus:outline-none focus:border-blue-500"
              value={rawText}
              onChange={(e) => handleRawChange(e.target.value)}
              spellCheck={false}
              style={{ minHeight: '300px' }}
            />
            {rawError && (
              <div className="text-red-400 text-xs mt-1 p-1 bg-red-900/20 rounded">{rawError}</div>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-t border-gray-700 bg-gray-900 shrink-0">
        <span className={`text-xs ${errorCount > 0 ? 'text-red-400' : warnCount > 0 ? 'text-amber-400' : 'text-green-400'}`}>
          {errorCount > 0
            ? `${errorCount} error${errorCount !== 1 ? 's' : ''}`
            : warnCount > 0
              ? `${warnCount} warning${warnCount !== 1 ? 's' : ''}`
              : '\u25CF No issues'
          }
        </span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={errorCount > 0 || !isDirty}
            className={`px-3 py-0.5 rounded text-xs ${
              !isDirty
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : errorCount > 0
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            {!isDirty ? 'No changes' : errorCount > 0 ? 'Fix errors to save' : 'Save to Poracle'}
          </button>
        </div>
      </div>
    </div>
  );
}
