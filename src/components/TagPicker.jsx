import { useState, useMemo } from 'react';
import { getFieldsForType, getBlockScope, blockScopes } from '../lib/field-definitions';
import { generateEachSnippet, generatePokemonSnippet, generatePowerUpCostSnippet } from '../lib/handlebars-context';

const categoryColors = {
  pokemon: 'text-yellow-300',
  identity: 'text-yellow-300',
  stats: 'text-green-400',
  moves: 'text-cyan-400',
  time: 'text-orange-400',
  location: 'text-pink-400',
  map: 'text-pink-400',
  maps: 'text-pink-400',
  media: 'text-pink-300',
  weather: 'text-blue-400',
  pvp: 'text-purple-400',
  display: 'text-yellow-200',
  raid: 'text-red-400',
  gym: 'text-red-300',
  pokestop: 'text-amber-400',
  quest: 'text-amber-300',
  invasion: 'text-rose-400',
  lure: 'text-teal-400',
  nest: 'text-lime-400',
  cost: 'text-amber-300',
  other: 'text-gray-400',
};

const urlFields = new Set([
  'staticMap', 'staticmap', 'imgUrl', 'imgUrlAlt', 'stickerUrl',
  'googleMapUrl', 'appleMapUrl', 'wazeMapUrl', 'mapurl', 'applemap',
  'rdmUrl', 'reactMapUrl', 'rocketMadUrl',
]);

const helpers = [
  { label: '{{#if ...}}', snippet: '{{#if fieldName}}...{{/if}}', desc: 'Conditional block' },
  { label: '{{#unless ...}}', snippet: '{{#unless fieldName}}...{{/unless}}', desc: 'Inverse conditional' },
  { label: '{{round ...}}', snippet: '{{round fieldName}}', desc: 'Round number' },
  { label: '{{numberFormat ...}}', snippet: '{{numberFormat fieldName 2}}', desc: 'Format decimals' },
  { label: '{{#eq a b}}', snippet: '{{#eq fieldA "value"}}...{{else}}...{{/eq}}', desc: 'Equals check' },
  { label: '{{#compare ...}}', snippet: '{{#compare fieldA ">" fieldB}}...{{/compare}}', desc: 'Comparison operator' },
];

// Fields that have iterable block scopes (for "insert each block" buttons)
const iterableFieldNames = ['pvpGreat', 'pvpUltra', 'pvpLittle', 'matched', 'weaknessList', 'evolutions'];

// Prevent the button from stealing focus from the active editor input.
// Without this, document.activeElement loses the input on click, which
// breaks document.execCommand('insertText') in useInsertAtCursor.
const noFocusSteal = (e) => e.preventDefault();

export default function TagPicker({ type, onInsertTag, apiFields, apiBlockScopes, blockContext, partials, emojis }) {
  const [expandedPartial, setExpandedPartial] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  const [showDeprecated, setShowDeprecated] = useState(false);
  const [lastInserted, setLastInserted] = useState(null);
  const [emojiSearch, setEmojiSearch] = useState('');

  const allFields = useMemo(() => {
    return apiFields && apiFields.length > 0 ? apiFields : getFieldsForType(type);
  }, [type, apiFields]);

  const grouped = useMemo(() => {
    const filtered = allFields.filter((f) => {
      if (f.rawWebhook && !showRaw) return false;
      if (f.deprecated && !showDeprecated) return false;
      return true;
    });
    filtered.sort((a, b) => (b.preferred ? 1 : 0) - (a.preferred ? 1 : 0));
    const groups = {};
    for (const f of filtered) {
      const cat = f.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(f);
    }
    return groups;
  }, [allFields, showRaw, showDeprecated]);

  // Build a flat lookup of block scopes from the API response (if available).
  // The API returns blockScopes as [{helper, arg?, fields, iterableFields?}, ...].
  // For each {{#each X}}-style entry, the per-iterable-field scopes are stored
  // under iterableFields[]. For named helpers (pokemon, getPowerUpCost), the
  // scope is stored under helper.
  const apiScopeLookup = useMemo(() => {
    if (!apiBlockScopes || !Array.isArray(apiBlockScopes)) return null;
    const lookup = {};
    for (const entry of apiBlockScopes) {
      const fields = entry.fields || [];
      if (entry.helper === 'each' || entry.helper === 'forEach') {
        // Each iterable field name gets the same scope
        for (const name of entry.iterableFields || []) {
          lookup[name] = fields;
        }
      } else if (entry.helper) {
        // Named helper like 'pokemon' or 'getPowerUpCost'
        lookup[entry.helper] = fields;
      }
    }
    return lookup;
  }, [apiBlockScopes]);

  // Get block scope fields when cursor is inside a block helper.
  // Prefer the API-supplied scopes; fall back to the static definitions.
  const scopeFields = useMemo(() => {
    if (!blockContext) return null;
    const key =
      blockContext.helper === 'each' || blockContext.helper === 'forEach'
        ? blockContext.arg
        : blockContext.helper;
    if (apiScopeLookup && apiScopeLookup[key]) return apiScopeLookup[key];
    return getBlockScope(key);
  }, [blockContext, apiScopeLookup]);

  // Find iterable fields in current type for "insert block" section.
  // Prefer the API's blockScopes.iterableFields list, falling back to a
  // heuristic on field type/name when offline.
  const iterableFields = useMemo(() => {
    if (apiBlockScopes && Array.isArray(apiBlockScopes)) {
      const names = new Set();
      for (const entry of apiBlockScopes) {
        if (entry.helper === 'each' || entry.helper === 'forEach') {
          for (const name of entry.iterableFields || []) names.add(name);
        }
      }
      if (names.size > 0) {
        return [...names].map((name) => ({ name }));
      }
    }
    return allFields.filter((f) =>
      f.type === 'array' || iterableFieldNames.includes(f.name)
    );
  }, [allFields, apiBlockScopes]);

  const doInsert = (text) => {
    const inserted = onInsertTag?.(text);
    if (inserted) {
      setLastInserted(text.length > 40 ? text.substring(0, 37) + '...' : text);
    } else {
      // Fallback: copy to clipboard so the user can paste manually
      navigator.clipboard?.writeText(text).catch(() => {});
      setLastInserted(`Copied: ${text.length > 30 ? text.substring(0, 27) + '...' : text}`);
    }
    setTimeout(() => setLastInserted(null), 2000);
  };

  const handleClick = (field) => {
    const tag = urlFields.has(field.name) ? `{{{${field.name}}}}` : `{{${field.name}}}`;
    doInsert(tag);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 pt-1 shrink-0">
        {lastInserted && (
          <div className="mb-1 px-2 py-1 bg-green-900/30 border border-green-700 rounded text-green-300 text-xs font-mono truncate">
            Inserted: {lastInserted}
          </div>
        )}
        <p className="text-gray-600 text-[10px] mb-1">Hover for description. Click to insert at cursor.</p>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-3">

        {/* Block context — shown when cursor is inside a block helper */}
        {blockContext && scopeFields && (
          <div className="border border-purple-700/50 bg-purple-900/20 rounded p-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-purple-400">
              Inside {'{{'}#{blockContext.helper} {blockContext.arg}{'}}'}
            </div>
            <div className="flex flex-wrap gap-1">
              {scopeFields.map((f) => (
                <button
                  key={f.name}
                  onMouseDown={noFocusSteal}
                  onClick={() => handleClick(f)}
                  title={f.description || f.name}
                  className="text-[11px] px-1.5 py-0.5 rounded cursor-pointer bg-purple-900/30 text-purple-300 font-medium border border-transparent hover:border-purple-500 transition-colors"
                >
                  {f.name}
                </button>
              ))}
              <button
                onMouseDown={noFocusSteal}
                onClick={() => doInsert('{{../}}')}
                title="Access parent scope field"
                className="text-[11px] px-1.5 py-0.5 rounded cursor-pointer bg-gray-800/40 text-gray-500 border border-transparent hover:border-gray-500 transition-colors"
              >
                ../
              </button>
            </div>
          </div>
        )}

        {/* Insert block helpers for iterable fields */}
        {iterableFields.length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-purple-400">
              Insert Block
            </div>
            <div className="flex flex-wrap gap-1">
              {iterableFields.map((f) => (
                <button
                  key={`block-${f.name}`}
                  onMouseDown={noFocusSteal}
                  onClick={() => {
                    // Prefer API-supplied scope, fall back to static
                    const scope = (apiScopeLookup && apiScopeLookup[f.name]) || getBlockScope(f.name);
                    doInsert(generateEachSnippet(f.name, scope));
                  }}
                  title={`Insert {{#each ${f.name}}}...{{/each}} block`}
                  className="text-[11px] px-1.5 py-0.5 rounded cursor-pointer bg-purple-900/20 text-purple-300 border border-purple-800/50 hover:border-purple-500 transition-colors"
                >
                  #each {f.name}
                </button>
              ))}
              <button
                onMouseDown={noFocusSteal}
                onClick={() => doInsert(generatePokemonSnippet())}
                title="Insert {{#pokemon id form}}...{{/pokemon}} block"
                className="text-[11px] px-1.5 py-0.5 rounded cursor-pointer bg-purple-900/20 text-purple-300 border border-purple-800/50 hover:border-purple-500 transition-colors"
              >
                #pokemon
              </button>
              <button
                onMouseDown={noFocusSteal}
                onClick={() => doInsert(generatePowerUpCostSnippet())}
                title="Insert {{#getPowerUpCost start end}}...{{/getPowerUpCost}} block"
                className="text-[11px] px-1.5 py-0.5 rounded cursor-pointer bg-purple-900/20 text-purple-300 border border-purple-800/50 hover:border-purple-500 transition-colors"
              >
                #getPowerUpCost
              </button>
            </div>
          </div>
        )}

        {/* Regular fields by category */}
        {Object.entries(grouped).map(([category, fields]) => (
          <div key={category}>
            <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${categoryColors[category] || 'text-gray-400'}`}>
              {category}
            </div>
            <div className="flex flex-wrap gap-1">
              {fields.map((f) => (
                <button
                  key={f.name}
                  onMouseDown={noFocusSteal}
                  onClick={() => handleClick(f)}
                  title={`${f.description || f.name}${f.deprecated && f.preferredAlternative ? `\n→ use ${f.preferredAlternative}` : ''}`}
                  className={`text-[11px] px-1.5 py-0.5 rounded cursor-pointer border border-transparent hover:border-gray-500 transition-colors ${
                    f.deprecated
                      ? 'line-through text-gray-600 bg-gray-800/40'
                      : f.rawWebhook
                        ? 'text-gray-500 bg-gray-800/40'
                        : f.preferred
                          ? `${categoryColors[f.category] || 'text-gray-300'} bg-gray-800/40 font-medium`
                          : 'text-gray-400 bg-gray-800/40'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Helpers section */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-gray-500">
            Helpers
          </div>
          <div className="flex flex-wrap gap-1">
            {helpers.map((h) => (
              <button
                key={h.label}
                onMouseDown={noFocusSteal}
                onClick={() => doInsert(h.snippet)}
                title={`${h.desc}\n${h.snippet}`}
                className="text-[11px] px-1.5 py-0.5 rounded cursor-pointer bg-gray-800/60 text-gray-400 border border-transparent hover:border-gray-500 transition-colors"
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>

        {/* Emoji section */}
        {emojis && Object.keys(emojis).length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-pink-400">
              Emojis ({Object.keys(emojis).length})
            </div>
            <input
              type="text"
              value={emojiSearch}
              onChange={(e) => setEmojiSearch(e.target.value)}
              placeholder="Search emoji keys..."
              className="w-full bg-gray-800 text-gray-200 px-2 py-1 rounded border border-gray-600 text-[11px] mb-1.5 focus:border-pink-500 focus:outline-none"
            />
            <div className="flex flex-wrap gap-1">
              {Object.entries(emojis)
                .filter(([key]) => !emojiSearch || key.toLowerCase().includes(emojiSearch.toLowerCase()))
                .slice(0, 60)
                .map(([key, value]) => (
                  <button
                    key={key}
                    onMouseDown={noFocusSteal}
                    onClick={() => doInsert(`{{getEmoji '${key}'}}`)}
                    title={`Insert {{getEmoji '${key}'}} → renders as ${value}`}
                    className="text-[11px] px-1.5 py-0.5 rounded cursor-pointer bg-pink-900/20 text-pink-300 border border-pink-800/50 hover:border-pink-500 transition-colors flex items-center gap-1"
                  >
                    <span className="text-gray-400 max-w-[20px] truncate">{value.length < 4 ? value : '🔣'}</span>
                    <span>{key}</span>
                  </button>
                ))}
            </div>
            {emojiSearch && Object.entries(emojis).filter(([k]) => k.toLowerCase().includes(emojiSearch.toLowerCase())).length > 60 && (
              <p className="text-[10px] text-gray-600 mt-1">Showing first 60 — refine search to narrow</p>
            )}
          </div>
        )}

        {/* Partials section */}
        {partials && Object.keys(partials).length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-amber-400">
              Partials ({Object.keys(partials).length})
            </div>
            <div className="space-y-0.5">
              {Object.entries(partials).sort(([a], [b]) => a.localeCompare(b)).map(([name, content]) => (
                <div key={name} className="flex items-start">
                  <button
                    onClick={() => setExpandedPartial(expandedPartial === name ? null : name)}
                    className="text-gray-500 hover:text-gray-300 text-[10px] px-0.5 shrink-0 mt-0.5"
                  >
                    {expandedPartial === name ? '▼' : '▶'}
                  </button>
                  <div className="flex-1 min-w-0">
                    <button
                      onMouseDown={noFocusSteal}
                      onClick={() => doInsert(`{{> ${name}}}`)}
                      title={`Insert {{> ${name}}}\n\n${content.substring(0, 200)}`}
                      className="text-[11px] font-mono text-amber-300 hover:text-amber-200 transition-colors truncate block w-full text-left"
                    >
                      {name}
                    </button>
                    {expandedPartial === name && (
                      <pre className="text-[9px] text-gray-500 font-mono whitespace-pre-wrap break-all mt-0.5 mb-1 pl-1 border-l border-gray-700 max-h-32 overflow-y-auto">
                        {content}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Toggles at bottom */}
      <div className="border-t border-gray-700 px-2 py-1.5 space-y-1 shrink-0">
        <label className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer">
          <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} className="rounded text-xs" />
          Show raw webhook
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer">
          <input type="checkbox" checked={showDeprecated} onChange={(e) => setShowDeprecated(e.target.checked)} className="rounded text-xs" />
          Show deprecated
        </label>
      </div>
    </div>
  );
}
