import { describe, it, expect } from 'vitest';
import { createEngine } from '../handlebars-engine';
import { renderButtons } from '../render-buttons';

const engine = createEngine();

describe('renderButtons — label rendering', () => {
  it('renders Handlebars in labels', () => {
    const result = renderButtons(engine, [
      { id: 'a', label: 'Mute {{name}}', style: 'primary' },
    ], { name: 'Tyranitar' });
    expect(result).toEqual([{ id: 'a', label: 'Mute Tyranitar', style: 'primary' }]);
  });

  it('defaults style to secondary when missing', () => {
    const result = renderButtons(engine, [{ id: 'a', label: 'Go' }], {});
    expect(result[0].style).toBe('secondary');
  });

  it('returns empty list for null/missing buttons', () => {
    expect(renderButtons(engine, null, {})).toEqual([]);
    expect(renderButtons(engine, undefined, {})).toEqual([]);
    expect(renderButtons(engine, [], {})).toEqual([]);
  });
});

describe('renderButtons — show_if filtering', () => {
  it('drops buttons where show_if evaluates falsy', () => {
    const result = renderButtons(engine, [
      { id: 'visible', label: 'A', show_if: 'iv' },
      { id: 'hidden',  label: 'B', show_if: 'missing' },
    ], { iv: 95 });
    expect(result.map((b) => b.id)).toEqual(['visible']);
  });

  it('keeps buttons where show_if evaluates truthy (helper subexpression)', () => {
    const result = renderButtons(engine, [
      { id: 'hi', label: 'Hi IV', show_if: '(gt iv 90)' },
    ], { iv: 95 });
    expect(result.map((b) => b.id)).toEqual(['hi']);
  });

  it('keeps button when show_if errors (fail-open)', () => {
    const result = renderButtons(engine, [
      { id: 'broken', label: 'B', show_if: '((((' },
    ], {});
    expect(result.map((b) => b.id)).toEqual(['broken']);
  });

  it('treats missing show_if as always-visible', () => {
    const result = renderButtons(engine, [{ id: 'a', label: 'A' }], {});
    expect(result).toHaveLength(1);
  });
});
