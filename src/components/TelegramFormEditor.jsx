import { useCallback, useRef, useMemo } from 'react';
import FormatToolbar from './FormatToolbar';
import { inputClass, labelClass } from '../lib/styles';

// Match the invisible-link preview image hack: [​](url) or [ ](url) or [\u200A](url)
// The link text is either empty, a zero-width space, a hair space, or a regular space
const PREVIEW_IMAGE_RE = /\[[\s\u200B\u200A]*\]\(([^)]+)\)/;

function extractPreviewImage(content) {
  if (!content) return { url: '', cleanContent: content || '' };
  const match = content.match(PREVIEW_IMAGE_RE);
  if (!match) return { url: '', cleanContent: content };
  return {
    url: match[1],
    cleanContent: content.replace(match[0], '').replace(/^\n+/, ''),
  };
}

function injectPreviewImage(content, url) {
  if (!url) return content || '';
  // Prepend the invisible link at the start
  const prefix = `[\u200A](${url})`;
  return content ? `${prefix}\n${content}` : prefix;
}

export default function TelegramFormEditor({ template, onChange }) {
  const formRef = useRef(null);

  const update = useCallback(
    (key, value) => {
      const updated = { ...template };
      if (value === '' || value === undefined || value === null) {
        delete updated[key];
      } else {
        updated[key] = value;
      }
      onChange(updated);
    },
    [template, onChange]
  );

  // Extract preview image from content
  const { url: previewImageUrl, cleanContent } = useMemo(
    () => extractPreviewImage(template?.content),
    [template?.content]
  );

  // Update content without the preview image (user edits clean content)
  const handleContentChange = useCallback(
    (newCleanContent) => {
      const updated = { ...template };
      if (previewImageUrl) {
        updated.content = injectPreviewImage(newCleanContent, previewImageUrl);
      } else {
        updated.content = newCleanContent;
      }
      if (!updated.content) delete updated.content;
      onChange(updated);
    },
    [template, onChange, previewImageUrl]
  );

  const updateVenueField = useCallback((key, val) => {
    const venue = { ...template?.venue };
    if (val) venue[key] = val;
    else delete venue[key];
    if (Object.keys(venue).length === 0) {
      update('venue', undefined);
    } else {
      update('venue', venue);
    }
  }, [template, update]);

  // Update preview image URL
  const handlePreviewImageChange = useCallback(
    (newUrl) => {
      const updated = { ...template };
      if (newUrl) {
        updated.content = injectPreviewImage(cleanContent, newUrl);
        // Auto-enable webpage_preview when using preview image
        updated.webpage_preview = true;
      } else {
        updated.content = cleanContent || undefined;
        if (!updated.content) delete updated.content;
      }
      onChange(updated);
    },
    [template, onChange, cleanContent]
  );

  return (
    <div ref={formRef} className="p-3 space-y-3">
      <FormatToolbar targetRef={formRef} />
      {/* Preview Image (extracted from invisible link hack) */}
      <div>
        <label className={labelClass}>
          Preview Image URL
          <span className="text-gray-600 ml-1 font-normal">(shown via link preview)</span>
        </label>
        <input
          className={inputClass}
          value={previewImageUrl}
          onChange={(e) => handlePreviewImageChange(e.target.value)}
          placeholder="{{{staticMap}}} — image shown in message via link preview"
        />
        {previewImageUrl && (
          <p className="text-[10px] text-teal-500 mt-0.5">
            Inserts as invisible link. Webpage preview auto-enabled.
          </p>
        )}
      </div>

      {/* Content */}
      <div>
        <label className={labelClass}>Content</label>
        <textarea
          className={inputClass + ' min-h-[120px] resize-y'}
          value={cleanContent}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Message content (supports Handlebars + Telegram Markdown)"
          rows={8}
        />
      </div>

      {/* Parse Mode */}
      <div>
        <label className={labelClass}>Parse Mode</label>
        <select
          className={inputClass}
          value={template?.parse_mode ?? 'Markdown'}
          onChange={(e) => update('parse_mode', e.target.value)}
        >
          <option value="Markdown">Markdown</option>
          <option value="MarkdownV2">MarkdownV2</option>
          <option value="HTML">HTML</option>
        </select>
      </div>

      {/* Sticker */}
      <div>
        <label className={labelClass}>Sticker URL</label>
        <input
          className={inputClass}
          value={template?.sticker ?? ''}
          onChange={(e) => update('sticker', e.target.value)}
          placeholder="{{{stickerUrl}}}"
        />
      </div>

      {/* Photo */}
      <div>
        <label className={labelClass}>Photo URL</label>
        <input
          className={inputClass}
          value={template?.photo ?? ''}
          onChange={(e) => update('photo', e.target.value)}
          placeholder="Sent as a separate photo message (optional)"
        />
      </div>

      {/* Location */}
      <div>
        <label className="flex items-center gap-2 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={!!template?.location}
            onChange={(e) => update('location', e.target.checked || undefined)}
            className="rounded"
          />
          Send location pin
        </label>
      </div>

      {/* Webpage Preview */}
      <div>
        <label className="flex items-center gap-2 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={!!template?.webpage_preview}
            onChange={(e) => update('webpage_preview', e.target.checked || undefined)}
            className="rounded"
          />
          Show link previews
          {previewImageUrl && !template?.webpage_preview && (
            <span className="text-yellow-500 text-[10px]">⚠ Required for preview image</span>
          )}
        </label>
      </div>

      {/* Venue */}
      <div className="border border-gray-700 rounded p-2 space-y-2">
        <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Venue (optional)</div>
        <div>
          <label className={labelClass}>Title</label>
          <input
            className={inputClass}
            value={template?.venue?.title ?? ''}
            onChange={(e) => updateVenueField('title', e.target.value)}
            placeholder="Venue title"
          />
        </div>
        <div>
          <label className={labelClass}>Address</label>
          <input
            className={inputClass}
            value={template?.venue?.address ?? ''}
            onChange={(e) => updateVenueField('address', e.target.value)}
            placeholder="Venue address"
          />
        </div>
      </div>

      {/* Send Order */}
      <div>
        <label className={labelClass}>Send Order (comma-separated)</label>
        <input
          className={inputClass}
          value={(template?.send_order || ['sticker', 'photo', 'text', 'location', 'venue']).join(', ')}
          onChange={(e) => {
            const order = e.target.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
            if (order.length > 0) {
              update('send_order', order);
            } else {
              update('send_order', undefined);
            }
          }}
          placeholder="sticker, photo, text, location, venue"
        />
        <p className="text-[10px] text-gray-600 mt-0.5">Controls the order Telegram messages are sent. Default: sticker, photo, text, location, venue</p>
      </div>
    </div>
  );
}
