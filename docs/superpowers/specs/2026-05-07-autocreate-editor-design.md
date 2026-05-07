# Autocreate Channel Template Editor — Design Spec

## Goal

Add a third top-level tab ("Autocreate") to poracle-config that provides a structured editor for `channelTemplate.json` — the file that defines how `!autocreate` and bulk sync create Discord channels, categories, roles, threads, and thread pickers.

## Background

Autocreate templates are deeply nested JSON structures. Admins currently hand-edit `config/channelTemplate.json`. This editor gives them a form-based UI with validation, while preserving raw JSON access for power users.

The complete schema reference is in the user's spec (reproduced in the Schema Reference section below). The backend API mirrors the existing DTS templates pattern (`GET`/`POST`/`DELETE`/`validate`/`schema`).

## Architecture

### Integration

- Third top-level tab in App.jsx alongside "Templates" and "Config"
- New tab button in TopBar.jsx
- Data loaded on connect (alongside config schema / DTS templates)
- Own hook (`useAutocreate`) managing all state, following the `useConfig` pattern

### New Files

| File | Purpose |
|------|---------|
| `src/hooks/useAutocreate.js` | State management: load, edit, validate, save, dirty tracking |
| `src/components/AutocreateEditor.jsx` | Main wrapper — renders tree sidebar + detail panel |
| `src/components/AutocreateTree.jsx` | Template picker + tree navigation for selected template |
| `src/components/AutocreateDetail.jsx` | Detail panel — form/raw toggle, dispatches to sub-forms |
| `src/components/AutocreateChannelForm.jsx` | Channel editing form (settings, roles, commands, threads, threadPicker) |
| `src/components/AutocreateCategoryForm.jsx` | Category editing form (categoryName + roles) |
| `src/components/AutocreateRoleCard.jsx` | Expandable role card with grouped tri-state permission grid |
| `src/components/AutocreateThreadForm.jsx` | Thread editing (name, buttonLabel, buttonStyle, commands) |
| `src/components/AutocreateThreadPickerForm.jsx` | Thread picker editing (embedTitle, embedDescription, pinned) |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/api-client.js` | Add 5 methods: getAutocreateTemplates, saveAutocreateTemplates, deleteAutocreateTemplate, validateAutocreateTemplates, getAutocreateSchema |
| `src/App.jsx` | Add `useAutocreate` hook, third tab conditional render |
| `src/components/TopBar.jsx` | Add "Autocreate" tab button |

### Data Flow

1. On connect, `useAutocreate.load()` fetches schema + templates from API
2. User selects a template via the picker → sets `selectedTemplateName`
3. Tree renders from `selectedTemplate.definition`
4. Tree node selection sets `selectedNode` (e.g., `{type: 'channel', index: 0}`)
5. Detail panel renders the appropriate form for the node type
6. Edits update a local working copy of the templates array
7. Client-side validation runs inline on every change
8. Save sends full templates array to `POST /api/autocreate/templates`; server validates before writing

### Dirty Tracking

Compare working copy against last-saved snapshot (same approach as `useConfig`). Show "Unsaved changes" indicator in the bottom bar and a dot on the tab button.

## UI Layout

Two-panel layout within the Autocreate tab:

### Left: Tree Sidebar (~240px)

**Template picker** at top — dropdown with search, matching the DTS `TemplateSelector` pattern. Below it: "New" and "Delete" buttons.

**Tree** for the selected template:
- **Category node** (if present) — folder icon, click to edit category name + roles
- **Channel nodes** — `#` icon (text) or speaker icon (voice), badge showing controlType (bot/webhook). Click to edit channel.
- **Info lines** nested under each channel (click scrolls to relevant section in the channel form):
  - `🔒 N roles`
  - `⌨ N commands`
  - `🧵 N threads`
  - `📌 Thread picker`
- **"+ Add Channel"** button at tree bottom
- **Up/down arrow buttons** on channel nodes for reordering

Selected node: left blue border + background tint.

### Right: Detail Panel

**Toolbar** at top: node label + type badge, Form/JSON toggle.

**Form mode** renders the appropriate form for the selected node type (see Form Editors below).

**Raw JSON mode** shows a CodeMirror editor with the *entire selected template* (not just the node). Debounced apply at 800ms, matching the DTS raw editor pattern.

**Bottom bar**: validation status indicator, "Validate" button (calls server `/validate`), "Save to Poracle" button.

## Form Editors

### Category Form

- `categoryName` — text input with placeholder hint about `{0}`, `{1}` substitution
- **Roles** — list of expandable role cards + "Add Role" button

### Channel Form

- **Channel Settings**: channelName (text), channelType (select: text/voice), controlType (select: none/bot/webhook), topic (text, optional), webhookName (text, shown only when controlType=webhook)
- **Roles**: expandable role cards + "Add Role"
- **Commands**: ordered list of text inputs with delete + reorder. "Add Command" button.
- **Threads** (text channels only): list of thread sub-forms (inline expandable cards). "Add Thread" button. Each shows name/buttonLabel/buttonStyle/commands.
- **Thread Picker** (shown when threads exist): embedTitle, embedDescription, pinned (boolean). Warning if threads exist but no picker or vice versa.

**Voice channel behavior:** When channelType is "voice", hide topic, commands, threads, and threadPicker sections with a note explaining they don't apply to voice channels.

**Placeholder help:** Collapsible info box explaining `{0}`, `{1}` substitution and the caveat that `{0}` in a template = `args[1]` from `!autocreate` (matches existing JS-Poracle behaviour).

### Thread Sub-Form (inline within channel form)

- `name` — text input
- `buttonLabel` — text input (optional override for picker button)
- `buttonStyle` — select: primary/secondary/success/danger
- `commands[]` — ordered text input list with delete + reorder

### Thread Picker Form (inline within channel form)

- `embedTitle` — text input
- `embedDescription` — textarea
- `pinned` — boolean toggle

## Role Card & Permission Grid

### Collapsed State

- Role name display
- Summary: count of set permissions or key flags (e.g., "view: deny" for @everyone)
- Expand/collapse toggle, delete button

### Expanded State

- Role name input (note that `@everyone` resolves to the guild's everyone role)
- Permission flags in a two-column grid, grouped by category:

**General:** view, viewHistory, send, react, pingEveryone, embedLinks, attachFiles, sendTTS, externalEmoji, externalStickers, createPublicThreads, createPrivateThreads, sendThreads, slashCommands, createInvite

**Voice:** connect, speak, autoMic, stream, vcActivities, prioritySpeaker

**Admin:** channels, messages, roles, webhooks, threads, events, mute, deafen, move

### Tri-State Toggle

Each permission flag cycles on click: **inherit** (grey dash `—`, null) → **allow** (green check `✓`, true) → **deny** (red X `✕`, false) → inherit.

Labels use the human-readable `label` from the schema endpoint, not the raw flag name. The permission list is driven by the `/api/autocreate/templates/schema` response so new flags propagate without editor changes.

## Validation

### Client-Side (inline, on every change)

**Errors (block save):**
- Template name: required, no spaces, unique within array
- `definition.channels[]`: at least 1 entry required
- channelType: must be "text", "voice", or omitted
- controlType: must be "", "bot", or "webhook"
- buttonStyle: must be "primary", "secondary", "success", "danger", or empty
- Role name: required within each role entry

**Warnings (non-blocking, yellow):**
- threadPicker present without threads
- threads present without threadPicker
- Voice channel with topic, commands, threads, or threadPicker set

### Server-Side (on save)

1. Client validation runs — errors block save
2. `POST /api/autocreate/templates/validate` — dry-run validation
3. Server errors mapped to paths (e.g., `templates[0].definition.channels`) and highlighted in tree/form
4. If both pass, `POST /api/autocreate/templates` writes the file
5. Success → update saved snapshot, clear dirty state
6. Failure → show error

### Delete Flow

Confirm dialog → `DELETE /api/autocreate/templates/:name` → refresh local state, select first remaining template (or empty state).

## API Methods (api-client.js)

```javascript
// Autocreate templates
getAutocreateTemplates()                    // GET  /api/autocreate/templates
saveAutocreateTemplates(templates)          // POST /api/autocreate/templates
deleteAutocreateTemplate(name)              // DELETE /api/autocreate/templates/:name
validateAutocreateTemplates(templates)      // POST /api/autocreate/templates/validate
getAutocreateSchema()                       // GET  /api/autocreate/templates/schema
```

## Schema Reference

### Template Structure

```
Template { name, definition }
  definition.category? { categoryName, roles[] }
  definition.channels[] {
    channelName, channelType, topic, controlType, webhookName,
    roles[], commands[], threads[], threadPicker?
  }
    roles[] { name, ...30 permission flags (tri-state) }
    commands[] (string array)
    threads[] { name, buttonLabel, buttonStyle, commands[] }
    threadPicker? { embedTitle, embedDescription, pinned }
```

### Enums

- channelType: `"text"` | `"voice"` (default: `"text"`)
- controlType: `""` | `"bot"` | `"webhook"` (default: `""`)
- buttonStyle: `"primary"` | `"secondary"` | `"success"` | `"danger"` (default: `"secondary"`)

### Placeholders

`{0}`, `{1}`, ... substitute arg slots positionally. Supported in: categoryName, channelName, topic, commands[], threads[].name, threads[].buttonLabel, threadPicker.embedTitle, threadPicker.embedDescription.

Caveat: `{0}` in the template = `args[1]` from `!autocreate <templateName> <args...>`. This matches existing JS-Poracle behaviour. The editor flags this in placeholder help text.

### Permission Flags

30 flags across 3 categories. Each is tri-state: `true` (allow), `false` (deny), `null`/absent (inherit). The authoritative list comes from the schema endpoint, derived from `rolePermissionFlags` in the Go backend.

## Out of Scope

- Drag-and-drop reordering (use up/down buttons)
- Live preview of created channels
- Testing autocreate execution from the editor
- Bulk sync rule editing (separate feature)
