import { useState, useCallback, useRef, useEffect } from 'react';
import FormEditor from './FormEditor';
import TelegramFormEditor from './TelegramFormEditor';
import RawEditor from './RawEditor';
import { tabClass } from '../lib/styles';

/**
 * Editor for the body of a DTS entry. Handles three modes:
 * - templateFile: raw Handlebars text editor
 * - form: structured form (Discord or Telegram)
 * - raw: JSON text editor with debounced parse
 *
 * Used by TemplateEditor (main entry body) and ButtonDispatchEditor
 * (inline-template button responses). Does NOT render the buttons section
 * itself — that's TemplateEditor's job.
 */
export default function TemplateBodyEditor({
  template,
  templateFileContent,
  onChange,
  onFileContentChange,
  platform,
  readOnly = false,
}) {
  const [mode, setMode] = useState('form');
  const [rawText, setRawText] = useState('');
  const debounceRef = useRef(null);
  const userEditingRef = useRef(false);

  useEffect(() => {
    if (mode === 'raw' && !userEditingRef.current && template) {
      setRawText(JSON.stringify(template, null, 2));
    }
  }, [template, mode]);

  const switchToRaw = useCallback(() => {
    setRawText(JSON.stringify(template, null, 2));
    userEditingRef.current = false;
    setMode('raw');
  }, [template]);

  const switchToForm = useCallback(() => {
    if (userEditingRef.current) {
      try {
        const parsed = JSON.parse(rawText);
        onChange(parsed);
      } catch {
        // keep last valid template
      }
    }
    userEditingRef.current = false;
    setMode('form');
  }, [rawText, onChange]);

  const handleRawChange = useCallback(
    (text) => {
      setRawText(text);
      userEditingRef.current = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        try {
          const parsed = JSON.parse(text);
          onChange(parsed);
        } catch {
          // still invalid JSON
        }
      }, 800);
    },
    [onChange]
  );

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const isTemplateFile = templateFileContent != null;
  const isTelegram = platform === 'telegram';

  if (isTemplateFile) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-700 text-sm">
          <span className="text-blue-400 text-xs font-medium">Template File</span>
          <span className="text-gray-500 text-[10px]">Raw Handlebars — not structured JSON</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <RawEditor
            value={templateFileContent}
            onChange={readOnly ? () => {} : (text) => onFileContentChange?.(text)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 px-3 py-1.5 border-b border-gray-700 text-sm">
        <button onClick={switchToForm} className={tabClass(mode === 'form')}>Form</button>
        <button onClick={switchToRaw} className={tabClass(mode === 'raw')}>Raw JSON</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {mode === 'form' ? (
          isTelegram ? (
            <TelegramFormEditor template={template} onChange={readOnly ? () => {} : onChange} />
          ) : (
            <FormEditor template={template} onChange={readOnly ? () => {} : onChange} />
          )
        ) : (
          <RawEditor value={rawText} onChange={readOnly ? () => {} : handleRawChange} />
        )}
      </div>
    </div>
  );
}
