import { useState, useEffect, useId } from 'react';
import { inputClass } from '../lib/styles';
import { buildResolveRequest, extractResolvedMap } from '../lib/resolve-utils';

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

function ResolvedLabel({ id, resolved }) {
  if (!resolved) return <span className="font-mono">{id}</span>;
  const icon = resolved.kind ? KIND_ICONS[resolved.kind] : null;
  return (
    <span>
      {resolved.stale && (
        <span className="text-amber-400 mr-0.5" title="Registered but unreachable on the platform">⚠️</span>
      )}
      {icon && <span className="text-gray-400 mr-0.5">{icon}</span>}
      <span className="text-gray-200">{resolved.name || resolved.globalName || id}</span>
      {resolved.guild && <span className="text-gray-500 text-[10px] ml-1">({resolved.guild})</span>}
      {resolved.enabled === false && <span className="text-amber-500 text-[10px] ml-1">(disabled)</span>}
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

function ColorArrayField({ value, onChange, minLength, maxLength }) {
  const items = Array.isArray(value) ? value : [];
  const count = Math.max(minLength || 0, items.length);
  const fixed = minLength && minLength === maxLength;

  const updateAt = (i, color) => {
    const updated = [...items];
    while (updated.length <= i) updated.push('#000000');
    updated[i] = color;
    onChange(updated);
  };

  const removeAt = (i) => {
    onChange(items.filter((_, idx) => idx !== i));
  };

  const addItem = () => {
    onChange([...items, '#000000']);
  };

  const atMax = maxLength && items.length >= maxLength;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: count }).map((_, i) => {
          const color = items[i] || '#000000';
          return (
            <div key={i} className="flex items-center gap-1">
              <input
                type="color"
                value={color}
                onChange={(e) => updateAt(i, e.target.value)}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border border-gray-600"
              />
              <span className="text-[10px] font-mono text-gray-500">{color}</span>
              {!fixed && (
                <button
                  onClick={() => removeAt(i)}
                  className="text-red-400 hover:text-red-300 text-xs"
                  type="button"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
      {!fixed && (
        <button
          onClick={addItem}
          disabled={atMax}
          className="text-xs text-blue-400 hover:text-blue-300 disabled:text-gray-600 disabled:cursor-not-allowed"
          type="button"
        >
          + Add color
        </button>
      )}
    </div>
  );
}

function IntArrayField({ value, onChange, minLength, maxLength }) {
  const items = Array.isArray(value) ? value : [];

  const updateAt = (i, num) => {
    const updated = [...items];
    updated[i] = num;
    onChange(updated);
  };

  const removeAt = (i) => {
    onChange(items.filter((_, idx) => idx !== i));
  };

  const addItem = () => {
    onChange([...items, 0]);
  };

  const atMax = maxLength && items.length >= maxLength;

  return (
    <div className="space-y-1">
      {items.map((n, i) => (
        <div key={i} className="flex gap-1.5 items-center">
          <input
            type="number"
            value={n}
            onChange={(e) => updateAt(i, parseInt(e.target.value, 10) || 0)}
            className={inputClass + ' w-32'}
          />
          <button
            onClick={() => removeAt(i)}
            className="text-red-400 hover:text-red-300 text-xs"
            type="button"
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={addItem}
        disabled={atMax}
        className="text-xs text-blue-400 hover:text-blue-300 disabled:text-gray-600 disabled:cursor-not-allowed"
        type="button"
      >
        + Add
      </button>
    </div>
  );
}

// String field with ID resolution (for fields with resolve hint)
function ResolvableStringField({ value, onChange, resolve, resolveIds, placeholder }) {
  const [resolved, setResolved] = useState(null);

  useEffect(() => {
    if (!value || !resolve || !resolveIds) {
      setResolved(null);
      return;
    }
    let cancelled = false;
    const request = buildResolveRequest(resolve, [value]);
    if (!request) return;

    resolveIds(request).then((result) => {
      if (cancelled) return;
      const map = extractResolvedMap(resolve, result);
      setResolved(map[value] || null);
    });
    return () => { cancelled = true; };
  }, [value, resolve, resolveIds]);

  const icon = resolved?.kind ? KIND_ICONS[resolved.kind] : null;

  return (
    <div>
      {resolved && (
        <div className="mb-1 inline-flex items-start gap-1 bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-xs">
          {resolved.stale && (
            <span
              className="text-amber-400"
              title="This destination is registered but no longer exists on the platform — alerts will not be delivered"
            >
              ⚠️
            </span>
          )}
          {icon && <span className="text-gray-400">{icon}</span>}
          <div>
            <span className="text-gray-200">
              {resolved.name || resolved.globalName || value}
            </span>
            {resolved.guild && <span className="text-gray-500 text-[10px] ml-1">({resolved.guild})</span>}
            {resolved.enabled === false && <span className="text-amber-500 text-[10px] ml-1">(disabled)</span>}
            {resolved.notes && (
              <span className="block text-[10px] text-gray-500 italic">{resolved.notes}</span>
            )}
            {resolved.stale && (
              <span className="block text-[10px] text-amber-400">
                Registered but unreachable on the platform
              </span>
            )}
          </div>
        </div>
      )}
      <input
        className={inputClass}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function NumberField({ value, onChange, isFloat, placeholder }) {
  return (
    <input
      className={inputClass}
      type="number"
      step={isFloat ? 'any' : '1'}
      value={value ?? ''}
      placeholder={placeholder}
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
  const radioName = useId();
  const visibleOptions = options.filter(
    (opt) => !opt.deprecated || String(value) === String(opt.value)
  );
  if (visibleOptions.length <= 5) {
    // Radio group
    return (
      <div className="space-y-1.5">
        {visibleOptions.map((opt) => (
          <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name={radioName}
              checked={String(value) === String(opt.value)}
              onChange={() => onChange(opt.value)}
              className="mt-1"
            />
            <div>
              <span className="text-sm text-gray-200">
                {opt.label}
                {opt.deprecated && (
                  <span className="text-amber-500 text-[10px] ml-1">(deprecated)</span>
                )}
              </span>
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
      {visibleOptions.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}{opt.deprecated ? ' (deprecated)' : ''}
        </option>
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

export default function ConfigField({ field, value, onChange, isDirty, defaultValue, originalValue, onReset, onClearOverride, isOverridden: isOverriddenBadge, resolveIds, disabled, disabledReason, validationIssue }) {
  const { name, type, description, hotReload, sensitive, options, resolve } = field;

  const isOverridden = JSON.stringify(originalValue) !== JSON.stringify(defaultValue);
  const placeholder = field.hideDefault ? String(field.default ?? '') : undefined;

  const issueSeverity = validationIssue?.severity;
  const borderClass = issueSeverity === 'error'
    ? 'border-l-2 border-red-500'
    : issueSeverity === 'warning'
    ? 'border-l-2 border-amber-500'
    : isDirty
    ? 'border-l-2 border-blue-500'
    : '';

  return (
    <div className={`py-2 pl-3 ${borderClass}`}>
      <div className="flex items-center gap-2 mb-1">
        <label
          className="text-sm text-gray-300 font-medium"
          title={disabled && disabledReason ? disabledReason : undefined}
        >
          {name}
        </label>
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

      <div className={disabled ? 'pointer-events-none opacity-50' : ''}>
        {sensitive ? (
          <SensitiveField value={value} onChange={onChange} />
        ) : type === 'bool' ? (
          <BoolField value={value} onChange={onChange} label={description} />
        ) : type === 'select' && options ? (
          <SelectField value={value} onChange={onChange} options={options} />
        ) : type === 'int' ? (
          <NumberField value={value} onChange={onChange} isFloat={false} placeholder={placeholder} />
        ) : type === 'float' ? (
          <NumberField value={value} onChange={onChange} isFloat={true} placeholder={placeholder} />
        ) : type === 'map' ? (
          <MapField value={value} onChange={onChange} />
        ) : type === 'color[]' ? (
          <ColorArrayField value={value} onChange={onChange} minLength={field.minLength} maxLength={field.maxLength} />
        ) : type === 'int[]' ? (
          <IntArrayField value={value} onChange={onChange} minLength={field.minLength} maxLength={field.maxLength} />
        ) : resolve ? (
          <ResolvableStringField value={value} onChange={onChange} resolve={resolve} resolveIds={resolveIds} placeholder={placeholder} />
        ) : (
          <StringField value={value} onChange={onChange} placeholder={placeholder} />
        )}
      </div>
      {(type === 'color[]' || type === 'int[]') && Array.isArray(value) && field.minLength && value.length < field.minLength && (
        <p className="text-[11px] text-red-400 mt-1">Minimum {field.minLength} entries required</p>
      )}
      {validationIssue && (
        <p className={`text-[11px] mt-1 ${issueSeverity === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
          {validationIssue.message}
        </p>
      )}
    </div>
  );
}

export { ResolvedLabel };
