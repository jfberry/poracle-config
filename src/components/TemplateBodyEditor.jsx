import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import FormEditor from './FormEditor';
import TelegramFormEditor from './TelegramFormEditor';
import RawEditor from './RawEditor';
import { tabClass } from '../lib/styles';

function tryParse(str) {
  if (typeof str !== 'string') return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Editor for the body of a DTS entry. Handles four cases:
 * - Genuine templateFile (templateFile filename set): raw Handlebars text editor only.
 *   Used for .hbs files that typically contain Handlebars block helpers.
 * - Parseable string body (templateFileContent set, templateFile NOT set, string parses
 *   as JSON): Form/Raw toggle. Form mode edits the parsed object via FormEditor;
 *   Raw mode edits the string and best-effort keeps the parsed object in sync.
 * - Unparseable string body (templateFileContent set, templateFile NOT set, doesn't
 *   parse): raw Handlebars text editor only.
 * - Pure object body (template set, no templateFileContent): Form/Raw toggle as before.
 */
export default function TemplateBodyEditor({
  template,
  templateFileContent,
  templateFile,
  onChange,
  onFileContentChange,
  platform,
  readOnly = false,
}) {
  const hasFileContent = templateFileContent != null;
  const isTrueTemplateFile = hasFileContent && templateFile != null;

  // Try to parse templateFileContent into an object (only when it's not a true .hbs file).
  const parsedFileContent = useMemo(
    () => (hasFileContent && !isTrueTemplateFile ? tryParse(templateFileContent) : null),
    [hasFileContent, isTrueTemplateFile, templateFileContent]
  );
  const stringBodyParseable = hasFileContent && !isTrueTemplateFile && parsedFileContent != null;

  // True templateFile path: raw only, no toggle.
  if (isTrueTemplateFile) {
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

  // Unparseable string body: raw only.
  if (hasFileContent && !stringBodyParseable) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-700 text-sm">
          <span className="text-blue-400 text-xs font-medium">Raw template</span>
          <span className="text-gray-500 text-[10px]">String body with Handlebars outside JSON — Form view unavailable</span>
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

  // Form/Raw toggle path. Covers two sub-cases:
  //   (a) pure object body (template set, templateFileContent null)
  //   (b) parseable string body (templateFileContent set, parses as JSON)
  return (
    <FormRawToggle
      template={template}
      onChange={onChange}
      onFileContentChange={onFileContentChange}
      templateFileContent={templateFileContent}
      parsedFileContent={parsedFileContent}
      stringBodyParseable={stringBodyParseable}
      platform={platform}
      readOnly={readOnly}
    />
  );
}

function FormRawToggle({
  template,
  onChange,
  onFileContentChange,
  templateFileContent,
  parsedFileContent,
  stringBodyParseable,
  platform,
  readOnly,
}) {
  // Effective "current object" for Form mode: prefer the live template prop;
  // fall back to the parsed file-content if template is missing.
  const effectiveTemplate = template ?? parsedFileContent;

  const [mode, setMode] = useState('form');
  // rawText holds the editable string. For pure-object case, derive from template
  // via JSON.stringify. For parseable-string case, default to templateFileContent.
  const [rawText, setRawText] = useState(() =>
    stringBodyParseable ? (templateFileContent ?? '') : JSON.stringify(template ?? {}, null, 2)
  );
  const debounceRef = useRef(null);
  const userEditingRef = useRef(false);

  // Resync rawText on switches and when external props change while not actively editing.
  useEffect(() => {
    if (mode !== 'raw' || userEditingRef.current) return;
    if (stringBodyParseable) {
      if (templateFileContent != null) setRawText(templateFileContent);
    } else if (template) {
      setRawText(JSON.stringify(template, null, 2));
    }
  }, [template, templateFileContent, stringBodyParseable, mode]);

  const switchToRaw = useCallback(() => {
    if (stringBodyParseable) {
      // Prefer the current object's serialization (latest Form edits) over the old templateFileContent.
      if (effectiveTemplate) setRawText(JSON.stringify(effectiveTemplate, null, 2));
    } else {
      setRawText(JSON.stringify(template ?? {}, null, 2));
    }
    userEditingRef.current = false;
    setMode('raw');
  }, [template, effectiveTemplate, stringBodyParseable]);

  const switchToForm = useCallback(() => {
    if (userEditingRef.current) {
      try {
        const parsed = JSON.parse(rawText);
        onChange?.(parsed);
        if (stringBodyParseable) onFileContentChange?.(JSON.stringify(parsed, null, 2));
      } catch {
        // keep last valid template
      }
    }
    userEditingRef.current = false;
    setMode('form');
  }, [rawText, onChange, onFileContentChange, stringBodyParseable]);

  const handleRawChange = useCallback(
    (text) => {
      setRawText(text);
      userEditingRef.current = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        // Always propagate the raw string when we have an onFileContentChange and we're in
        // a string-body case — that keeps templateFileContent live for save handlers.
        if (stringBodyParseable && onFileContentChange) onFileContentChange(text);
        // Try to parse and update the object form too.
        try {
          const parsed = JSON.parse(text);
          onChange?.(parsed);
        } catch {
          // still invalid JSON — leave template stale; Raw is the active view.
        }
      }, 800);
    },
    [onChange, onFileContentChange, stringBodyParseable]
  );

  const handleFormChange = useCallback(
    (next) => {
      onChange?.(next);
      // Keep the templateFileContent string in sync so that toggling to Raw shows fresh state
      // and the save handler (if it uses templateFileContent) has the latest.
      if (stringBodyParseable && onFileContentChange) {
        onFileContentChange(JSON.stringify(next, null, 2));
      }
    },
    [onChange, onFileContentChange, stringBodyParseable]
  );

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const isTelegram = platform === 'telegram';

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 px-3 py-1.5 border-b border-gray-700 text-sm">
        <button onClick={switchToForm} className={tabClass(mode === 'form')}>Form</button>
        <button onClick={switchToRaw} className={tabClass(mode === 'raw')}>Raw JSON</button>
        {stringBodyParseable && (
          <span className="ml-2 text-[10px] text-gray-500 self-center">
            Parsed from string body — Form edits restringify on save
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {mode === 'form' ? (
          isTelegram ? (
            <TelegramFormEditor template={effectiveTemplate ?? {}} onChange={readOnly ? () => {} : handleFormChange} />
          ) : (
            <FormEditor template={effectiveTemplate ?? {}} onChange={readOnly ? () => {} : handleFormChange} />
          )
        ) : (
          <RawEditor value={rawText} onChange={readOnly ? () => {} : handleRawChange} />
        )}
      </div>
    </div>
  );
}
