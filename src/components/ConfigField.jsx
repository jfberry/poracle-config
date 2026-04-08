import { useState, useEffect } from 'react';
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

// Map kind → display icon
const KIND_ICONS = {
  'discord:channel': '#',
  'discord:user': '@',
  'discord:role': '@',
  'discord:guild': '🏠',
  'telegram:user': '@',
  'telegram:channel': '#',
  'telegram:group': '👥',
  'telegram:chat': '💬',
  'webhook': '🔗',
};

// String field with ID resolution (for fields with resolve hint)
function ResolvableStringField({ value, onChange, resolve, resolveIds, placeholder }) {
  const [resolved, setResolved] = useState(null);

  useEffect(() => {
    if (!value || !resolve || !resolveIds) {
      setResolved(null);
      return;
    }
    let cancelled = false;
    let request;

    if (resolve === 'destination') {
      // Unknown-type ID — let the processor try everything
      request = { destinations: [value] };
    } else {
      const [platform, type] = resolve.split(':');
      if (platform === 'discord') {
        if (type === 'user|role') request = { discord: { users: [value], roles: [value] } };
        else if (type === 'target') request = { discord: { users: [value], channels: [value] } };
        else request = { discord: { [type + 's']: [value] } };
      } else if (platform === 'telegram') {
        request = { telegram: { chats: [value] } };
      }
    }
    if (!request) return;

    resolveIds(request).then((result) => {
      if (cancelled) return;
      let found = null;

      if (resolve === 'destination') {
        found = result.destinations?.[value] || null;
      } else {
        const [platform] = resolve.split(':');
        const platformResult = result[platform];
        if (platformResult) {
          for (const typeMap of Object.values(platformResult)) {
            if (typeMap[value]) {
              found = typeMap[value];
              break;
            }
          }
        }
      }
      setResolved(found);
    });
    return () => { cancelled = true; };
  }, [value, resolve, resolveIds]);

  const icon = resolved?.kind ? KIND_ICONS[resolved.kind] : null;

  return (
    <div>
      <input
        className={inputClass}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {resolved && (
        <div className="mt-0.5 flex items-start gap-1.5">
          {resolved.stale && (
            <span
              className="text-[11px] text-amber-400"
              title="This destination is registered but no longer exists on the platform — alerts will not be delivered"
            >
              ⚠️
            </span>
          )}
          <div className="flex-1">
            <p className="text-[10px] text-teal-400">
              {icon && <span className="text-gray-400 mr-0.5">{icon}</span>}
              {resolved.name || resolved.globalName || value}
              {resolved.guild && <span className="text-gray-500 ml-1">({resolved.guild})</span>}
              {resolved.kind && (
                <span className="text-gray-600 ml-1">[{resolved.kind}]</span>
              )}
              {resolved.enabled === false && (
                <span className="text-amber-500 ml-1">(disabled)</span>
              )}
            </p>
            {resolved.notes && (
              <p className="text-[10px] text-gray-500 italic">{resolved.notes}</p>
            )}
            {resolved.stale && (
              <p className="text-[10px] text-amber-400">
                Registered but unreachable on the platform
              </p>
            )}
          </div>
        </div>
      )}
    </div>
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
        <div key={`${k}-${i}`} className="flex gap-1.5 items-center">
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

export default function ConfigField({ field, value, onChange, isDirty, defaultValue, originalValue, onReset, onClearOverride, isOverridden: isOverriddenBadge, resolveIds }) {
  const { name, type, description, hotReload, sensitive, options, resolve } = field;

  const isOverridden = JSON.stringify(originalValue) !== JSON.stringify(defaultValue);

  return (
    <div className={`py-2 ${isDirty ? 'border-l-2 border-blue-500 pl-3' : 'pl-3'}`}>
      <div className="flex items-center gap-2 mb-1">
        <label className="text-sm text-gray-300 font-medium">{name}</label>
        {isOverriddenBadge && (
          <span className="text-[9px] px-1 py-px bg-teal-900/40 text-teal-300 rounded" title="Currently set in overrides.json (web editor)">via editor</span>
        )}
        {!hotReload && (
          <span className="text-[10px] text-amber-500" title="Requires restart to take effect">🔄</span>
        )}
        {isDirty && (
          <span className="text-[10px] text-blue-400">modified</span>
        )}
        {isDirty && onReset && (
          <button
            type="button"
            onClick={onReset}
            title="Revert to loaded value"
            className="text-[10px] text-gray-400 hover:text-gray-200 border border-gray-700 rounded px-1"
          >
            ↶ undo
          </button>
        )}
        {isOverridden && onClearOverride && (
          <button
            type="button"
            onClick={onClearOverride}
            title="Clear override (reset to schema default)"
            className="text-[10px] text-gray-400 hover:text-gray-200 border border-gray-700 rounded px-1"
          >
            × default
          </button>
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
      ) : resolve ? (
        <ResolvableStringField value={value} onChange={onChange} resolve={resolve} resolveIds={resolveIds} />
      ) : (
        <StringField value={value} onChange={onChange} />
      )}
    </div>
  );
}

export { ResolvedLabel };
