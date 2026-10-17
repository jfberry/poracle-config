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

describe('loadDtsTypes support detection', () => {
  it('uses the capability flag (true) without a testdata fetch', async () => {
    const c = makeClient();
    const supported = await c.loadDtsTypes({ derivedDtsTypes: true });
    expect(supported).toBe(true);
    expect(c.supportsDerivedTypes).toBe(true);
    expect(c.fetch).not.toHaveBeenCalled();
  });
  it('uses the capability flag (false) without a testdata fetch', async () => {
    const c = makeClient();
    await c.loadDtsTypes({ buttons: true, derivedDtsTypes: false });
    expect(c.supportsDerivedTypes).toBe(false);
    expect(c.fetch).not.toHaveBeenCalled();
  });
  it('sniffs testdata `types` when the flag key is absent (older /health)', async () => {
    const c = makeClient();
    c.fetch = vi.fn().mockResolvedValue({ types: { monster: {} }, testdata: [] });
    const supported = await c.loadDtsTypes({ buttons: true });
    expect(supported).toBe(true);
    expect(c.fetch).toHaveBeenCalledWith('/api/dts/testdata');
  });
  it('sniffs and returns false when no flag and no types (old poracle)', async () => {
    const c = makeClient();
    c.fetch = vi.fn().mockResolvedValue({ testdata: [] });
    await c.loadDtsTypes(undefined);
    expect(c.supportsDerivedTypes).toBe(false);
    expect(c.fetch).toHaveBeenCalledWith('/api/dts/testdata');
  });
  it('never throws and stays false when the sniff fetch errors', async () => {
    const c = makeClient();
    c.fetch = vi.fn().mockRejectedValue(new Error('network'));
    await expect(c.loadDtsTypes()).resolves.toBe(false);
    expect(c.supportsDerivedTypes).toBe(false);
  });
});

describe('loadCustomMaps', () => {
  it('fetches /api/dts/custommaps when the capability is present', async () => {
    const c = makeClient();
    c.fetch.mockResolvedValue({ status: 'ok', maps: { generation: { 1: { genName: 'Kanto' } } } });
    const maps = await c.loadCustomMaps({ customMaps: true });
    expect(c.fetch).toHaveBeenCalledWith('/api/dts/custommaps');
    expect(maps).toEqual({ generation: { 1: { genName: 'Kanto' } } });
  });
  it('returns null without fetching when the capability is absent (older PoracleNG)', async () => {
    const c = makeClient();
    expect(await c.loadCustomMaps({})).toBeNull();
    expect(await c.loadCustomMaps(undefined)).toBeNull();
    expect(c.fetch).not.toHaveBeenCalled();
  });
  it('returns an empty object when the server has no maps', async () => {
    const c = makeClient();
    c.fetch.mockResolvedValue({ status: 'ok', maps: {} });
    expect(await c.loadCustomMaps({ customMaps: true })).toEqual({});
  });
  it('never throws; returns null when the fetch errors', async () => {
    const c = makeClient();
    c.fetch.mockRejectedValue(new Error('boom'));
    expect(await c.loadCustomMaps({ customMaps: true })).toBeNull();
  });
});
