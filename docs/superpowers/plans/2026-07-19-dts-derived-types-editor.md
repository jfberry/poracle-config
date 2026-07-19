# DTS Derived Types — Server-Driven Type Resolution — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the editor preview every DTS template type (incl. derived: `monsterChanged`, `incident`, `questSummary`, `weatherchange`, `rsvpChanges`) by consuming PoracleNG's new server-side type map + `?dtsType=` filtering + enrich-by-name, with a thin feature-detected fallback for old poracle.

**Architecture:** All type-resolution policy and legacy fallback live in one new pure module `src/lib/dts-types.js`. `api-client.js` gains a capability probe (`loadDtsTypes()`) called race-free inside `useApi.connect()` before `setConnected(true)`. `App.jsx` deletes its hardcoded maps and calls the new helpers. The build-time capture script and `/next/` Pages channel are independent follow-on tasks.

**Tech Stack:** React 18 + Vite 8, Vitest 4 for unit tests, plain ESM. PoracleNG HTTP API.

## Global Constraints

- **Back-compat:** the fallback path (`!client.supportsDerivedTypes`) must reproduce today's runtime behaviour exactly — plain `?type=<webhookType>` passthrough, **no client-side scenario splitting**.
- **Capability detection is race-free:** `loadDtsTypes()` runs inside `useApi.connect()` *before* `setConnected(true)`; it never throws and never blocks connect.
- **CI never contacts a poracle:** `capture-test-data.mjs` is a manual on-demand tool only; both Pages builds use committed fixtures.
- **Legacy is quarantined** in `src/lib/dts-types.js` (`DTS_TO_WEBHOOK`, `DTS_TO_ENRICH`, and the `!supportsDerivedTypes` branches) for one-commit deletion at promote.
- **Branch:** all work on `feature/dts-derived-types`. Run tests with `npm test` (`vitest run`).

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/api-client.js` | Transport + connection capability. `getTestdata({type,dtsType})`, `loadDtsTypes()`, `dtsTypes`/`supportsDerivedTypes` fields. |
| `src/lib/dts-types.js` | **New.** Pure resolution policy + all fallback logic. |
| `src/lib/__tests__/api-client.test.js` | **New.** Unit tests for query building + capability detection. |
| `src/lib/__tests__/dts-types.test.js` | **New.** Unit tests for resolution helpers (both modes). |
| `src/hooks/useApi.js` | Calls `loadDtsTypes()` in `connect()` before `setConnected(true)`. |
| `src/App.jsx` | Deletes inline maps; wires `fetchScenarios` / `resolveEnrichType`. |
| `scripts/capture-test-data.mjs` | Rewritten to the new API (on-demand only). |
| `src/data/test-data.js` | Regenerated offline fixtures (manual run of the script). |
| `vite.config.js` | `base` parameterized via `BASE_PATH` env. |
| `.github/workflows/deploy.yml` | Assembles root + `/next/` into one Pages artifact. |

---

### Task 1: api-client — `getTestdata` options signature + `loadDtsTypes()` capability probe

**Files:**
- Modify: `src/lib/api-client.js` (constructor; `getTestdata`, ~lines 58-61; add `loadDtsTypes`)
- Test: `src/lib/__tests__/api-client.test.js` (create)

**Interfaces:**
- Produces:
  - `client.getTestdata({ type?, dtsType? } = {}) → Promise<object>` — builds `?dtsType=` if `dtsType` set (wins), else `?type=` if `type` set, else no query.
  - `client.loadDtsTypes() → Promise<boolean>` — sets `client.dtsTypes` (`res.types ?? null`) and `client.supportsDerivedTypes` (`!!res.types`); never throws; returns `supportsDerivedTypes`.
  - `client.dtsTypes` (`object|null`, default `null`), `client.supportsDerivedTypes` (`boolean`, default `false`).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/api-client.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- api-client`
Expected: FAIL — `getTestdata` currently expects a string; `loadDtsTypes` is undefined.

- [ ] **Step 3: Implement in `src/lib/api-client.js`**

In the constructor (after `this.useProxy = false;`), add:

```js
    // Populated by loadDtsTypes() on connect. null / false = old poracle (fallback).
    this.dtsTypes = null;
    this.supportsDerivedTypes = false;
```

Replace the existing `getTestdata` method:

```js
  async getTestdata({ type, dtsType } = {}) {
    const params = new URLSearchParams();
    if (dtsType) params.set('dtsType', dtsType);
    else if (type) params.set('type', type);
    const query = params.toString();
    return this.fetch(`/api/dts/testdata${query ? '?' + query : ''}`);
  }

  async loadDtsTypes() {
    try {
      const res = await this.getTestdata();
      this.dtsTypes = res.types ?? null;
      this.supportsDerivedTypes = !!res.types;
    } catch {
      this.dtsTypes = null;
      this.supportsDerivedTypes = false;
    }
    return this.supportsDerivedTypes;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- api-client`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-client.js src/lib/__tests__/api-client.test.js
git commit -m "feat(api-client): options-object getTestdata + loadDtsTypes capability probe"
```

---

### Task 2: `dts-types.js` — pure resolution policy + fallback

**Files:**
- Create: `src/lib/dts-types.js`
- Test: `src/lib/__tests__/dts-types.test.js`

**Interfaces:**
- Consumes: a `client` with `{ dtsTypes, supportsDerivedTypes, getTestdata({type,dtsType}) }` (Task 1).
- Produces:
  - `resolveWebhookType(client, dtsType) → string`
  - `resolveEnrichType(client, dtsType) → string`
  - `fetchScenarios(client, dtsType) → Promise<entries[]>`
  - `DTS_TO_WEBHOOK`, `DTS_TO_ENRICH` (fallback tables, exported for testing).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/dts-types.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- dts-types`
Expected: FAIL — module `../dts-types` does not exist.

- [ ] **Step 3: Implement `src/lib/dts-types.js`**

```js
// Server-driven DTS type resolution, with a thin fallback for pre-derived-types
// poracle builds. Everything guarded by `!client.supportsDerivedTypes` — plus the
// two fallback tables below — is deleted in one commit once develop is promoted.
// See docs/superpowers/specs/2026-07-19-dts-derived-types-editor.md §6.

// ─── Fallback tables (delete at promote) ───
export const DTS_TO_WEBHOOK = {
  monster: 'pokemon',
  monsterNoIv: 'pokemon',
  raid: 'raid',
  egg: 'raid',
  invasion: 'pokestop',
  lure: 'pokestop',
  quest: 'quest',
  nest: 'nest',
  gym: 'gym',
  'fort-update': 'fort_update',
  maxbattle: 'max_battle',
};

export const DTS_TO_ENRICH = {
  monsterNoIv: 'pokemon',
  egg: 'raid',
  'fort-update': 'fort_update',
  maxbattle: 'max_battle',
};

// The webhook bucket a DTS type reads from. New poracle answers via its `types`
// map; old poracle uses the hardcoded table, then the dtsType itself.
export function resolveWebhookType(client, dtsType) {
  return client?.dtsTypes?.[dtsType]?.webhookType ?? DTS_TO_WEBHOOK[dtsType] ?? dtsType;
}

// The `type` to send to POST /api/dts/enrich. New poracle accepts DTS names
// directly; old poracle needs the legacy remap.
export function resolveEnrichType(client, dtsType) {
  if (client?.supportsDerivedTypes) return dtsType;
  return DTS_TO_ENRICH[dtsType] ?? dtsType;
}

// Test scenarios for a DTS type. New poracle filters + tags server-side via
// ?dtsType=; old poracle returns every entry of the mapped webhook type
// (no client-side split — matches pre-derived-types runtime behaviour).
export async function fetchScenarios(client, dtsType) {
  if (!client) return [];
  try {
    if (client.supportsDerivedTypes) {
      const res = await client.getTestdata({ dtsType });
      return res.testdata ?? [];
    }
    const res = await client.getTestdata({ type: resolveWebhookType(client, dtsType) });
    return res.testdata ?? [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- dts-types`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dts-types.js src/lib/__tests__/dts-types.test.js
git commit -m "feat(dts-types): server-driven type resolution with thin fallback"
```

---

### Task 3: Wire `useApi` + `App.jsx` to the new resolution path

**Files:**
- Modify: `src/hooks/useApi.js` (`connect`, ~lines 10-29)
- Modify: `src/App.jsx` (delete maps ~lines 23-52; testdata effect ~lines 121-124; `handleEnrich` ~lines 210-221)

**Interfaces:**
- Consumes: `client.loadDtsTypes()` (Task 1); `fetchScenarios`, `resolveEnrichType` (Task 2).
- Produces: no new exports. Behavioural: on connect, `client.supportsDerivedTypes`/`dtsTypes` are set before `connected` flips; the testdata effect and enrich use the resolution helpers.

- [ ] **Step 1: Add the capability probe to `useApi.connect()`**

In `src/hooks/useApi.js`, in `connect`, after the `await client.getConfigSchema();` line and before `clientRef.current = client;`, add:

```js
      // Detect derived-types support before flipping `connected`, so the
      // testdata effect never runs against an unset capability. Never throws.
      await client.loadDtsTypes();
```

- [ ] **Step 2: Delete the hardcoded maps in `App.jsx`**

Remove the entire block `src/App.jsx:23-52` — the `dtsToWebhookType` map, the `dtsToEnrichType` map, and the `getEnrichType` function (the comment header through the closing `}` of `getEnrichType`).

- [ ] **Step 3: Add the import in `App.jsx`**

Alongside the other `./lib/...` imports (near `import { tabClass } from './lib/styles';`), add:

```js
import { fetchScenarios, resolveEnrichType } from './lib/dts-types';
```

- [ ] **Step 4: Update the testdata effect in `App.jsx`**

Replace the current testdata lines (was ~121-124):

```js
    const webhookType = dtsToWebhookType[dts.filters.type] || dts.filters.type;
    api.client.getTestdata(webhookType)
      .then((result) => { if (!cancelled) setApiTestScenarios(result.testdata || null); })
      .catch(() => { if (!cancelled) setApiTestScenarios(null); });
```

with:

```js
    fetchScenarios(api.client, dts.filters.type)
      .then((scenarios) => { if (!cancelled) setApiTestScenarios(scenarios.length ? scenarios : null); });
```

(`fetchScenarios` already swallows errors and returns `[]`, so no `.catch` is needed.)

- [ ] **Step 5: Update `handleEnrich` in `App.jsx`**

In `handleEnrich`, replace:

```js
      const enrichType = getEnrichType(dts.filters.type);
```

with:

```js
      const enrichType = resolveEnrichType(api.client, dts.filters.type);
```

- [ ] **Step 6: Verify the build and existing tests**

Run: `npm run build`
Expected: SUCCESS, no unresolved references to `dtsToWebhookType` / `getEnrichType`.

Run: `npm test`
Expected: PASS (all suites, including Tasks 1-2).

Run (grep for stragglers): `grep -rn "dtsToWebhookType\|dtsToEnrichType\|getEnrichType" src`
Expected: no matches.

- [ ] **Step 7: Live smoke test (verify skill)**

Start the dev server against develop poracle and confirm the bug is fixed:

Run: `PORACLE_URL=http://localhost:4201 npm run dev`
Then in the browser at `http://localhost:3000/poracle-config/`, connect with URL `http://localhost:4201` / secret `flibble` and confirm:
- The Test Data tab on the default `monsterChanged` template shows a populated **API Test Scenarios** dropdown (not empty).
- Selecting a scenario + clicking **Enrich via PoracleNG** populates the enriched view (incl. `original.*` fields) and the preview renders.

Expected: scenarios load; enrich succeeds. (If the browser extension is unavailable, verify via the proxied endpoint: `curl -s -H 'X-Poracle-Secret: flibble' 'http://localhost:3000/poracle-api/api/dts/testdata?dtsType=monsterChanged' | head -c 200` returns non-null `testdata`.)

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useApi.js src/App.jsx
git commit -m "feat(editor): resolve DTS scenarios + enrich via server type map"
```

---

### Task 4: Rewrite `capture-test-data.mjs` to the new API + regenerate fixtures

**Files:**
- Modify (rewrite): `scripts/capture-test-data.mjs`
- Regenerate: `src/data/test-data.js`

**Interfaces:**
- Standalone Node script. No runtime code depends on it. Output `src/data/test-data.js` keeps its existing exports: `testScenarios` (object keyed by DTS type), `getTestScenario(type, scenario)`, `getTestScenarioNames(type)`.

- [ ] **Step 1: Rewrite `scripts/capture-test-data.mjs`**

Replace the whole file with:

```js
#!/usr/bin/env node
/**
 * Capture enriched test data from a running PoracleNG instance (on-demand only).
 *
 * Usage:
 *   PORACLE_URL=http://localhost:4201 PORACLE_SECRET=flibble node scripts/capture-test-data.mjs
 *
 * Uses the server-side DTS type map (GET /api/dts/testdata -> `types`) and
 * per-DTS-type scenarios (?dtsType=), enriches each by DTS name, and writes the
 * enriched variable maps to src/data/test-data.js for standalone/offline mode.
 * Requires a poracle build that exposes `types` (develop / >= 5.2.0).
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const URL = process.env.PORACLE_URL || 'http://localhost:4201';
const SECRET = process.env.PORACLE_SECRET || '';

// DTS types with no bundled webhook sample — skip (no scenarios to capture).
const SKIP_TYPES = new Set(['rsvpChanges', 'greeting', 'help', 'nest']);

if (!SECRET) {
  console.error('PORACLE_SECRET environment variable is required');
  process.exit(1);
}

async function fetchJson(path, options = {}) {
  const res = await fetch(`${URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Poracle-Secret': SECRET,
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

async function main() {
  console.log(`Connecting to ${URL}...`);
  try {
    const res = await fetch(`${URL}/health`);
    if (!res.ok) throw new Error(`health check returned ${res.status}`);
  } catch (err) {
    console.error(`Cannot reach ${URL}: ${err.message}`);
    process.exit(1);
  }

  // Discover DTS types from the server map.
  const root = await fetchJson('/api/dts/testdata');
  if (!root.types) {
    console.error('This poracle build does not expose a `types` map (needs develop / >= 5.2.0).');
    process.exit(1);
  }
  // The `types` map is keyed by alias (e.g. monster_changed, fort_update) as well as
  // by canonical DTS type. Keep only canonical keys (key === templateType) so each
  // type is captured once, under the editor-facing name.
  const dtsTypes = Object.keys(root.types).filter(
    (t) => root.types[t].templateType === t && !SKIP_TYPES.has(t)
  );

  const result = {};
  for (const dtsType of dtsTypes) {
    console.log(`\n=== ${dtsType} ===`);
    let scenarios;
    try {
      const data = await fetchJson(`/api/dts/testdata?dtsType=${encodeURIComponent(dtsType)}`);
      scenarios = data.testdata || [];
    } catch (err) {
      console.warn(`  testdata fetch failed: ${err.message}`);
      continue;
    }
    if (scenarios.length === 0) {
      console.log('  no scenarios');
      continue;
    }

    result[dtsType] = {};
    for (const scenario of scenarios) {
      const name = scenario.test;
      try {
        const enriched = await fetchJson('/api/dts/enrich', {
          method: 'POST',
          body: JSON.stringify({ type: dtsType, webhook: scenario.webhook, language: 'en' }),
        });
        if (enriched.variables) {
          result[dtsType][name] = enriched.variables;
          console.log(`  ✓ ${name}`);
        } else {
          console.log(`  ✗ ${name} (no variables in response)`);
        }
      } catch (err) {
        console.warn(`  ✗ ${name}: ${err.message}`);
      }
    }
    if (Object.keys(result[dtsType]).length === 0) delete result[dtsType];
  }

  const totalScenarios = Object.values(result).reduce((sum, t) => sum + Object.keys(t).length, 0);
  console.log(`\nCaptured ${totalScenarios} scenarios across ${Object.keys(result).length} types`);

  const banner = `/**
 * Pre-enriched test data for standalone preview mode.
 *
 * AUTO-GENERATED — do not edit by hand.
 * Regenerate with: PORACLE_URL=... PORACLE_SECRET=... node scripts/capture-test-data.mjs
 */

`;
  const body = `export const testScenarios = ${JSON.stringify(result, null, 2)};

export function getTestScenario(type, scenario) {
  return testScenarios[type]?.[scenario] || null;
}

export function getTestScenarioNames(type) {
  return Object.keys(testScenarios[type] || {});
}
`;
  const outputPath = join(__dirname, '..', 'src', 'data', 'test-data.js');
  writeFileSync(outputPath, banner + body);
  console.log(`Wrote ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Note: the auto-generated banner intentionally omits a timestamp so regeneration produces no spurious diff when data is unchanged.

- [ ] **Step 2: Regenerate the fixtures against develop poracle**

Run against a poracle that exposes `types` (the derived-types build): `PORACLE_URL=http://localhost:4200 PORACLE_SECRET=hello node scripts/capture-test-data.mjs`
Expected: prints `✓` lines per scenario including `monster`, `monsterChanged`, `incident`, `questSummary`, `weatherchange`, `raid`, `egg`, `invasion`, `lure`, `quest`, `gym`, `maxbattle`, `fort-update`; writes `src/data/test-data.js`. (`showcase` currently `✗`es — its `/api/dts/enrich` returns 500 server-side; the script skips it gracefully and it's simply absent from the fixtures until the poracle bug is fixed.)

- [ ] **Step 3: Verify the regenerated module loads and includes derived types**

Run:
```bash
node -e "import('./src/data/test-data.js').then(m => { const k = Object.keys(m.testScenarios); console.log(k); if (!k.includes('monsterChanged')) { console.error('MISSING monsterChanged'); process.exit(1); } })"
```
Expected: prints the type keys, includes `monsterChanged`; exit 0.

Run: `npm test && npm run build`
Expected: PASS + SUCCESS (fixture is valid ESM; existing consumers unaffected).

- [ ] **Step 4: Commit**

```bash
git add scripts/capture-test-data.mjs src/data/test-data.js
git commit -m "feat(capture): use server dtsType API; regenerate offline fixtures with derived types"
```

---

### Task 5: `/next/` GitHub Pages preview channel

**Files:**
- Modify: `vite.config.js` (`base`)
- Modify: `.github/workflows/deploy.yml` (build job)

**Interfaces:**
- Build accepts `BASE_PATH` env (default `/poracle-config/`). CI assembles `dist/` (root = `master`) + `dist/next/` (preview branch built with `BASE_PATH=/poracle-config/next/`).

- [ ] **Step 1: Parameterize the Vite base**

In `vite.config.js`, replace `base: '/poracle-config/',` with:

```js
  base: process.env.BASE_PATH || '/poracle-config/',
```

- [ ] **Step 2: Verify a preview-base build locally**

Run: `BASE_PATH=/poracle-config/next/ npm run build`
Then: `grep -o '/poracle-config/next/[^"]*' dist/index.html | head -1`
Expected: asset URLs are prefixed with `/poracle-config/next/` (confirming the base took effect). Restore the normal build afterwards with `npm run build`.

- [ ] **Step 3: Restructure the deploy workflow into independent jobs**

Replace the single `build` + `deploy` jobs in `.github/workflows/deploy.yml` with three jobs so a preview-branch failure can never block the production deploy (per the reviewer's Important finding — user chose full job separation over `continue-on-error` on a shared job):

- `build-stable`: checkout the triggering ref, `npm run build`, `actions/upload-artifact` as `stable-dist` (path `dist`).
- `build-preview`: `continue-on-error: true`; `actions/checkout` with `ref: ${{ env.PREVIEW_BRANCH }}`, `BASE_PATH=/poracle-config/next/ npm run build`, `actions/upload-artifact` as `preview-dist` (path `dist`).
- `deploy`: `needs: [build-stable, build-preview]`, `if: ${{ !cancelled() && needs.build-stable.result == 'success' }}`; `download-artifact stable-dist → dist`, `download-artifact preview-dist → dist/next` (`continue-on-error: true`), then `upload-pages-artifact` (path `dist`) + `deploy-pages@v4`.

Add a workflow-level `env: PREVIEW_BRANCH: feature/dts-derived-types` (the documented knob). Both builds are plain `npm ci && npm run build` — no poracle contact. The committed `.github/workflows/deploy.yml` is the source of truth for exact YAML.

- [ ] **Step 4: Validate the workflow YAML**

Run: `node -e "import('js-yaml').then(y => y.load(require('fs').readFileSync('.github/workflows/deploy.yml','utf8'))).then(()=>console.log('yaml ok')).catch(e=>{console.error(e);process.exit(1)})" 2>/dev/null || python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml')); print('yaml ok')"`
Expected: `yaml ok`.

- [ ] **Step 5: Commit**

```bash
git add vite.config.js .github/workflows/deploy.yml
git commit -m "ci: add /next/ Pages preview channel via BASE_PATH"
```

---

## Self-Review

**Spec coverage:**
- §Architecture `dts-types.js` → Task 2. `api-client` changes → Task 1. `useApi` race-free probe → Task 3 (Step 1). `App.jsx` map deletion + wiring → Task 3. ✓
- §Data flow (new + fallback) → exercised by Task 2 tests + Task 3 Step 7 live smoke. ✓
- §3 derived-extras preview (no new code) → verified in Task 3 Step 7. ✓
- §4 capture script + offline fixtures (on-demand) → Task 4. ✓
- §5 `/next/` channel → Task 5. ✓
- §6 cleanup checklist → documented in spec; no task now (it's the future promote commit). ✓
- §7 tests → Tasks 1-2 unit; Task 3 live smoke. ✓

**Placeholder scan:** none — every code step contains full content.

**Type consistency:** `getTestdata({type,dtsType})`, `loadDtsTypes()`, `dtsTypes`/`supportsDerivedTypes`, `fetchScenarios(client,dtsType)`, `resolveEnrichType(client,dtsType)` used identically across Tasks 1-4. ✓
