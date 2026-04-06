import ConfigField from './ConfigField';
import ConfigTagInput from './ConfigTagInput';
import ConfigTable from './ConfigTable';

export default function ConfigSection({ section, values, originalValues, onUpdateField, resolveIds, dirtyFieldNames }) {
  const sectionValues = values || {};

  // Evaluate dependency visibility
  const isVisible = (field) => {
    if (!field.dependsOn) return true;
    const parentValue = sectionValues[field.dependsOn.field];
    if (field.dependsOn.value === true) return !!parentValue;
    if (field.dependsOn.value === false) return !parentValue;
    return String(parentValue) === String(field.dependsOn.value);
  };

  const isDirty = (fieldName) => dirtyFieldNames ? dirtyFieldNames.has(fieldName) : false;

  return (
    <div className="p-4">
      <h2 className="text-lg font-medium text-gray-200 mb-1">{section.title}</h2>
      <div className="space-y-1">
        {section.fields.map((field) => {
          if (!isVisible(field)) return null;

          if (field.type === 'string[]') {
            return (
              <div key={field.name} className={`py-2 ${isDirty(field.name) ? 'border-l-2 border-blue-500 pl-3' : 'pl-3'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-sm text-gray-300 font-medium">{field.name}</label>
                  {!field.hotReload && (
                    <span className="text-[10px] text-amber-500" title="Requires restart">🔄</span>
                  )}
                  {isDirty(field.name) && <span className="text-[10px] text-blue-400">modified</span>}
                </div>
                {field.description && (
                  <p className="text-[11px] text-gray-500 mb-1.5">{field.description}</p>
                )}
                <ConfigTagInput
                  value={sectionValues[field.name]}
                  onChange={(v) => onUpdateField(section.name, field.name, v)}
                  resolve={field.resolve}
                  resolveIds={resolveIds}
                  field={field}
                />
              </div>
            );
          }

          return (
            <ConfigField
              key={field.name}
              field={field}
              value={sectionValues[field.name]}
              onChange={(v) => onUpdateField(section.name, field.name, v)}
              isDirty={isDirty(field.name)}
            />
          );
        })}

        {/* Tables */}
        {(section.tables || []).map((table) => (
          <div key={table.name} className="mt-4">
            <h3 className="text-sm font-medium text-gray-300 mb-2">{table.title || table.name}</h3>
            <ConfigTable
              table={table}
              value={sectionValues[table.name]}
              onChange={(v) => onUpdateField(section.name, table.name, v)}
              resolveIds={resolveIds}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
