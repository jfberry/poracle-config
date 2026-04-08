import { useState } from 'react';
import ConfigField from './ConfigField';
import ConfigTagInput from './ConfigTagInput';

export default function ConfigTable({ table, value, onChange, resolveIds, geofenceAreas, overriddenFields, sectionName, tableName }) {
  const [expandedIndex, setExpandedIndex] = useState(null);
  const entries = Array.isArray(value) ? value : [];

  const updateEntry = (index, field, fieldValue) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: fieldValue };
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

  // Determine a display label for each entry
  const entryLabel = (entry) => {
    // Use the first string field as label
    for (const field of table.fields) {
      if (field.type === 'string' && entry[field.name]) {
        return entry[field.name];
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
                const fieldValue = entry[field.name];
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
