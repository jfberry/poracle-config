import { useState, useMemo, useEffect, useRef } from 'react';
import { hasIssuesUnder } from '../lib/autocreate-validation';

function TemplatePicker({ templates, selectedName, onSelect, onAdd, onDelete }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return templates;
    const q = search.toLowerCase();
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, search]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-sm hover:bg-gray-700"
      >
        <span className="text-yellow-300 font-medium truncate">{selectedName || 'Select template...'}</span>
        <span className="text-gray-500 ml-1">{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-full max-h-60 bg-gray-900 border border-gray-600 rounded shadow-xl z-50 flex flex-col">
          {templates.length > 5 && (
            <div className="p-1.5 border-b border-gray-700">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full bg-gray-800 text-gray-200 px-2 py-1 rounded border border-gray-600 text-xs focus:border-blue-500 focus:outline-none"
                autoFocus
              />
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {filtered.map((t) => (
              <button
                key={t.name}
                onClick={() => { onSelect(t.name); setOpen(false); setSearch(''); }}
                className={`w-full text-left px-2.5 py-1.5 text-sm hover:bg-gray-800 ${
                  t.name === selectedName ? 'bg-blue-900/20 border-l-2 border-blue-500' : ''
                }`}
              >
                {t.name}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-2.5 py-2 text-gray-500 text-xs text-center">No templates match</div>
            )}
          </div>
        </div>
      )}
      <div className="flex gap-1 mt-1.5">
        <button
          type="button"
          onClick={onAdd}
          className="flex-1 bg-blue-600 text-white border-none rounded py-0.5 text-[10px] hover:bg-blue-500"
        >
          + New
        </button>
        <button
          type="button"
          onClick={() => {
            if (selectedName && confirm(`Delete template "${selectedName}"?`)) {
              onDelete(selectedName);
            }
          }}
          disabled={!selectedName}
          className="flex-1 bg-gray-800 text-gray-400 border border-gray-600 rounded py-0.5 text-[10px] hover:bg-gray-700 disabled:opacity-40"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

const CONTROL_TYPE_COLORS = {
  bot: 'text-blue-400',
  webhook: 'text-green-400',
};

export default function AutocreateTree({
  templates, selectedTemplateName, selectedTemplate, selectedNode,
  onSelectTemplate, onSelectNode, onAddTemplate, onDeleteTemplate,
  onAddChannel, onRemoveChannel, onMoveChannel, validation,
}) {
  if (!selectedTemplate) {
    return (
      <div className="flex flex-col h-full bg-gray-900 border-r border-gray-700 shrink-0" style={{ width: 240 }}>
        <div className="p-2 border-b border-gray-700">
          <TemplatePicker
            templates={templates}
            selectedName={selectedTemplateName}
            onSelect={onSelectTemplate}
            onAdd={onAddTemplate}
            onDelete={onDeleteTemplate}
          />
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-600 text-xs">
          {templates.length === 0 ? 'No templates \u2014 create one' : 'Select a template'}
        </div>
      </div>
    );
  }

  const def = selectedTemplate.definition || {};
  const channels = def.channels || [];
  const templateIndex = templates.findIndex((t) => t.name === selectedTemplateName);
  const basePath = `templates[${templateIndex}]`;

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-700 shrink-0" style={{ width: 240 }}>
      <div className="p-2 border-b border-gray-700 shrink-0">
        <TemplatePicker
          templates={templates}
          selectedName={selectedTemplateName}
          onSelect={onSelectTemplate}
          onAdd={onAddTemplate}
          onDelete={onDeleteTemplate}
        />
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {/* Template root */}
        <button
          type="button"
          onClick={() => onSelectNode({ type: 'template' })}
          className={`w-full text-left px-3 py-1 text-xs flex items-center gap-1.5 hover:bg-gray-800 ${
            selectedNode.type === 'template' ? 'bg-blue-900/20 border-l-2 border-blue-500' : ''
          }`}
        >
          <span className="text-yellow-300 font-medium truncate">{selectedTemplate.name}</span>
        </button>

        {/* Category node */}
        {def.category ? (
          <button
            type="button"
            onClick={() => onSelectNode({ type: 'category' })}
            className={`w-full text-left px-3 py-1 text-xs flex items-center gap-1.5 hover:bg-gray-800 ${
              selectedNode.type === 'category' ? 'bg-blue-900/20 border-l-2 border-blue-500' : ''
            }`}
          >
            <span className="text-gray-500">{'\uD83D\uDCC1'}</span>
            <span className="text-gray-300 truncate">Category: {def.category.categoryName || '(unnamed)'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSelectNode({ type: 'category' })}
            className="w-full text-left px-3 py-1 text-[10px] text-gray-600 hover:text-gray-400"
          >
            + Add category wrapper
          </button>
        )}

        {/* Channel nodes */}
        {channels.map((ch, ci) => {
          const isSelected = selectedNode.type === 'channel' && selectedNode.index === ci;
          const chPath = `${basePath}.definition.channels[${ci}]`;
          const hasError = hasIssuesUnder(validation, chPath);
          const controlType = ch.controlType || '';
          const isVoice = (ch.channelType || 'text') === 'voice';
          const rolesCount = (ch.roles || []).length;
          const cmdsCount = (ch.commands || []).length;
          const threadsCount = (ch.threads || []).length;
          const hasPicker = !!ch.threadPicker;

          return (
            <div key={ci}>
              <div className={`flex items-center ${isSelected ? 'bg-blue-900/20 border-l-2 border-blue-500' : 'hover:bg-gray-800'}`}>
                <button
                  type="button"
                  onClick={() => onSelectNode({ type: 'channel', index: ci })}
                  className="flex-1 text-left px-3 py-1 text-xs flex items-center gap-1.5 min-w-0"
                >
                  <span className="text-gray-500 shrink-0">{isVoice ? '\uD83D\uDD0A' : '#'}</span>
                  <span className={`truncate ${hasError ? 'text-red-400' : 'text-gray-200'}`}>
                    {ch.channelName || '(unnamed)'}
                  </span>
                  {controlType && (
                    <span className={`text-[9px] ml-auto shrink-0 ${CONTROL_TYPE_COLORS[controlType] || 'text-gray-500'}`}>
                      {controlType}
                    </span>
                  )}
                </button>
                <div className="flex items-center gap-0.5 pr-1 shrink-0">
                  <button type="button" onClick={() => onMoveChannel(ci, -1)} className="text-gray-700 hover:text-gray-400 text-[10px] px-0.5" disabled={ci === 0}>{'\u2191'}</button>
                  <button type="button" onClick={() => onMoveChannel(ci, 1)} className="text-gray-700 hover:text-gray-400 text-[10px] px-0.5" disabled={ci === channels.length - 1}>{'\u2193'}</button>
                  <button type="button" onClick={() => { if (confirm('Remove this channel?')) onRemoveChannel(ci); }} className="text-gray-700 hover:text-red-400 text-[10px] px-0.5">{'\u2715'}</button>
                </div>
              </div>
              <div className="pl-7 text-[10px] text-gray-600 space-y-0">
                {rolesCount > 0 && (
                  <button type="button" onClick={() => onSelectNode({ type: 'channel', index: ci })} className="block hover:text-gray-400 py-0.5">
                    {'\uD83D\uDD12'} {rolesCount} role{rolesCount !== 1 ? 's' : ''}
                  </button>
                )}
                {cmdsCount > 0 && (
                  <button type="button" onClick={() => onSelectNode({ type: 'channel', index: ci })} className="block hover:text-gray-400 py-0.5">
                    {'\u2328'} {cmdsCount} command{cmdsCount !== 1 ? 's' : ''}
                  </button>
                )}
                {threadsCount > 0 && (
                  <button type="button" onClick={() => onSelectNode({ type: 'channel', index: ci })} className="block hover:text-gray-400 py-0.5">
                    {'\uD83E\uDDF5'} {threadsCount} thread{threadsCount !== 1 ? 's' : ''}
                  </button>
                )}
                {hasPicker && (
                  <button type="button" onClick={() => onSelectNode({ type: 'channel', index: ci })} className="block hover:text-gray-400 py-0.5">
                    {'\uD83D\uDCCC'} Thread picker
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <div className="px-3 pt-2">
          <button
            type="button"
            onClick={onAddChannel}
            className="w-full border border-dashed border-gray-700 text-gray-600 rounded py-1 text-[10px] hover:text-gray-400 hover:border-gray-500"
          >
            + Add Channel
          </button>
        </div>
      </div>
    </div>
  );
}
