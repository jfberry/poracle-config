import { useState, useMemo } from 'react';
import ConfigSidebar from './ConfigSidebar';
import ConfigSection from './ConfigSection';
import ConfigOverview from './ConfigOverview';

export default function ConfigEditor({ config }) {
  const [search, setSearch] = useState('');
  const [showDeprecated, setShowDeprecated] = useState(false);

  const searchMatches = useMemo(() => {
    const set = new Set();
    if (!config.schema || !search) return set;
    const q = search.toLowerCase();
    for (const section of config.schema) {
      if ((section.name && section.name.toLowerCase().includes(q)) ||
          (section.title && section.title.toLowerCase().includes(q))) {
        set.add(section.name);
        continue;
      }
      for (const field of section.fields || []) {
        if ((field.name && field.name.toLowerCase().includes(q)) ||
            (field.description && field.description.toLowerCase().includes(q))) {
          set.add(section.name);
          break;
        }
      }
    }
    return set;
  }, [config.schema, search]);

  const overviewCount = useMemo(() => {
    if (!config.schema) return 0;
    let n = 0;
    for (const section of config.schema) {
      const sv = config.values[section.name] || {};
      for (const field of section.fields || []) {
        const cur = sv[field.name];
        if (cur === undefined || cur === '****') continue;
        if (JSON.stringify(cur) !== JSON.stringify(field.default)) n++;
      }
    }
    return n;
  }, [config.schema, config.values]);

  if (config.loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading configuration...
      </div>
    );
  }

  if (config.error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <div className="text-red-400">Failed to load config: {config.error}</div>
          <button
            onClick={config.load}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!config.schema) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Connect to PoracleNG to edit configuration.
      </div>
    );
  }

  const isOverview = config.activeSection === '__overview__';
  const activeSchemaSection = isOverview
    ? null
    : config.schema.find((s) => s.name === config.activeSection);

  return (
    <div className="flex h-full">
      <ConfigSidebar
        sections={config.schema}
        activeSection={config.activeSection}
        onSelect={config.setActiveSection}
        dirtySections={config.dirtySections}
        search={search}
        onSearchChange={setSearch}
        searchMatches={searchMatches}
        showDeprecated={showDeprecated}
        onToggleDeprecated={setShowDeprecated}
        overviewCount={overviewCount}
      />
      <div className="flex-1 overflow-y-auto">
        {isOverview ? (
          <ConfigOverview
            schema={config.schema}
            values={config.values}
            onJumpTo={config.setActiveSection}
          />
        ) : activeSchemaSection ? (
          <ConfigSection
            section={activeSchemaSection}
            values={config.values[config.activeSection]}
            originalValues={config.originalValues[config.activeSection]}
            onUpdateField={config.updateField}
            resolveIds={config.resolveIds}
            dirtyFieldNames={new Set(Object.keys(config.dirtyFields.dirty[config.activeSection] || {}))}
            search={search}
            showDeprecated={showDeprecated}
            geofenceAreas={config.geofenceAreas}
          />
        ) : null}
      </div>
    </div>
  );
}
