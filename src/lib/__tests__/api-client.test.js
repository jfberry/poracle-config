import { describe, it, expect, vi } from 'vitest';
import { PoracleApiClient } from '../api-client';

function makeClient() {
  const client = new PoracleApiClient('http://x', 'secret');
  client.fetch = vi.fn().mockResolvedValue({});
  return client;
}

describe('getTestdata query building', () => {
  it('uses ?dtsType= when dtsType given', async () => {
    const c = makeClient();
    await c.getTestdata({ dtsType: 'monsterChanged' });
    expect(c.fetch).toHaveBeenCalledWith('/api/dts/testdata?dtsType=monsterChanged');
  });
  it('uses ?type= when only type given', async () => {
    const c = makeClient();
    await c.getTestdata({ type: 'pokemon' });
    expect(c.fetch).toHaveBeenCalledWith('/api/dts/testdata?type=pokemon');
  });
  it('builds no query when called with no args', async () => {
    const c = makeClient();
    await c.getTestdata();
    expect(c.fetch).toHaveBeenCalledWith('/api/dts/testdata');
  });
  it('dtsType wins when both given', async () => {
    const c = makeClient();
    await c.getTestdata({ type: 'pokestop', dtsType: 'invasion' });
    expect(c.fetch).toHaveBeenCalledWith('/api/dts/testdata?dtsType=invasion');
  });
});

describe('loadDtsTypes capability detection', () => {
  it('stores the map and sets supportsDerivedTypes when types present', async () => {
    const c = makeClient();
    c.fetch = vi.fn().mockResolvedValue({
      types: { monster: { webhookType: 'pokemon', derived: false } },
      testdata: [],
    });
    const supported = await c.loadDtsTypes();
    expect(supported).toBe(true);
    expect(c.supportsDerivedTypes).toBe(true);
    expect(c.dtsTypes.monster.webhookType).toBe('pokemon');
  });
  it('falls back to false when types absent', async () => {
    const c = makeClient();
    c.fetch = vi.fn().mockResolvedValue({ testdata: [] });
    await c.loadDtsTypes();
    expect(c.supportsDerivedTypes).toBe(false);
    expect(c.dtsTypes).toBe(null);
  });
  it('never throws and stays false on fetch error', async () => {
    const c = makeClient();
    c.fetch = vi.fn().mockRejectedValue(new Error('network'));
    await expect(c.loadDtsTypes()).resolves.toBe(false);
    expect(c.supportsDerivedTypes).toBe(false);
    expect(c.dtsTypes).toBe(null);
  });
});
