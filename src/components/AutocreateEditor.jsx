import AutocreateTree from './AutocreateTree';
import AutocreateDetail from './AutocreateDetail';

export default function AutocreateEditor({ autocreate }) {
  if (autocreate.loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading autocreate templates...
      </div>
    );
  }

  if (autocreate.error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <div className="text-red-400">Failed to load autocreate templates: {autocreate.error}</div>
          <button onClick={autocreate.load} className="text-blue-400 hover:text-blue-300 text-sm">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <AutocreateTree
        templates={autocreate.templates}
        selectedTemplateName={autocreate.selectedTemplateName}
        selectedTemplate={autocreate.selectedTemplate}
        selectedNode={autocreate.selectedNode}
        onSelectTemplate={(name) => {
          autocreate.setSelectedTemplateName(name);
          autocreate.setSelectedNode({ type: 'template' });
        }}
        onSelectNode={autocreate.setSelectedNode}
        onAddTemplate={autocreate.addTemplate}
        onDeleteTemplate={autocreate.deleteFromServer}
        onAddChannel={autocreate.addChannel}
        onRemoveChannel={autocreate.removeChannel}
        onMoveChannel={autocreate.moveChannel}
        validation={autocreate.validation}
      />
      <AutocreateDetail
        selectedTemplate={autocreate.selectedTemplate}
        selectedNode={autocreate.selectedNode}
        schema={autocreate.schema}
        validation={autocreate.validation}
        onUpdateTemplate={(t) => {
          if (typeof t === 'function') {
            autocreate.updateSelectedTemplate(t);
          } else {
            autocreate.replaceSelectedTemplateRaw(t);
          }
        }}
        onUpdateDefinition={autocreate.updateDefinition}
        onUpdateTemplateName={autocreate.updateTemplateName}
        onSave={autocreate.save}
        isDirty={autocreate.isDirty}
        selectedTemplateIndex={autocreate.selectedTemplateIndex}
      />
    </div>
  );
}
