import ConfigSidebar from './ConfigSidebar';
import ConfigSection from './ConfigSection';

export default function ConfigEditor({ config }) {
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

  if (!config.schema) return null;

  const activeSchemaSection = config.schema.find((s) => s.name === config.activeSection);

  return (
    <div className="flex h-full">
      <ConfigSidebar
        sections={config.schema}
        activeSection={config.activeSection}
        onSelect={config.setActiveSection}
        dirtySections={config.dirtySections}
      />
      <div className="flex-1 overflow-y-auto">
        {activeSchemaSection && (
          <ConfigSection
            section={activeSchemaSection}
            values={config.values[config.activeSection]}
            originalValues={config.originalValues[config.activeSection]}
            onUpdateField={config.updateField}
            resolveIds={config.resolveIds}
            dirtyFieldNames={new Set(Object.keys(config.dirtyFields.dirty[config.activeSection] || {}))}
          />
        )}
      </div>
    </div>
  );
}
