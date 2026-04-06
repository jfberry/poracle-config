import { useState } from 'react';
import { inputClass } from '../lib/styles';

function ResolvedLabel({ id, resolved }) {
  if (!resolved) return <span className="font-mono">{id}</span>;
  return (
    <span>
      <span className="text-gray-200">{resolved.name || resolved.globalName || id}</span>
      {resolved.guild && <span className="text-gray-500 text-[10px] ml-1">({resolved.guild})</span>}
      <span className="block text-[10px] text-gray-500 font-mono">{id}</span>
    </span>
  );
}

function StringField({ value, onChange, placeholder }) {
  return (
    <input
      className={inputClass}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function NumberField({ value, onChange, isFloat }) {
  return (
    <input
      className={inputClass}
      type="number"
      step={isFloat ? 'any' : '1'}
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value;
        if (v === '') onChange(undefined);
        else onChange(isFloat ? parseFloat(v) : parseInt(v, 10));
      }}
    />
  );
}

function BoolField({ value, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded"
      />
      <span className="text-sm text-gray-300">{label}</span>
    </label>
  );
}

function SelectField({ value, onChange, options }) {
  if (options.length <= 5) {
    // Radio group
    return (
      <div className="space-y-1.5">
        {options.map((opt) => (
          <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name={`select-${options[0]?.value}`}
              checked={String(value) === String(opt.value)}
              onChange={() => onChange(opt.value)}
              className="mt-1"
            />
            <div>
              <span className="text-sm text-gray-200">{opt.label}</span>
              {opt.description && (
                <span className="block text-[11px] text-gray-500">{opt.description}</span>
              )}
            </div>
          </label>
        ))}
      </div>
    );
  }
  // Dropdown for > 5 options
  return (
    <select
      className={inputClass}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

function SensitiveField({ value, onChange }) {
  const [revealed, setRevealed] = useState(false);
  const isMasked = value === '****';

  return (
    <div className="flex gap-2">
      <input
        className={inputClass + ' flex-1'}
        type={revealed ? 'text' : 'password'}
        value={isMasked && !revealed ? '' : (value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isMasked ? '(unchanged)' : ''}
      />
      <button
        onClick={() => setRevealed(!revealed)}
        className="text-xs text-gray-500 hover:text-gray-300 px-2"
        type="button"
      >
        {revealed ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

function MapField({ value, onChange }) {
  const entries = Object.entries(value || {});

  const updateKey = (oldKey, newKey) => {
    const updated = {};
    for (const [k, v] of entries) {
      updated[k === oldKey ? newKey : k] = v;
    }
    onChange(updated);
  };

  const updateValue = (key, newValue) => {
    onChange({ ...value, [key]: newValue });
  };

  const addEntry = () => {
    onChange({ ...value, '': '' });
  };

  const removeEntry = (key) => {
    const updated = { ...value };
    delete updated[key];
    onChange(updated);
  };

  return (
    <div className="space-y-1.5">
      {entries.map(([k, v], i) => (
        <div key={i} className="flex gap-1.5 items-center">
          <input
            className={inputClass + ' flex-1'}
            value={k}
            onChange={(e) => updateKey(k, e.target.value)}
            placeholder="Key"
          />
          <input
            className={inputClass + ' flex-1'}
            value={v ?? ''}
            onChange={(e) => updateValue(k, e.target.value)}
            placeholder="Value"
          />
          <button
            onClick={() => removeEntry(k)}
            className="text-red-400 hover:text-red-300 text-xs px-1"
            type="button"
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={addEntry}
        className="text-xs text-blue-400 hover:text-blue-300"
        type="button"
      >
        + Add entry
      </button>
    </div>
  );
}

export default function ConfigField({ field, value, onChange, isDirty }) {
  const { name, type, description, hotReload, sensitive, options } = field;

  return (
    <div className={`py-2 ${isDirty ? 'border-l-2 border-blue-500 pl-3' : 'pl-3'}`}>
      <div className="flex items-center gap-2 mb-1">
        <label className="text-sm text-gray-300 font-medium">{name}</label>
        {!hotReload && (
          <span className="text-[10px] text-amber-500" title="Requires restart to take effect">🔄</span>
        )}
        {isDirty && (
          <span className="text-[10px] text-blue-400">modified</span>
        )}
      </div>
      {description && (
        <p className="text-[11px] text-gray-500 mb-1.5">{description}</p>
      )}

      {sensitive ? (
        <SensitiveField value={value} onChange={onChange} />
      ) : type === 'bool' ? (
        <BoolField value={value} onChange={onChange} label={description} />
      ) : type === 'select' && options ? (
        <SelectField value={value} onChange={onChange} options={options} />
      ) : type === 'int' ? (
        <NumberField value={value} onChange={onChange} isFloat={false} />
      ) : type === 'float' ? (
        <NumberField value={value} onChange={onChange} isFloat={true} />
      ) : type === 'map' ? (
        <MapField value={value} onChange={onChange} />
      ) : (
        <StringField value={value} onChange={onChange} />
      )}
    </div>
  );
}

export { ResolvedLabel };
