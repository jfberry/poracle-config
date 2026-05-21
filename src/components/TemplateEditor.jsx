import TemplateBodyEditor from './TemplateBodyEditor';
import ButtonsEditor from './ButtonsEditor';

function FormatBadge({ format }) {
  if (!format) return null;
  const color = format === 'toml'
    ? 'bg-purple-900/40 text-purple-300 border-purple-700'
    : 'bg-gray-800 text-gray-400 border-gray-700';
  return (
    <span className={`text-[10px] font-mono uppercase border rounded px-1.5 py-0.5 ${color}`}>
      {format}
    </span>
  );
}

/**
 * Top-level editor for a DTS entry. Composes TemplateBodyEditor + ButtonsEditor
 * with a sourceFormat badge.
 */
export default function TemplateEditor({
  template,
  templateFileContent,
  onChange,
  onFileContentChange,
  platform,
  entry,
  onButtonsChange,
  actions,
  actionsError,
  templates,
  fields,
  onJumpToTemplate,
  snapshotsEnabled = true,
}) {
  const readOnly = entry?.readonly === true;
  return (
    <div className="flex flex-col h-full">
      {(entry?.sourceFormat || readOnly) && (
        <div className="flex items-center gap-2 px-3 py-1 border-b border-gray-700">
          <FormatBadge format={entry?.sourceFormat} />
          {entry?.sourceFile && (
            <span className="text-[10px] text-gray-500 font-mono truncate" title={entry.sourceFile}>
              {entry.sourceFile}
            </span>
          )}
          {readOnly && (
            <span className="text-[10px] uppercase tracking-wider text-purple-400 ml-auto">
              Read-only (fallback)
            </span>
          )}
        </div>
      )}
      <div className="flex-1 min-h-0">
        <TemplateBodyEditor
          template={template}
          templateFileContent={templateFileContent}
          onChange={onChange}
          onFileContentChange={onFileContentChange}
          platform={platform}
          readOnly={readOnly}
        />
      </div>
      <ButtonsEditor
        buttons={entry?.buttons}
        onChange={onButtonsChange}
        actions={actions || []}
        actionsError={actionsError}
        templates={templates || []}
        platform={platform}
        fields={fields || []}
        onJumpTo={onJumpToTemplate}
        readOnly={readOnly}
        snapshotsEnabled={snapshotsEnabled}
      />
    </div>
  );
}
