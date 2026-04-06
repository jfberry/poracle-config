import { useState, useMemo } from 'react';

/**
 * Single unified template selector replacing the multi-dropdown approach.
 * Shows all DTS entries in a filterable list grouped by type.
 */
export default function TemplateSelector({ templates, currentTemplate, onSelect }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('');

  // Build display label for a template
  const label = (t) => {
    const parts = [t.type];
    if (t.id && t.id !== '1') parts.push(`#${t.id}`);
    if (t.name) parts.push(`"${t.name}"`);
    return parts.join(' ');
  };

  const sublabel = (t) => {
    const parts = [];
    if (t.platform) parts.push(t.platform);
    if (t.language) parts.push(t.language);
    if (t.description) parts.push(t.description);
    return parts.join(' / ');
  };

  // Current template display
  const currentLabel = currentTemplate ? label(currentTemplate) : 'Select template...';
  const currentSublabel = currentTemplate ? sublabel(currentTemplate) : '';

  // Filter and group templates
  const grouped = useMemo(() => {
    const searchLower = search.toLowerCase();
    const filtered = templates.filter((t) => {
      if (filterPlatform && t.platform !== filterPlatform) return false;
      if (!search) return true;
      const text = `${t.type} ${t.id} ${t.name || ''} ${t.description || ''} ${t.platform} ${t.language}`.toLowerCase();
      return text.includes(searchLower);
    });

    // Group by type
    const groups = {};
    for (const t of filtered) {
      if (!groups[t.type]) groups[t.type] = [];
      groups[t.type].push(t);
    }

    // Sort entries within each group: by id, then platform, then language
    for (const entries of Object.values(groups)) {
      entries.sort((a, b) => {
        if (a.id !== b.id) return String(a.id).localeCompare(String(b.id));
        if (a.platform !== b.platform) return (a.platform || '').localeCompare(b.platform || '');
        return (a.language || '').localeCompare(b.language || '');
      });
    }

    return groups;
  }, [templates, search, filterPlatform]);

  const platforms = useMemo(
    () => [...new Set(templates.map((t) => t.platform).filter(Boolean))],
    [templates]
  );

  const isSelected = (t) =>
    currentTemplate &&
    t.type === currentTemplate.type &&
    String(t.id) === String(currentTemplate.id) &&
    t.platform === currentTemplate.platform &&
    t.language === currentTemplate.language;

  return (
    <div className="relative">
      {/* Current selection button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-gray-800 border border-gray-600 rounded px-3 py-1 text-sm hover:bg-gray-700 max-w-md"
      >
        <span className="text-yellow-300 font-medium truncate">{currentLabel}</span>
        {currentSublabel && (
          <span className="text-gray-500 text-xs truncate">{currentSublabel}</span>
        )}
        <span className="text-gray-500 ml-1">{open ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-96 max-h-[70vh] bg-gray-900 border border-gray-600 rounded shadow-xl z-50 flex flex-col">
          {/* Search and filter */}
          <div className="p-2 border-b border-gray-700 space-y-1.5 shrink-0">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="w-full bg-gray-800 text-gray-200 px-2 py-1 rounded border border-gray-600 text-sm focus:border-blue-500 focus:outline-none"
              autoFocus
            />
            <div className="flex gap-1">
              <button
                onClick={() => setFilterPlatform('')}
                className={`text-[11px] px-2 py-0.5 rounded ${!filterPlatform ? 'bg-blue-900/40 text-blue-300' : 'bg-gray-800 text-gray-500'}`}
              >
                All
              </button>
              {platforms.map((p) => (
                <button
                  key={p}
                  onClick={() => setFilterPlatform(filterPlatform === p ? '' : p)}
                  className={`text-[11px] px-2 py-0.5 rounded ${filterPlatform === p ? 'bg-blue-900/40 text-blue-300' : 'bg-gray-800 text-gray-500'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Template list */}
          <div className="flex-1 overflow-y-auto">
            {Object.entries(grouped).map(([type, entries]) => (
              <div key={type}>
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-850 sticky top-0 bg-gray-900 border-b border-gray-800">
                  {type}
                  <span className="text-gray-600 font-normal ml-1">({entries.length})</span>
                </div>
                {entries.map((t, i) => {
                  const isTelegram = t.platform === 'telegram';
                  return (
                    <button
                      key={`${t.type}-${t.id}-${t.platform}-${t.language}-${i}`}
                      onClick={() => { if (!isTelegram) { onSelect(t); setOpen(false); setSearch(''); } }}
                      disabled={isTelegram}
                      className={`w-full text-left px-3 py-1.5 text-sm transition-colors flex items-baseline gap-2 ${
                        isTelegram
                          ? 'opacity-40 cursor-not-allowed'
                          : isSelected(t)
                            ? 'bg-blue-900/20 border-l-2 border-blue-500'
                            : 'hover:bg-gray-800'
                      }`}
                    >
                      <span className={`font-mono shrink-0 ${isTelegram ? 'text-gray-500' : 'text-yellow-300'}`}>
                        {t.id || '1'}
                      </span>
                      <span className="text-gray-400 text-xs shrink-0">
                        {t.platform}
                      </span>
                      {isTelegram && (
                        <span className="text-gray-600 text-[9px] shrink-0">(coming soon)</span>
                      )}
                      {t.language && (
                        <span className="text-gray-500 text-xs shrink-0">
                          {t.language}
                        </span>
                      )}
                      {t.name && (
                        <span className="text-gray-300 text-xs truncate">
                          {t.name}
                        </span>
                      )}
                      {t.description && (
                        <span className="text-gray-600 text-xs truncate">
                          {t.description}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
            {Object.keys(grouped).length === 0 && (
              <div className="px-3 py-4 text-gray-500 text-sm text-center">
                No templates match
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
