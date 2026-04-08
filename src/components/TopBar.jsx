import TemplateSelector from './TemplateSelector';

export default function TopBar({
  activeTab, onTabChange,
  // DTS props
  templates, currentTemplate, onSelectTemplate,
  onImport, onExport, onSave, connected,
  showMiddle, onToggleMiddle, sendTestButton,
  // Config props
  configDirtyCount, configRestartRequired, onConfigSave, configHasErrors,
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700 text-sm">
      <div className="flex items-center gap-3">
        {/* Tab navigation */}
        <div className="flex gap-1 mr-2">
          <button
            onClick={() => onTabChange('templates')}
            className={`px-3 py-0.5 rounded text-sm font-medium transition-colors ${
              activeTab === 'templates'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            Templates
          </button>
          <button
            onClick={() => onTabChange('config')}
            className={`px-3 py-0.5 rounded text-sm font-medium transition-colors ${
              activeTab === 'config'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            Config
          </button>
        </div>

        {activeTab === 'templates' && (
          <>
            <span className="text-gray-600">|</span>
            <TemplateSelector
              templates={templates}
              currentTemplate={currentTemplate}
              onSelect={onSelectTemplate}
            />
          </>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {activeTab === 'templates' && (
          <>
            {sendTestButton}
            <button onClick={onToggleMiddle}
              className={`px-3 py-0.5 rounded text-sm border border-gray-600 hover:bg-gray-700 ${showMiddle ? 'bg-gray-700 text-blue-300' : 'bg-gray-800 text-gray-400'}`}>
              {showMiddle ? 'Hide Tags' : 'Show Tags'}
            </button>
            {onSave && (
              <button onClick={onSave}
                className="bg-gray-800 text-teal-300 px-3 py-0.5 rounded text-sm border border-gray-600 hover:bg-gray-700"
                title="Save current template to PoracleNG">
                Save
              </button>
            )}
            <button onClick={onImport}
              className="bg-gray-800 text-gray-400 px-3 py-0.5 rounded text-sm border border-gray-600 hover:bg-gray-700"
              title="Import template entry from a JSON file">
              Import
            </button>
            <button onClick={onExport}
              className="bg-gray-800 text-gray-400 px-3 py-0.5 rounded text-sm border border-gray-600 hover:bg-gray-700"
              title="Export current template as a JSON file">
              Export
            </button>
          </>
        )}
        {activeTab === 'config' && onConfigSave && (
          <button onClick={onConfigSave}
            className={`px-3 py-0.5 rounded text-sm border border-gray-600 hover:bg-gray-700 ${
              configDirtyCount > 0
                ? configRestartRequired
                  ? 'bg-amber-900/30 text-amber-300 border-amber-600'
                  : 'bg-gray-800 text-teal-300'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
            disabled={configDirtyCount === 0 || configHasErrors}
            title={configHasErrors ? 'Fix validation errors before saving' : configRestartRequired ? 'Some changes require restart' : 'Save config changes'}>
            {configHasErrors
              ? 'Validation errors'
              : configDirtyCount === 0
              ? 'No changes'
              : configRestartRequired
                ? `Save (restart required)`
                : `Save ${configDirtyCount} change${configDirtyCount !== 1 ? 's' : ''}`}
          </button>
        )}
      </div>
    </div>
  );
}
