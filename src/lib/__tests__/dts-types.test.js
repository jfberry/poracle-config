import { describe, it, expect, vi } from 'vitest';
import { resolveWebhookType, resolveEnrichType, fetchScenarios } from '../dts-types';

const newClient = (overrides = {}) => ({
  supportsDerivedTypes: true,
  dtsTypes: {
    monster: { webhookType: 'pokemon' },
    monsterChanged: { webhookType: 'monster_changed', derived: true },
  },
  getTestdata: vi.fn().mockResolvedValue({ testdata: [{ test: 'a' }] }),
  ...overrides,
});

const oldClient = (overrides = {}) => ({
  supportsDerivedTypes: false,
  dtsTypes: null,
  getTestdata: vi.fn().mockResolvedValue({ testdata: [{ test: 'b' }] }),
  ...overrides,
});

describe('resolveWebhookType', () => {
  it('uses the server map when present', () => {
    expect(resolveWebhookType(newClient(), 'monsterChanged')).toBe('monster_changed');
  });
  it('falls back to the hardcoded map for old poracle', () => {
    expect(resolveWebhookType(oldClient(), 'invasion')).toBe('pokestop');
  });
  it('falls back to the dtsType itself when unknown', () => {
    expect(resolveWebhookType(oldClient(), 'mystery')).toBe('mystery');
  });
});

describe('resolveEnrichType', () => {
  it('passes the DTS name straight through on new poracle', () => {
    expect(resolveEnrichType(newClient(), 'monsterNoIv')).toBe('monsterNoIv');
  });
  it('applies the legacy remap on old poracle', () => {
    expect(resolveEnrichType(oldClient(), 'monsterNoIv')).toBe('pokemon');
    expect(resolveEnrichType(oldClient(), 'egg')).toBe('raid');
  });
  it('returns the dtsType unchanged when no legacy remap exists', () => {
    expect(resolveEnrichType(oldClient(), 'monster')).toBe('monster');
  });
});

describe('fetchScenarios', () => {
  it('queries by dtsType on new poracle', async () => {
    const c = newClient();
    const out = await fetchScenarios(c, 'monsterChanged');
    expect(c.getTestdata).toHaveBeenCalledWith({ dtsType: 'monsterChanged' });
    expect(out).toEqual([{ test: 'a' }]);
  });
  it('queries by mapped webhook type on old poracle (no split)', async () => {
    const c = oldClient();
    const out = await fetchScenarios(c, 'invasion');
    expect(c.getTestdata).toHaveBeenCalledWith({ type: 'pokestop' });
    expect(out).toEqual([{ test: 'b' }]);
  });
  it('returns [] on null client', async () => {
    expect(await fetchScenarios(null, 'monster')).toEqual([]);
  });
  it('returns [] when the request throws', async () => {
    const c = newClient({ getTestdata: vi.fn().mockRejectedValue(new Error('x')) });
    expect(await fetchScenarios(c, 'monster')).toEqual([]);
  });
  it('returns [] when testdata is null', async () => {
    const c = newClient({ getTestdata: vi.fn().mockResolvedValue({ testdata: null }) });
    expect(await fetchScenarios(c, 'monster')).toEqual([]);
  });
});
