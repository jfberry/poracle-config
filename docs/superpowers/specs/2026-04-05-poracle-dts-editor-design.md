# Poracle DTS Editor — Design Spec

## Overview

Transform the forked Discord embed visualizer into a Poracle DTS (Data Template System) editor. The tool lets community admins who run their own Poracle bot instances create, edit, and preview Discord embed templates with Handlebars expressions — without needing deep technical knowledge.

**Audience:** Poracle community admins (not the Poracle developer).

**Scope:** Discord embeds first. Telegram support deferred to a later phase.

## Architecture

### Tech Stack

- **React 18 + Vite** — modernize the existing repo (upgrade from React 15 + react-scripts 0.8.5)
- **Handlebars.js** — browser-side template rendering (same engine family as PoracleNG's raymond fork)
- **CodeMirror 6** — raw JSON/Handlebars editing (upgrade from CM5)
- **Tailwind CSS** — editor UI styling (Discord preview keeps its own isolated styles)
- **Existing Discord renderer** — upgraded in place, renders embed JSON as Discord would

### Modes of Operation

1. **Standalone** (no backend): Load DTS via file or paste. Uses static pre-enriched test data snapshots. Handlebars helpers return dummy values where game data would be needed. Fully functional in a browser with no server.

2. **Connected** (PoracleNG API): Load/save DTS directly. Post arbitrary webhooks through the enrichment pipeline to get real variable maps. Field metadata from API powers the tag picker.

### Data Flow

```
Template (Handlebars in embed fields)
    + Test Data (enriched variable map)
    → Handlebars.js compiles in-browser
    → Produces embed JSON
    → Discord renderer displays preview
```

When connected to PoracleNG:
- `POST /api/dts/render` takes a webhook payload, runs it through the enrichment pipeline, returns the variable map
- `POST /api/dts/webhook` posts arbitrary webhook data, returns both variable map and rendered embed JSON
- The browser uses the returned variable map as Handlebars context

## UI Layout

### Three-Panel Design

```
┌─────────────────┬──────────────┬─────────────────┐
│ Template Editor  │ Tag Picker / │ Discord Preview  │
│                  │ Test Data    │                  │
│ [Form] [Raw]    │ [Tags] [Data]│ [Dark][Light]    │
│                  │              │ [Compact]        │
│ • Color         │ Identity:    │                  │
│ • Title         │  name        │  ┌─ embed ─────┐ │
│ • Description   │  fullName    │  │ 95% Magikarp│ │
│ • Thumbnail     │  formName    │  │ cp:212 ...  │ │
│ • Image         │ Stats:       │  │             │ │
│ • Footer        │  iv, atk ... │  └─────────────┘ │
│ • Author        │ Moves:       │                  │
│ • Fields[]      │  quickMove.. │                  │
│                  │ Helpers:     │                  │
│                  │  #if, #each  │                  │
└─────────────────┴──────────────┴─────────────────┘
```

### Top Bar

- **DTS filter bar**: Type (monster, raid, egg, quest, invasion, lure, nest, gym, fort-update, weatherchange, greeting) / Template ID / Platform (discord) / Language dropdowns
- **File actions**: Load File, Save/Download, Paste JSON
- **API connection**: Settings button to configure PoracleNG URL + secret, connection status indicator

### Left Panel — Template Editor

Two modes toggled by tabs:

**Form mode** (default): Structured fields matching the Discord embed schema:
- Color (with color picker, supports Handlebars expression like `{{ivColor}}`)
- Title (text input with inline Handlebars highlighting)
- Description (multi-line textarea with Handlebars highlighting)
- URL
- Thumbnail URL
- Image URL
- Footer (text + icon_url)
- Author (name + url + icon_url)
- Fields (array of name/value/inline, add/remove/reorder)
- Timestamp

Each text field supports clicking tags from the tag picker to insert at cursor position. Handlebars expressions are syntax-highlighted inline (variables in gold, block helpers in purple).

**Raw JSON mode**: CodeMirror 6 editor showing the full DTS entry JSON. Changes sync bidirectionally with form mode.

### Middle Panel — Tag Picker / Test Data

Two tabs:

**Tags tab**: Available template variables for the currently selected DTS type, grouped by category (Identity, Stats, Moves, Time, Maps & Location, Weather, PVP, Helpers, etc.).

Field display rules:
- **Preferred fields** shown prominently with full color, sorted first within each category
- **Raw webhook fields** shown in a collapsible "Raw Webhook" section per category, dimmed styling
- **Deprecated fields** hidden by default, revealed by a "Show deprecated" toggle, with strikethrough styling
- Raw and deprecated fields show their preferred alternative (e.g. `pokemon_id` → "use `pokemonId`")

Clicking a tag inserts `{{fieldName}}` (or `{{{fieldName}}}` for URL fields) at the cursor position in the active editor field.

**Context-aware scoping:** The tag picker is aware of the cursor's position within block helpers. When inside a `{{#each pvpGreat}}` block, the picker shows the PVP entry fields (`rank`, `cp`, `fullName`, `level`, `percentage`, `cap`, etc.) instead of top-level fields. Similarly, inside `{{#pokemon id form}}`, it shows the pokemon block context (`name`, `baseStats`, `typeEmoji`, `formName`, etc.). Inside `{{#getPowerUpCost}}`, it shows `stardust`, `candy`, `xlCandy`. The top-level fields remain accessible via `../fieldName` (shown in a collapsible "Parent scope" section). The field metadata from `GET /api/dts/fields/{type}` includes block helper scopes — each block helper that creates a new context lists the fields available within it.

Helpers section shows common Handlebars constructs (`{{#if}}`, `{{#each}}`, `{{#unless}}`, `{{round}}`, `{{numberFormat}}`, etc.) and inserts snippet templates with cursor placement.

**Test Data tab**: Shows and allows editing of the webhook JSON / enriched variable map being used for the preview. Features:
- Dropdown to select from built-in test scenarios (e.g. "hundo", "boring", "great1" for pokemon; "egg1", "level5" for raids)
- Editable JSON editor for the variable map — changes update the preview in real time
- When connected to API: "Enrich" button sends the webhook through `POST /api/dts/render` and replaces the variable map with real computed values
- "Send Webhook" button posts arbitrary webhook data through `POST /api/dts/webhook` to see the full pipeline result

### Right Panel — Discord Preview

The existing Discord embed renderer, upgraded to React 18. Shows the result of compiling the template against the test data.

- Dark/Light theme toggle
- Cozy/Compact mode toggle  
- Live-updating as the template or test data changes
- Bot username and avatar shown (configurable)

### Bottom Status Bar

- Connection status (standalone / connected to PoracleNG at URL)
- Current test scenario name
- Validation errors/warnings

## DTS File Management

### Loading Templates

Three methods, progressive:

1. **Paste**: Paste a single DTS entry or full `dts.json` content. Auto-detected.
2. **File**: Drag-and-drop or file picker. Supports single DTS entry JSON or full `dts.json` array. When a multi-entry file is loaded, the filter bar populates and the user selects which entry to edit.
3. **API**: When connected to PoracleNG, `GET /api/dts/templates` fetches all entries. Filter bar works as above.

### Saving Templates

1. **Copy JSON**: Copy the current DTS entry to clipboard.
2. **Download**: Download modified `dts.json` file (single entry or full file if one was loaded).
3. **API**: When connected, `POST /api/dts/templates` pushes changes back to PoracleNG.

## PoracleNG API Additions

New endpoints to add to the Go processor:

### GET /api/dts/templates

Returns all DTS entries, filterable by query params.

```
GET /api/dts/templates?type=monster&platform=discord&language=en
```

Response:
```json
{
  "status": "ok",
  "templates": [
    {
      "id": 1,
      "type": "monster",
      "platform": "discord",
      "language": "en",
      "default": true,
      "template": { "embed": { ... } }
    }
  ]
}
```

### POST /api/dts/templates

Create/update DTS entries. Accepts an array.

```json
[{
  "id": 1,
  "type": "monster",
  "platform": "discord",
  "language": "en",
  "template": { "embed": { ... } }
}]
```

### POST /api/dts/render

Takes a DTS type and webhook payload, runs it through the enrichment pipeline, returns the enriched variable map.

```json
{
  "type": "pokemon",
  "webhook": { "pokemon_id": 129, "individual_attack": 15, ... }
}
```

Response:
```json
{
  "status": "ok",
  "variables": {
    "name": "Magikarp",
    "fullName": "Magikarp",
    "iv": 100,
    "cp": 212,
    "level": 27,
    "quickMoveName": "Splash",
    "chargeMoveName": "Struggle",
    "time": "14:33",
    "tthm": 10,
    "tths": 0,
    "imgUrl": "https://...",
    "staticMap": "https://...",
    ...
  }
}
```

### POST /api/dts/webhook

Posts an arbitrary webhook through the full pipeline. Returns both the variable map and the rendered message JSON (what would be sent to Discord).

```json
{
  "type": "pokemon",
  "webhook": { ... },
  "template": "1",
  "language": "en"
}
```

Response:
```json
{
  "status": "ok",
  "variables": { ... },
  "rendered": {
    "embed": {
      "title": "100% Magikarp cp:212 ...",
      "description": "...",
      "color": 2948390
    }
  }
}
```

### GET /api/dts/fields/{type}

Returns available template fields for a DTS type.

```
GET /api/dts/fields/monster
```

Response:
```json
{
  "status": "ok",
  "fields": [
    {
      "name": "fullName",
      "type": "string",
      "description": "Name + form combined",
      "category": "identity",
      "preferred": true,
      "deprecated": false,
      "rawWebhook": false
    },
    {
      "name": "pokemon_id",
      "type": "int",
      "description": "Pokemon ID (from webhook)",
      "category": "identity",
      "preferred": false,
      "deprecated": false,
      "rawWebhook": true,
      "preferredAlternative": "pokemonId"
    },
    {
      "name": "mapurl",
      "type": "string",
      "description": "Google Maps link",
      "category": "maps",
      "preferred": false,
      "deprecated": true,
      "rawWebhook": false,
      "preferredAlternative": "googleMapUrl"
    }
  ],
  "blockScopes": [
    {
      "helper": "each",
      "iterableFields": ["pvpGreat", "pvpUltra", "pvpLittle", "matched", "weaknessList"],
      "scopes": {
        "pvpGreat": {
          "description": "PVP Great League entry",
          "fields": [
            {"name": "rank", "type": "int", "description": "PVP rank"},
            {"name": "cp", "type": "int", "description": "CP at this rank"},
            {"name": "fullName", "type": "string", "description": "Pokemon name + form"},
            {"name": "level", "type": "number", "description": "Level at this rank"},
            {"name": "levelWithCap", "type": "string", "description": "Level with cap notation"},
            {"name": "percentage", "type": "number", "description": "Stat product percentage"},
            {"name": "cap", "type": "int", "description": "Level cap"},
            {"name": "evolution", "type": "int", "description": "Evolution ID (0 if none)"}
          ]
        },
        "weaknessList": {
          "description": "Weakness category",
          "fields": [
            {"name": "value", "type": "string", "description": "Weakness multiplier"},
            {"name": "types", "type": "array", "description": "Array of {typeId, name, typeEmoji}"}
          ]
        }
      }
    },
    {
      "helper": "pokemon",
      "args": ["id", "form"],
      "description": "Looks up pokemon by ID and form, provides block context",
      "fields": [
        {"name": "name", "type": "string", "description": "Translated pokemon name"},
        {"name": "nameEng", "type": "string", "description": "English pokemon name"},
        {"name": "fullName", "type": "string", "description": "Name + form"},
        {"name": "formName", "type": "string", "description": "Translated form name"},
        {"name": "typeName", "type": "string", "description": "Comma-separated type names"},
        {"name": "typeEmoji", "type": "string", "description": "Type emojis concatenated"},
        {"name": "baseStats", "type": "object", "description": "{baseAttack, baseDefense, baseStamina}"},
        {"name": "hasEvolutions", "type": "bool", "description": "Has evolutions"}
      ]
    },
    {
      "helper": "getPowerUpCost",
      "args": ["levelStart", "levelEnd"],
      "description": "Power-up cost between two levels",
      "fields": [
        {"name": "stardust", "type": "int", "description": "Stardust cost"},
        {"name": "candy", "type": "int", "description": "Candy cost"},
        {"name": "xlCandy", "type": "int", "description": "XL Candy cost"}
      ]
    }
  ]
}
```

## Handlebars in the Browser

All Handlebars rendering happens client-side. The PoracleNG API only returns enriched variable maps, not rendered output.

### Helper Tiers

**Fully functional** (pure formatting, no external data):
- `round`, `numberFormat`, `pad0`, `concat`
- `#if`, `#each`, `#unless`, `#with`
- `compare`, `eq`, `isnt`, `or`, `and`, `forEach`, `minus`
- Helpers matching the PoracleNG Go backend exactly — implemented directly (not imported from budibase). We can reference the budibase source for parity where the Go backend originally derived from it, but the goal is to match PoracleNG's actual helper set.

**Dummy returns** (would need game data for real values):
- `pokemonName` → returns the input ID as string
- `moveName`, `moveType`, `moveEmoji` → returns placeholder text
- `getEmoji` → returns the emoji name as-is
- `pokemon` block helper → returns a dummy context with placeholder names
- `map`, `map2` → returns the input value
- `getPowerUpCost` → returns placeholder cost text
- `calculateCp` → returns 0

These dummy helpers are sufficient for template editing — the real values come from the variable map (which already contains `fullName`, `quickMoveName`, etc.). The helpers are only invoked when users explicitly call them in templates rather than using the pre-computed fields.

Note: The enriched variable maps contain sub-fields (e.g. `genderData.name`, `genderData.emoji`, `baseStats.baseAttack`) and arrays (e.g. `pvpGreat`, `matched`, `weaknessList`). Handlebars handles these naturally via dot notation and `{{#each}}` blocks. The test data snapshots must preserve the full nested structure.

When connected to the API, users can click "Enrich" to get a real variable map, making the preview accurate regardless of which helpers are used.

## Static Test Data

For standalone mode, ship pre-enriched variable map snapshots for each DTS type. These are generated from `testdata.json` webhook payloads run through the PoracleNG enrichment pipeline.

Included test scenarios (matching existing testdata.json):
- **Pokemon**: boring, hundo, great1, hisuian, eevee, ditto, ultra1
- **Raid**: egg1, level5, egg7, level7, egg8, level8, egg9, level9, egg10, level10
- **Quest**: (from testdata)
- **Invasion**: (from testdata)
- And so on for each DTS type

These snapshots can be regenerated by running a script against a PoracleNG instance, or manually updated.

## Modernization Plan

Upgrade the existing repo in place:

1. **React 15 → 18**: Update `react`, `react-dom`. Replace `React.createClass` with functional components + hooks. Replace `react-addons-css-transition-group` with `react-transition-group`.
2. **react-scripts → Vite**: Replace CRA with Vite. Update build config.
3. **CodeMirror 5 → 6**: Upgrade the editor component.
4. **Add Tailwind CSS**: For new UI components (not the Discord renderer).
5. **Add Handlebars.js**: Browser-side template engine.
6. **Preserve Discord renderer**: The embed, markdown, and emoji components are the core value. Upgrade their React API (classes → functions) but keep rendering logic intact.

## Out of Scope (Future Phases)

- Telegram message preview and editing
- Multi-embed editing (webhook mode with multiple embeds)
- Syntax validation of Handlebars expressions
- Template diffing / version history
- Collaborative editing
- i18n of the editor UI itself
