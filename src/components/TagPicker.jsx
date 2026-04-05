import { useState, useMemo } from 'react';
import { getFieldsForType } from '../lib/field-definitions';

const categoryColors = {
  pokemon: 'text-yellow-300',
  stats: 'text-green-400',
  moves: 'text-cyan-400',
  time: 'text-orange-400',
  location: 'text-pink-400',
  map: 'text-pink-400',
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
  other: 'text-gray-400',
};

const categoryBgColors = {
  pokemon: 'bg-yellow-900/30',
  stats: 'bg-green-900/30',
  moves: 'bg-cyan-900/30',
  time: 'bg-orange-900/30',
  location: 'bg-pink-900/30',
  map: 'bg-pink-900/30',
  media: 'bg-pink-900/30',
  weather: 'bg-blue-900/30',
  pvp: 'bg-purple-900/30',
  display: 'bg-yellow-900/20',
  raid: 'bg-red-900/30',
  gym: 'bg-red-900/20',
  pokestop: 'bg-amber-900/30',
  quest: 'bg-amber-900/20',
  invasion: 'bg-rose-900/30',
  lure: 'bg-teal-900/30',
  nest: 'bg-lime-900/30',
  other: 'bg-gray-800/30',
};

const urlFields = new Set([
  'staticMap', 'staticmap', 'imgUrl', 'googleMapUrl', 'appleMapUrl', 'wazeMapUrl', 'mapurl', 'applemap',
]);

const helpers = [
  { label: '{{#if ...}}', snippet: '{{#if fieldName}}...{{/if}}' },
  { label: '{{#each ...}}', snippet: '{{#each arrayField}}...{{/each}}' },
  { label: '{{#unless ...}}', snippet: '{{#unless fieldName}}...{{/unless}}' },
  { label: '{{round ...}}', snippet: '{{round fieldName}}' },
  { label: '{{numberFormat ...}}', snippet: '{{numberFormat fieldName 2}}' },
  { label: '{{#eq a b}}', snippet: '{{#eq fieldA "value"}}...{{else}}...{{/eq}}' },
  { label: '{{#compare ...}}', snippet: '{{#compare fieldA ">" fieldB}}...{{/compare}}' },
  { label: '{{#forEach ...}}', snippet: '{{#forEach arrayField}}...{{/forEach}}' },
];

export default function TagPicker({ type, onInsertTag }) {
  const [showRaw, setShowRaw] = useState(false);
  const [showDeprecated, setShowDeprecated] = useState(false);

  const grouped = useMemo(() => {
    const fields = getFieldsForType(type);
    const filtered = fields.filter((f) => {
      if (f.rawWebhook && !showRaw) return false;
      if (f.deprecated && !showDeprecated) return false;
      return true;
    });
    // Sort: preferred first within each group
    filtered.sort((a, b) => (b.preferred ? 1 : 0) - (a.preferred ? 1 : 0));
    // Group by category
    const groups = {};
    for (const f of filtered) {
      const cat = f.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(f);
    }
    return groups;
  }, [type, showRaw, showDeprecated]);

  const handleClick = (field) => {
    const tag = urlFields.has(field.name) ? `{{{${field.name}}}}` : `{{${field.name}}}`;
    if (onInsertTag) {
      onInsertTag(tag);
    }
    navigator.clipboard?.writeText(tag).catch(() => {});
  };

  const handleHelperClick = (snippet) => {
    if (onInsertTag) {
      onInsertTag(snippet);
    }
    navigator.clipboard?.writeText(snippet).catch(() => {});
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-3">
        {Object.entries(grouped).map(([category, fields]) => (
          <div key={category}>
            <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${categoryColors[category] || 'text-gray-400'}`}>
              {category}
            </div>
            <div className="flex flex-wrap gap-1">
              {fields.map((f) => (
                <button
                  key={f.name}
                  onClick={() => handleClick(f)}
                  title={`${f.description}${f.deprecated ? ` (use ${f.preferredAlternative} instead)` : ''}`}
                  className={`text-[11px] px-1.5 py-0.5 rounded cursor-pointer border border-transparent hover:border-gray-500 transition-colors ${
                    f.deprecated
                      ? 'line-through text-gray-600 bg-gray-800/40'
                      : f.rawWebhook
                        ? 'text-gray-500 bg-gray-800/40'
                        : f.preferred
                          ? `${categoryColors[f.category] || 'text-gray-300'} ${categoryBgColors[f.category] || 'bg-gray-800/40'} font-medium`
                          : `text-gray-400 ${categoryBgColors[f.category] || 'bg-gray-800/40'}`
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
                onClick={() => handleHelperClick(h.snippet)}
                title={h.snippet}
                className="text-[11px] px-1.5 py-0.5 rounded cursor-pointer bg-gray-800/60 text-gray-400 border border-transparent hover:border-gray-500 transition-colors"
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Toggles at bottom */}
      <div className="border-t border-gray-700 px-2 py-1.5 space-y-1 shrink-0">
        <label className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showRaw}
            onChange={(e) => setShowRaw(e.target.checked)}
            className="rounded text-xs"
          />
          Show raw webhook
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showDeprecated}
            onChange={(e) => setShowDeprecated(e.target.checked)}
            className="rounded text-xs"
          />
          Show deprecated
        </label>
      </div>
    </div>
  );
}
