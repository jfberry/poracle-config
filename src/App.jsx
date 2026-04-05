import { useMemo } from 'react';
import TopBar from './components/TopBar';
import TemplateEditor from './components/TemplateEditor';
import DiscordPreview from './components/DiscordPreview';
import StatusBar from './components/StatusBar';
import { useDts } from './hooks/useDts';
import { useHandlebars } from './hooks/useHandlebars';

export default function App() {
  const dts = useDts();
  const { render, renderError } = useHandlebars();

  const renderedData = useMemo(() => {
    if (!dts.currentTemplate?.template) return {};
    return render(dts.currentTemplate.template, dts.currentTestData) || {};
  }, [dts.currentTemplate, dts.currentTestData, render]);

  const handleLoadFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          const entries = Array.isArray(parsed) ? parsed : [parsed];
          dts.loadTemplates(entries);
        } catch (err) {
          alert('Invalid JSON file: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleSave = () => {
    const blob = new Blob([JSON.stringify(dts.templates, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dts.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-200">
      <TopBar filters={dts.filters} setFilters={dts.setFilters}
        availableTypes={dts.availableTypes} availableIds={dts.availableIds}
        onLoadFile={handleLoadFile} onSave={handleSave} />
      <div className="flex flex-1 min-h-0">
        {/* Left panel — Template Editor */}
        <div className="w-1/3 border-r border-gray-700">
          <TemplateEditor template={dts.currentTemplate?.template} onChange={dts.updateTemplate} />
        </div>
        {/* Middle panel — Tag Picker placeholder */}
        <div className="w-60 border-r border-gray-700 overflow-y-auto p-3">
          <div className="text-gray-500 text-sm">Tag Picker — coming in Task 10</div>
        </div>
        {/* Right panel — Discord Preview */}
        <div className="flex-1">
          <DiscordPreview data={renderedData} error={renderError} />
        </div>
      </div>
      <StatusBar connected={false} testScenario={dts.testScenario} error={renderError} />
    </div>
  );
}
