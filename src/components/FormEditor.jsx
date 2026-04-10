import { useCallback, useRef, useState } from 'react';
import FormatToolbar from './FormatToolbar';
import { inputClass, labelClass } from '../lib/styles';

function Section({ title, children }) {
  return (
    <div className="border border-gray-700 rounded p-2 space-y-2">
      <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{title}</div>
      {children}
    </div>
  );
}

export default function FormEditor({ template, onChange }) {
  const formRef = useRef(null);
  const [activeEmbedIndex, setActiveEmbedIndex] = useState(0);

  // Detect embeds mode (array) vs embed mode (single object)
  const isEmbedsMode = Array.isArray(template?.embeds);
  const embedsList = isEmbedsMode ? template.embeds : [];
  const embed = isEmbedsMode
    ? (embedsList[activeEmbedIndex] || {})
    : (template?.embed || {});

  // Write back the correct key when updating
  const writeEmbed = useCallback(
    (newEmbed) => {
      if (isEmbedsMode) {
        const newEmbeds = [...embedsList];
        newEmbeds[activeEmbedIndex] = newEmbed;
        onChange({ ...template, embeds: newEmbeds });
      } else {
        onChange({ ...template, embed: newEmbed });
      }
    },
    [template, isEmbedsMode, embedsList, activeEmbedIndex, onChange]
  );

  // Update a top-level template field (content, username, avatar_url, etc.)
  const updateRoot = useCallback(
    (key, value) => {
      const updated = { ...template };
      if (value === '' || value === undefined) {
        delete updated[key];
      } else {
        updated[key] = value;
      }
      onChange(updated);
    },
    [template, onChange]
  );

  const updateEmbed = useCallback(
    (key, value) => {
      const newEmbed = { ...embed };
      if (value === '' || value === undefined) {
        delete newEmbed[key];
      } else {
        newEmbed[key] = value;
      }
      writeEmbed(newEmbed);
    },
    [embed, writeEmbed]
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
      const newEmbed = { ...embed };
      if (Object.keys(updated).length === 0) {
        delete newEmbed[parent];
      } else {
        newEmbed[parent] = updated;
      }
      writeEmbed(newEmbed);
    },
    [embed, writeEmbed]
  );

  const fields = embed.fields || [];

  const updateField = useCallback(
    (index, field) => {
      const newFields = [...fields];
      newFields[index] = field;
      writeEmbed({ ...embed, fields: newFields });
    },
    [embed, fields, writeEmbed]
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
      writeEmbed(newEmbed);
    },
    [embed, fields, writeEmbed]
  );

  const addField = useCallback(() => {
    const newFields = [...fields, { name: '', value: '', inline: false }];
    writeEmbed({ ...embed, fields: newFields });
  }, [embed, fields, writeEmbed]);

  const addEmbed = useCallback(() => {
    const newEmbeds = [...embedsList, {}];
    onChange({ ...template, embeds: newEmbeds });
    setActiveEmbedIndex(newEmbeds.length - 1);
  }, [template, embedsList, onChange]);

  const removeEmbed = useCallback((index) => {
    const newEmbeds = embedsList.filter((_, i) => i !== index);
    if (newEmbeds.length === 0) {
      // Convert back to single embed mode
      const { embeds, ...rest } = template;
      onChange({ ...rest, embed: {} });
    } else {
      onChange({ ...template, embeds: newEmbeds });
      setActiveEmbedIndex(Math.min(activeEmbedIndex, newEmbeds.length - 1));
    }
  }, [template, embedsList, activeEmbedIndex, onChange]);

  const convertToEmbeds = useCallback(() => {
    const { embed: singleEmbed, ...rest } = template;
    onChange({ ...rest, embeds: [singleEmbed || {}] });
    setActiveEmbedIndex(0);
  }, [template, onChange]);

  const convertToEmbed = useCallback(() => {
    const { embeds: multiEmbeds, ...rest } = template;
    onChange({ ...rest, embed: multiEmbeds?.[0] || {} });
  }, [template, onChange]);

  return (
    <div ref={formRef} className="p-3 space-y-3">
      <FormatToolbar targetRef={formRef} />

      {/* Message — top-level template fields (outside the embed) */}
      <Section title="Message">
        <div>
          <label className={labelClass}>Content</label>
          <textarea
            className={inputClass + ' min-h-[60px] resize-y'}
            value={template?.content ?? ''}
            onChange={(e) => updateRoot('content', e.target.value)}
            placeholder="Plain text message above the embed (optional)"
            rows={3}
          />
        </div>
        <div>
          <label className={labelClass}>Username (webhook)</label>
          <input
            className={inputClass}
            value={template?.username ?? ''}
            onChange={(e) => updateRoot('username', e.target.value)}
            placeholder="Override the bot's display name (webhook only)"
          />
        </div>
        <div>
          <label className={labelClass}>Avatar URL (webhook)</label>
          <input
            className={inputClass}
            value={template?.avatar_url ?? ''}
            onChange={(e) => updateRoot('avatar_url', e.target.value)}
            placeholder="Override the bot's avatar (webhook only)"
          />
        </div>
      </Section>

      {/* Embed mode selector */}
      {isEmbedsMode ? (
        <div className="flex items-center gap-2 text-xs border border-gray-700 rounded p-2">
          <span className="text-gray-400">Embeds:</span>
          {embedsList.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveEmbedIndex(i)}
              className={`px-2 py-0.5 rounded ${i === activeEmbedIndex ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}
            >
              #{i + 1}
            </button>
          ))}
          <button onClick={addEmbed} className="text-blue-400 hover:text-blue-300 px-1">+</button>
          {embedsList.length > 1 && (
            <button onClick={() => removeEmbed(activeEmbedIndex)} className="text-red-400 hover:text-red-300 px-1 text-[10px]">Remove</button>
          )}
          <button onClick={convertToEmbed} className="text-gray-500 hover:text-gray-300 ml-auto text-[10px]" title="Convert to single embed">→ embed</button>
        </div>
      ) : (
        <div className="flex items-center justify-end text-[10px]">
          <button onClick={convertToEmbeds} className="text-gray-500 hover:text-gray-300" title="Convert to embeds array (webhook mode)">→ embeds[]</button>
        </div>
      )}

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
          placeholder="e.g. {{nowISO}} or ISO 8601 string"
        />
      </div>
    </div>
  );
}
