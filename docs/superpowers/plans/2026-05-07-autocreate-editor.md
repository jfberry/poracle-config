# Autocreate Channel Template Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third top-level tab ("Autocreate") to poracle-config that provides a form-based and raw JSON editor for `channelTemplate.json` — the file controlling how `!autocreate` creates Discord channels, categories, roles, threads, and thread pickers.

**Architecture:** New `useAutocreate` hook manages all state (load/edit/validate/save/dirty tracking). Tree sidebar shows the selected template's structure; detail panel renders form editors per node type. Raw JSON toggle shows the full template definition in CodeMirror. Client-side inline validation + server `/validate` on save.

**Tech Stack:** React 18, Tailwind CSS, CodeMirror 6 (already in project for raw JSON editing), existing `PoracleApiClient` pattern.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/lib/api-client.js` | Add 5 autocreate API methods |
| `src/lib/autocreate-validation.js` | Client-side validation logic (pure functions) |
| `src/hooks/useAutocreate.js` | State management: templates, selected template/node, dirty tracking, load/save |
| `src/components/AutocreateEditor.jsx` | Main wrapper — sidebar + detail panel layout |
| `src/components/AutocreateTree.jsx` | Template picker + tree navigation |
| `src/components/AutocreateDetail.jsx` | Detail panel — form/raw toggle, dispatches to sub-forms |
| `src/components/AutocreateChannelForm.jsx` | Channel form (settings, roles, commands, threads, threadPicker) |
| `src/components/AutocreateCategoryForm.jsx` | Category form (categoryName + roles) |
| `src/components/AutocreateRoleCard.jsx` | Expandable role card with grouped tri-state permission grid |
| `src/components/TopBar.jsx` | Add Autocreate tab button + save button |
| `src/App.jsx` | Wire useAutocreate hook, add third tab render |

---

### Task 1: API Client Methods

**Files:**
- Modify: `src/lib/api-client.js:98-151`

- [ ] **Step 1: Add the 5 autocreate API methods to PoracleApiClient**

Add these methods before the `health()` method in `src/lib/api-client.js`:

```javascript
  async getAutocreateTemplates() {
    return this.fetch('/api/autocreate/templates');
  }

  async saveAutocreateTemplates(templates) {
    return this.fetch('/api/autocreate/templates', {
      method: 'POST',
      body: JSON.stringify({ templates }),
    });
  }

  async deleteAutocreateTemplate(name) {
    return this.fetch(`/api/autocreate/templates/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
  }

  async validateAutocreateTemplates(templates) {
    return this.fetch('/api/autocreate/templates/validate', {
      method: 'POST',
      body: JSON.stringify({ templates }),
    });
  }

  async getAutocreateSchema() {
    return this.fetch('/api/autocreate/templates/schema');
  }
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api-client.js
git commit -m "feat(autocreate): add API client methods for autocreate templates"
```

---

### Task 2: Client-Side Validation

**Files:**
- Create: `src/lib/autocreate-validation.js`

- [ ] **Step 1: Create the validation module**

Create `src/lib/autocreate-validation.js`:

```javascript
/**
 * Client-side validation for autocreate channel templates.
 * Returns { errors: [...], warnings: [...] } where each entry is
 * { path: string, message: string }.
 */

const CHANNEL_TYPES = new Set(['text', 'voice', '']);
const CONTROL_TYPES = new Set(['', 'bot', 'webhook']);
const BUTTON_STYLES = new Set(['primary', 'secondary', 'success', 'danger', '']);

export function validateTemplates(templates) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(templates)) {
    errors.push({ path: 'templates', message: 'Templates must be an array' });
    return { errors, warnings };
  }

  const seenNames = new Set();

  for (let ti = 0; ti < templates.length; ti++) {
    const t = templates[ti];
    const tp = `templates[${ti}]`;

    // Name validation
    if (!t.name || !t.name.trim()) {
      errors.push({ path: `${tp}.name`, message: 'Template name is required' });
    } else {
      if (/\s/.test(t.name)) {
        errors.push({ path: `${tp}.name`, message: 'Template name must not contain spaces' });
      }
      if (seenNames.has(t.name)) {
        errors.push({ path: `${tp}.name`, message: `Duplicate template name "${t.name}"` });
      }
      seenNames.add(t.name);
    }

    const def = t.definition;
    if (!def) {
      errors.push({ path: `${tp}.definition`, message: 'Definition is required' });
      continue;
    }

    // Category roles
    if (def.category?.roles) {
      validateRoles(def.category.roles, `${tp}.definition.category.roles`, errors);
    }

    // Channels
    if (!Array.isArray(def.channels) || def.channels.length === 0) {
      errors.push({ path: `${tp}.definition.channels`, message: 'At least one channel is required' });
      continue;
    }

    for (let ci = 0; ci < def.channels.length; ci++) {
      const ch = def.channels[ci];
      const cp = `${tp}.definition.channels[${ci}]`;

      if (!ch.channelName || !ch.channelName.trim()) {
        errors.push({ path: `${cp}.channelName`, message: 'Channel name is required' });
      }

      const chType = ch.channelType || '';
      if (!CHANNEL_TYPES.has(chType)) {
        errors.push({ path: `${cp}.channelType`, message: `Invalid channel type "${chType}"` });
      }

      const ctrlType = ch.controlType || '';
      if (!CONTROL_TYPES.has(ctrlType)) {
        errors.push({ path: `${cp}.controlType`, message: `Invalid control type "${ctrlType}"` });
      }

      if (ch.roles) {
        validateRoles(ch.roles, `${cp}.roles`, errors);
      }

      // Voice channel warnings
      const isVoice = chType === 'voice';
      if (isVoice) {
        if (ch.topic) warnings.push({ path: `${cp}.topic`, message: 'Topic is ignored for voice channels' });
        if (ch.commands?.length) warnings.push({ path: `${cp}.commands`, message: 'Commands are ignored for voice channels' });
        if (ch.threads?.length) warnings.push({ path: `${cp}.threads`, message: 'Threads are not supported on voice channels' });
        if (ch.threadPicker) warnings.push({ path: `${cp}.threadPicker`, message: 'Thread picker is not supported on voice channels' });
      }

      // Threads
      if (Array.isArray(ch.threads)) {
        for (let thi = 0; thi < ch.threads.length; thi++) {
          const thread = ch.threads[thi];
          const thp = `${cp}.threads[${thi}]`;
          if (!thread.name || !thread.name.trim()) {
            errors.push({ path: `${thp}.name`, message: 'Thread name is required' });
          }
          const bs = thread.buttonStyle || '';
          if (bs && !BUTTON_STYLES.has(bs)) {
            errors.push({ path: `${thp}.buttonStyle`, message: `Invalid button style "${bs}"` });
          }
        }
      }

      // threadPicker vs threads consistency warnings
      const hasThreads = ch.threads?.length > 0;
      const hasPicker = !!ch.threadPicker;
      if (hasPicker && !hasThreads) {
        warnings.push({ path: `${cp}.threadPicker`, message: 'Thread picker set but no threads defined' });
      }
      if (hasThreads && !hasPicker) {
        warnings.push({ path: `${cp}.threads`, message: 'Threads defined but no thread picker set' });
      }
    }
  }

  return { errors, warnings };
}

function validateRoles(roles, basePath, errors) {
  if (!Array.isArray(roles)) return;
  for (let ri = 0; ri < roles.length; ri++) {
    const role = roles[ri];
    if (!role.name || !role.name.trim()) {
      errors.push({ path: `${basePath}[${ri}].name`, message: 'Role name is required' });
    }
  }
}

/**
 * Check if a specific path has an error or warning.
 * Returns the first matching issue or null.
 */
export function getIssueForPath(validation, path) {
  const err = validation.errors.find((e) => e.path === path);
  if (err) return { ...err, severity: 'error' };
  const warn = validation.warnings.find((w) => w.path === path);
  if (warn) return { ...warn, severity: 'warning' };
  return null;
}

/**
 * Check if any issue path starts with the given prefix.
 */
export function hasIssuesUnder(validation, pathPrefix) {
  return (
    validation.errors.some((e) => e.path.startsWith(pathPrefix)) ||
    validation.warnings.some((w) => w.path.startsWith(pathPrefix))
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds (new file is not yet imported anywhere, but should be valid JS).

- [ ] **Step 3: Commit**

```bash
git add src/lib/autocreate-validation.js
git commit -m "feat(autocreate): add client-side validation for autocreate templates"
```

---

### Task 3: useAutocreate Hook

**Files:**
- Create: `src/hooks/useAutocreate.js`

- [ ] **Step 1: Create the hook**

Create `src/hooks/useAutocreate.js`:

```javascript
import { useState, useCallback, useMemo, useRef } from 'react';
import { validateTemplates } from '../lib/autocreate-validation';

/**
 * Manages autocreate template state: load, edit, validate, save, dirty tracking.
 * Follows the same pattern as useConfig.
 */
export function useAutocreate(apiClient) {
  const [templates, setTemplates] = useState([]);
  const [savedSnapshot, setSavedSnapshot] = useState([]);
  const [schema, setSchema] = useState(null); // { permissionFlags, channelTypes, controlTypes, buttonStyles, placeholderHelp }
  const [selectedTemplateName, setSelectedTemplateName] = useState(null);
  const [selectedNode, setSelectedNode] = useState({ type: 'template' }); // { type: 'template' | 'category' | 'channel', index?: number }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const loadedRef = useRef(false);

  // Load templates + schema from API
  const load = useCallback(async () => {
    if (!apiClient) return;
    setLoading(true);
    setError(null);
    try {
      const [templatesRes, schemaRes] = await Promise.all([
        apiClient.getAutocreateTemplates(),
        apiClient.getAutocreateSchema(),
      ]);
      const tpls = templatesRes.templates || [];
      setTemplates(tpls);
      setSavedSnapshot(JSON.parse(JSON.stringify(tpls)));
      setSchema(schemaRes.schema || null);
      if (tpls.length > 0 && !selectedTemplateName) {
        setSelectedTemplateName(tpls[0].name);
      }
      loadedRef.current = true;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiClient, selectedTemplateName]);

  // Selected template object
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.name === selectedTemplateName) || null,
    [templates, selectedTemplateName]
  );

  const selectedTemplateIndex = useMemo(
    () => templates.findIndex((t) => t.name === selectedTemplateName),
    [templates, selectedTemplateName]
  );

  // Client-side validation (runs on every render when templates change)
  const validation = useMemo(() => validateTemplates(templates), [templates]);

  // Dirty tracking
  const isDirty = useMemo(
    () => JSON.stringify(templates) !== JSON.stringify(savedSnapshot),
    [templates, savedSnapshot]
  );

  // Update the entire selected template
  const updateSelectedTemplate = useCallback((updater) => {
    setTemplates((prev) => {
      const idx = prev.findIndex((t) => t.name === selectedTemplateName);
      if (idx < 0) return prev;
      const updated = [...prev];
      const current = updated[idx];
      updated[idx] = typeof updater === 'function' ? updater(current) : updater;
      return updated;
    });
  }, [selectedTemplateName]);

  // Convenience: update a field on the selected template's definition
  const updateDefinition = useCallback((updater) => {
    updateSelectedTemplate((t) => ({
      ...t,
      definition: typeof updater === 'function' ? updater(t.definition) : updater,
    }));
  }, [updateSelectedTemplate]);

  // Update the selected template's name
  const updateTemplateName = useCallback((newName) => {
    setTemplates((prev) => {
      const idx = prev.findIndex((t) => t.name === selectedTemplateName);
      if (idx < 0) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], name: newName };
      return updated;
    });
    setSelectedTemplateName(newName);
  }, [selectedTemplateName]);

  // Add a new template
  const addTemplate = useCallback(() => {
    let name = 'new-template';
    let counter = 1;
    const existing = new Set(templates.map((t) => t.name));
    while (existing.has(name)) {
      name = `new-template-${counter++}`;
    }
    const newTemplate = {
      name,
      definition: {
        channels: [{
          channelName: 'new-channel',
          channelType: 'text',
          controlType: '',
          roles: [],
          commands: [],
        }],
      },
    };
    setTemplates((prev) => [...prev, newTemplate]);
    setSelectedTemplateName(name);
    setSelectedNode({ type: 'channel', index: 0 });
  }, [templates]);

  // Delete the selected template
  const deleteTemplate = useCallback((name) => {
    setTemplates((prev) => {
      const filtered = prev.filter((t) => t.name !== name);
      return filtered;
    });
    setSelectedTemplateName((prev) => {
      if (prev === name) {
        const remaining = templates.filter((t) => t.name !== name);
        return remaining.length > 0 ? remaining[0].name : null;
      }
      return prev;
    });
    setSelectedNode({ type: 'template' });
  }, [templates]);

  // Add a channel to the selected template
  const addChannel = useCallback(() => {
    updateDefinition((def) => ({
      ...def,
      channels: [...(def.channels || []), {
        channelName: 'new-channel',
        channelType: 'text',
        controlType: '',
        roles: [],
        commands: [],
      }],
    }));
    // Select the new channel
    const newIndex = (selectedTemplate?.definition?.channels?.length || 0);
    setSelectedNode({ type: 'channel', index: newIndex });
  }, [updateDefinition, selectedTemplate]);

  // Remove a channel by index
  const removeChannel = useCallback((index) => {
    updateDefinition((def) => ({
      ...def,
      channels: def.channels.filter((_, i) => i !== index),
    }));
    setSelectedNode((prev) => {
      if (prev.type === 'channel' && prev.index === index) {
        return { type: 'template' };
      }
      if (prev.type === 'channel' && prev.index > index) {
        return { ...prev, index: prev.index - 1 };
      }
      return prev;
    });
  }, [updateDefinition]);

  // Move a channel up or down
  const moveChannel = useCallback((index, direction) => {
    updateDefinition((def) => {
      const channels = [...def.channels];
      const target = index + direction;
      if (target < 0 || target >= channels.length) return def;
      [channels[index], channels[target]] = [channels[target], channels[index]];
      return { ...def, channels };
    });
    setSelectedNode((prev) => {
      if (prev.type === 'channel' && prev.index === index) {
        const target = index + direction;
        return { ...prev, index: target };
      }
      return prev;
    });
  }, [updateDefinition]);

  // Save to server
  const save = useCallback(async () => {
    if (!apiClient) throw new Error('Not connected');
    // Client validation
    const v = validateTemplates(templates);
    if (v.errors.length > 0) {
      throw new Error(`Validation errors: ${v.errors.map((e) => e.message).join(', ')}`);
    }
    // Server validation
    const valResult = await apiClient.validateAutocreateTemplates(templates);
    if (valResult.errors?.length > 0) {
      throw new Error(`Server validation: ${valResult.errors.map((e) => e.message).join(', ')}`);
    }
    // Save
    const result = await apiClient.saveAutocreateTemplates(templates);
    setSavedSnapshot(JSON.parse(JSON.stringify(templates)));
    return result;
  }, [apiClient, templates]);

  // Delete a template on the server
  const deleteFromServer = useCallback(async (name) => {
    if (!apiClient) throw new Error('Not connected');
    await apiClient.deleteAutocreateTemplate(name);
    deleteTemplate(name);
    setSavedSnapshot((prev) => prev.filter((t) => t.name !== name));
  }, [apiClient, deleteTemplate]);

  // Replace templates from raw JSON (for the raw editor)
  const replaceSelectedTemplateRaw = useCallback((json) => {
    setTemplates((prev) => {
      const idx = prev.findIndex((t) => t.name === selectedTemplateName);
      if (idx < 0) return prev;
      const updated = [...prev];
      updated[idx] = json;
      return updated;
    });
    if (json.name !== selectedTemplateName) {
      setSelectedTemplateName(json.name);
    }
  }, [selectedTemplateName]);

  return {
    templates,
    schema,
    selectedTemplate,
    selectedTemplateIndex,
    selectedTemplateName,
    setSelectedTemplateName,
    selectedNode,
    setSelectedNode,
    loading,
    error,
    loaded: loadedRef.current,
    validation,
    isDirty,
    load,
    updateSelectedTemplate,
    updateDefinition,
    updateTemplateName,
    addTemplate,
    deleteTemplate,
    addChannel,
    removeChannel,
    moveChannel,
    save,
    deleteFromServer,
    replaceSelectedTemplateRaw,
  };
}
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAutocreate.js
git commit -m "feat(autocreate): add useAutocreate state management hook"
```

---

### Task 4: AutocreateRoleCard Component

**Files:**
- Create: `src/components/AutocreateRoleCard.jsx`

This is built first because it's used by both the category and channel forms.

- [ ] **Step 1: Create the role card component**

Create `src/components/AutocreateRoleCard.jsx`:

```javascript
import { useState } from 'react';
import { inputClass, labelClass } from '../lib/styles';

/**
 * Permission flag categories for display grouping.
 * Falls back to these if schema doesn't provide categories.
 */
const DEFAULT_CATEGORIES = {
  general: ['view', 'viewHistory', 'send', 'react', 'pingEveryone', 'embedLinks', 'attachFiles', 'sendTTS', 'externalEmoji', 'externalStickers', 'createPublicThreads', 'createPrivateThreads', 'sendThreads', 'slashCommands', 'createInvite'],
  voice: ['connect', 'speak', 'autoMic', 'stream', 'vcActivities', 'prioritySpeaker'],
  admin: ['channels', 'messages', 'roles', 'webhooks', 'threads', 'events', 'mute', 'deafen', 'move'],
};

function TriStateToggle({ value, onChange }) {
  // null/undefined = inherit, true = allow, false = deny
  const cycle = () => {
    if (value === null || value === undefined) onChange(true);
    else if (value === true) onChange(false);
    else onChange(null);
  };

  let display, color;
  if (value === true) { display = '✓'; color = 'text-green-400'; }
  else if (value === false) { display = '✕'; color = 'text-red-400'; }
  else { display = '—'; color = 'text-gray-600'; }

  return (
    <button
      type="button"
      onClick={cycle}
      className={`w-5 h-5 flex items-center justify-center text-xs font-bold rounded ${color} hover:bg-gray-700 shrink-0`}
      title={value === true ? 'Allow (click for Deny)' : value === false ? 'Deny (click for Inherit)' : 'Inherit (click for Allow)'}
    >
      {display}
    </button>
  );
}

/**
 * Build grouped permission flags from schema or defaults.
 */
function groupPermissions(schemaFlags) {
  if (schemaFlags?.length > 0) {
    const groups = {};
    for (const flag of schemaFlags) {
      const cat = flag.category || 'general';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(flag);
    }
    return groups;
  }
  // Fallback: use default categories with basic labels
  const groups = {};
  for (const [cat, flags] of Object.entries(DEFAULT_CATEGORIES)) {
    groups[cat] = flags.map((name) => ({ name, label: name, category: cat }));
  }
  return groups;
}

/**
 * Summary text for a collapsed role card.
 */
function roleSummary(role) {
  const set = [];
  const flagNames = Object.keys(DEFAULT_CATEGORIES).flatMap((c) => DEFAULT_CATEGORIES[c]);
  for (const flag of flagNames) {
    if (role[flag] === true) set.push(`${flag}: allow`);
    else if (role[flag] === false) set.push(`${flag}: deny`);
  }
  if (set.length === 0) return 'no permissions set';
  if (set.length <= 2) return set.join(', ');
  return `${set.length} set`;
}

export default function AutocreateRoleCard({ role, onChange, onDelete, schemaFlags }) {
  const [expanded, setExpanded] = useState(false);
  const grouped = groupPermissions(schemaFlags);

  const updateField = (field, value) => {
    onChange({ ...role, [field]: value });
  };

  return (
    <div className={`bg-gray-800 border rounded mb-1.5 ${expanded ? 'border-gray-600' : 'border-gray-700'}`}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-gray-750"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-gray-500 text-xs">{expanded ? '▼' : '▶'}</span>
        <span className="text-yellow-300 text-sm font-medium">
          {role.name || '(unnamed)'}
        </span>
        {!expanded && (
          <span className="text-gray-500 text-xs ml-auto mr-1 truncate">
            {roleSummary(role)}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-gray-600 hover:text-red-400 text-xs ml-auto shrink-0"
          title="Remove role"
        >
          ✕
        </button>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-2.5 pb-2.5 border-t border-gray-700 pt-2">
          {/* Role name */}
          <div className="mb-3">
            <label className={labelClass}>
              Role Name
              {role.name === '@everyone' && (
                <span className="text-gray-500 ml-1">(resolves to guild @everyone)</span>
              )}
            </label>
            <input
              className={inputClass}
              value={role.name || ''}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. @everyone, subscribers"
            />
          </div>

          {/* Permission groups */}
          {Object.entries(grouped).map(([category, flags]) => (
            <div key={category} className="mb-2">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-bold">
                {category}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {flags.map((flag) => (
                  <div key={flag.name} className="flex items-center gap-1.5 text-xs">
                    <TriStateToggle
                      value={role[flag.name] ?? null}
                      onChange={(v) => updateField(flag.name, v)}
                    />
                    <span className={role[flag.name] != null ? 'text-gray-200' : 'text-gray-500'}>
                      {flag.label || flag.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/AutocreateRoleCard.jsx
git commit -m "feat(autocreate): add role card with tri-state permission grid"
```

---

### Task 5: AutocreateCategoryForm Component

**Files:**
- Create: `src/components/AutocreateCategoryForm.jsx`

- [ ] **Step 1: Create the category form**

Create `src/components/AutocreateCategoryForm.jsx`:

```javascript
import AutocreateRoleCard from './AutocreateRoleCard';
import { inputClass, labelClass } from '../lib/styles';

export default function AutocreateCategoryForm({ category, onChange, schemaFlags }) {
  const updateCategoryName = (value) => {
    onChange({ ...category, categoryName: value });
  };

  const updateRoles = (roles) => {
    onChange({ ...category, roles });
  };

  const addRole = () => {
    updateRoles([...(category.roles || []), { name: '' }]);
  };

  const updateRole = (index, role) => {
    const roles = [...(category.roles || [])];
    roles[index] = role;
    updateRoles(roles);
  };

  const removeRole = (index) => {
    updateRoles((category.roles || []).filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {/* Category Name */}
      <div>
        <label className={labelClass}>
          Category Name
        </label>
        <input
          className={inputClass}
          value={category.categoryName || ''}
          onChange={(e) => updateCategoryName(e.target.value)}
          placeholder="e.g. {0} Pokemon Alerts"
        />
        <div className="text-[10px] text-gray-600 mt-0.5">
          Supports {'{'}{0}{'}'}, {'{'}{1}{'}'}, ... placeholders from autocreate args
        </div>
      </div>

      {/* Roles */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">
            Roles ({(category.roles || []).length})
          </span>
          <button
            type="button"
            onClick={addRole}
            className="text-[10px] text-gray-500 border border-dashed border-gray-600 rounded px-1.5 py-0.5 hover:text-gray-300 hover:border-gray-400"
          >
            + Add Role
          </button>
        </div>
        {(category.roles || []).map((role, i) => (
          <AutocreateRoleCard
            key={i}
            role={role}
            onChange={(r) => updateRole(i, r)}
            onDelete={() => removeRole(i)}
            schemaFlags={schemaFlags}
          />
        ))}
        {(category.roles || []).length === 0 && (
          <div className="text-xs text-gray-600 italic">No role overwrites</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/AutocreateCategoryForm.jsx
git commit -m "feat(autocreate): add category form component"
```

---

### Task 6: AutocreateChannelForm Component

**Files:**
- Create: `src/components/AutocreateChannelForm.jsx`

- [ ] **Step 1: Create the channel form**

Create `src/components/AutocreateChannelForm.jsx`:

```javascript
import { useState } from 'react';
import AutocreateRoleCard from './AutocreateRoleCard';
import { inputClass, labelClass } from '../lib/styles';

function CommandsList({ commands, onChange }) {
  const add = () => onChange([...commands, '']);
  const update = (i, val) => {
    const updated = [...commands];
    updated[i] = val;
    onChange(updated);
  };
  const remove = (i) => onChange(commands.filter((_, idx) => idx !== i));
  const move = (i, dir) => {
    const target = i + dir;
    if (target < 0 || target >= commands.length) return;
    const updated = [...commands];
    [updated[i], updated[target]] = [updated[target], updated[i]];
    onChange(updated);
  };

  return (
    <div>
      {commands.map((cmd, i) => (
        <div key={i} className="flex items-center gap-1 mb-1">
          <span className="text-gray-600 text-[10px] w-4 text-right shrink-0">{i + 1}.</span>
          <input
            className={`${inputClass} flex-1`}
            value={cmd}
            onChange={(e) => update(i, e.target.value)}
            placeholder="e.g. track pokemon100 pokemon000"
          />
          <button type="button" onClick={() => move(i, -1)} className="text-gray-600 hover:text-gray-300 text-xs px-0.5" title="Move up" disabled={i === 0}>↑</button>
          <button type="button" onClick={() => move(i, 1)} className="text-gray-600 hover:text-gray-300 text-xs px-0.5" title="Move down" disabled={i === commands.length - 1}>↓</button>
          <button type="button" onClick={() => remove(i)} className="text-gray-600 hover:text-red-400 text-xs px-0.5" title="Remove">✕</button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-[10px] text-gray-500 border border-dashed border-gray-600 rounded px-1.5 py-0.5 hover:text-gray-300 hover:border-gray-400 mt-1"
      >
        + Add Command
      </button>
      <div className="text-[10px] text-gray-600 mt-1">
        Commands run as the channel's target. <code className="bg-gray-800 px-0.5 rounded">{'{N}'}</code> = arg slot (note: {'{0}'} = args[1] from !autocreate)
      </div>
    </div>
  );
}

function ThreadCard({ thread, onChange, onDelete, onMove, isFirst, isLast, schema }) {
  const [expanded, setExpanded] = useState(false);
  const buttonStyles = schema?.buttonStyles || ['primary', 'secondary', 'success', 'danger'];

  const update = (field, value) => onChange({ ...thread, [field]: value });

  return (
    <div className={`bg-gray-800 border rounded mb-1.5 ${expanded ? 'border-gray-600' : 'border-gray-700'}`}>
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-gray-750"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-gray-500 text-xs">{expanded ? '▼' : '▶'}</span>
        <span className="text-gray-200 text-sm">🧵 {thread.name || '(unnamed)'}</span>
        {thread.buttonStyle && thread.buttonStyle !== 'secondary' && (
          <span className="text-[10px] text-gray-500">{thread.buttonStyle}</span>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" onClick={(e) => { e.stopPropagation(); onMove(-1); }} className="text-gray-600 hover:text-gray-300 text-xs px-0.5" disabled={isFirst}>↑</button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onMove(1); }} className="text-gray-600 hover:text-gray-300 text-xs px-0.5" disabled={isLast}>↓</button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-gray-600 hover:text-red-400 text-xs px-0.5">✕</button>
        </div>
      </div>
      {expanded && (
        <div className="px-2.5 pb-2.5 border-t border-gray-700 pt-2 space-y-2">
          <div>
            <label className={labelClass}>Thread Name</label>
            <input className={inputClass} value={thread.name || ''} onChange={(e) => update('name', e.target.value)} placeholder="e.g. {0}-100iv-pokemon" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass}>Button Label <span className="text-gray-600">(optional)</span></label>
              <input className={inputClass} value={thread.buttonLabel || ''} onChange={(e) => update('buttonLabel', e.target.value)} placeholder="Defaults to thread name" />
            </div>
            <div className="w-32">
              <label className={labelClass}>Button Style</label>
              <select className={inputClass} value={thread.buttonStyle || 'secondary'} onChange={(e) => update('buttonStyle', e.target.value)}>
                {buttonStyles.map((s) => <option key={s} value={s}>{s || '(none)'}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Commands ({(thread.commands || []).length})</label>
            <CommandsList commands={thread.commands || []} onChange={(cmds) => update('commands', cmds)} />
          </div>
        </div>
      )}
    </div>
  );
}

function ThreadPickerForm({ picker, onChange }) {
  const update = (field, value) => onChange({ ...picker, [field]: value });

  return (
    <div className="space-y-2 bg-gray-800 border border-gray-700 rounded p-2.5">
      <div>
        <label className={labelClass}>Embed Title</label>
        <input className={inputClass} value={picker.embedTitle || ''} onChange={(e) => update('embedTitle', e.target.value)} placeholder="e.g. Choose your alerts" />
      </div>
      <div>
        <label className={labelClass}>Embed Description</label>
        <textarea className={`${inputClass} h-16 resize-y`} value={picker.embedDescription || ''} onChange={(e) => update('embedDescription', e.target.value)} placeholder="Description shown in the picker embed" />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
        <input type="checkbox" checked={!!picker.pinned} onChange={(e) => update('pinned', e.target.checked)} className="rounded" />
        Pin picker message
      </label>
    </div>
  );
}

export default function AutocreateChannelForm({ channel, onChange, schemaFlags, schema, validation, channelPath }) {
  const update = (field, value) => onChange({ ...channel, [field]: value });
  const isVoice = (channel.channelType || 'text') === 'voice';
  const channelTypes = schema?.channelTypes || ['text', 'voice'];
  const controlTypes = schema?.controlTypes || ['', 'bot', 'webhook'];

  // Roles
  const addRole = () => update('roles', [...(channel.roles || []), { name: '' }]);
  const updateRole = (i, role) => { const r = [...(channel.roles || [])]; r[i] = role; update('roles', r); };
  const removeRole = (i) => update('roles', (channel.roles || []).filter((_, idx) => idx !== i));

  // Threads
  const addThread = () => update('threads', [...(channel.threads || []), { name: '', buttonStyle: 'secondary', commands: [] }]);
  const updateThread = (i, thread) => { const t = [...(channel.threads || [])]; t[i] = thread; update('threads', t); };
  const removeThread = (i) => update('threads', (channel.threads || []).filter((_, idx) => idx !== i));
  const moveThread = (i, dir) => {
    const t = [...(channel.threads || [])];
    const target = i + dir;
    if (target < 0 || target >= t.length) return;
    [t[i], t[target]] = [t[target], t[i]];
    update('threads', t);
  };

  const hasThreads = (channel.threads || []).length > 0;
  const hasPicker = !!channel.threadPicker;

  return (
    <div className="space-y-5">
      {/* Channel Settings */}
      <section>
        <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-2">Channel Settings</div>
        <div className="space-y-2">
          <div>
            <label className={labelClass}>Channel Name</label>
            <input className={inputClass} value={channel.channelName || ''} onChange={(e) => update('channelName', e.target.value)} placeholder="e.g. {0}-pokemon-100iv" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass}>Channel Type</label>
              <select className={inputClass} value={channel.channelType || 'text'} onChange={(e) => update('channelType', e.target.value)}>
                {channelTypes.map((t) => <option key={t} value={t}>{t || 'text'}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className={labelClass}>Control Type</label>
              <select className={inputClass} value={channel.controlType || ''} onChange={(e) => update('controlType', e.target.value)}>
                {controlTypes.map((t) => <option key={t} value={t}>{t || '(none)'}</option>)}
              </select>
            </div>
          </div>
          {channel.controlType === 'webhook' && (
            <div>
              <label className={labelClass}>Webhook Name <span className="text-gray-600">(optional)</span></label>
              <input className={inputClass} value={channel.webhookName || ''} onChange={(e) => update('webhookName', e.target.value)} placeholder="Poracle" />
            </div>
          )}
          {!isVoice && (
            <div>
              <label className={labelClass}>Topic <span className="text-gray-600">(optional)</span></label>
              <input className={inputClass} value={channel.topic || ''} onChange={(e) => update('topic', e.target.value)} placeholder="Channel topic with {0} placeholders" />
            </div>
          )}
        </div>
      </section>

      {/* Roles */}
      <section>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">
            Roles ({(channel.roles || []).length})
          </span>
          <button type="button" onClick={addRole} className="text-[10px] text-gray-500 border border-dashed border-gray-600 rounded px-1.5 py-0.5 hover:text-gray-300 hover:border-gray-400">
            + Add Role
          </button>
        </div>
        {(channel.roles || []).map((role, i) => (
          <AutocreateRoleCard key={i} role={role} onChange={(r) => updateRole(i, r)} onDelete={() => removeRole(i)} schemaFlags={schemaFlags} />
        ))}
        {(channel.roles || []).length === 0 && (
          <div className="text-xs text-gray-600 italic">No role overwrites</div>
        )}
      </section>

      {/* Commands */}
      {!isVoice && (
        <section>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1.5">
            Commands ({(channel.commands || []).length})
          </div>
          <CommandsList commands={channel.commands || []} onChange={(cmds) => update('commands', cmds)} />
        </section>
      )}

      {/* Threads */}
      {!isVoice && (
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">
              Threads ({(channel.threads || []).length})
            </span>
            <button type="button" onClick={addThread} className="text-[10px] text-gray-500 border border-dashed border-gray-600 rounded px-1.5 py-0.5 hover:text-gray-300 hover:border-gray-400">
              + Add Thread
            </button>
          </div>
          {(channel.threads || []).map((thread, i) => (
            <ThreadCard
              key={i}
              thread={thread}
              onChange={(t) => updateThread(i, t)}
              onDelete={() => removeThread(i)}
              onMove={(dir) => moveThread(i, dir)}
              isFirst={i === 0}
              isLast={i === (channel.threads || []).length - 1}
              schema={schema}
            />
          ))}
          {(channel.threads || []).length === 0 && (
            <div className="text-xs text-gray-600 italic">No threads</div>
          )}
        </section>
      )}

      {/* Thread Picker */}
      {!isVoice && hasThreads && (
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Thread Picker</span>
            {!hasPicker && (
              <button type="button" onClick={() => update('threadPicker', { embedTitle: '', embedDescription: '', pinned: false })} className="text-[10px] text-gray-500 border border-dashed border-gray-600 rounded px-1.5 py-0.5 hover:text-gray-300 hover:border-gray-400">
                + Add Picker
              </button>
            )}
            {hasPicker && (
              <button type="button" onClick={() => update('threadPicker', null)} className="text-[10px] text-gray-500 hover:text-red-400">
                Remove
              </button>
            )}
          </div>
          {hasPicker && (
            <ThreadPickerForm picker={channel.threadPicker} onChange={(p) => update('threadPicker', p)} />
          )}
          {!hasPicker && (
            <div className="text-xs text-amber-500/70">Threads defined but no picker — users won't have buttons to join</div>
          )}
        </section>
      )}

      {/* Voice channel note */}
      {isVoice && (
        <div className="text-xs text-gray-500 italic border border-gray-800 rounded p-2">
          Voice channels don't support topics, commands, threads, or thread pickers.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/AutocreateChannelForm.jsx
git commit -m "feat(autocreate): add channel form with commands, threads, and thread picker"
```

---

### Task 7: AutocreateTree Component

**Files:**
- Create: `src/components/AutocreateTree.jsx`

- [ ] **Step 1: Create the tree sidebar**

Create `src/components/AutocreateTree.jsx`:

```javascript
import { useState, useMemo, useEffect, useRef } from 'react';
import { hasIssuesUnder } from '../lib/autocreate-validation';

function TemplatePicker({ templates, selectedName, onSelect, onAdd, onDelete }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return templates;
    const q = search.toLowerCase();
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, search]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-sm hover:bg-gray-700"
      >
        <span className="text-yellow-300 font-medium truncate">{selectedName || 'Select template...'}</span>
        <span className="text-gray-500 ml-1">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-full max-h-60 bg-gray-900 border border-gray-600 rounded shadow-xl z-50 flex flex-col">
          {templates.length > 5 && (
            <div className="p-1.5 border-b border-gray-700">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full bg-gray-800 text-gray-200 px-2 py-1 rounded border border-gray-600 text-xs focus:border-blue-500 focus:outline-none"
                autoFocus
              />
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {filtered.map((t) => (
              <button
                key={t.name}
                onClick={() => { onSelect(t.name); setOpen(false); setSearch(''); }}
                className={`w-full text-left px-2.5 py-1.5 text-sm hover:bg-gray-800 ${
                  t.name === selectedName ? 'bg-blue-900/20 border-l-2 border-blue-500' : ''
                }`}
              >
                {t.name}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-2.5 py-2 text-gray-500 text-xs text-center">No templates match</div>
            )}
          </div>
        </div>
      )}
      <div className="flex gap-1 mt-1.5">
        <button
          type="button"
          onClick={onAdd}
          className="flex-1 bg-blue-600 text-white border-none rounded py-0.5 text-[10px] hover:bg-blue-500"
        >
          + New
        </button>
        <button
          type="button"
          onClick={() => {
            if (selectedName && confirm(`Delete template "${selectedName}"?`)) {
              onDelete(selectedName);
            }
          }}
          disabled={!selectedName}
          className="flex-1 bg-gray-800 text-gray-400 border border-gray-600 rounded py-0.5 text-[10px] hover:bg-gray-700 disabled:opacity-40"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

const CONTROL_TYPE_COLORS = {
  bot: 'text-blue-400',
  webhook: 'text-green-400',
};

export default function AutocreateTree({
  templates, selectedTemplateName, selectedTemplate, selectedNode,
  onSelectTemplate, onSelectNode, onAddTemplate, onDeleteTemplate,
  onAddChannel, onRemoveChannel, onMoveChannel, validation,
}) {
  if (!selectedTemplate) {
    return (
      <div className="flex flex-col h-full bg-gray-900 border-r border-gray-700" style={{ width: 240 }}>
        <div className="p-2 border-b border-gray-700">
          <TemplatePicker
            templates={templates}
            selectedName={selectedTemplateName}
            onSelect={onSelectTemplate}
            onAdd={onAddTemplate}
            onDelete={onDeleteTemplate}
          />
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-600 text-xs">
          {templates.length === 0 ? 'No templates — create one' : 'Select a template'}
        </div>
      </div>
    );
  }

  const def = selectedTemplate.definition || {};
  const channels = def.channels || [];
  const templateIndex = templates.findIndex((t) => t.name === selectedTemplateName);
  const basePath = `templates[${templateIndex}]`;

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-700" style={{ width: 240 }}>
      {/* Template picker */}
      <div className="p-2 border-b border-gray-700 shrink-0">
        <TemplatePicker
          templates={templates}
          selectedName={selectedTemplateName}
          onSelect={onSelectTemplate}
          onAdd={onAddTemplate}
          onDelete={onDeleteTemplate}
        />
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {/* Category node */}
        {def.category ? (
          <button
            type="button"
            onClick={() => onSelectNode({ type: 'category' })}
            className={`w-full text-left px-3 py-1 text-xs flex items-center gap-1.5 hover:bg-gray-800 ${
              selectedNode.type === 'category' ? 'bg-blue-900/20 border-l-2 border-blue-500' : ''
            }`}
          >
            <span className="text-gray-500">📁</span>
            <span className="text-gray-300 truncate">Category: {def.category.categoryName || '(unnamed)'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              // Add a category
              onSelectNode({ type: 'category' });
            }}
            className="w-full text-left px-3 py-1 text-[10px] text-gray-600 hover:text-gray-400"
          >
            + Add category wrapper
          </button>
        )}

        {/* Channel nodes */}
        {channels.map((ch, ci) => {
          const isSelected = selectedNode.type === 'channel' && selectedNode.index === ci;
          const chPath = `${basePath}.definition.channels[${ci}]`;
          const hasError = hasIssuesUnder(validation, chPath);
          const controlType = ch.controlType || '';
          const isVoice = (ch.channelType || 'text') === 'voice';
          const rolesCount = (ch.roles || []).length;
          const cmdsCount = (ch.commands || []).length;
          const threadsCount = (ch.threads || []).length;
          const hasPicker = !!ch.threadPicker;

          return (
            <div key={ci}>
              <div className={`flex items-center ${isSelected ? 'bg-blue-900/20 border-l-2 border-blue-500' : 'hover:bg-gray-800'}`}>
                <button
                  type="button"
                  onClick={() => onSelectNode({ type: 'channel', index: ci })}
                  className="flex-1 text-left px-3 py-1 text-xs flex items-center gap-1.5 min-w-0"
                >
                  <span className="text-gray-500 shrink-0">{isVoice ? '🔊' : '#'}</span>
                  <span className={`truncate ${hasError ? 'text-red-400' : 'text-gray-200'}`}>
                    {ch.channelName || '(unnamed)'}
                  </span>
                  {controlType && (
                    <span className={`text-[9px] ml-auto shrink-0 ${CONTROL_TYPE_COLORS[controlType] || 'text-gray-500'}`}>
                      {controlType}
                    </span>
                  )}
                </button>
                <div className="flex items-center gap-0.5 pr-1 shrink-0">
                  <button type="button" onClick={() => onMoveChannel(ci, -1)} className="text-gray-700 hover:text-gray-400 text-[10px] px-0.5" disabled={ci === 0}>↑</button>
                  <button type="button" onClick={() => onMoveChannel(ci, 1)} className="text-gray-700 hover:text-gray-400 text-[10px] px-0.5" disabled={ci === channels.length - 1}>↓</button>
                  <button type="button" onClick={() => { if (confirm('Remove this channel?')) onRemoveChannel(ci); }} className="text-gray-700 hover:text-red-400 text-[10px] px-0.5">✕</button>
                </div>
              </div>
              {/* Info lines */}
              <div className="pl-7 text-[10px] text-gray-600 space-y-0">
                {rolesCount > 0 && (
                  <button type="button" onClick={() => onSelectNode({ type: 'channel', index: ci })} className="block hover:text-gray-400 py-0.5">
                    🔒 {rolesCount} role{rolesCount !== 1 ? 's' : ''}
                  </button>
                )}
                {cmdsCount > 0 && (
                  <button type="button" onClick={() => onSelectNode({ type: 'channel', index: ci })} className="block hover:text-gray-400 py-0.5">
                    ⌨ {cmdsCount} command{cmdsCount !== 1 ? 's' : ''}
                  </button>
                )}
                {threadsCount > 0 && (
                  <button type="button" onClick={() => onSelectNode({ type: 'channel', index: ci })} className="block hover:text-gray-400 py-0.5">
                    🧵 {threadsCount} thread{threadsCount !== 1 ? 's' : ''}
                  </button>
                )}
                {hasPicker && (
                  <button type="button" onClick={() => onSelectNode({ type: 'channel', index: ci })} className="block hover:text-gray-400 py-0.5">
                    📌 Thread picker
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Add channel button */}
        <div className="px-3 pt-2">
          <button
            type="button"
            onClick={onAddChannel}
            className="w-full border border-dashed border-gray-700 text-gray-600 rounded py-1 text-[10px] hover:text-gray-400 hover:border-gray-500"
          >
            + Add Channel
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/AutocreateTree.jsx
git commit -m "feat(autocreate): add tree sidebar with template picker"
```

---

### Task 8: AutocreateDetail Component

**Files:**
- Create: `src/components/AutocreateDetail.jsx`

- [ ] **Step 1: Create the detail panel**

Create `src/components/AutocreateDetail.jsx`:

```javascript
import { useState, useCallback, useRef, useEffect } from 'react';
import AutocreateChannelForm from './AutocreateChannelForm';
import AutocreateCategoryForm from './AutocreateCategoryForm';
import { inputClass, labelClass } from '../lib/styles';

export default function AutocreateDetail({
  selectedTemplate, selectedNode, schema, validation,
  onUpdateTemplate, onUpdateDefinition, onUpdateTemplateName,
  onSave, onDeleteFromServer, isDirty, selectedTemplateIndex,
}) {
  const [mode, setMode] = useState('form'); // 'form' | 'json'
  const [rawText, setRawText] = useState('');
  const [rawError, setRawError] = useState(null);
  const debounceRef = useRef(null);

  // Sync raw text when template changes or switching to raw mode
  useEffect(() => {
    if (mode === 'json' && selectedTemplate) {
      setRawText(JSON.stringify(selectedTemplate, null, 2));
      setRawError(null);
    }
  }, [mode, selectedTemplate?.name]);

  const handleRawChange = useCallback((text) => {
    setRawText(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        const parsed = JSON.parse(text);
        if (!parsed.name || !parsed.definition) {
          setRawError('JSON must have "name" and "definition" fields');
          return;
        }
        setRawError(null);
        onUpdateTemplate(parsed);
      } catch (err) {
        setRawError(err.message);
      }
    }, 800);
  }, [onUpdateTemplate]);

  const switchToForm = useCallback(() => {
    // Apply any pending raw edits
    if (rawText && mode === 'json') {
      try {
        const parsed = JSON.parse(rawText);
        if (parsed.name && parsed.definition) {
          onUpdateTemplate(parsed);
        }
      } catch {
        // ignore parse errors when switching
      }
    }
    setMode('form');
  }, [rawText, mode, onUpdateTemplate]);

  const handleSave = useCallback(async () => {
    try {
      const result = await onSave();
      alert(`Saved ${result.saved || 0} template(s) to PoracleNG`);
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
  }, [onSave]);

  if (!selectedTemplate) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
        Select or create a template to begin editing
      </div>
    );
  }

  const def = selectedTemplate.definition || {};
  const channels = def.channels || [];
  const schemaFlags = schema?.permissionFlags || null;
  const basePath = `templates[${selectedTemplateIndex}]`;

  // What are we editing?
  let nodeLabel = selectedTemplate.name;
  let nodeType = '';
  let formContent = null;

  if (selectedNode.type === 'category') {
    nodeLabel = def.category ? `Category: ${def.category.categoryName || '(unnamed)'}` : 'Add Category';
    nodeType = 'category';

    if (!def.category) {
      // Show "add category" prompt
      formContent = (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
          <p className="text-sm">This template has no category wrapper.</p>
          <button
            type="button"
            onClick={() => onUpdateDefinition((d) => ({ ...d, category: { categoryName: '', roles: [] } }))}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-500"
          >
            Add Category
          </button>
        </div>
      );
    } else {
      formContent = (
        <AutocreateCategoryForm
          category={def.category}
          onChange={(cat) => onUpdateDefinition((d) => ({ ...d, category: cat }))}
          schemaFlags={schemaFlags}
        />
      );
    }
  } else if (selectedNode.type === 'channel' && selectedNode.index != null && channels[selectedNode.index]) {
    const ch = channels[selectedNode.index];
    const ci = selectedNode.index;
    nodeLabel = `# ${ch.channelName || '(unnamed)'}`;
    nodeType = ch.controlType ? `${ch.controlType} channel` : 'channel';

    formContent = (
      <AutocreateChannelForm
        channel={ch}
        onChange={(updated) => {
          onUpdateDefinition((d) => {
            const chs = [...d.channels];
            chs[ci] = updated;
            return { ...d, channels: chs };
          });
        }}
        schemaFlags={schemaFlags}
        schema={schema}
        validation={validation}
        channelPath={`${basePath}.definition.channels[${ci}]`}
      />
    );
  } else {
    // Template root — show template name editor + summary
    nodeLabel = selectedTemplate.name;
    nodeType = 'template';
    formContent = (
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Template Name</label>
          <input
            className={inputClass}
            value={selectedTemplate.name || ''}
            onChange={(e) => onUpdateTemplateName(e.target.value)}
            placeholder="e.g. pokemon-alerts"
          />
          <div className="text-[10px] text-gray-600 mt-0.5">
            Referenced by <code className="bg-gray-800 px-0.5 rounded">!autocreate {selectedTemplate.name}</code> and <code className="bg-gray-800 px-0.5 rounded">template = "{selectedTemplate.name}"</code> in rules
          </div>
        </div>
        {/* Remove category */}
        {def.category && (
          <div className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded p-2">
            <span className="text-xs text-gray-300">📁 Category: {def.category.categoryName || '(unnamed)'}</span>
            <button
              type="button"
              onClick={() => {
                if (confirm('Remove category wrapper? Channels will be created at top level.')) {
                  onUpdateDefinition((d) => { const { category, ...rest } = d; return rest; });
                }
              }}
              className="text-[10px] text-gray-500 hover:text-red-400"
            >
              Remove
            </button>
          </div>
        )}
        <div className="text-xs text-gray-500">
          {channels.length} channel{channels.length !== 1 ? 's' : ''}
          {def.category ? ' under a category' : ' at top level'}
        </div>

        {/* Placeholder help */}
        <details className="text-xs text-gray-500 border border-gray-800 rounded p-2">
          <summary className="cursor-pointer hover:text-gray-300">Placeholder reference</summary>
          <div className="mt-2 space-y-1">
            <p><code className="bg-gray-800 px-0.5 rounded">{'{0}'}</code>, <code className="bg-gray-800 px-0.5 rounded">{'{1}'}</code>, ... substitute arg slots positionally.</p>
            <p><strong>Interactive:</strong> <code className="bg-gray-800 px-0.5 rounded">!autocreate {selectedTemplate.name} arg0 arg1</code> — {'{0}'} = arg0 (which is args[1] in the command).</p>
            <p><strong>Bulk:</strong> <code className="bg-gray-800 px-0.5 rounded">params = ["{'{{group}}'}", "{'{{name}}'}"]</code> — each element becomes a positional slot.</p>
            <p>Supported in: categoryName, channelName, topic, commands, thread names, button labels, picker title/description.</p>
          </div>
        </details>
      </div>
    );
  }

  // Validation summary for bottom bar
  const errorCount = validation.errors.length;
  const warnCount = validation.warnings.length;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-700 bg-gray-900 shrink-0">
        <span className="text-gray-400 text-xs truncate">{nodeLabel}</span>
        {nodeType && (
          <span className="text-[9px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded shrink-0">{nodeType}</span>
        )}
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={switchToForm}
            className={`px-2 py-0.5 rounded text-[11px] border ${mode === 'form' ? 'bg-gray-800 text-gray-200 border-gray-600' : 'text-gray-500 border-gray-700 hover:border-gray-600'}`}
          >
            Form
          </button>
          <button
            type="button"
            onClick={() => { setRawText(JSON.stringify(selectedTemplate, null, 2)); setRawError(null); setMode('json'); }}
            className={`px-2 py-0.5 rounded text-[11px] border ${mode === 'json' ? 'bg-gray-800 text-gray-200 border-gray-600' : 'text-gray-500 border-gray-700 hover:border-gray-600'}`}
          >
            JSON
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {mode === 'form' ? (
          formContent
        ) : (
          <div className="h-full flex flex-col">
            <textarea
              className="w-full flex-1 bg-gray-800 text-gray-200 border border-gray-600 rounded p-2 font-mono text-xs resize-none focus:outline-none focus:border-blue-500"
              value={rawText}
              onChange={(e) => handleRawChange(e.target.value)}
              spellCheck={false}
              style={{ minHeight: '300px' }}
            />
            {rawError && (
              <div className="text-red-400 text-xs mt-1 p-1 bg-red-900/20 rounded">{rawError}</div>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-t border-gray-700 bg-gray-900 shrink-0">
        <span className={`text-xs ${errorCount > 0 ? 'text-red-400' : warnCount > 0 ? 'text-amber-400' : 'text-green-400'}`}>
          {errorCount > 0
            ? `${errorCount} error${errorCount !== 1 ? 's' : ''}`
            : warnCount > 0
              ? `${warnCount} warning${warnCount !== 1 ? 's' : ''}`
              : '● No issues'
          }
        </span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={errorCount > 0 || !isDirty}
            className={`px-3 py-0.5 rounded text-xs ${
              !isDirty
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : errorCount > 0
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            {!isDirty ? 'No changes' : errorCount > 0 ? 'Fix errors to save' : 'Save to Poracle'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/AutocreateDetail.jsx
git commit -m "feat(autocreate): add detail panel with form/json toggle"
```

---

### Task 9: AutocreateEditor Component

**Files:**
- Create: `src/components/AutocreateEditor.jsx`

- [ ] **Step 1: Create the main editor wrapper**

Create `src/components/AutocreateEditor.jsx`:

```javascript
import AutocreateTree from './AutocreateTree';
import AutocreateDetail from './AutocreateDetail';

export default function AutocreateEditor({ autocreate }) {
  if (autocreate.loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading autocreate templates...
      </div>
    );
  }

  if (autocreate.error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <div className="text-red-400">Failed to load autocreate templates: {autocreate.error}</div>
          <button onClick={autocreate.load} className="text-blue-400 hover:text-blue-300 text-sm">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <AutocreateTree
        templates={autocreate.templates}
        selectedTemplateName={autocreate.selectedTemplateName}
        selectedTemplate={autocreate.selectedTemplate}
        selectedNode={autocreate.selectedNode}
        onSelectTemplate={(name) => {
          autocreate.setSelectedTemplateName(name);
          autocreate.setSelectedNode({ type: 'template' });
        }}
        onSelectNode={autocreate.setSelectedNode}
        onAddTemplate={autocreate.addTemplate}
        onDeleteTemplate={autocreate.deleteFromServer}
        onAddChannel={autocreate.addChannel}
        onRemoveChannel={autocreate.removeChannel}
        onMoveChannel={autocreate.moveChannel}
        validation={autocreate.validation}
      />
      <AutocreateDetail
        selectedTemplate={autocreate.selectedTemplate}
        selectedNode={autocreate.selectedNode}
        schema={autocreate.schema}
        validation={autocreate.validation}
        onUpdateTemplate={(t) => {
          if (typeof t === 'function') {
            autocreate.updateSelectedTemplate(t);
          } else {
            autocreate.replaceSelectedTemplateRaw(t);
          }
        }}
        onUpdateDefinition={autocreate.updateDefinition}
        onUpdateTemplateName={autocreate.updateTemplateName}
        onSave={autocreate.save}
        onDeleteFromServer={autocreate.deleteFromServer}
        isDirty={autocreate.isDirty}
        selectedTemplateIndex={autocreate.selectedTemplateIndex}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/AutocreateEditor.jsx
git commit -m "feat(autocreate): add main editor wrapper component"
```

---

### Task 10: Wire Into App.jsx and TopBar.jsx

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/TopBar.jsx`

- [ ] **Step 1: Update TopBar.jsx to add the Autocreate tab and save button**

In `src/components/TopBar.jsx`, add the `autocreateDirty` and `onAutocreateSave` props to the component signature:

Replace the entire component signature (line 3):

```javascript
export default function TopBar({
  activeTab, onTabChange,
  // DTS props
  templates, currentTemplate, onSelectTemplate,
  onImport, onExport, onSave, connected,
  showMiddle, onToggleMiddle, sendTestButton,
  // Config props
  configDirtyCount, configRestartRequired, onConfigSave, configHasErrors,
}) {
```

With:

```javascript
export default function TopBar({
  activeTab, onTabChange,
  // DTS props
  templates, currentTemplate, onSelectTemplate,
  onImport, onExport, onSave, connected,
  showMiddle, onToggleMiddle, sendTestButton,
  // Config props
  configDirtyCount, configRestartRequired, onConfigSave, configHasErrors,
  // Autocreate props
  autocreateDirty, onAutocreateSave,
}) {
```

Add the Autocreate tab button after the Config tab button (after line 36, before the closing `</div>` of the tab group):

```javascript
          <button
            onClick={() => onTabChange('autocreate')}
            className={`px-3 py-0.5 rounded text-sm font-medium transition-colors ${
              activeTab === 'autocreate'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            Autocreate
            {autocreateDirty && <span className="ml-1 text-[9px] text-blue-300">●</span>}
          </button>
```

Add the autocreate save button in the right-side actions area, after the config save button block (after line 96):

```javascript
        {activeTab === 'autocreate' && onAutocreateSave && (
          <button onClick={onAutocreateSave}
            className={`px-3 py-0.5 rounded text-sm border border-gray-600 hover:bg-gray-700 ${
              autocreateDirty
                ? 'bg-gray-800 text-teal-300'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
            disabled={!autocreateDirty}
          >
            {autocreateDirty ? 'Save Autocreate' : 'No changes'}
          </button>
        )}
```

- [ ] **Step 2: Update App.jsx to wire the autocreate hook and tab**

Add the import at the top of `src/App.jsx` (after the ConfigEditor import, line 10):

```javascript
import AutocreateEditor from './components/AutocreateEditor';
```

Add the import for the hook (after the useApi import, line 17):

```javascript
import { useAutocreate } from './hooks/useAutocreate';
```

Add the hook usage after the `config` hook (after line 68):

```javascript
  const autocreate = useAutocreate(api.connected ? api.client : null);
```

Add a `useEffect` to load autocreate data when switching to the tab (after the existing config load useEffect, after line 131):

```javascript
  // Load autocreate templates when connected and switching to autocreate tab
  useEffect(() => {
    if (api.connected && activeTab === 'autocreate' && !autocreate.loaded) {
      autocreate.load();
    }
  }, [api.connected, activeTab, autocreate.loaded]);
```

Add the autocreate save handler (after `handleConfigSave`, after line 242):

```javascript
  const handleAutocreateSave = useCallback(async () => {
    try {
      const result = await autocreate.save();
      alert(`Saved ${result.saved || 0} autocreate template(s).`);
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
  }, [autocreate]);
```

Add autocreate props to TopBar (after `onConfigSave` prop, around line 366):

```javascript
        autocreateDirty={autocreate.isDirty}
        onAutocreateSave={api.connected ? handleAutocreateSave : null}
```

Change the tab content from a ternary to handle three tabs. Replace the block from line 368 (`{activeTab === 'templates' ? (`) through line 450 (the closing of the config block, `)}`) with:

```javascript
      {activeTab === 'templates' ? (
        <ErrorBoundary>
        <div className="flex flex-1 min-h-0">
          {/* Left panel — Template Editor */}
          <div
            ref={editorContainerRef}
            className="min-w-0 shrink-0"
            style={{ width: `${leftWidth}px` }}
          >
            <TemplateEditor
              template={dts.currentTemplate?.template}
              templateFileContent={dts.currentTemplate?.templateFileContent ?? null}
              onChange={dts.updateTemplate}
              onFileContentChange={dts.updateTemplateFileContent}
              platform={dts.filters.platform}
            />
          </div>
          <ResizeHandle onResize={resizeLeft} />
          {/* Middle panel — Tags / Test Data (collapsible) */}
          {showMiddle && (
            <>
              <div
                className="flex flex-col min-h-0 shrink-0"
                style={{ width: `${middleWidth}px` }}
              >
                <div className="flex shrink-0 border-b border-gray-700">
                  <button
                    onClick={() => setMiddleTab('tags')}
                    className={`flex-1 text-xs py-1.5 text-center transition-colors ${tabClass(middleTab === 'tags')}`}
                  >
                    Tags
                  </button>
                  <button
                    onClick={() => setMiddleTab('data')}
                    className={`flex-1 text-xs py-1.5 text-center transition-colors ${tabClass(middleTab === 'data')}`}
                  >
                    Test Data
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  {middleTab === 'tags' ? (
                    <TagPicker
                      type={dts.filters.type}
                      platform={dts.filters.platform}
                      onInsertTag={handleInsertTag}
                      apiFields={apiFields}
                      apiBlockScopes={apiBlockScopes}
                      apiSnippets={apiSnippets}
                      blockContext={blockContext}
                      partials={partials}
                      emojis={emojis[dts.filters.platform] || {}}
                    />
                  ) : (
                    <TestDataPanel
                      testData={activeTestData}
                      onTestDataChange={setCustomTestData}
                      scenarios={dts.availableScenarios}
                      currentScenario={dts.testScenario}
                      onScenarioChange={handleScenarioChange}
                      apiScenarios={apiTestScenarios}
                      onEnrich={api.connected ? handleEnrich : null}
                    />
                  )}
                </div>
              </div>
              <ResizeHandle onResize={resizeMiddle} />
            </>
          )}
          {/* Right panel — Discord Preview */}
          <div className="flex-1 min-w-0">
            {dts.filters.platform === 'telegram' ? (
              <TelegramPreview data={renderedData} />
            ) : (
              <DiscordPreview data={renderedData} error={renderError} />
            )}
          </div>
        </div>
        </ErrorBoundary>
      ) : activeTab === 'autocreate' ? (
        <div className="flex-1 min-h-0">
          <AutocreateEditor autocreate={autocreate} />
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ConfigEditor config={config} />
        </div>
      )}
```

- [ ] **Step 3: Verify the app builds and runs**

Run: `npm run build`
Expected: Build succeeds with no errors.

Run: `npm run dev`
Expected: App runs. The three tabs (Templates, Config, Autocreate) are visible. Clicking Autocreate shows the editor (loading state if connected, or empty state).

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/components/TopBar.jsx
git commit -m "feat(autocreate): wire autocreate tab into App and TopBar"
```

---

### Task 11: End-to-End Testing and Polish

**Files:**
- Possibly modify any of the above files based on testing

- [ ] **Step 1: Manual smoke test — offline mode**

Run: `npm run dev`

1. Don't connect to Poracle — click the Autocreate tab
2. Verify it shows "Loading..." briefly then an error or empty state
3. This is expected — autocreate requires a connection

- [ ] **Step 2: Manual smoke test — connected mode**

Run: `npm run dev`

1. Connect to PoracleNG (localhost:3030, secret: flibble)
2. Click the Autocreate tab
3. Verify templates load (or empty state if no channelTemplate.json exists)
4. Click "+ New" to create a template
5. Verify template appears in picker, tree shows one channel
6. Edit the template name — verify no spaces warning
7. Click the channel node in tree — verify channel form appears
8. Add a role to the channel — verify expandable card works
9. Toggle a permission flag — verify tri-state cycles (inherit → allow → deny → inherit)
10. Add a command — verify it appears in the list
11. Switch to JSON mode — verify raw JSON shows the template
12. Edit JSON — verify debounced apply back to form
13. Click Save — verify API call (may error if backend not ready — that's OK)

- [ ] **Step 3: Fix any issues found during testing**

Address any rendering bugs, missing props, or state management issues found in steps 1-2.

- [ ] **Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix(autocreate): polish from smoke testing"
```

- [ ] **Step 5: Build for production**

Run: `npm run build`
Expected: Clean production build with no warnings or errors.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(autocreate): autocreate channel template editor complete"
```
