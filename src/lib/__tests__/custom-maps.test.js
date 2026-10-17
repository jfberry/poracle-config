import { describe, it, expect, afterEach } from 'vitest';
import { createEngine, renderTemplate, setCustomMaps, setMapLanguage } from '../handlebars-engine';

function render(tpl, data = {}, language) {
  const engine = createEngine();
  const compiled = engine.compile(tpl, { noEscape: true });
  return compiled(data, language ? { data: { language } } : undefined);
}

const MAPS = {
  generation: {
    1: { genName: 'Kanto', genNumber: '1' },
    '26_61': { genName: 'Alola', genNumber: '7' },
  },
  shinyPossible: { 25: '✨' },
  weatherBoost: { Windy: 'Dragon, Flying, Psychic', Rainy: 'Water' },
  'weatherBoost.de': { Windy: 'Drache, Flug, Psycho' },
  trainers: { 144: 2 },
};

afterEach(() => {
  setCustomMaps(null);
  setMapLanguage('');
});

describe('map / map2 without server maps (older PoracleNG)', () => {
  it('echoes the key, as before', () => {
    setCustomMaps(null);
    expect(render("{{map 'shinyPossible' 25}}")).toBe('25');
    expect(render("{{map2 'generation' 'x' 1}}")).toBe('x');
  });
});

describe('map / map2 with server maps (PoracleNG customMaps capability)', () => {
  it('inline hit', () => {
    setCustomMaps(MAPS);
    expect(render("{{map 'shinyPossible' id}}", { id: 25 })).toBe('✨');
  });
  it('inline number value', () => {
    setCustomMaps(MAPS);
    expect(render("{{map 'trainers' 144}}")).toBe('2');
  });
  it('inline miss is empty', () => {
    setCustomMaps(MAPS);
    expect(render("[{{map 'shinyPossible' id}}]", { id: 1 })).toBe('[]');
  });
  it('unknown map is empty', () => {
    setCustomMaps(MAPS);
    expect(render("[{{map 'nope' 1}}]")).toBe('[]');
  });
  it('inline object value renders empty', () => {
    setCustomMaps(MAPS);
    expect(render("[{{map 'generation' 1}}]")).toBe('[]');
  });
  it('block exposes object fields', () => {
    setCustomMaps(MAPS);
    expect(render("{{#map 'generation' id}}Gen {{genNumber}} {{genName}}{{/map}}", { id: 1 })).toBe('Gen 1 Kanto');
  });
  it('block miss renders else', () => {
    setCustomMaps(MAPS);
    expect(render("{{#map 'generation' id}}{{genName}}{{else}}none{{/map}}", { id: 999 })).toBe('none');
  });
  it('subexpression: object hit is truthy, miss is falsy', () => {
    setCustomMaps(MAPS);
    const tpl = "{{#if (map 'generation' id)}}yes{{else}}no{{/if}}";
    expect(render(tpl, { id: 1 })).toBe('yes');
    expect(render(tpl, { id: 999 })).toBe('no');
  });
  it('map2 prefers the first key, falls back to the second', () => {
    setCustomMaps(MAPS);
    const tpl = "{{#map2 'generation' (concat id '_' formId) id}}{{genName}}{{/map2}}";
    expect(render(tpl, { id: 26, formId: 61 })).toBe('Alola');
    expect(render(tpl, { id: 1, formId: 0 })).toBe('Kanto');
  });
  it('language variant first, then base map key by key', () => {
    setCustomMaps(MAPS);
    setMapLanguage('de');
    expect(render("{{map 'weatherBoost' 'Windy'}}")).toBe('Drache, Flug, Psycho');
    expect(render("{{map 'weatherBoost' 'Rainy'}}")).toBe('Water');
  });
  it('@data language overrides the active language', () => {
    setCustomMaps(MAPS);
    setMapLanguage('en');
    expect(render("{{map 'weatherBoost' 'Windy'}}", {}, 'de')).toBe('Drache, Flug, Psycho');
  });
  it('the user template pattern renders like PoracleNG', () => {
    setCustomMaps(MAPS);
    const tpl = "{{map 'shinyPossible' id}}{{map 'shinyPossible' (concat id '_' formId)}}|{{#if (map2 'generation' (concat id '_' formId) id)}}{{#map2 'generation' (concat id '_' formId) id}}Gen {{genNumber}} {{genName}}{{/map2}}{{/if}}";
    expect(render(tpl, { id: 25, formId: 0 })).toBe('✨|');
    expect(render(tpl, { id: 1, formId: 0 })).toBe('|Gen 1 Kanto');
  });
});

describe('renderTemplate uses the registry', () => {
  it('works through the engine helper', () => {
    setCustomMaps(MAPS);
    expect(renderTemplate(createEngine(), "{{map 'shinyPossible' 25}}", {})).toBe('✨');
  });
});
