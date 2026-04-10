import { useMemo } from 'react';

/**
 * Renders a Telegram-style message preview.
 * Shows sticker, photo, text, location, venue as separate message bubbles
 * in the configured send order.
 */

function parseTelegramMarkdown(text) {
  if (!text) return null;
  if (Array.isArray(text)) text = text.join('');
  else if (typeof text !== 'string') text = String(text);
  // Convert Telegram Markdown to HTML for display
  // Bold: **text** or *text* (Telegram v1 uses *text*)
  // Italic: __text__ (Telegram v1) or _text_
  // Code: `text`
  // Code block: ```text```
  // Link: [text](url)
  // Strikethrough: ~~text~~

  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Code blocks first (before other formatting)
    .replace(/```([\s\S]*?)```/g, '<pre class="tg-code-block">$1</pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="tg-code">$1</code>')
    // Bold: **text**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Bold: *text* (single asterisk, Telegram v1)
    .replace(/\*(.+?)\*/g, '<strong>$1</strong>')
    // Italic: __text__ (double underscore)
    .replace(/__(.+?)__/g, '<em>$1</em>')
    // Italic: _text_ (single underscore, Telegram v1)
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    // Links: [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="tg-link">$1</a>')
    // Missing emoji sentinel ⟦key⟧ → badge
    .replace(
      /⟦([^⟧]+)⟧/g,
      '<span title="Missing emoji key: $1" style="display:inline-block;padding:0 4px;margin:0 2px;font-size:10px;font-family:monospace;color:#fbbf24;background-color:rgba(251,191,36,0.15);border:1px dashed rgba(251,191,36,0.5);border-radius:3px;vertical-align:middle">?$1</span>'
    )
    // Newlines
    .replace(/\n/g, '<br/>');

  return html;
}

function TelegramBubble({ children, className = '' }) {
  return (
    <div className={`bg-[#2B5278] rounded-lg px-3 py-2 max-w-[380px] mb-1 ${className}`}>
      {children}
    </div>
  );
}

function StickerMessage({ url }) {
  if (!url) return null;
  return (
    <div className="mb-1">
      <img
        src={url}
        alt="Sticker"
        className="w-24 h-24 object-contain"
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    </div>
  );
}

function PhotoMessage({ url }) {
  if (!url) return null;
  return (
    <div className="mb-1 max-w-[380px]">
      <img
        src={url}
        alt="Photo"
        className="rounded-lg max-w-full max-h-64 object-cover"
        onError={(e) => { e.target.src = ''; e.target.alt = '[Photo]'; e.target.className = 'bg-gray-700 rounded-lg w-full h-32 flex items-center justify-center text-gray-500'; }}
      />
    </div>
  );
}

function TextMessage({ content, parseMode, webpagePreview }) {
  if (!content) return null;
  const textContent = typeof content === 'string' ? content : Array.isArray(content) ? content.join('') : String(content);

  const html = useMemo(() => {
    if (parseMode?.toLowerCase() === 'html') {
      // Allowlist only HTML tags Telegram actually supports
      const allowedTags = new Set(['b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'code', 'pre', 'a', 'br']);
      return textContent.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tag) => {
        return allowedTags.has(tag.toLowerCase()) ? match : match.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      });
    }
    return parseTelegramMarkdown(textContent);
  }, [textContent, parseMode]);

  return (
    <TelegramBubble>
      <div
        className="tg-text text-[14px] leading-[1.4] text-white break-words"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </TelegramBubble>
  );
}

function LocationMessage({ latitude, longitude }) {
  return (
    <TelegramBubble className="flex items-center gap-2 text-sm">
      <span className="text-lg">📍</span>
      <div>
        <div className="text-white text-xs">Location</div>
        <div className="text-blue-300 text-[11px]">{latitude?.toFixed(4)}, {longitude?.toFixed(4)}</div>
      </div>
    </TelegramBubble>
  );
}

function VenueMessage({ venue, latitude, longitude }) {
  if (!venue) return null;
  return (
    <TelegramBubble className="flex items-center gap-2 text-sm">
      <span className="text-lg">📍</span>
      <div>
        <div className="text-white text-xs font-medium">{venue.title || 'Venue'}</div>
        {venue.address && <div className="text-gray-300 text-[11px]">{venue.address}</div>}
        <div className="text-blue-300 text-[11px]">{latitude?.toFixed(4)}, {longitude?.toFixed(4)}</div>
      </div>
    </TelegramBubble>
  );
}

export default function TelegramPreview({ data }) {
  const message = data || {};
  const sendOrder = message.send_order || ['sticker', 'photo', 'text', 'location', 'venue'];

  // Extract lat/lon from the enriched data (they're top-level in the variable map)
  const latitude = message.latitude ?? 51.507;
  const longitude = message.longitude ?? -0.128;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-700 text-sm">
        <span className="text-blue-400">Telegram Preview</span>
      </div>
      <div className="flex-1 overflow-auto bg-[#17212B] p-4">
        {/* Bot name */}
        <div className="text-[13px] text-blue-400 font-medium mb-2">Poracle Bot</div>

        {/* Message sequence in send order */}
        {sendOrder.map((type) => {
          switch (type) {
            case 'sticker':
              return message.sticker ? <StickerMessage key="sticker" url={message.sticker} /> : null;
            case 'photo':
              return message.photo ? <PhotoMessage key="photo" url={message.photo} /> : null;
            case 'text':
              return message.content ? (
                <TextMessage
                  key="text"
                  content={message.content}
                  parseMode={message.parse_mode}
                  webpagePreview={message.webpage_preview}
                />
              ) : null;
            case 'location':
              return message.location ? <LocationMessage key="location" latitude={latitude} longitude={longitude} /> : null;
            case 'venue':
              return message.venue ? <VenueMessage key="venue" venue={message.venue} latitude={latitude} longitude={longitude} /> : null;
            default:
              return null;
          }
        })}

        {/* Timestamp */}
        <div className="text-[11px] text-gray-500 mt-1 text-right max-w-[380px]">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
