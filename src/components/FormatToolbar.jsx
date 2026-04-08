import { useEffect, useCallback } from 'react';

const formats = [
  { label: 'B', title: 'Bold', before: '**', after: '**', style: 'font-bold', shortcut: 'b' },
  { label: 'I', title: 'Italic', before: '*', after: '*', style: 'italic', shortcut: 'i' },
  { label: 'U', title: 'Underline', before: '__', after: '__', style: 'underline', shortcut: 'u' },
  { label: 'S', title: 'Strikethrough', before: '~~', after: '~~', style: 'line-through', shortcut: 'd' },
  { label: '`', title: 'Inline code', before: '`', after: '`', style: 'font-mono', shortcut: 'e' },
  { label: '```', title: 'Code block', before: '```\n', after: '\n```', style: 'font-mono text-[9px]' },
  { label: '||', title: 'Spoiler', before: '||', after: '||', style: '' },
  { label: '>', title: 'Block quote', before: '> ', after: '', style: '' },
  { label: '🔗', title: 'Link', before: '[', after: '](url)', style: '', shortcut: 'k' },
];

// Map shortcut keys to formats for quick lookup
const shortcutMap = {};
for (const f of formats) {
  if (f.shortcut) shortcutMap[f.shortcut] = f;
}

function applyFormat(el, format) {
  if (!el) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const selected = el.value.substring(start, end);

  el.focus();
  el.setSelectionRange(start, end);

  const insertText = format.before + (selected || 'text') + format.after;
  document.execCommand('insertText', false, insertText);

  // If no text was selected, select the placeholder 'text' so user can type over it
  if (!selected && format.after) {
    const textStart = start + format.before.length;
    const textEnd = textStart + 4;
    requestAnimationFrame(() => {
      el.setSelectionRange(textStart, textEnd);
    });
  }
}

/**
 * Discord markdown formatting toolbar.
 * Wraps selected text or inserts markers at cursor.
 * Supports keyboard shortcuts (Cmd/Ctrl + B, I, U, D, E, K).
 *
 * Uses document.activeElement at click time — the button's onMouseDown
 * preventDefault keeps focus on the input, so it remains active.
 */
export default function FormatToolbar({ targetRef }) {
  // Keyboard shortcuts: Cmd/Ctrl + key, attached to the container only.
  useEffect(() => {
    const container = targetRef?.current;
    if (!container) return;

    const handleKeyDown = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const format = shortcutMap[e.key.toLowerCase()];
      if (!format) return;

      const el = e.target;
      if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;

      e.preventDefault();
      applyFormat(el, format);
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [targetRef]);

  const handleFormat = useCallback((format) => {
    const el = document.activeElement;
    if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return;
    applyFormat(el, format);
  }, []);

  return (
    <div className="flex gap-0.5 flex-wrap">
      {formats.map((f) => (
        <button
          key={f.title}
          onMouseDown={(e) => e.preventDefault()} // prevent stealing focus
          onClick={() => handleFormat(f)}
          title={f.title + (f.shortcut ? ` (${navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl+'}${f.shortcut.toUpperCase()})` : '')}
          className={`px-1.5 py-0.5 text-[11px] rounded bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 border border-transparent hover:border-gray-600 transition-colors ${f.style}`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
