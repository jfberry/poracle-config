import ConfigField from './ConfigField';
import ConfigTagInput from './ConfigTagInput';
import ConfigTable from './ConfigTable';

export default function ConfigSection({
  section,
  values,
  originalValues,
  onUpdateField,
  resolveIds,
  dirtyFieldNames,
  search,
  showDeprecated,
  geofenceAreas,
}) {
  const sectionValues = values || {};
  const sectionOriginal = originalValues || {};

  const isVisible = (field) => {
    if (!field.dependsOn) return true;
    const parentValue = sectionValues[field.dependsOn.field];
    if (field.dependsOn.value === true) return !!parentValue;
    if (field.dependsOn.value === false) return !parentValue;
    return String(parentValue) === String(field.dependsOn.value);
  };

  const isDirty = (fieldName) => dirtyFieldNames ? dirtyFieldNames.has(fieldName) : false;

  const searchLower = (search || '').toLowerCase();
  const hasSearch = searchLower.length > 0;
  const sectionMatchesSearch =
    hasSearch &&
    ((section.name && section.name.toLowerCase().includes(searchLower)) ||
      (section.title && section.title.toLowerCase().includes(searchLower)));

  const matchesSearch = (field) => {
    if (!hasSearch) return true;
    if (sectionMatchesSearch) return true;
    if (field.name && field.name.toLowerCase().includes(searchLower)) return true;
    if (field.description && field.description.toLowerCase().includes(searchLower)) return true;
    return false;
  };

  const visibleFields = (section.fields || []).filter((field) => {
    if (!isVisible(field)) return false;
    if (!showDeprecated && field.deprecated === true) return false;
    if (!matchesSearch(field)) return false;
    return true;
  });

  const docsUrl = `https://jfberry.github.io/PoracleNG-docs/config/${section.name.replace(/\./g, '-')}/`;

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-lg font-medium text-gray-200">{section.title}</h2>
        <a
          href={docsUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          📖 Docs
        </a>
      </div>
      <div className="space-y-1">
        {hasSearch && visibleFields.length === 0 && (
          <div className="text-sm text-gray-500 py-2">No matching fields in this section</div>
        )}
        {visibleFields.map((field) => {
          if (field.type === 'string[]') {
            return (
              <div key={field.name} className={`py-2 ${isDirty(field.name) ? 'border-l-2 border-blue-500 pl-3' : 'pl-3'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-sm text-gray-300 font-medium">{field.name}</label>
                  {!field.hotReload && (
                    <span className="text-[10px] text-amber-500" title="Requires restart">🔄</span>
                  )}
                  {isDirty(field.name) && <span className="text-[10px] text-blue-400">modified</span>}
                  {isDirty(field.name) && (
                    <button
                      type="button"
                      onClick={() => onUpdateField(section.name, field.name, sectionOriginal[field.name])}
                      title="Revert to loaded value"
                      className="text-[10px] text-gray-400 hover:text-gray-200 border border-gray-700 rounded px-1"
                    >
                      ↶ undo
                    </button>
                  )}
                  {JSON.stringify(sectionOriginal[field.name]) !== JSON.stringify(field.default) && (
                    <button
                      type="button"
                      onClick={() => onUpdateField(section.name, field.name, field.default)}
                      title="Clear override (reset to schema default)"
                      className="text-[10px] text-gray-400 hover:text-gray-200 border border-gray-700 rounded px-1"
                    >
                      × default
                    </button>
                  )}
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
                  suggestions={field.resolve === 'geofence:area' ? geofenceAreas : undefined}
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
              defaultValue={field.default}
              originalValue={sectionOriginal[field.name]}
              onReset={() => onUpdateField(section.name, field.name, sectionOriginal[field.name])}
              onClearOverride={() => onUpdateField(section.name, field.name, field.default)}
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
              geofenceAreas={geofenceAreas}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
