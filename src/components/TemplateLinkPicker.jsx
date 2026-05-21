import { useMemo, useState, useRef, useEffect } from 'react';

/**
 * Dropdown that filters the in-memory templates list to entries of a given
 * type (default: "buttonResponse") and emits the selected id via onChange.
 *
 * Props:
 * - templates — full templates list from useDts
 * - value — currently selected template id (string)
 * - onChange — (id: string) => void
 * - onJumpTo — (template) => void; opens the linked entry in the main editor
 * - type — DTS type to filter on (default "buttonResponse")
 * - platform — optional; filter to entries with matching platform when present
 */
export default function TemplateLinkPicker({
  templates,
  value,
  onChange,
  onJumpTo,
  type = 'buttonResponse',
  platform,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const candidates = useMemo(() => {
    return templates.filter((t) => {
      if (t.type !== type) return false;
      if (platform && t.platform && t.platform !== platform) return false;
      if (!search) return true;
      const haystack = `${t.id} ${t.name || ''} ${t.description || ''}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  }, [templates, type, platform, search]);

  const selected = templates.find((t) => t.type === type && String(t.id) === String(value));

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-left hover:bg-gray-700"
        >
          {selected ? (
            <span className="text-yellow-300 font-mono">{selected.id}</span>
          ) : value ? (
            <span className="text-red-400 font-mono">{value} (not found)</span>
          ) : (
            <span className="text-gray-500">Pick a {type} template...</span>
          )}
          {selected?.name && <span className="text-gray-400 ml-2">{selected.name}</span>}
        </button>
        {selected && (
          <button
            type="button"
            onClick={() => onJumpTo?.(selected)}
            className="text-xs px-2 py-1 bg-blue-900/40 hover:bg-blue-900/60 text-blue-300 rounded"
            title="Open this template in the editor"
          >
            Jump to
          </button>
        )}
      </div>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 max-h-64 bg-gray-900 border border-gray-600 rounded shadow-xl z-50 flex flex-col">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${type}...`}
            className="m-1 px-2 py-1 bg-gray-800 text-gray-200 border border-gray-700 rounded text-xs shrink-0"
          />
          <div className="overflow-y-auto">
            {candidates.length === 0 && (
              <div className="px-2 py-2 text-gray-500 text-xs">
                No {type} templates yet.
              </div>
            )}
            {candidates.map((t) => (
              <button
                key={`${t.id}-${t.platform}-${t.language}`}
                type="button"
                onClick={() => { onChange(String(t.id)); setOpen(false); setSearch(''); }}
                className="w-full text-left px-2 py-1 text-xs hover:bg-gray-800 flex items-baseline gap-2"
              >
                <span className="text-yellow-300 font-mono shrink-0">{t.id}</span>
                <span className="text-gray-400 truncate">{t.name || t.description || ''}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
