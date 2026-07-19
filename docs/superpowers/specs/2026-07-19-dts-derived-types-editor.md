# DTS Derived Types — Server-Driven Type Resolution — Design Spec

## Goal

Adopt PoracleNG's new server-side DTS-type support so the editor can preview **every** DTS template type — including the *derived* ones (`monsterChanged`, `incident`, `questSummary`, `weatherchange`, `rsvpChanges`) — and stop hardcoding the DTS-type→webhook-type mapping.

Concretely:

1. Replace the hardcoded `dtsToWebhookType` / `dtsToEnrichType` maps with the server-provided `types` map + `?dtsType=` filtering + enrich-by-DTS-name.
2. Keep the current behaviour working against **old poracle** (no `types` support) via a thin, feature-detected fallback that is deleted in a single commit once develop→main is promoted.
3. Update the on-demand `capture-test-data.mjs` tool + regenerate `src/data/test-data.js` so **offline mode** previews the derived types too.
4. Add a `/next/` GitHub Pages preview channel so the new editor can be tested against develop poracle before merging to `master`.

**Out of scope:** any bespoke rendering UI for derived extras (they render through the existing Handlebars preview with no new code — see §3); a snapshot/RSVP inspector; changes to the runtime type selector (already template-driven).

## Background

PoracleNG (develop, reported `version` 5.2.0) added server-side support described in
`~/GolandProjects/PoracleNG/docs/superpowers/handoffs/2026-07-18-dts-editor-derived-types.md`.
All changes are **additive and back-compatible**:

- `GET /api/dts/testdata` responses now include a `types` object: `{ [dtsType]: { webhookType, templateType, derived } }`.
- `GET /api/dts/testdata?dtsType=<name>` resolves the DTS type server-side and returns only the matching entries, each tagged with `dtsType`. Legacy `?type=<webhookType>` is unchanged.
- `POST /api/dts/enrich` now accepts any DTS type name (incl. derived) as `type`, and returns the derived extras in `variables` (`original.*`, `enrichedActivePokemons`, quest group, RSVP fields).

### The bug this fixes

On connect the editor loads templates and selects the first one. Against develop poracle that first template is now type `monsterChanged`. The editor's hardcoded `dtsToWebhookType` (`src/App.jsx`) has no entry for it, so it requests `GET /api/dts/testdata?type=monsterChanged` — a bucket that does not exist — and poracle returns `{ testdata: null }`. Result: the **Test Data tab shows an empty scenario dropdown** and `{}` enriched output. The same gap affects `incident`, `questSummary`, `weatherchange`, `rsvpChanges`. Config schema/values and CORS are **not** implicated — this is purely stale client-side type mapping.

## Design axis: the compatibility lever

The editor is one static bundle that each user points at **their own** poracle. So compatibility is not a function of which editor deploy a user loads — it is a function of **which poracle version they connect to**. The lever is therefore **runtime feature-detection against the connected poracle**, not a second Pages deploy. Detection is free: the new `types` object is present in every testdata response and absent on old poracle.

All legacy/fallback logic is quarantined in one new pure module (`src/lib/dts-types.js`) so that promotion is a single, bounded deletion (see §6).

## Architecture

### New: `src/lib/dts-types.js` (pure policy module)

The single home for resolution policy and all fallback logic. Pure functions over an injected `client` (reads `client.dtsTypes` / `client.supportsDerivedTypes`); no side effects beyond the `client.getTestdata` call it delegates.

| Export | Behaviour |
|--------|-----------|
| `DTS_TO_WEBHOOK` | Fallback map, moved verbatim from `App.jsx`. Used **only** when `!client.supportsDerivedTypes`. |
| `DTS_TO_ENRICH` | Fallback enrich remap (`monsterNoIv→pokemon`, `egg→raid`, `fort-update→fort_update`, `maxbattle→max_battle`), moved from `App.jsx`. Fallback-only. |
| `resolveWebhookType(client, dtsType)` | `client.dtsTypes?.[dtsType]?.webhookType` ?? `DTS_TO_WEBHOOK[dtsType]` ?? `dtsType`. |
| `fetchScenarios(client, dtsType)` → `Promise<entries[]>` | New: `client.getTestdata({ dtsType })` → `res.testdata ?? []` (server already filtered + tagged). Old: `client.getTestdata({ type: resolveWebhookType(client, dtsType) })` → `res.testdata ?? []` — a plain passthrough with **no client-side split**, matching today's runtime exactly. Network error ⇒ `[]`. |

**Note on splitting:** today's *runtime* never split the shared pokestop bucket (invasion vs lure) — it showed every entry of the mapped webhook type (App.jsx:121-124). Only the build-time capture script split. On new poracle, `?dtsType=` does the split server-side; on old poracle the fallback reproduces today's unsplit behaviour. So no client-side split helper is needed anywhere.
| `resolveEnrichType(client, dtsType)` | New: `dtsType` unchanged (server accepts DTS names). Old: `DTS_TO_ENRICH[dtsType] ?? dtsType`. |

### Changed: `src/lib/api-client.js`

Stays a transport layer; gains connection-capability state exactly as it already does with `useProxy`.

- `getTestdata({ type, dtsType } = {})` — options object; builds `?type=` **or** `?dtsType=` (never both). Replaces the current `getTestdata(type)` string signature; all call sites updated.
- `loadDtsTypes()` — one `GET /api/dts/testdata` (no filter). Sets `this.dtsTypes = res.types ?? null` and `this.supportsDerivedTypes = !!res.types`. Swallows its own errors and leaves `dtsTypes = null` / `supportsDerivedTypes = false` (safe fallback), so it never throws and never blocks connect.

### Changed: `src/hooks/useApi.js` (race-free capability detection)

`connect()` currently flips `setConnected(true)` after verifying auth. The testdata effect in `App.jsx` depends on `connected`, so capability **must** be known before that flip — otherwise the first `fetchScenarios` runs with `supportsDerivedTypes` still `false` and silently takes the fallback path on a new poracle. Fix: call `await client.loadDtsTypes()` inside `connect()`, right after the `getConfigSchema()` auth check and **before** `setConnected(true)`. Because `loadDtsTypes()` cannot throw, a capability-probe failure degrades to the fallback path without breaking the connection.

### Changed: `src/App.jsx`

- Delete `dtsToWebhookType`, `dtsToEnrichType`, `getEnrichType`. (Capability detection lives in `useApi.connect()`, not `handleConnect` — see above.)
- Testdata effect (currently lines ~121-124): replace the inline `dtsToWebhookType` lookup with `fetchScenarios(api.client, dts.filters.type).then((s) => setApiTestScenarios(s.length ? s : null))`.
- `handleEnrich`: `const enrichType = resolveEnrichType(api.client, dts.filters.type)`.
- **No selector change** — `dts.availableTypes` is derived from loaded templates, so derived types already appear when the operator has such templates.

### Files

| File | Change |
|------|--------|
| `src/lib/dts-types.js` | **New.** Policy module above. |
| `src/lib/__tests__/dts-types.test.js` | **New.** Unit tests (see §7). |
| `src/lib/api-client.js` | `getTestdata` options-object signature; new `loadDtsTypes()`; capability fields. |
| `src/hooks/useApi.js` | Call `await client.loadDtsTypes()` in `connect()` before `setConnected(true)` (race-free capability detection). |
| `src/App.jsx` | Delete inline maps; wire `fetchScenarios` / `resolveEnrichType`. |
| `scripts/capture-test-data.mjs` | Rewrite to new API (see §4). On-demand only. |
| `src/data/test-data.js` | Regenerated (manual, on-demand) with derived-type fixtures. |
| `vite.config.js` | Parameterize `base` via `BASE_PATH` env (default `/poracle-config/`). |
| `.github/workflows/deploy.yml` | Assemble root + `/next/` into one Pages artifact (see §5). |

## Data flow

### New poracle (develop)

1. Connect → `useApi.connect()` runs `loadDtsTypes()` before flipping `connected`, so the `types` map + `supportsDerivedTypes = true` are set before any effect fires.
2. On `monsterChanged`, effect → `fetchScenarios` → `?dtsType=monsterChanged` → tagged partials fill the API-scenario dropdown.
3. User selects a scenario → raw partial shown in "Raw Webhook".
4. User clicks **Enrich via PoracleNG** → `resolveEnrichType` → `"monsterChanged"` → `POST /enrich {type:"monsterChanged", webhook}` → `variables` incl. `original.*` / `changeType` → `setCustomTestData(variables)` → Handlebars preview renders it (no special code).

### Old poracle (fallback)

1. Connect → testdata response has no `types` → `supportsDerivedTypes = false`.
2. `fetchScenarios('monster')` → `resolveWebhookType` → `pokemon` → `?type=pokemon` → all entries (no client split) → **exactly today's behaviour**.
3. Derived types don't appear (old poracle has no such templates); if forced, they resolve empty — no worse than today.

## §3 — Types, selector, derived-extras preview

- `monsterChanged`, `incident`, `questSummary`, `weatherchange` preview end-to-end (scenarios via `?dtsType=`, extras via enrich).
- `rsvpChanges` — appears only if the operator authored a template; enrich/testdata work, no bundled default. Handled naturally by the template-driven selector.
- `greeting` / `help` — no webhook source; `fetchScenarios` returns `[]`; the tab shows the (empty) static fallback. No special-casing.
- **Derived extras need no new rendering code**: the preview renders whatever variable bag it is handed via Handlebars, and enrich returns the full bag. The tag picker already pulls `/api/dts/fields/<type>` (API-driven, includes derived fields).

## §4 — capture-test-data.mjs + offline fixtures (on-demand only)

**Constraint: this is a manual developer tool, never run at build time.** CI has no guaranteed poracle. Regeneration is decoupled from any deploy and run by the maintainer when offline fixtures need refreshing.

- Rewrite `capture-test-data.mjs` to the new API: drop its private `dtsToWebhookType` and the `grunt_type`/`lure_id` filter; read the DTS types from the server `types` map, fetch each via `?dtsType=`, enrich by DTS name, write enriched variable maps to `src/data/test-data.js` **keyed by DTS type** — now including `monsterChanged`, `incident`, `questSummary`, `weatherchange`. Skip `rsvpChanges` / `greeting` (no bundled sample). As a build-time tool targeting new poracle only, it carries **no fallback branch**.
- Regenerate `src/data/test-data.js` against develop poracle and commit the result. This is what lets **offline mode** ("Try Offline") preview the derived types.

## §5 — `/next/` GitHub Pages preview channel

- Parameterize Vite `base` via `BASE_PATH` (default `/poracle-config/`).
- Restructure `.github/workflows/deploy.yml` into **three independent jobs** so a broken preview branch can never block the production deploy:
  1. `build-stable` — checkout the triggering ref (`master`), `npm run build`, upload `stable-dist` artifact.
  2. `build-preview` — checkout `PREVIEW_BRANCH` (`feature/dts-derived-types`; a documented knob), `BASE_PATH=/poracle-config/next/ npm run build`, upload `preview-dist` artifact. Marked `continue-on-error: true`.
  3. `deploy` — `needs: [build-stable, build-preview]` but `if: !cancelled() && needs.build-stable.result == 'success'`, so it runs whenever the stable build succeeded regardless of the preview result. Downloads `stable-dist` → `dist/`, `preview-dist` → `dist/next/` (skip-tolerant `continue-on-error`), then `upload-pages-artifact` + `deploy-pages`.
- Result: `…/poracle-config/` (stable) + `…/poracle-config/next/` (new editor) on one site; a preview-branch failure degrades to "no `/next/` this run" without failing the stable deploy.
- **Both builds use only committed fixtures** (`npm ci && npm run build`) — CI never contacts a poracle.
- The preview channel is a maintainer testing convenience, **not** the compatibility mechanism (that is runtime feature-detection).

## §6 — Cleanup at promote (bounded legacy removal)

Once develop→main is promoted, one commit removes all legacy:

- [ ] `src/lib/dts-types.js`: delete `DTS_TO_WEBHOOK`, `DTS_TO_ENRICH`, and every `!client.supportsDerivedTypes` branch. `fetchScenarios` / `resolveWebhookType` / `resolveEnrichType` collapse to the `?dtsType=` / `types` path.
- [ ] `api-client.js`: `loadDtsTypes()` / `supportsDerivedTypes` may stay (harmless) or be simplified. Also drop `getTestdata`'s now-unused `else if (type)` branch — it exists only for the fallback path (kept out of `dts-types.js`, so note it here so the legacy sweep is complete).
- [ ] Delete the fallback-path unit tests in `dts-types.test.js` (and the `oldClient` fixture).
- [ ] Retire or repoint the `/next/` channel: update/remove `PREVIEW_BRANCH` in `deploy.yml`. Note that once the preview branch is deleted, `build-preview`'s checkout fails, `continue-on-error` tolerates it, and the stable site still ships — the red ✗ on that job is expected graceful degradation, not a regression.

## §7 — Testing

- **Unit** (`src/lib/__tests__/dts-types.test.js`, vitest): `resolveWebhookType`, `resolveEnrichType`, and `fetchScenarios` against a mocked client for both `supportsDerivedTypes = true` and `false`. Plus `api-client` `getTestdata` query-building and `loadDtsTypes` capability detection.
- **Live/manual** (via the `verify` skill during implementation): `PORACLE_URL=http://localhost:4201 npm run dev` → confirm `monsterChanged` scenarios load, enrich, and preview; mock a `types`-less testdata response to confirm the fallback path reproduces current behaviour.
