/**
 * Dummy game-data-dependent Handlebars helpers.
 * These return placeholder values since real game data is not available in the browser.
 * Some helpers (getEmoji, map, map2) read from a runtime-mutable registry so the
 * editor can inject real data fetched from the PoracleNG API.
 */

// Mutable per-platform emoji registry. Populated via setEmojiMap from the
// app once it has fetched /api/dts/emoji?platform=...
const emojiRegistry = { discord: {}, telegram: {} };

// The active platform — set by the engine before rendering so {{getEmoji "key"}}
// without an explicit platform argument picks the right map.
let activePlatform = 'discord';

export function setEmojiMap(platform, map) {
  emojiRegistry[platform] = map || {};
}

export function getEmojiMap(platform) {
  return emojiRegistry[platform] || {};
}

export function setActivePlatform(platform) {
  activePlatform = platform || 'discord';
}

// Custom maps fetched from GET /api/dts/custommaps, keyed by lookup key
// ("name" or "name.language"). null = the connected PoracleNG predates the
// customMaps capability (or we're offline): map/map2 keep the old behaviour of
// echoing the key so previews stay readable.
let customMaps = null;
let mapLanguage = '';

export function setCustomMaps(maps) {
  customMaps = maps || null;
}

export function setMapLanguage(language) {
  mapLanguage = language || '';
}

// lookupCustomMap mirrors PoracleNG: try "name.<lang>" then "name", each for
// value then fallbackValue. Returns { found, value }.
function lookupCustomMap(name, value, fallbackValue, language) {
  for (const key of [`${name}.${language}`, String(name)]) {
    const m = customMaps[key];
    if (!m) continue;
    if (Object.prototype.hasOwnProperty.call(m, value)) return { found: true, value: m[value] };
    if (fallbackValue !== '' && Object.prototype.hasOwnProperty.call(m, fallbackValue)) {
      return { found: true, value: m[fallbackValue] };
    }
  }
  return { found: false, value: undefined };
}

// keyString converts a helper argument to a lookup key the way PoracleNG's
// toString does (missing → '').
function keyString(v) {
  if (v == null || (typeof v === 'object' && !Array.isArray(v))) return '';
  if (Array.isArray(v)) return v.length === 0 ? '' : String(v);
  return String(v);
}

// customMapResult shapes a lookup like PoracleNG's customMapResult: block →
// body with the value as context ({{else}} on a miss); inline/subexpression →
// the value, empty on a miss. Handlebars can't tell inline from subexpression,
// so object values come back with a toString of '' — truthy in {{#if (map …)}}
// but rendering empty inline, as in PoracleNG.
function customMapResult({ found, value }, options) {
  if (typeof options.fn === 'function') {
    return found ? options.fn(value) : options.inverse(this);
  }
  if (!found || value == null) return '';
  if (typeof value === 'object') {
    const wrapped = Array.isArray(value) ? [...value] : { ...value };
    Object.defineProperty(wrapped, 'toString', { value: () => '', enumerable: false });
    return wrapped;
  }
  return value;
}

export function registerGameHelpers(hbs) {
  hbs.registerHelper('pokemonName', (id) => `Pokemon #${id}`);
  hbs.registerHelper('pokemonNameEng', (id) => `Pokemon #${id}`);
  hbs.registerHelper('pokemonNameAlt', (id) => `Pokemon #${id}`);
  hbs.registerHelper('pokemonForm', (formId) => `Form #${formId}`);
  hbs.registerHelper('pokemonFormEng', (formId) => `Form #${formId}`);
  hbs.registerHelper('pokemonFormAlt', (formId) => `Form #${formId}`);

  // pokemon block helper — provides a context with pokemon data fields
  hbs.registerHelper('pokemon', function (id, form, options) {
    if (typeof form === 'object' && form.fn) {
      options = form;
      form = 0;
    }
    const ctx = {
      name: `Pokemon #${id}`,
      nameEng: `Pokemon #${id}`,
      formName: '',
      formNameEng: '',
      fullName: `Pokemon #${id}`,
      fullNameEng: `Pokemon #${id}`,
      typeName: [],
      typeNameEng: [],
      typeEmoji: [],
      baseStats: { baseAttack: 0, baseDefense: 0, baseStamina: 0 },
      hasEvolutions: false,
    };
    return options.fn(ctx);
  });

  hbs.registerHelper('pokemonBaseStats', () => ({ baseAttack: 0, baseDefense: 0, baseStamina: 0 }));
  hbs.registerHelper('moveName', (id) => `Move #${id}`);
  hbs.registerHelper('moveNameEng', (id) => `Move #${id}`);
  hbs.registerHelper('moveNameAlt', (id) => `Move #${id}`);
  hbs.registerHelper('moveType', () => 'Type');
  hbs.registerHelper('moveTypeEng', () => 'Type');
  hbs.registerHelper('moveTypeAlt', () => 'Type');
  hbs.registerHelper('moveEmoji', () => '');
  hbs.registerHelper('moveEmojiEng', () => '');
  hbs.registerHelper('moveEmojiAlt', () => '');
  hbs.registerHelper('getEmoji', function (key, platform) {
    // Handlebars passes its options object as the last arg if no platform was supplied
    const explicitPlatform = typeof platform === 'string' ? platform : null;
    const p = explicitPlatform || activePlatform;
    const map = emojiRegistry[p] || {};
    if (map[key] !== undefined) return map[key];
    // Wrap unresolved keys in a sentinel that the markdown renderer turns into a
    // visible "missing emoji" badge. Using ⟦ ⟧ (mathematical brackets) since
    // they're unlikely to appear in user text.
    return `⟦${key}⟧`;
  });
  hbs.registerHelper('translateAlt', (text) => String(text));
  hbs.registerHelper('getPowerUpCost', function (startLevel, endLevel, options) {
    const result = { stardust: 0, candy: 0, xlCandy: 0 };
    const rendered = options.fn(result);
    return rendered || '0 stardust, 0 candy, 0 XL candy';
  });
  hbs.registerHelper('calculateCp', () => 10);
  hbs.registerHelper('map', function (name, value, options) {
    if (customMaps === null) return String(value);
    const language = options.data?.language || mapLanguage;
    return customMapResult.call(this, lookupCustomMap(name, keyString(value), '', language), options);
  });
  hbs.registerHelper('map2', function (name, value, value2, options) {
    if (customMaps === null) return String(value);
    const language = options.data?.language || mapLanguage;
    return customMapResult.call(this, lookupCustomMap(name, keyString(value), keyString(value2), language), options);
  });
}
