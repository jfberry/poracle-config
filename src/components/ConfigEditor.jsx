import { useState, useMemo } from 'react';
import ConfigSidebar from './ConfigSidebar';
import ConfigSection from './ConfigSection';
import ConfigOverview from './ConfigOverview';

export default function ConfigEditor({ config }) {
  const [search, setSearch] = useState('');
  const [showDeprecated, setShowDeprecated] = useState(false);

  const handleMigrate = async () => {
    const confirmed = confirm(
      'Migrate config.toml to overrides.json?\n\n' +
      'This will:\n' +
      '• Back up your current config.toml\n' +
      '• Move all editable settings into overrides.json\n' +
      '• Rewrite config.toml to contain only database, tokens, and connection settings\n\n' +
      'This is reversible: delete overrides.json and restore from the backup file.'
    );
    if (!confirmed) return;
    try {
      const result = await config.migrate();
      alert(
        `Migration complete.\n\n` +
        `Backup: ${result.backup}\n` +
        `Moved ${result.fields_moved?.length || 0} fields to overrides.json\n` +
        `Kept ${result.fields_kept?.length || 0} TOML-only fields`
      );
    } catch (err) {
      alert('Migration failed: ' + err.message);
    }
  };

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
      <div className="flex-1 overflow-y-auto relative">
        <div className="absolute top-2 right-3 z-10">
          <button
            type="button"
            onClick={handleMigrate}
            title="Migrate config.toml into overrides.json"
            className="text-[11px] text-gray-400 hover:text-gray-200 border border-gray-700 rounded px-2 py-0.5 bg-gray-900/60"
          >
            Migrate config
          </button>
        </div>
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
            overriddenFields={config.overriddenFields}
            validationIssues={config.validationIssues}
          />
        ) : null}
      </div>
    </div>
  );
}
