# Button Management & Snapshots Config — Design Spec

## Goal

Support PoracleNG's new button/snapshot features in the config editor:

1. Authoring of interactive Discord buttons on DTS entries, with live preview.
2. Cross-linking from a button to a `type="buttonResponse"` DTS entry.
3. A new `[snapshots]` config section (with a "buttons silently disabled" warning).
4. Transparent handling of TOML-sourced entries (badge, save warning, no format conversion).

Out of scope for this spec: the snapshot inspector panel (deferred).

## Background

PoracleNG branch `buttons-and-snapshots` added three interrelated capabilities — see the user's brief for details. The editor speaks JSON to the processor; the processor preserves each entry's original source format (`json` or `toml`) on save. The editor never touches TOML directly. The full brief is the source of truth for the wire schema, validation rules, and round-trip semantics.

## Architecture

### Integration

- Buttons are a property of a DTSEntry. The editor surfaces them in a new collapsible "Buttons" section inside `TemplateEditor.jsx`, below the existing template body editor. Buttons are not part of the JSON template body, so the section renders identically across all three body modes: Form, Raw JSON, and templateFile (raw Handlebars).
- The current `TemplateEditor.jsx` body-editing logic (Form/Raw/templateFile toggle) is extracted into a reusable `TemplateBodyEditor` component. `TemplateEditor` becomes a thin shell composing `TemplateBodyEditor` + `ButtonsEditor` + the format badge. This extraction enables the **inline-template button dispatch mode** to reuse the exact same body editor (with Form/Raw toggle and full embed-fields support).
- Action registry is fetched once on connect via a new `useActions` hook (mirrors `useDts` loading at connect time in `App.jsx`).
- Live preview is wired by extending the existing render pipeline to attach a rendered `buttons` array to `renderedData`. `DiscordView` gains an action-row renderer that consumes it.
- `[snapshots]` config schema is exposed by the PoracleNG server via the existing `/api/config/schema` endpoint. The editor renders it through the normal `useConfig` flow with no special-case code. This is a **blocker on the processor side** — see the "Processor dependencies" section below. The editor work in this spec assumes the schema is in place.

### New Files

| File | Purpose |
|------|---------|
| `src/hooks/useActions.js` | Fetches `/api/dts/actions` once at connect; exposes `{ actions, loading, error }`. Treats 503 as "no registry" (returns empty list; editor falls back to the four hardcoded action names with no scope/param hints). |
| `src/components/TemplateBodyEditor.jsx` | Extracted from current `TemplateEditor.jsx`: the Form/Raw toggle plus templateFile handling. Accepts `{ template, templateFileContent, onChange, onFileContentChange, platform }` and renders the right body editor. Used by `TemplateEditor` for the main entry body AND by `ButtonDispatchEditor` for inline-template button responses. |
| `src/components/ButtonsEditor.jsx` | Top-level collapsible "Buttons" section. Header shows count, add button, disabled banner. Body is the list of `ButtonCard`s. |
| `src/components/ButtonCard.jsx` | One button — collapsed row (label + style badge + reorder/delete) + expanded form. |
| `src/components/ButtonDispatchEditor.jsx` | The mutually-exclusive dispatch chooser (Action / Template Link / Inline Template / Plain Text) and the per-mode sub-form. The Inline Template mode embeds `TemplateBodyEditor` for full Form/Raw/embed-fields support. |
| `src/components/HandlebarsExpressionInput.jsx` | Small text input that wires `useInsertAtCursor` + a compact field-picker popover. Used for `show_if`. Reusable for future Handlebars-aware short inputs. |
| `src/components/TemplateLinkPicker.jsx` | Dropdown filtered to `type === "buttonResponse"` entries, with a "Jump to" button that calls `dts.selectTemplate`. |
| `src/lib/button-validation.js` | Client-side validation matching the brief's rules. Returns `{ errors: string[] }` per button. |
| `src/lib/__tests__/button-validation.test.js` | Unit tests for the validator. |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/api-client.js` | Add `getActions()` returning `/api/dts/actions` body. |
| `src/hooks/useDts.js` | Already preserves unknown fields via spread, so `buttons`/`sourceFormat`/`sourceFile` survive automatically. Add a typed JSDoc comment and a helper `updateButtons(updater)` for the buttons editor to call. |
| `src/hooks/useHandlebars.js` | Extend render to produce a parallel `__buttons` array attached to the rendered output. For each button: render `label` through Handlebars against the same context, evaluate `show_if` (drop the button when false), pass `style` and `id` through unchanged. Other fields (`action`, `scope`, `params`, response_*, `applies_to`, `visible_to`) are NOT rendered — they're processor-side metadata and don't affect the visual preview. Underscored name (`__buttons`) avoids colliding with any future webhook field. |
| `src/components/TemplateEditor.jsx` | Becomes a thin shell: `TemplateBodyEditor` + format badge + `ButtonsEditor`. Passes `buttons`, `readonly`, `sourceFormat`, and the actions list down. |
| `src/components/TemplateSelector.jsx` | Show a small TOML/JSON badge per entry row. |
| `src/components/DiscordPreview.jsx` + `src/components/discordview.jsx` | Render an action-row after the embed(s) when `data.__buttons` is non-empty. |
| `src/App.jsx` | Call `useActions` at connect; pass `actions` down to `TemplateEditor`. Show one-shot toast on save when any saved entry has `sourceFormat === "toml"`. |
| `src/lib/styles.js` | Add Discord button color tokens (primary blurple, secondary grey, success green, danger red). |

### Data Flow

1. Connect → `useActions.load()` fetches `/api/dts/actions` alongside `useDts.load()` and `useConfig.load()`.
2. User selects a DTS template → `TemplateEditor` receives the entry (now with optional `buttons`).
3. `ButtonsEditor` renders the buttons list with the action registry as a prop.
4. Edits call `dts.updateButtons(buttons => …)` which spreads the entry and writes back the new `buttons` array — same dirty-tracking as template edits.
5. `useHandlebars` renders the template body, renders each visible button's label, and attaches `__buttons` to the preview data.
6. `DiscordView` renders the action row from `data.__buttons`.
7. Save → entry is POSTed as-is via existing `apiClient.saveTemplates`. The processor preserves `sourceFormat`; the editor shows a TOML-loss toast if applicable.

## UI Layout

### Buttons section in TemplateEditor

Position: below the existing Form/Raw template body, above the bottom of the editor pane.

Header row (always visible):
- Title: "Buttons (N)" with collapse chevron
- Add button (disabled when `readonly` or when 5 buttons already exist — Discord's per-row limit; we cap at 5 for v1)
- `sourceFormat` badge (in editor header, not this section)
- "Buttons disabled" yellow banner when `snapshots.enabled === false` in current config values

Body (when expanded):
- Vertical list of `ButtonCard`s in order
- Each `ButtonCard` collapsed: drag handle • label preview (rendered through Handlebars) • style swatch • dispatch summary ("→ mute (gym)" / "→ template: rsvp-confirm") • up/down/delete
- Expanded: form fields described below

### ButtonCard (expanded)

Grouped into three sub-sections:

**Identity & appearance**
- `id` (text, required) — small input
- `label` (text, required) — Handlebars-aware via `HandlebarsExpressionInput`
- `style` (segmented control: primary / secondary / success / danger; default secondary)

**Dispatch** — `ButtonDispatchEditor` (segmented tab control with four options, exactly one active):
1. **Action** — dropdown driven by `useActions.actions`. When an action is picked, conditionally show:
   - `scope` dropdown (options come from `action.scopes`; required when `action.required_scope`; for `unsubscribe`, locked to `tracking`)
   - `params` editor: one input per documented param in `action.params`, plus a "+ Add custom param" row for anything not in the registry. Stored as `Record<string, unknown>`.
2. **Template link** — `TemplateLinkPicker` (dropdown of in-memory entries where `type === "buttonResponse"`). Shows a "Jump to" button that calls `dts.selectTemplate`. Shows "Create new buttonResponse template" link when no candidates exist (opens a new entry of that type — same flow as TemplateSelector's "new").
3. **Inline template** — embeds the full `TemplateBodyEditor` (same Form/Raw toggle as the main template editor, with all embed-fields UI). Storage mirrors the main template: object when last edited in Form mode, string when last edited in Raw mode. The nested `TemplateBodyEditor` does NOT show its own buttons section — buttons are entry-level and nesting them inside an inline response template is out of scope. Sent to the processor as-is; per the brief the `template?: any` shape (object OR string) is accepted, and `response_template_inline` should follow the same tolerance. Confirm with the processor team and add a string-serialization step at the save boundary if it turns out the processor only accepts strings here.
4. **Plain text** — single-line Handlebars textarea. Stored as `response_text`.

Switching tabs clears the other three dispatch fields (so the entry only ever carries one). Show a confirmation if the previous tab had content.

**Visibility & targeting**
- `applies_to` (multi-checkbox: dm / channel / webhook / any) — default per action type (`["dm"]` for mute/unsubscribe, `["any"]` otherwise)
- `show_if` (text input with `HandlebarsExpressionInput`) — placeholder shows an example like `{{gt iv 90}}`
- `visible_to` (dropdown: target / admin / registered / anyone; default target)

Per-button validation errors render below the card body in red.

### Read-only entries

When `entry.readonly === true`, the entire Buttons section renders read-only: no add, no edit, no delete, no reorder. Inputs become `<div>`s with the displayed value. Header shows a "Read-only (fallback entry)" badge.

### TemplateSelector format badge

Each row in `TemplateSelector` gets a 28px monospace badge: `JSON` (grey) or `TOML` (purple). Driven by `entry.sourceFormat`. Missing → no badge.

### Live preview (DiscordView)

After the embed(s), render an action row when `data.__buttons` is non-empty:

```
<div className="discord-action-row">
  {data.__buttons.map(b => (
    <button className={`discord-btn discord-btn-${b.style}`}>{b.label}</button>
  ))}
</div>
```

Style classes use the new tokens in `styles.js`. The row wraps at 5 buttons (Discord's component-row limit; we cap input at 5 anyway).

`show_if` evaluation happens in the render pipeline:
- The expression is wrapped as `{{#if (show_if_expr)}}1{{/if}}` and rendered against the context.
- Result of "1" → visible; anything else → hidden.
- A render error on `show_if` leaves the button visible (fail-open) and logs to the preview's error pane.

Labels go through the same Handlebars context as the template body, so field references work.

### Snapshots config section

The four `[snapshots]` fields (`enabled`, `path`, `max_age_days`, `sweep_interval_mins`) are exposed by the processor via the existing `/api/config/schema` endpoint. The editor renders them through the normal `useConfig` flow with no special-case code. This is a **processor dependency** — see "Processor dependencies" below.

The "Buttons disabled" banner in `ButtonsEditor` reads `snapshots.enabled` from the live config values via `useConfig`. The banner works as soon as the field is present in the loaded config values; the schema render is what gives operators a way to set it from the editor.

### TOML save warning

When `apiClient.saveTemplates` succeeds, the App-level save handler inspects the saved entries. If any has `sourceFormat === "toml"`, it shows a one-shot toast:

> Saved — TOML comments and key order may be lost in the round-trip. The previous version was backed up to `config/backups/`.

Existing toast/status infrastructure (the bottom `StatusBar`) is the host for this.

## Validation

`button-validation.js` mirrors the brief's rules:

- `id` and `label` required.
- Exactly one of `action`, `response_template_id`, `response_template_inline`, `response_text`.
- `action === "mute"` ⇒ `scope` required; must be in the action's `scopes` (from the registry) or in the hardcoded fallback list.
- `action === "unsubscribe"` ⇒ `scope` required AND must equal `"tracking"`.
- Enum fields (`style`, `applies_to[]`, `visible_to`) reject values outside the allowed set.
- `id` must be unique within the entry's `buttons` array.

Validation runs on every edit; errors render under the offending card. Save remains enabled (the server re-validates and rejects), but a top-level banner counts errors: "3 buttons have errors — save will be rejected by the server."

## Error Handling

- `/api/dts/actions` 503 → editor still works; the Action dispatch dropdown shows the four hardcoded names with no scope/param hints, and a small inline note: "Action registry unavailable — enable snapshots to load action metadata."
- `/api/dts/actions` other error → log to console, fall back the same way.
- Save rejection from server (validation failure) → existing save-error flow, no new infrastructure.
- TOML save toast is fire-and-forget; doesn't block on user dismissal.
- A button with malformed `show_if` does not break the whole preview — only that button is logged and rendered as visible.

## Testing

Unit tests:
- `button-validation.test.js` — exhaustive validation rule coverage.
- A new `useActions.test.js` if it grows beyond a trivial fetch (start without one).

No automated UI tests for the editor (matches the rest of the codebase). Manual verification flow documented in the implementation plan's verification step.

## Open Items Folded Into the Spec

These were decided during brainstorming and recorded here for traceability:

- Live button preview: **yes**, rendered in `DiscordView` from `data.__buttons`.
- `show_if` autocomplete: **field-aware** via shared `HandlebarsExpressionInput`.
- Read-only entries: **show buttons read-only** (no edit UI, but visible).
- Cross-linking via `response_template_id`: **first-class**, with picker + "Jump to" navigation. Hardcoded to type `buttonResponse` for v1; if other types become valid response targets later, the picker's type filter becomes a prop.
- Snapshot inspector panel: **deferred**, not in this spec.
- Inline `response_template_inline`: **full editor**, reusing `TemplateBodyEditor` (Form/Raw toggle, embed fields). Storage shape (object vs string) mirrors the main template — assumes the processor accepts either, as it does for the entry's main `template` field. Confirm with the processor team.
- Button cap: **5 per entry** for v1 (matches Discord's single-row component limit; multi-row support deferred).

## Processor dependencies (resolved)

Both processor-side prerequisites for this spec are merged on `buttons-and-snapshots`:

1. **`[snapshots]` section in `/api/config/schema`** — added with the four fields:
   - `enabled` (boolean, default `false`) — master switch; its description carries the "buttons silently disabled when not enabled" caveat.
   - `path` (string, default `"config/.cache/snapshots"`) — `advanced: true`, `dependsOn: enabled`.
   - `max_age_days` (int, default `7`) — `advanced: true`, `dependsOn: enabled`.
   - `sweep_interval_mins` (int, default `60`) — `advanced: true`, `dependsOn: enabled`.

   Picked up automatically via the `Config.Snapshots` field's `toml:"snapshots"` tag through the existing reflection-based config pipeline. No section-level description field exists in `ConfigSection` (no prior section uses one), so the title alone identifies the section in the sidebar; the master switch's description covers the disabled-buttons warning. The editor's existing "show advanced" toggle and `dependsOn` rendering handle the three advanced fields without changes.

2. **`response_template_inline` accepts objects** — `inlineTemplateString` in `processor/internal/dts/button_response.go` now accepts `map[string]any` (and mixed-type `[]any`), JSON-marshalled with HTML escaping off so Handlebars `<` / `>` / `&` survive intact. Wire type stays `any` (matches the main `template` field), so the editor's TypeScript type for `response_template_inline` becomes `string | string[] | object`. The Form-mode storage approach in `ButtonDispatchEditor` is unchanged from the spec and needs no serialization shim.
