import { describe, it, expect } from 'vitest';
import { validateButton, validateButtons } from '../button-validation';

const ok = (b) => expect(validateButton(b).errors).toEqual([]);
const errs = (b) => validateButton(b).errors;

describe('validateButton — required fields', () => {
  it('flags missing id', () => {
    expect(errs({ label: 'x', action: 'redeliver' })).toContain('id is required');
  });
  it('flags missing label', () => {
    expect(errs({ id: 'x', action: 'redeliver' })).toContain('label is required');
  });
});

describe('validateButton — exactly one dispatch field', () => {
  it('flags zero dispatch fields', () => {
    expect(errs({ id: 'x', label: 'L' })).toContain(
      'exactly one of action / response_template_id / response_template_inline / response_text is required'
    );
  });
  it('flags two dispatch fields', () => {
    const e = errs({ id: 'x', label: 'L', action: 'redeliver', response_text: 'hi' });
    expect(e.some((m) => m.includes('exactly one'))).toBe(true);
  });
  it('accepts action alone', () => {
    ok({ id: 'x', label: 'L', action: 'redeliver' });
  });
  it('accepts response_template_id alone', () => {
    ok({ id: 'x', label: 'L', response_template_id: 'rsvp-confirm' });
  });
  it('accepts response_template_inline alone (string)', () => {
    ok({ id: 'x', label: 'L', response_template_inline: 'hi' });
  });
  it('accepts response_template_inline alone (object)', () => {
    ok({ id: 'x', label: 'L', response_template_inline: { content: 'hi' } });
  });
  it('accepts response_text alone', () => {
    ok({ id: 'x', label: 'L', response_text: 'hi' });
  });
});

describe('validateButton — action+scope rules', () => {
  it('mute requires scope', () => {
    expect(errs({ id: 'x', label: 'L', action: 'mute' })).toContain('action "mute" requires scope');
  });
  it('mute with scope passes', () => {
    ok({ id: 'x', label: 'L', action: 'mute', scope: 'gym' });
  });
  it('unsubscribe requires scope = tracking', () => {
    expect(errs({ id: 'x', label: 'L', action: 'unsubscribe', scope: 'gym' })).toContain(
      'action "unsubscribe" requires scope = "tracking"'
    );
  });
  it('unsubscribe with scope=tracking passes', () => {
    ok({ id: 'x', label: 'L', action: 'unsubscribe', scope: 'tracking' });
  });
  it('redeliver does not require scope', () => {
    ok({ id: 'x', label: 'L', action: 'redeliver' });
  });
});

describe('validateButton — enum fields', () => {
  it('rejects unknown style', () => {
    expect(errs({ id: 'x', label: 'L', action: 'redeliver', style: 'pink' })).toContain(
      'style must be one of primary, secondary, success, danger'
    );
  });
  it('rejects unknown visible_to', () => {
    expect(errs({ id: 'x', label: 'L', action: 'redeliver', visible_to: 'nobody' })).toContain(
      'visible_to must be one of anyone, registered, admin'
    );
  });
  it('rejects legacy visible_to=target (processor removed it)', () => {
    expect(errs({ id: 'x', label: 'L', action: 'redeliver', visible_to: 'target' })).toContain(
      'visible_to must be one of anyone, registered, admin'
    );
  });
  it('rejects unknown applies_to entry', () => {
    const e = errs({ id: 'x', label: 'L', action: 'redeliver', applies_to: ['dm', 'pigeon'] });
    expect(e.some((m) => m.includes('applies_to'))).toBe(true);
  });
});

describe('validateButtons — list-level rules', () => {
  it('flags duplicate ids', () => {
    const result = validateButtons([
      { id: 'a', label: 'A', action: 'redeliver' },
      { id: 'a', label: 'B', action: 'redeliver' },
    ]);
    expect(result.listErrors).toContain('duplicate button id: "a"');
  });
  it('passes unique ids', () => {
    const result = validateButtons([
      { id: 'a', label: 'A', action: 'redeliver' },
      { id: 'b', label: 'B', action: 'redeliver' },
    ]);
    expect(result.listErrors).toEqual([]);
  });
  it('returns per-button errors keyed by index', () => {
    const result = validateButtons([
      { id: 'a', label: 'A', action: 'redeliver' },
      { id: 'b', action: 'mute' },
    ]);
    expect(result.perButton[0]).toEqual([]);
    expect(result.perButton[1].length).toBeGreaterThan(0);
  });
});
