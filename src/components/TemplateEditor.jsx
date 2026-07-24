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
  templateFile,
  onChange,
  onFileContentChange,
  platform,
  entry,
  onButtonsChange,
  actions,
  actionsError,
  actionsReason,
  templates,
  fields,
  onJumpToTemplate,
  snapshotsEnabled = true,
  canEdit = true,
  buttonsSupported = true,
}) {
  const readOnly = entry?.readonly === true;
  // Hide the buttons section entirely when the connected processor doesn't
  // support buttons (caps.buttons === false). Existing entries on this server
  // won't have a buttons field anyway, and authoring new ones here would
  // silently vanish on save.
  const hasExistingButtons = Array.isArray(entry?.buttons) && entry.buttons.length > 0;
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
          templateFile={templateFile}
          onChange={onChange}
          onFileContentChange={onFileContentChange}
          platform={platform}
          readOnly={readOnly}
        />
      </div>
      {(buttonsSupported || hasExistingButtons) && (
        <ButtonsEditor
          buttons={entry?.buttons}
          onChange={onButtonsChange}
          actions={actions || []}
          actionsError={actionsError}
          actionsReason={actionsReason}
          templates={templates || []}
          platform={platform}
          fields={fields || []}
          onJumpTo={onJumpToTemplate}
          readOnly={readOnly || !buttonsSupported}
          snapshotsEnabled={snapshotsEnabled}
          canEdit={canEdit && buttonsSupported}
          unsupportedNotice={!buttonsSupported}
        />
      )}
    </div>
  );
}
