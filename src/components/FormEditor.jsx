import { useCallback } from 'react';

const inputClass =
  'w-full bg-gray-800 text-gray-200 border border-gray-600 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-blue-500';
const labelClass = 'block text-xs text-gray-400 mb-1';

function Section({ title, children }) {
  return (
    <div className="border border-gray-700 rounded p-2 space-y-2">
      <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{title}</div>
      {children}
    </div>
  );
}

export default function FormEditor({ template, onChange }) {
  const embed = template?.embed || {};

  const updateEmbed = useCallback(
    (key, value) => {
      const newEmbed = { ...embed };
      if (value === '' || value === undefined) {
        delete newEmbed[key];
      } else {
        newEmbed[key] = value;
      }
      onChange({ ...template, embed: newEmbed });
    },
    [template, embed, onChange]
  );

  const updateNested = useCallback(
    (parent, key, value) => {
      const current = embed[parent] || {};
      const updated = { ...current };
      if (value === '' || value === undefined) {
        delete updated[key];
      } else {
        updated[key] = value;
      }
      // Remove parent if empty
      const newEmbed = { ...embed };
      if (Object.keys(updated).length === 0) {
        delete newEmbed[parent];
      } else {
        newEmbed[parent] = updated;
      }
      onChange({ ...template, embed: newEmbed });
    },
    [template, embed, onChange]
  );

  const fields = embed.fields || [];

  const updateField = useCallback(
    (index, field) => {
      const newFields = [...fields];
      newFields[index] = field;
      onChange({ ...template, embed: { ...embed, fields: newFields } });
    },
    [template, embed, fields, onChange]
  );

  const removeField = useCallback(
    (index) => {
      const newFields = fields.filter((_, i) => i !== index);
      const newEmbed = { ...embed };
      if (newFields.length === 0) {
        delete newEmbed.fields;
      } else {
        newEmbed.fields = newFields;
      }
      onChange({ ...template, embed: newEmbed });
    },
    [template, embed, fields, onChange]
  );

  const addField = useCallback(() => {
    const newFields = [...fields, { name: '', value: '', inline: false }];
    onChange({ ...template, embed: { ...embed, fields: newFields } });
  }, [template, embed, fields, onChange]);

  return (
    <div className="p-3 space-y-3">
      {/* Color */}
      <div>
        <label className={labelClass}>Color</label>
        <input
          className={inputClass}
          value={embed.color ?? ''}
          onChange={(e) => updateEmbed('color', e.target.value)}
          placeholder="e.g. {{ivColor}} or #FF0000"
        />
      </div>

      {/* Title */}
      <div>
        <label className={labelClass}>Title</label>
        <input
          className={inputClass}
          value={embed.title ?? ''}
          onChange={(e) => updateEmbed('title', e.target.value)}
          placeholder="Embed title"
        />
      </div>

      {/* URL */}
      <div>
        <label className={labelClass}>URL</label>
        <input
          className={inputClass}
          value={embed.url ?? ''}
          onChange={(e) => updateEmbed('url', e.target.value)}
          placeholder="Title link URL"
        />
      </div>

      {/* Description */}
      <div>
        <label className={labelClass}>Description</label>
        <textarea
          className={inputClass + ' min-h-[80px] resize-y'}
          value={embed.description ?? ''}
          onChange={(e) => updateEmbed('description', e.target.value)}
          placeholder="Embed description (supports Handlebars)"
          rows={4}
        />
      </div>

      {/* Thumbnail */}
      <div>
        <label className={labelClass}>Thumbnail URL</label>
        <input
          className={inputClass}
          value={embed.thumbnail?.url ?? ''}
          onChange={(e) => updateNested('thumbnail', 'url', e.target.value)}
          placeholder="Thumbnail image URL"
        />
      </div>

      {/* Image */}
      <div>
        <label className={labelClass}>Image URL</label>
        <input
          className={inputClass}
          value={embed.image?.url ?? ''}
          onChange={(e) => updateNested('image', 'url', e.target.value)}
          placeholder="Large image URL"
        />
      </div>

      {/* Author */}
      <Section title="Author">
        <div>
          <label className={labelClass}>Name</label>
          <input
            className={inputClass}
            value={embed.author?.name ?? ''}
            onChange={(e) => updateNested('author', 'name', e.target.value)}
            placeholder="Author name"
          />
        </div>
        <div>
          <label className={labelClass}>Icon URL</label>
          <input
            className={inputClass}
            value={embed.author?.icon_url ?? ''}
            onChange={(e) => updateNested('author', 'icon_url', e.target.value)}
            placeholder="Author icon URL"
          />
        </div>
      </Section>

      {/* Footer */}
      <Section title="Footer">
        <div>
          <label className={labelClass}>Text</label>
          <input
            className={inputClass}
            value={embed.footer?.text ?? ''}
            onChange={(e) => updateNested('footer', 'text', e.target.value)}
            placeholder="Footer text"
          />
        </div>
        <div>
          <label className={labelClass}>Icon URL</label>
          <input
            className={inputClass}
            value={embed.footer?.icon_url ?? ''}
            onChange={(e) => updateNested('footer', 'icon_url', e.target.value)}
            placeholder="Footer icon URL"
          />
        </div>
      </Section>

      {/* Timestamp */}
      <div>
        <label className={labelClass}>Timestamp</label>
        <input
          className={inputClass}
          value={embed.timestamp ?? ''}
          onChange={(e) => updateEmbed('timestamp', e.target.value)}
          placeholder="e.g. {{timestamp}} or ISO string"
        />
      </div>

      {/* Fields */}
      <Section title="Fields">
        {fields.map((field, i) => (
          <div key={i} className="border border-gray-600 rounded p-2 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Field {i + 1}</span>
              <button
                onClick={() => removeField(i)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>
            <div>
              <label className={labelClass}>Name</label>
              <input
                className={inputClass}
                value={field.name ?? ''}
                onChange={(e) => updateField(i, { ...field, name: e.target.value })}
                placeholder="Field name"
              />
            </div>
            <div>
              <label className={labelClass}>Value</label>
              <textarea
                className={inputClass + ' min-h-[40px] resize-y'}
                value={field.value ?? ''}
                onChange={(e) => updateField(i, { ...field, value: e.target.value })}
                placeholder="Field value"
                rows={2}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-400">
              <input
                type="checkbox"
                checked={!!field.inline}
                onChange={(e) => updateField(i, { ...field, inline: e.target.checked })}
                className="rounded"
              />
              Inline
            </label>
          </div>
        ))}
        <button
          onClick={addField}
          className="w-full text-sm text-blue-400 hover:text-blue-300 border border-dashed border-gray-600 rounded py-1"
        >
          + Add Field
        </button>
      </Section>
    </div>
  );
}
