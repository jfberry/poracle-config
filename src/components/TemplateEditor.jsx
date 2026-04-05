import { useState, useCallback } from 'react';
import FormEditor from './FormEditor';
import RawEditor from './RawEditor';

export default function TemplateEditor({ template, onChange }) {
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 px-3 py-1.5 border-b border-gray-700 text-sm">
        <button
          onClick={() => setMode('form')}
          className={
            mode === 'form'
              ? 'text-blue-400 border-b-2 border-blue-400 pb-1'
              : 'text-gray-500 pb-1'
          }
        >
          Form
        </button>
        <button
          onClick={() => setMode('raw')}
          className={
            mode === 'raw'
              ? 'text-blue-400 border-b-2 border-blue-400 pb-1'
              : 'text-gray-500 pb-1'
          }
        >
          Raw JSON
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {mode === 'form' ? (
          <FormEditor template={template} onChange={onChange} />
        ) : (
          <RawEditor value={JSON.stringify(template, null, 2)} onChange={handleRawChange} />
        )}
      </div>
    </div>
  );
}
