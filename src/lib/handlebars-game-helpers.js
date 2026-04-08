/**
 * Dummy game-data-dependent Handlebars helpers.
 * These return placeholder values since real game data is not available in the browser.
 * Some helpers (getEmoji) read from a runtime-mutable registry so the editor can
 * inject real data fetched from the PoracleNG API.
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
  hbs.registerHelper('map', (_name, value) => String(value));
  hbs.registerHelper('map2', (_name, value) => String(value));
}
