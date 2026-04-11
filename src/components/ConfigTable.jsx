import { useState } from 'react';
import ConfigField from './ConfigField';
import ConfigTagInput from './ConfigTagInput';

// Case-insensitive lookup: find the actual key in the object that matches the schema name
function findKey(obj, schemaName) {
  if (!obj || typeof obj !== 'object') return schemaName;
  if (schemaName in obj) return schemaName;
  const lower = schemaName.toLowerCase();
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === lower) return key;
  }
  return schemaName;
}

export default function ConfigTable({ table, value, onChange, resolveIds, geofenceAreas, overriddenFields, sectionName, tableName }) {
  const [expandedIndex, setExpandedIndex] = useState(null);
  const entries = Array.isArray(value) ? value : [];

  const updateEntry = (index, schemaField, fieldValue) => {
    const updated = [...entries];
    const entry = updated[index];
    // Use the actual key from the entry (handles Go-cased keys like Guild vs guild)
    const actualKey = findKey(entry, schemaField);
    updated[index] = { ...entry, [actualKey]: fieldValue };
    onChange(updated);
  };

  const removeEntry = (index) => {
    if (!confirm(`Remove this ${table.title || table.name} entry?`)) return;
    const updated = entries.filter((_, i) => i !== index);
    onChange(updated);
  };

  const addEntry = () => {
    const newEntry = {};
    for (const field of table.fields) {
      if (field.type === 'string[]') newEntry[field.name] = [];
      else if (field.type === 'bool') newEntry[field.name] = false;
      else if (field.type === 'int' || field.type === 'float') newEntry[field.name] = 0;
      else newEntry[field.name] = '';
    }
    onChange([...entries, newEntry]);
    setExpandedIndex(entries.length);
  };

  // Determine a display label for each entry (case-insensitive field lookup)
  const entryLabel = (entry) => {
    for (const field of table.fields) {
      const key = findKey(entry, field.name);
      if (field.type === 'string' && entry[key]) {
        return entry[key];
      }
    }
    return '(unnamed)';
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-400 mb-1">{table.description}</div>
      {entries.map((entry, index) => (
        <div key={index} className="border border-gray-700 rounded">
          <div
            className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-800/50"
            onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500">{expandedIndex === index ? '▼' : '▶'}</span>
              <span className="text-sm text-gray-300">{entryLabel(entry)}</span>
              <span className="text-[10px] text-gray-600">#{index + 1}</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); removeEntry(index); }}
              className="text-xs text-red-400 hover:text-red-300"
              type="button"
            >
              Remove
            </button>
          </div>
          {expandedIndex === index && (
            <div className="px-3 pb-3 border-t border-gray-700 space-y-2 pt-2">
              {table.fields.map((field) => {
                const actualKey = findKey(entry, field.name);
                const fieldValue = entry[actualKey];
                if (field.type === 'string[]') {
                  return (
                    <div key={field.name}>
                      <label className="block text-xs text-gray-400 mb-1">{field.name}</label>
                      {field.description && (
                        <p className="text-[10px] text-gray-500 mb-1">{field.description}</p>
                      )}
                      <ConfigTagInput
                        value={fieldValue}
                        onChange={(v) => updateEntry(index, field.name, v)}
                        resolve={field.resolve}
                        resolveIds={resolveIds}
                        field={field}
                        suggestions={field.resolve === 'geofence:area' ? geofenceAreas : undefined}
                        sensitive={field.sensitive === true}
                      />
                    </div>
                  );
                }
                return (
                  <ConfigField
                    key={field.name}
                    field={field}
                    value={fieldValue}
                    onChange={(v) => updateEntry(index, field.name, v)}
                    isDirty={false}
                    resolveIds={resolveIds}
                  />
                );
              })}
            </div>
          )}
        </div>
      ))}
      <button
        onClick={addEntry}
        className="w-full text-sm text-blue-400 hover:text-blue-300 border border-dashed border-gray-600 rounded py-1.5"
        type="button"
      >
        + Add {table.title || table.name}
      </button>
    </div>
  );
}
