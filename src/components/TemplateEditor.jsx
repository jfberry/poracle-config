import TemplateBodyEditor from './TemplateBodyEditor';

/**
 * Top-level editor for a DTS entry. Composes the body editor (TemplateBodyEditor)
 * with the buttons editor (added in a later task). For now this is a thin shell
 * around TemplateBodyEditor to preserve existing behavior.
 */
export default function TemplateEditor({
  template,
  templateFileContent,
  onChange,
  onFileContentChange,
  platform,
}) {
  return (
    <TemplateBodyEditor
      template={template}
      templateFileContent={templateFileContent}
      onChange={onChange}
      onFileContentChange={onFileContentChange}
      platform={platform}
    />
  );
}
