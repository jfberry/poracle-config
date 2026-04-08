import { useState, useCallback } from 'react';
import FormEditor from './FormEditor';
import TelegramFormEditor from './TelegramFormEditor';
import RawEditor from './RawEditor';
import { tabClass } from '../lib/styles';

export default function TemplateEditor({ template, onChange, platform }) {
  const [mode, setMode] = useState('form');

  const handleRawChange = useCallback(
    (text) => {
      try {
        const parsed = JSON.parse(text);
        onChange(parsed);
      } catch {
        // Ignore parse errors while typing
      }
    },
    [onChange]
  );

  const isTelegram = platform === 'telegram';

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 px-3 py-1.5 border-b border-gray-700 text-sm">
        <button onClick={() => setMode('form')} className={tabClass(mode === 'form')}>
          Form
        </button>
        <button onClick={() => setMode('raw')} className={tabClass(mode === 'raw')}>
          Raw JSON
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {mode === 'form' ? (
          isTelegram ? (
            <TelegramFormEditor template={template} onChange={onChange} />
          ) : (
            <FormEditor template={template} onChange={onChange} />
          )
        ) : (
          <RawEditor value={JSON.stringify(template, null, 2)} onChange={handleRawChange} />
        )}
      </div>
    </div>
  );
}
