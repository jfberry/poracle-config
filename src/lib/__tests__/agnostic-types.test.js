import { describe, it, expect } from 'vitest';
import { AGNOSTIC_TYPES, isAgnostic } from '../agnostic-types';

describe('agnostic-types', () => {
  it('help is the only agnostic type', () => {
    expect(AGNOSTIC_TYPES).toEqual(['help']);
    expect(isAgnostic('help')).toBe(true);
  });

  it('platform-specific types are not agnostic', () => {
    for (const t of [
      'monster', 'raid', 'quest', 'invasion', 'incident', 'lure', 'nest',
      'gym', 'fort-update', 'maxbattle', 'showcase', 'monsterChanged',
      'questSummary', 'weatherchange',
    ]) {
      expect(isAgnostic(t)).toBe(false);
    }
  });

  it('unknown types are not agnostic', () => {
    expect(isAgnostic('')).toBe(false);
    expect(isAgnostic(undefined)).toBe(false);
  });
});
