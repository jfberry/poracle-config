function formatValue(v) {
  if (v === undefined) return '(unset)';
  if (v === null) return 'null';
  if (typeof v === 'string') return v.length > 60 ? v.slice(0, 57) + '...' : v;
  if (Array.isArray(v)) {
    const s = JSON.stringify(v);
    return s.length > 60 ? s.slice(0, 57) + '...' : s;
  }
  if (typeof v === 'object') {
    const s = JSON.stringify(v);
    return s.length > 60 ? s.slice(0, 57) + '...' : s;
  }
  return String(v);
}

function isEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function ConfigOverview({ schema, values, onJumpTo }) {
  if (!schema) return null;

  const groups = [];
  for (const section of schema) {
    const sectionValues = values[section.name] || {};
    const overridden = [];
    for (const field of section.fields || []) {
      const current = sectionValues[field.name];
      if (current === undefined) continue;
      if (current === '****') continue;
      if (!isEqual(current, field.default)) {
        overridden.push({ field, current });
      }
    }
    if (overridden.length > 0) {
      groups.push({ section, overridden });
    }
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-medium text-gray-200 mb-1">Overview</h2>
      <p className="text-[11px] text-gray-500 mb-4">
        Fields whose current value differs from the schema default.
      </p>
      {groups.length === 0 ? (
        <div className="text-sm text-gray-500">No overridden fields.</div>
      ) : (
        <div className="space-y-4">
          {groups.map(({ section, overridden }) => (
            <div key={section.name}>
              <h3 className="text-sm font-medium text-gray-300 mb-1">{section.title}</h3>
              <ul className="space-y-1">
                {overridden.map(({ field, current }) => (
                  <li key={field.name} className="text-xs">
                    <button
                      type="button"
                      onClick={() => onJumpTo(section.name)}
                      className="text-blue-400 hover:text-blue-300 font-mono mr-2"
                    >
                      {field.name}
                    </button>
                    <span className="text-gray-300 font-mono">{formatValue(current)}</span>
                    <span className="text-gray-600 font-mono ml-2">
                      (default: {formatValue(field.default)})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
