import { useState, useRef, useEffect } from 'react';
import { useInsertAtCursor } from '../hooks/useInsertAtCursor';
import { inputClass } from '../lib/styles';

/**
 * Compact single-line text input for short Handlebars expressions
 * (used for button `show_if`). Wires useInsertAtCursor and offers a
 * popover field picker.
 *
 * Props:
 * - value, onChange — controlled input
 * - fields — Array<{ name: string, description?: string, category?: string }>
 * - placeholder
 */
export default function HandlebarsExpressionInput({
  value,
  onChange,
  fields = [],
  placeholder = '',
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { containerRef, insertAtCursor } = useInsertAtCursor();
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDocClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [pickerOpen]);

  const handleInsert = (fieldName) => {
    const inserted = insertAtCursor(`{{${fieldName}}}`);
    if (!inserted) onChange((value || '') + `{{${fieldName}}}`);
    setPickerOpen(false);
    setSearch('');
  };

  const filtered = fields.filter((f) =>
    !search || f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative flex items-center gap-1">
      <input
        type="text"
        className={inputClass + ' flex-1 font-mono text-xs'}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        className="text-xs px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded shrink-0"
        title="Insert field"
      >
        {'{}'}
      </button>
      {pickerOpen && (
        <div
          ref={popoverRef}
          className="absolute top-full right-0 mt-1 w-64 max-h-64 bg-gray-900 border border-gray-600 rounded shadow-xl z-50 flex flex-col"
        >
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter fields..."
            className="m-1 px-2 py-1 bg-gray-800 text-gray-200 border border-gray-700 rounded text-xs shrink-0"
          />
          <div className="overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-2 py-1 text-gray-500 text-xs">No matches</div>
            )}
            {filtered.map((f) => (
              <button
                key={f.name}
                type="button"
                onClick={() => handleInsert(f.name)}
                className="w-full text-left px-2 py-1 text-xs text-gray-200 hover:bg-gray-800 font-mono truncate"
                title={f.description || ''}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
