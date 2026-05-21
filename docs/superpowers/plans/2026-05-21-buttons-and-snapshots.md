# Buttons & Snapshots Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add author/preview support for interactive Discord buttons attached to DTS entries, plus a TOML source-format badge and TOML-save warning. Snapshots config section already ships from PoracleNG; renders automatically via existing config UI.

**Architecture:** Buttons live as a property of each DTSEntry. A new `ButtonsEditor` renders below the existing template body editor inside a thinned-down `TemplateEditor`. The body-editing logic is extracted into a reusable `TemplateBodyEditor` so inline-template button responses get the same Form/Raw/embed-fields support as the main template. The Handlebars render pipeline gains a parallel `renderButtons` that resolves labels and evaluates `show_if`; the resulting list is attached to the preview data as `__buttons` and rendered as a Discord action row in `DiscordView`.

**Tech Stack:** React 18, Vite, vitest, Handlebars, Tailwind CSS classes.

**Reference spec:** `docs/superpowers/specs/2026-05-21-buttons-and-snapshots-design.md`

---

## File Structure

**New files:**

| File | Responsibility |
|---|---|
| `src/hooks/useActions.js` | Fetch + hold the action registry from `/api/dts/actions`. Tolerates 503. |
| `src/lib/button-validation.js` | Pure validator for a single `ButtonDef`; pure dedup checker for a list. |
| `src/lib/__tests__/button-validation.test.js` | Vitest coverage for the validator. |
| `src/lib/render-buttons.js` | Pure function: given engine + buttons + data + platform, returns the rendered, `show_if`-filtered list `[{ id, label, style }, ...]`. |
| `src/lib/__tests__/render-buttons.test.js` | Vitest coverage for label rendering and `show_if` filtering. |
| `src/components/TemplateBodyEditor.jsx` | Extracted Form/Raw/templateFile body editor. Used by `TemplateEditor` and `ButtonDispatchEditor` inline-template mode. |
| `src/components/HandlebarsExpressionInput.jsx` | Small text input wired to `useInsertAtCursor` with a compact field-picker popover. |
| `src/components/TemplateLinkPicker.jsx` | Dropdown filtered to in-memory entries with `type === "buttonResponse"`, plus "Jump to" navigation. |
| `src/components/ButtonDispatchEditor.jsx` | Segmented control: Action / Template link / Inline template / Plain text. Non-destructive tab switching. |
| `src/components/ButtonCard.jsx` | Single button — collapsed row (label preview, style swatch, dispatch summary, reorder/delete) and expanded form (identity, dispatch, visibility). |
| `src/components/ButtonsEditor.jsx` | Top-level collapsible "Buttons" section: header, disabled banner, list of `ButtonCard`s, add button (capped at 25). |

**Modified files:**

| File | Change |
|---|---|
| `src/lib/api-client.js` | Add `getActions()`. |
| `src/lib/styles.js` | Add Discord button color tokens (`discordBtnClass` map). |
| `src/hooks/useDts.js` | Add `updateButtons(buttons)` helper. |
| `src/hooks/useHandlebars.js` | Expose `renderButtons(buttons, data, platform)` backed by `render-buttons.js`. |
| `src/components/TemplateEditor.jsx` | Thin shell: format badge + `TemplateBodyEditor` + `ButtonsEditor`. |
| `src/components/TemplateSelector.jsx` | Per-row JSON/TOML badge driven by `entry.sourceFormat`. |
| `src/components/discordview.jsx` | Render Discord-style action row after embeds when `data.__buttons` is non-empty. |
| `src/App.jsx` | Call `useActions` at connect, pass actions down to `TemplateEditor`. Merge rendered `__buttons` into `renderedData`. Show one-shot toast on save when any saved entry has `sourceFormat === "toml"`. |

---

## Task 1: Add `getActions` API method

**Files:**
- Modify: `src/lib/api-client.js` (insert after the existing `getEmoji` method around line 70)

- [ ] **Step 1: Add the method**

Append after the `getEmoji` method, before `getConfigSchema`:

```js
  async getActions() {
    return this.fetch('/api/dts/actions');
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api-client.js
git commit -m "feat: add getActions() API method for button action registry"
```

---

## Task 2: Create `useActions` hook

**Files:**
- Create: `src/hooks/useActions.js`

- [ ] **Step 1: Write the hook**

```jsx
import { useState, useCallback } from 'react';

/**
 * Holds the button-action registry fetched from /api/dts/actions.
 *
 * actions: Array<{ name: string, scopes: string[], required_scope?: boolean, params?: string[] }>
 * Treats 503 (snapshots disabled) as "no registry" — actions stays []
 * and the editor falls back to the four hardcoded action names with no hints.
 */
export function useActions() {
  const [actions, setActions] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(async (client) => {
    if (!client) return;
    try {
      const result = await client.getActions();
      setActions(result.actions || []);
      setError(null);
    } catch (err) {
      // 503 = snapshots disabled; other errors are network/config issues.
      // Either way: no registry → editor falls back to hardcoded action names.
      setActions([]);
      setError(err.message || String(err));
    }
  }, []);

  const reset = useCallback(() => {
    setActions([]);
    setError(null);
  }, []);

  return { actions, error, load, reset };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useActions.js
git commit -m "feat: add useActions hook for button action registry"
```

---

## Task 3: Add Discord button color tokens

**Files:**
- Modify: `src/lib/styles.js`

- [ ] **Step 1: Read the file to see existing exports**

Run: `cat src/lib/styles.js`

- [ ] **Step 2: Append the button-color map**

Append at the end of the file (after the last export):

```js
// Discord button color tokens.
// Used by ButtonCard previews and the DiscordView live action row.
export const discordBtnClass = {
  primary:   'bg-[#5865f2] hover:bg-[#4752c4] text-white',
  secondary: 'bg-[#4e5058] hover:bg-[#6d6f78] text-white',
  success:   'bg-[#248046] hover:bg-[#1a6334] text-white',
  danger:    'bg-[#da373c] hover:bg-[#a12d2f] text-white',
};

// Common shape for a rendered Discord-style button (preview + ButtonCard swatch).
export const discordBtnBase =
  'inline-flex items-center justify-center font-medium text-sm px-3 py-1.5 rounded min-w-[60px] transition-colors';
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/styles.js
git commit -m "feat: add Discord button color tokens to styles"
```

---

## Task 4: Button validation module (TDD)

**Files:**
- Create: `src/lib/button-validation.js`
- Create: `src/lib/__tests__/button-validation.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/button-validation.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { validateButton, validateButtons } from '../button-validation';

const ok = (b) => expect(validateButton(b).errors).toEqual([]);
const errs = (b) => validateButton(b).errors;

describe('validateButton — required fields', () => {
  it('flags missing id', () => {
    expect(errs({ label: 'x', action: 'redeliver' })).toContain('id is required');
  });
  it('flags missing label', () => {
    expect(errs({ id: 'x', action: 'redeliver' })).toContain('label is required');
  });
});

describe('validateButton — exactly one dispatch field', () => {
  it('flags zero dispatch fields', () => {
    expect(errs({ id: 'x', label: 'L' })).toContain(
      'exactly one of action / response_template_id / response_template_inline / response_text is required'
    );
  });
  it('flags two dispatch fields', () => {
    const e = errs({ id: 'x', label: 'L', action: 'redeliver', response_text: 'hi' });
    expect(e.some((m) => m.includes('exactly one'))).toBe(true);
  });
  it('accepts action alone', () => {
    ok({ id: 'x', label: 'L', action: 'redeliver' });
  });
  it('accepts response_template_id alone', () => {
    ok({ id: 'x', label: 'L', response_template_id: 'rsvp-confirm' });
  });
  it('accepts response_template_inline alone (string)', () => {
    ok({ id: 'x', label: 'L', response_template_inline: 'hi' });
  });
  it('accepts response_template_inline alone (object)', () => {
    ok({ id: 'x', label: 'L', response_template_inline: { content: 'hi' } });
  });
  it('accepts response_text alone', () => {
    ok({ id: 'x', label: 'L', response_text: 'hi' });
  });
});

describe('validateButton — action+scope rules', () => {
  it('mute requires scope', () => {
    expect(errs({ id: 'x', label: 'L', action: 'mute' })).toContain('action "mute" requires scope');
  });
  it('mute with scope passes', () => {
    ok({ id: 'x', label: 'L', action: 'mute', scope: 'gym' });
  });
  it('unsubscribe requires scope = tracking', () => {
    expect(errs({ id: 'x', label: 'L', action: 'unsubscribe', scope: 'gym' })).toContain(
      'action "unsubscribe" requires scope = "tracking"'
    );
  });
  it('unsubscribe with scope=tracking passes', () => {
    ok({ id: 'x', label: 'L', action: 'unsubscribe', scope: 'tracking' });
  });
  it('redeliver does not require scope', () => {
    ok({ id: 'x', label: 'L', action: 'redeliver' });
  });
});

describe('validateButton — enum fields', () => {
  it('rejects unknown style', () => {
    expect(errs({ id: 'x', label: 'L', action: 'redeliver', style: 'pink' })).toContain(
      'style must be one of primary, secondary, success, danger'
    );
  });
  it('rejects unknown visible_to', () => {
    expect(errs({ id: 'x', label: 'L', action: 'redeliver', visible_to: 'nobody' })).toContain(
      'visible_to must be one of target, admin, registered, anyone'
    );
  });
  it('rejects unknown applies_to entry', () => {
    const e = errs({ id: 'x', label: 'L', action: 'redeliver', applies_to: ['dm', 'pigeon'] });
    expect(e.some((m) => m.includes('applies_to'))).toBe(true);
  });
});

describe('validateButtons — list-level rules', () => {
  it('flags duplicate ids', () => {
    const result = validateButtons([
      { id: 'a', label: 'A', action: 'redeliver' },
      { id: 'a', label: 'B', action: 'redeliver' },
    ]);
    expect(result.listErrors).toContain('duplicate button id: "a"');
  });
  it('passes unique ids', () => {
    const result = validateButtons([
      { id: 'a', label: 'A', action: 'redeliver' },
      { id: 'b', label: 'B', action: 'redeliver' },
    ]);
    expect(result.listErrors).toEqual([]);
  });
  it('returns per-button errors keyed by index', () => {
    const result = validateButtons([
      { id: 'a', label: 'A', action: 'redeliver' },
      { id: 'b', action: 'mute' },
    ]);
    expect(result.perButton[0]).toEqual([]);
    expect(result.perButton[1].length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/button-validation.test.js`
Expected: FAIL (module not found / undefined exports).

- [ ] **Step 3: Implement the validator**

Create `src/lib/button-validation.js`:

```js
const STYLES = ['primary', 'secondary', 'success', 'danger'];
const VISIBLE_TO = ['target', 'admin', 'registered', 'anyone'];
const APPLIES_TO = ['dm', 'channel', 'webhook', 'any'];
const DISPATCH_FIELDS = ['action', 'response_template_id', 'response_template_inline', 'response_text'];

function hasValue(v) {
  if (v == null) return false;
  if (typeof v === 'string') return v.length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

export function validateButton(button) {
  const errors = [];
  if (!button || typeof button !== 'object') return { errors: ['button is not an object'] };

  if (!hasValue(button.id)) errors.push('id is required');
  if (!hasValue(button.label)) errors.push('label is required');

  const dispatchCount = DISPATCH_FIELDS.filter((f) => hasValue(button[f])).length;
  if (dispatchCount !== 1) {
    errors.push(
      'exactly one of action / response_template_id / response_template_inline / response_text is required'
    );
  }

  if (button.action === 'mute' && !hasValue(button.scope)) {
    errors.push('action "mute" requires scope');
  }
  if (button.action === 'unsubscribe' && button.scope !== 'tracking') {
    errors.push('action "unsubscribe" requires scope = "tracking"');
  }

  if (button.style != null && !STYLES.includes(button.style)) {
    errors.push(`style must be one of ${STYLES.join(', ')}`);
  }
  if (button.visible_to != null && !VISIBLE_TO.includes(button.visible_to)) {
    errors.push(`visible_to must be one of ${VISIBLE_TO.join(', ')}`);
  }
  if (Array.isArray(button.applies_to)) {
    for (const v of button.applies_to) {
      if (!APPLIES_TO.includes(v)) {
        errors.push(`applies_to entry "${v}" must be one of ${APPLIES_TO.join(', ')}`);
      }
    }
  }

  return { errors };
}

export function validateButtons(buttons) {
  const perButton = (buttons || []).map((b) => validateButton(b).errors);
  const listErrors = [];

  const seen = new Map();
  (buttons || []).forEach((b, idx) => {
    if (!hasValue(b?.id)) return;
    if (seen.has(b.id)) listErrors.push(`duplicate button id: "${b.id}"`);
    else seen.set(b.id, idx);
  });

  return { perButton, listErrors };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/button-validation.test.js`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/button-validation.js src/lib/__tests__/button-validation.test.js
git commit -m "feat: add button validation module with tests"
```

---

## Task 5: Render-buttons module (TDD)

**Files:**
- Create: `src/lib/render-buttons.js`
- Create: `src/lib/__tests__/render-buttons.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/render-buttons.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createEngine } from '../handlebars-engine';
import { renderButtons } from '../render-buttons';

const engine = createEngine();

describe('renderButtons — label rendering', () => {
  it('renders Handlebars in labels', () => {
    const result = renderButtons(engine, [
      { id: 'a', label: 'Mute {{name}}', style: 'primary' },
    ], { name: 'Tyranitar' });
    expect(result).toEqual([{ id: 'a', label: 'Mute Tyranitar', style: 'primary' }]);
  });

  it('defaults style to secondary when missing', () => {
    const result = renderButtons(engine, [{ id: 'a', label: 'Go' }], {});
    expect(result[0].style).toBe('secondary');
  });

  it('returns empty list for null/missing buttons', () => {
    expect(renderButtons(engine, null, {})).toEqual([]);
    expect(renderButtons(engine, undefined, {})).toEqual([]);
    expect(renderButtons(engine, [], {})).toEqual([]);
  });
});

describe('renderButtons — show_if filtering', () => {
  it('drops buttons where show_if evaluates falsy', () => {
    const result = renderButtons(engine, [
      { id: 'visible', label: 'A', show_if: 'iv' },
      { id: 'hidden',  label: 'B', show_if: 'missing' },
    ], { iv: 95 });
    expect(result.map((b) => b.id)).toEqual(['visible']);
  });

  it('keeps buttons where show_if evaluates truthy (helper subexpression)', () => {
    const result = renderButtons(engine, [
      { id: 'hi', label: 'Hi IV', show_if: '(gt iv 90)' },
    ], { iv: 95 });
    expect(result.map((b) => b.id)).toEqual(['hi']);
  });

  it('keeps button when show_if errors (fail-open)', () => {
    const result = renderButtons(engine, [
      { id: 'broken', label: 'B', show_if: '((((' },
    ], {});
    expect(result.map((b) => b.id)).toEqual(['broken']);
  });

  it('treats missing show_if as always-visible', () => {
    const result = renderButtons(engine, [{ id: 'a', label: 'A' }], {});
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/render-buttons.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement renderButtons**

Create `src/lib/render-buttons.js`:

```js
import { renderTemplate, setActivePlatform } from './handlebars-engine';

/**
 * Renders a list of ButtonDef into the shape consumed by DiscordView:
 *   [{ id, label (string), style (string) }, ...]
 *
 * - label is rendered through Handlebars against `data`
 * - show_if is evaluated as a Handlebars expression; falsy ⇒ drop the button
 * - A render/evaluation error on show_if leaves the button visible (fail-open)
 * - style defaults to "secondary"
 */
export function renderButtons(engine, buttons, data, platform) {
  if (!Array.isArray(buttons) || buttons.length === 0) return [];
  if (platform) setActivePlatform(platform);

  const out = [];
  for (const button of buttons) {
    if (!shouldShow(engine, button.show_if, data)) continue;
    let label;
    try {
      label = renderTemplate(engine, String(button.label ?? ''), data);
    } catch {
      label = String(button.label ?? '');
    }
    out.push({
      id: button.id,
      label,
      style: button.style || 'secondary',
    });
  }
  return out;
}

function shouldShow(engine, expr, data) {
  if (expr == null || expr === '') return true;
  try {
    const wrapped = `{{#if ${expr}}}1{{/if}}`;
    const rendered = renderTemplate(engine, wrapped, data);
    return rendered === '1';
  } catch {
    return true; // fail-open
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/render-buttons.test.js`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/render-buttons.js src/lib/__tests__/render-buttons.test.js
git commit -m "feat: add render-buttons module with show_if filtering"
```

---

## Task 6: Extend `useDts` with `updateButtons` helper

**Files:**
- Modify: `src/hooks/useDts.js` (insert after `updateTemplate` around line 100)

- [ ] **Step 1: Add `updateButtons`**

Insert immediately after the `updateTemplate` useCallback (before `updateTemplateFileContent`):

```js
  const updateButtons = useCallback(
    (newButtons) => {
      setTemplates((prev) => {
        if (currentTemplateIndex < 0 || currentTemplateIndex >= prev.length) return prev;
        const updated = [...prev];
        const entry = { ...updated[currentTemplateIndex] };
        if (Array.isArray(newButtons) && newButtons.length > 0) {
          entry.buttons = newButtons;
        } else {
          delete entry.buttons;
        }
        updated[currentTemplateIndex] = entry;
        return updated;
      });
    },
    [currentTemplateIndex]
  );
```

- [ ] **Step 2: Export it from the hook**

Add `updateButtons` to the returned object at the bottom of the hook:

```js
  return {
    templates, filters, setFilters: setFiltersWithAutoId,
    currentTemplate, currentTestData,
    testScenario, setTestScenario,
    availableTypes, availableIds, availableLanguages, availableScenarios,
    updateTemplate, updateButtons, updateTemplateFileContent, loadTemplates, importTemplates, selectTemplate,
  };
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useDts.js
git commit -m "feat: add updateButtons helper to useDts"
```

---

## Task 7: Extend `useHandlebars` with `renderButtons`

**Files:**
- Modify: `src/hooks/useHandlebars.js`

- [ ] **Step 1: Import the renderer**

Add to the existing imports at the top:

```js
import { renderButtons as renderButtonsImpl } from '../lib/render-buttons';
```

- [ ] **Step 2: Add the callback inside the hook**

Inside `useHandlebars()`, immediately after the existing `render` callback declaration, add:

```js
  const renderButtons = useCallback(
    (buttons, data, platform) => {
      try {
        return renderButtonsImpl(engine, buttons, data, platform);
      } catch {
        return [];
      }
    },
    [engine]
  );
```

- [ ] **Step 3: Expose it from the hook**

Update the return statement at the bottom of the hook:

```js
  return { render, renderButtons, renderError, setPartials, setEmojis };
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useHandlebars.js
git commit -m "feat: expose renderButtons from useHandlebars hook"
```

---

## Task 8: Extract `TemplateBodyEditor` from `TemplateEditor`

**Files:**
- Create: `src/components/TemplateBodyEditor.jsx`
- Modify: `src/components/TemplateEditor.jsx`

- [ ] **Step 1: Create the new body editor**

Create `src/components/TemplateBodyEditor.jsx` by lifting the existing body-editing logic out of `TemplateEditor`:

```jsx
import { useState, useCallback, useRef, useEffect } from 'react';
import FormEditor from './FormEditor';
import TelegramFormEditor from './TelegramFormEditor';
import RawEditor from './RawEditor';
import { tabClass } from '../lib/styles';

/**
 * Editor for the body of a DTS entry. Handles three modes:
 * - templateFile: raw Handlebars text editor
 * - form: structured form (Discord or Telegram)
 * - raw: JSON text editor with debounced parse
 *
 * Used by TemplateEditor (main entry body) and ButtonDispatchEditor
 * (inline-template button responses). Does NOT render the buttons section
 * itself — that's TemplateEditor's job.
 */
export default function TemplateBodyEditor({
  template,
  templateFileContent,
  onChange,
  onFileContentChange,
  platform,
  readOnly = false,
}) {
  const [mode, setMode] = useState('form');
  const [rawText, setRawText] = useState('');
  const debounceRef = useRef(null);
  const userEditingRef = useRef(false);

  useEffect(() => {
    if (mode === 'raw' && !userEditingRef.current && template) {
      setRawText(JSON.stringify(template, null, 2));
    }
  }, [template, mode]);

  const switchToRaw = useCallback(() => {
    setRawText(JSON.stringify(template, null, 2));
    userEditingRef.current = false;
    setMode('raw');
  }, [template]);

  const switchToForm = useCallback(() => {
    if (userEditingRef.current) {
      try {
        const parsed = JSON.parse(rawText);
        onChange(parsed);
      } catch {
        // keep last valid template
      }
    }
    userEditingRef.current = false;
    setMode('form');
  }, [rawText, onChange]);

  const handleRawChange = useCallback(
    (text) => {
      setRawText(text);
      userEditingRef.current = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        try {
          const parsed = JSON.parse(text);
          onChange(parsed);
        } catch {
          // still invalid JSON
        }
      }, 800);
    },
    [onChange]
  );

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const isTemplateFile = templateFileContent != null;
  const isTelegram = platform === 'telegram';

  if (isTemplateFile) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-700 text-sm">
          <span className="text-blue-400 text-xs font-medium">Template File</span>
          <span className="text-gray-500 text-[10px]">Raw Handlebars — not structured JSON</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <RawEditor
            value={templateFileContent}
            onChange={readOnly ? () => {} : (text) => onFileContentChange?.(text)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 px-3 py-1.5 border-b border-gray-700 text-sm">
        <button onClick={switchToForm} className={tabClass(mode === 'form')}>Form</button>
        <button onClick={switchToRaw} className={tabClass(mode === 'raw')}>Raw JSON</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {mode === 'form' ? (
          isTelegram ? (
            <TelegramFormEditor template={template} onChange={readOnly ? () => {} : onChange} />
          ) : (
            <FormEditor template={template} onChange={readOnly ? () => {} : onChange} />
          )
        ) : (
          <RawEditor value={rawText} onChange={readOnly ? () => {} : handleRawChange} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Slim `TemplateEditor` down to a wrapper**

Replace the entire body of `src/components/TemplateEditor.jsx` with:

```jsx
import TemplateBodyEditor from './TemplateBodyEditor';

/**
 * Top-level editor for a DTS entry. Composes the body editor (TemplateBodyEditor)
 * with the buttons editor (added in a later task). For now this is a thin shell
 * around TemplateBodyEditor to preserve existing behavior.
 */
export default function TemplateEditor({
  template,
  templateFileContent,
  onChange,
  onFileContentChange,
  platform,
}) {
  return (
    <TemplateBodyEditor
      template={template}
      templateFileContent={templateFileContent}
      onChange={onChange}
      onFileContentChange={onFileContentChange}
      platform={platform}
    />
  );
}
```

- [ ] **Step 3: Verify the app still renders identically**

Run: `npm run dev` (in background, or open the dev server) and confirm:
- Templates tab loads
- Switching between Form / Raw modes still works
- templateFile entries still show the raw Handlebars editor

Then stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/TemplateBodyEditor.jsx src/components/TemplateEditor.jsx
git commit -m "refactor: extract TemplateBodyEditor from TemplateEditor"
```

---

## Task 9: `HandlebarsExpressionInput` component

**Files:**
- Create: `src/components/HandlebarsExpressionInput.jsx`

- [ ] **Step 1: Write the component**

```jsx
import { useState, useRef, useEffect } from 'react';
import { useInsertAtCursor } from '../hooks/useInsertAtCursor';
import { inputClass } from '../lib/styles';

/**
 * Compact single-line text input for short Handlebars expressions
 * (used for button `show_if`). Wires useInsertAtCursor and offers a
 * popover field picker.
 *
 * Props:
 * - value, onChange — controlled input
 * - fields — Array<{ name: string, description?: string, category?: string }>
 * - placeholder
 */
export default function HandlebarsExpressionInput({
  value,
  onChange,
  fields = [],
  placeholder = '',
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { containerRef, insertAtCursor } = useInsertAtCursor();
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDocClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [pickerOpen]);

  const handleInsert = (fieldName) => {
    const inserted = insertAtCursor(`{{${fieldName}}}`);
    if (!inserted) onChange((value || '') + `{{${fieldName}}}`);
    setPickerOpen(false);
    setSearch('');
  };

  const filtered = fields.filter((f) =>
    !search || f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative flex items-center gap-1">
      <input
        type="text"
        className={inputClass + ' flex-1 font-mono text-xs'}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        className="text-xs px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded shrink-0"
        title="Insert field"
      >
        {'{}'}
      </button>
      {pickerOpen && (
        <div
          ref={popoverRef}
          className="absolute top-full right-0 mt-1 w-64 max-h-64 bg-gray-900 border border-gray-600 rounded shadow-xl z-50 flex flex-col"
        >
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter fields..."
            className="m-1 px-2 py-1 bg-gray-800 text-gray-200 border border-gray-700 rounded text-xs shrink-0"
          />
          <div className="overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-2 py-1 text-gray-500 text-xs">No matches</div>
            )}
            {filtered.map((f) => (
              <button
                key={f.name}
                type="button"
                onClick={() => handleInsert(f.name)}
                className="w-full text-left px-2 py-1 text-xs text-gray-200 hover:bg-gray-800 font-mono truncate"
                title={f.description || ''}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/HandlebarsExpressionInput.jsx
git commit -m "feat: add HandlebarsExpressionInput with field picker popover"
```

---

## Task 10: `TemplateLinkPicker` component

**Files:**
- Create: `src/components/TemplateLinkPicker.jsx`

- [ ] **Step 1: Write the component**

```jsx
import { useMemo, useState, useRef, useEffect } from 'react';

/**
 * Dropdown that filters the in-memory templates list to entries of a given
 * type (default: "buttonResponse") and emits the selected id via onChange.
 *
 * Props:
 * - templates — full templates list from useDts
 * - value — currently selected template id (string)
 * - onChange — (id: string) => void
 * - onJumpTo — (template) => void; opens the linked entry in the main editor
 * - type — DTS type to filter on (default "buttonResponse")
 * - platform — optional; filter to entries with matching platform when present
 */
export default function TemplateLinkPicker({
  templates,
  value,
  onChange,
  onJumpTo,
  type = 'buttonResponse',
  platform,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const candidates = useMemo(() => {
    return templates.filter((t) => {
      if (t.type !== type) return false;
      if (platform && t.platform && t.platform !== platform) return false;
      if (!search) return true;
      const haystack = `${t.id} ${t.name || ''} ${t.description || ''}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  }, [templates, type, platform, search]);

  const selected = templates.find((t) => t.type === type && String(t.id) === String(value));

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-left hover:bg-gray-700"
        >
          {selected ? (
            <span className="text-yellow-300 font-mono">{selected.id}</span>
          ) : value ? (
            <span className="text-red-400 font-mono">{value} (not found)</span>
          ) : (
            <span className="text-gray-500">Pick a {type} template...</span>
          )}
          {selected?.name && <span className="text-gray-400 ml-2">{selected.name}</span>}
        </button>
        {selected && (
          <button
            type="button"
            onClick={() => onJumpTo?.(selected)}
            className="text-xs px-2 py-1 bg-blue-900/40 hover:bg-blue-900/60 text-blue-300 rounded"
            title="Open this template in the editor"
          >
            Jump to
          </button>
        )}
      </div>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 max-h-64 bg-gray-900 border border-gray-600 rounded shadow-xl z-50 flex flex-col">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${type}...`}
            className="m-1 px-2 py-1 bg-gray-800 text-gray-200 border border-gray-700 rounded text-xs shrink-0"
          />
          <div className="overflow-y-auto">
            {candidates.length === 0 && (
              <div className="px-2 py-2 text-gray-500 text-xs">
                No {type} templates yet.
              </div>
            )}
            {candidates.map((t) => (
              <button
                key={`${t.id}-${t.platform}-${t.language}`}
                type="button"
                onClick={() => { onChange(String(t.id)); setOpen(false); setSearch(''); }}
                className="w-full text-left px-2 py-1 text-xs hover:bg-gray-800 flex items-baseline gap-2"
              >
                <span className="text-yellow-300 font-mono shrink-0">{t.id}</span>
                <span className="text-gray-400 truncate">{t.name || t.description || ''}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TemplateLinkPicker.jsx
git commit -m "feat: add TemplateLinkPicker for cross-template button links"
```

---

## Task 11: `ButtonDispatchEditor` component

**Files:**
- Create: `src/components/ButtonDispatchEditor.jsx`

- [ ] **Step 1: Write the component**

```jsx
import { useState } from 'react';
import TemplateBodyEditor from './TemplateBodyEditor';
import TemplateLinkPicker from './TemplateLinkPicker';
import { inputClass, labelClass, tabClass } from '../lib/styles';

const DISPATCH_TABS = [
  { key: 'action',   label: 'Action',         field: 'action' },
  { key: 'link',     label: 'Template link',  field: 'response_template_id' },
  { key: 'inline',   label: 'Inline template', field: 'response_template_inline' },
  { key: 'text',     label: 'Plain text',     field: 'response_text' },
];

function detectActiveTab(button) {
  if (button.action != null) return 'action';
  if (button.response_template_id != null) return 'link';
  if (button.response_template_inline != null) return 'inline';
  if (button.response_text != null) return 'text';
  return 'action';
}

/**
 * Edits the dispatch portion of a button: which one of the four mutually-
 * exclusive fields is active, plus per-mode controls.
 *
 * Tab switching is non-destructive in-session: the other three tabs' values
 * stay in `staged` so a misclick doesn't lose work. Only the active tab's
 * field is serialized into the saved button via `serializeDispatch`.
 *
 * Props:
 * - button — the current ButtonDef
 * - onChange — (next ButtonDef) => void
 * - actions — Array from useActions; [] if registry unavailable
 * - actionsError — error string from useActions; surfaces "registry unavailable" hint when truthy
 * - templates — full templates list (for TemplateLinkPicker)
 * - platform — current entry's platform (passed to TemplateBodyEditor)
 * - onJumpTo — forwarded to TemplateLinkPicker
 * - readOnly — disable inputs
 */
export default function ButtonDispatchEditor({
  button,
  onChange,
  actions,
  actionsError,
  templates,
  platform,
  onJumpTo,
  readOnly = false,
}) {
  const [activeTab, setActiveTab] = useState(() => detectActiveTab(button));
  // Inactive tabs' values held in component state.
  const [staged, setStaged] = useState({
    action: { action: button.action ?? 'redeliver', scope: button.scope, params: button.params || {} },
    link:   { response_template_id: button.response_template_id ?? '' },
    inline: { response_template_inline: button.response_template_inline ?? {} },
    text:   { response_text: button.response_text ?? '' },
  });

  const writeActive = (nextStagedTab) => {
    const updatedStaged = { ...staged, [activeTab]: nextStagedTab };
    setStaged(updatedStaged);
    onChange(serializeDispatch(button, activeTab, updatedStaged));
  };

  const switchTab = (tabKey) => {
    setActiveTab(tabKey);
    onChange(serializeDispatch(button, tabKey, staged));
  };

  const ACTION_FALLBACK = ['mute', 'unsubscribe', 'redeliver', 'render'];
  const actionNames = actions.length > 0 ? actions.map((a) => a.name) : ACTION_FALLBACK;
  const currentActionInfo = actions.find((a) => a.name === staged.action.action);

  return (
    <div className="border border-gray-700 rounded p-2 space-y-2">
      <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Dispatch</div>
      <div className="flex gap-1 text-xs">
        {DISPATCH_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            disabled={readOnly}
            onClick={() => switchTab(t.key)}
            className={tabClass(activeTab === t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'action' && (
        <div className="space-y-2">
          <label className={labelClass}>Action</label>
          <select
            className={inputClass}
            disabled={readOnly}
            value={staged.action.action || ''}
            onChange={(e) => writeActive({ ...staged.action, action: e.target.value, scope: undefined })}
          >
            {actionNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          {actions.length === 0 && (
            <div className="text-[10px] text-gray-500">
              Action registry unavailable{actionsError ? ` (${actionsError})` : ''} — enable snapshots to load action metadata.
            </div>
          )}

          {(currentActionInfo?.required_scope || ['mute', 'unsubscribe'].includes(staged.action.action)) && (
            <>
              <label className={labelClass}>Scope</label>
              <select
                className={inputClass}
                disabled={readOnly}
                value={staged.action.scope || ''}
                onChange={(e) => writeActive({ ...staged.action, scope: e.target.value || undefined })}
              >
                <option value="">(pick a scope)</option>
                {(currentActionInfo?.scopes ?? scopeFallback(staged.action.action)).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {staged.action.action === 'unsubscribe' && (
                <div className="text-[10px] text-gray-500">Locked to "tracking" by the action registry.</div>
              )}
            </>
          )}

          {(currentActionInfo?.params ?? []).length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Action params</div>
              {currentActionInfo.params.map((paramName) => (
                <div key={paramName} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-mono w-32 shrink-0">{paramName}</span>
                  <input
                    className={inputClass + ' flex-1'}
                    disabled={readOnly}
                    value={staged.action.params?.[paramName] ?? ''}
                    onChange={(e) => writeActive({
                      ...staged.action,
                      params: { ...staged.action.params, [paramName]: e.target.value },
                    })}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'link' && (
        <div className="space-y-1">
          <label className={labelClass}>Linked buttonResponse template</label>
          <TemplateLinkPicker
            templates={templates}
            value={staged.link.response_template_id}
            onChange={(id) => writeActive({ response_template_id: id })}
            onJumpTo={onJumpTo}
            platform={platform}
          />
        </div>
      )}

      {activeTab === 'inline' && (
        <div className="space-y-1">
          <label className={labelClass}>Inline response template</label>
          <div className="h-72 border border-gray-700 rounded overflow-hidden">
            <TemplateBodyEditor
              template={
                typeof staged.inline.response_template_inline === 'object'
                  ? staged.inline.response_template_inline
                  : {}
              }
              platform={platform}
              readOnly={readOnly}
              onChange={(next) => writeActive({ response_template_inline: next })}
            />
          </div>
        </div>
      )}

      {activeTab === 'text' && (
        <div className="space-y-1">
          <label className={labelClass}>Plain text response (Handlebars)</label>
          <textarea
            className={inputClass + ' font-mono text-xs h-24'}
            disabled={readOnly}
            value={staged.text.response_text || ''}
            onChange={(e) => writeActive({ response_text: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

function scopeFallback(action) {
  if (action === 'unsubscribe') return ['tracking'];
  if (action === 'mute') return ['gym', 'pokemon', 'area', 'pokestop', 'station', 'everything', 'tracking'];
  return [];
}

function serializeDispatch(button, activeTab, staged) {
  // Strip all four dispatch fields, then re-add the active tab's values.
  const stripped = { ...button };
  delete stripped.action;
  delete stripped.scope;
  delete stripped.params;
  delete stripped.response_template_id;
  delete stripped.response_template_inline;
  delete stripped.response_text;

  switch (activeTab) {
    case 'action': {
      const out = { ...stripped, action: staged.action.action };
      if (staged.action.scope) out.scope = staged.action.scope;
      if (staged.action.params && Object.keys(staged.action.params).length > 0) {
        out.params = staged.action.params;
      }
      return out;
    }
    case 'link':
      return { ...stripped, response_template_id: staged.link.response_template_id || '' };
    case 'inline':
      return { ...stripped, response_template_inline: staged.inline.response_template_inline ?? {} };
    case 'text':
      return { ...stripped, response_text: staged.text.response_text || '' };
    default:
      return stripped;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ButtonDispatchEditor.jsx
git commit -m "feat: add ButtonDispatchEditor with non-destructive tab switching"
```

---

## Task 12: `ButtonCard` component

**Files:**
- Create: `src/components/ButtonCard.jsx`

- [ ] **Step 1: Write the component**

```jsx
import { useState, useMemo } from 'react';
import ButtonDispatchEditor from './ButtonDispatchEditor';
import HandlebarsExpressionInput from './HandlebarsExpressionInput';
import { validateButton } from '../lib/button-validation';
import { discordBtnClass, discordBtnBase, inputClass, labelClass } from '../lib/styles';

const STYLES = ['primary', 'secondary', 'success', 'danger'];
const APPLIES_TO = ['dm', 'channel', 'webhook', 'any'];
const VISIBLE_TO = ['target', 'admin', 'registered', 'anyone'];

function dispatchSummary(b) {
  if (b.action) return `→ ${b.action}${b.scope ? ` (${b.scope})` : ''}`;
  if (b.response_template_id) return `→ template: ${b.response_template_id}`;
  if (b.response_template_inline != null) return '→ inline template';
  if (b.response_text != null) return '→ plain text';
  return '(no dispatch)';
}

/**
 * Single button — collapsed row (label + style swatch + dispatch summary + reorder/delete)
 * and an expanded form (identity, dispatch, visibility).
 *
 * Props:
 * - button, onChange — controlled
 * - onDelete, onMoveUp, onMoveDown — list controls (functions may be null at endpoints)
 * - actions, actionsError, templates, platform, fields, onJumpTo — passed down
 * - readOnly
 */
export default function ButtonCard({
  button,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  actions,
  actionsError,
  templates,
  platform,
  fields,
  onJumpTo,
  readOnly = false,
}) {
  const [expanded, setExpanded] = useState(false);

  const errors = useMemo(() => validateButton(button).errors, [button]);
  const styleClass = discordBtnClass[button.style || 'secondary'];

  const updateField = (key, value) => {
    const next = { ...button };
    if (value === '' || value === undefined) delete next[key];
    else next[key] = value;
    onChange(next);
  };

  return (
    <div className={`bg-gray-800 border rounded mb-1.5 ${expanded ? 'border-gray-600' : 'border-gray-700'}`}>
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-gray-750"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-gray-500 text-xs shrink-0">{expanded ? '▼' : '▶'}</span>
        <span className={`${discordBtnBase} ${styleClass} text-xs py-0.5 px-2 min-w-0`}>
          {button.label || '(unnamed)'}
        </span>
        <span className="text-gray-500 text-xs truncate">{dispatchSummary(button)}</span>
        {errors.length > 0 && (
          <span className="text-red-400 text-[10px]" title={errors.join('\n')}>
            {errors.length} issue{errors.length === 1 ? '' : 's'}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          {!readOnly && onMoveUp && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
              className="text-gray-500 hover:text-gray-300 text-xs px-1"
              title="Move up"
            >▲</button>
          )}
          {!readOnly && onMoveDown && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
              className="text-gray-500 hover:text-gray-300 text-xs px-1"
              title="Move down"
            >▼</button>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-gray-600 hover:text-red-400 text-xs px-1"
              title="Delete button"
            >✕</button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-2.5 pb-2.5 border-t border-gray-700 pt-2 space-y-3">
          <div className="border border-gray-700 rounded p-2 space-y-2">
            <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Identity</div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className={labelClass}>id (used in custom_id)</label>
                <input
                  className={inputClass}
                  disabled={readOnly}
                  value={button.id || ''}
                  onChange={(e) => updateField('id', e.target.value)}
                />
              </div>
              <div className="w-40">
                <label className={labelClass}>Style</label>
                <select
                  className={inputClass}
                  disabled={readOnly}
                  value={button.style || 'secondary'}
                  onChange={(e) => updateField('style', e.target.value)}
                >
                  {STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>Label (Handlebars)</label>
              <HandlebarsExpressionInput
                value={button.label || ''}
                onChange={(v) => updateField('label', v)}
                fields={fields}
                placeholder="Mute {{name}}"
              />
            </div>
          </div>

          <ButtonDispatchEditor
            button={button}
            onChange={onChange}
            actions={actions}
            actionsError={actionsError}
            templates={templates}
            platform={platform}
            onJumpTo={onJumpTo}
            readOnly={readOnly}
          />

          <div className="border border-gray-700 rounded p-2 space-y-2">
            <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Visibility & targeting</div>
            <div>
              <label className={labelClass}>applies_to</label>
              <div className="flex gap-2 flex-wrap">
                {APPLIES_TO.map((v) => {
                  const checked = Array.isArray(button.applies_to) && button.applies_to.includes(v);
                  return (
                    <label key={v} className="flex items-center gap-1 text-xs text-gray-300">
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={checked}
                        onChange={() => {
                          const cur = Array.isArray(button.applies_to) ? button.applies_to : [];
                          const next = checked ? cur.filter((x) => x !== v) : [...cur, v];
                          updateField('applies_to', next.length > 0 ? next : undefined);
                        }}
                      />
                      {v}
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <label className={labelClass}>show_if (Handlebars expression)</label>
              <HandlebarsExpressionInput
                value={button.show_if || ''}
                onChange={(v) => updateField('show_if', v)}
                fields={fields}
                placeholder="(gt iv 90)"
              />
            </div>
            <div>
              <label className={labelClass}>visible_to</label>
              <select
                className={inputClass}
                disabled={readOnly}
                value={button.visible_to || 'target'}
                onChange={(e) => updateField('visible_to', e.target.value)}
              >
                {VISIBLE_TO.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="border border-red-700 rounded p-2 bg-red-950/30">
              <div className="text-xs text-red-400 font-semibold uppercase tracking-wide mb-1">Issues</div>
              <ul className="text-xs text-red-300 list-disc pl-4 space-y-0.5">
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ButtonCard.jsx
git commit -m "feat: add ButtonCard with expand/collapse, dispatch, validation"
```

---

## Task 13: `ButtonsEditor` component

**Files:**
- Create: `src/components/ButtonsEditor.jsx`

- [ ] **Step 1: Write the component**

```jsx
import { useState, useMemo } from 'react';
import ButtonCard from './ButtonCard';
import { validateButtons } from '../lib/button-validation';

const MAX_BUTTONS = 25; // 5 rows × 5 buttons

const NEW_BUTTON_TEMPLATE = {
  id: 'new-button',
  label: 'New button',
  style: 'secondary',
  action: 'redeliver',
};

/**
 * Top-level collapsible "Buttons" section for a DTS entry.
 *
 * Props:
 * - buttons — Array<ButtonDef> or undefined
 * - onChange — (newButtons: ButtonDef[]) => void
 * - actions, actionsError, templates, platform, fields, onJumpTo — passed down
 * - readOnly — when true, hides add/reorder/delete and disables card inputs
 * - snapshotsEnabled — when false, shows the "buttons disabled" banner
 */
export default function ButtonsEditor({
  buttons,
  onChange,
  actions,
  actionsError,
  templates,
  platform,
  fields,
  onJumpTo,
  readOnly = false,
  snapshotsEnabled = true,
}) {
  const list = Array.isArray(buttons) ? buttons : [];
  const [expanded, setExpanded] = useState(list.length > 0);
  const { perButton, listErrors } = useMemo(() => validateButtons(list), [list]);
  const totalIssues = perButton.reduce((acc, errs) => acc + errs.length, 0) + listErrors.length;

  const updateAt = (idx, next) => {
    const updated = [...list];
    updated[idx] = next;
    onChange(updated);
  };
  const deleteAt = (idx) => {
    const updated = list.filter((_, i) => i !== idx);
    onChange(updated);
  };
  const move = (idx, delta) => {
    const target = idx + delta;
    if (target < 0 || target >= list.length) return;
    const updated = [...list];
    [updated[idx], updated[target]] = [updated[target], updated[idx]];
    onChange(updated);
  };
  const add = () => {
    if (list.length >= MAX_BUTTONS) return;
    const id = uniqueId(list, NEW_BUTTON_TEMPLATE.id);
    onChange([...list, { ...NEW_BUTTON_TEMPLATE, id }]);
  };

  return (
    <div className="border-t border-gray-700">
      <div
        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-850 text-sm"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-gray-500 text-xs">{expanded ? '▼' : '▶'}</span>
        <span className="text-gray-200 font-medium">Buttons ({list.length})</span>
        {readOnly && (
          <span className="text-[10px] uppercase tracking-wider text-purple-400">Read-only</span>
        )}
        {totalIssues > 0 && (
          <span className="text-[10px] text-red-400">
            {totalIssues} issue{totalIssues === 1 ? '' : 's'}
          </span>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); add(); }}
            disabled={list.length >= MAX_BUTTONS}
            className="ml-auto text-xs px-2 py-0.5 rounded bg-blue-900/40 hover:bg-blue-900/60 text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + Add ({list.length}/{MAX_BUTTONS})
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-3 py-2 space-y-2">
          {!snapshotsEnabled && list.length > 0 && (
            <div className="border border-yellow-700/60 bg-yellow-900/20 rounded p-2 text-xs text-yellow-200">
              Buttons are configured but disabled — set <code>[snapshots] enabled = true</code> to activate them.
            </div>
          )}

          {listErrors.length > 0 && (
            <div className="border border-red-700 bg-red-950/30 rounded p-2 text-xs text-red-300">
              <ul className="list-disc pl-4 space-y-0.5">
                {listErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {list.length === 0 ? (
            <div className="text-xs text-gray-500 italic">No buttons yet.</div>
          ) : (
            list.map((b, i) => (
              <ButtonCard
                key={i}
                button={b}
                onChange={(next) => updateAt(i, next)}
                onDelete={() => deleteAt(i)}
                onMoveUp={i > 0 ? () => move(i, -1) : null}
                onMoveDown={i < list.length - 1 ? () => move(i, 1) : null}
                actions={actions}
                actionsError={actionsError}
                templates={templates}
                platform={platform}
                fields={fields}
                onJumpTo={onJumpTo}
                readOnly={readOnly}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function uniqueId(list, base) {
  const taken = new Set(list.map((b) => b.id));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ButtonsEditor.jsx
git commit -m "feat: add ButtonsEditor with reorder, delete, 25-button cap"
```

---

## Task 14: Compose `ButtonsEditor` + format badge in `TemplateEditor`

**Files:**
- Modify: `src/components/TemplateEditor.jsx`

- [ ] **Step 1: Replace the slim wrapper with the full composition**

Replace the entire body of `src/components/TemplateEditor.jsx`:

```jsx
import TemplateBodyEditor from './TemplateBodyEditor';
import ButtonsEditor from './ButtonsEditor';

function FormatBadge({ format }) {
  if (!format) return null;
  const color = format === 'toml'
    ? 'bg-purple-900/40 text-purple-300 border-purple-700'
    : 'bg-gray-800 text-gray-400 border-gray-700';
  return (
    <span className={`text-[10px] font-mono uppercase border rounded px-1.5 py-0.5 ${color}`}>
      {format}
    </span>
  );
}

/**
 * Top-level editor for a DTS entry. Composes TemplateBodyEditor + ButtonsEditor
 * with a sourceFormat badge.
 */
export default function TemplateEditor({
  template,
  templateFileContent,
  onChange,
  onFileContentChange,
  platform,
  entry,
  onButtonsChange,
  actions,
  actionsError,
  templates,
  fields,
  onJumpToTemplate,
  snapshotsEnabled = true,
}) {
  const readOnly = entry?.readonly === true;
  return (
    <div className="flex flex-col h-full">
      {(entry?.sourceFormat || readOnly) && (
        <div className="flex items-center gap-2 px-3 py-1 border-b border-gray-700">
          <FormatBadge format={entry?.sourceFormat} />
          {entry?.sourceFile && (
            <span className="text-[10px] text-gray-500 font-mono truncate" title={entry.sourceFile}>
              {entry.sourceFile}
            </span>
          )}
          {readOnly && (
            <span className="text-[10px] uppercase tracking-wider text-purple-400 ml-auto">
              Read-only (fallback)
            </span>
          )}
        </div>
      )}
      <div className="flex-1 min-h-0">
        <TemplateBodyEditor
          template={template}
          templateFileContent={templateFileContent}
          onChange={onChange}
          onFileContentChange={onFileContentChange}
          platform={platform}
          readOnly={readOnly}
        />
      </div>
      <ButtonsEditor
        buttons={entry?.buttons}
        onChange={onButtonsChange}
        actions={actions || []}
        actionsError={actionsError}
        templates={templates || []}
        platform={platform}
        fields={fields || []}
        onJumpTo={onJumpToTemplate}
        readOnly={readOnly}
        snapshotsEnabled={snapshotsEnabled}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TemplateEditor.jsx
git commit -m "feat: compose ButtonsEditor and format badge in TemplateEditor"
```

---

## Task 15: Wire `useActions` and pass props in `App.jsx`

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Import the hook**

Add to the top of `src/App.jsx` (with the other hook imports):

```js
import { useActions } from './hooks/useActions';
```

- [ ] **Step 2: Instantiate it alongside the existing hooks**

In the component body, near where `const config = useConfig(...)` and `const dts = useDts()` are declared, add:

```js
  const actions = useActions();
```

- [ ] **Step 3: Load on connect**

Inside `handleConnect`, after the `getTemplates()` block (around line 184), add:

```js
      try {
        await actions.load(client);
      } catch (err) {
        console.error('Failed to load action registry:', err);
      }
```

Also reset on disconnect — find the existing disconnect/reset path (search for `setApiFields(null)` around line 100). Add `actions.reset();` next to those calls.

- [ ] **Step 4: Compute snapshotsEnabled and pass everything down**

Find the `<TemplateEditor` JSX usage (around line 401-402) and replace it with:

```jsx
              <TemplateEditor
                template={dts.currentTemplate?.template}
                templateFileContent={dts.currentTemplate?.templateFileContent}
                onChange={dts.updateTemplate}
                onFileContentChange={dts.updateTemplateFileContent}
                platform={dts.filters.platform}
                entry={dts.currentTemplate}
                onButtonsChange={dts.updateButtons}
                actions={actions.actions}
                actionsError={actions.error}
                templates={dts.templates}
                fields={apiFields}
                onJumpToTemplate={dts.selectTemplate}
                snapshotsEnabled={config.values?.snapshots?.enabled !== false}
              />
```

Note: `snapshotsEnabled` defaults to `true` until config values are loaded (avoids a false-positive warning during initial connect before the config tab has been opened). If the operator hasn't loaded config yet, we don't know — and crying wolf is worse than silence.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire useActions and pass buttons/actions props to TemplateEditor"
```

---

## Task 16: Merge rendered `__buttons` into preview data

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Pull `renderButtons` from useHandlebars**

Find the existing destructuring of `useHandlebars` (search for `useHandlebars(`). It currently destructures `render, renderError, setPartials, setEmojis`. Change it to also pull `renderButtons`:

```js
  const { render, renderButtons, renderError, setPartials, setEmojis } = useHandlebars();
```

- [ ] **Step 2: Attach `__buttons` to `renderedData`**

Find the `renderedData` `useMemo` (around lines 144-165). Replace it with:

```jsx
  const renderedData = useMemo(() => {
    if (!activeTestData || Object.keys(activeTestData).length === 0) return {};

    let body;
    if (dts.currentTemplate?.templateFileContent != null) {
      try {
        body = render(null, activeTestData, dts.filters.platform, dts.currentTemplate.templateFileContent) || {};
      } catch (err) {
        console.error('Render error (templateFile):', err);
        body = {};
      }
    } else if (dts.currentTemplate?.template) {
      try {
        body = render(dts.currentTemplate.template, activeTestData, dts.filters.platform) || {};
      } catch (err) {
        console.error('Render error:', err);
        body = {};
      }
    } else {
      body = {};
    }

    const rendered = renderButtons(dts.currentTemplate?.buttons, activeTestData, dts.filters.platform);
    if (rendered.length > 0) body = { ...body, __buttons: rendered };
    return body;
  }, [dts.currentTemplate, activeTestData, render, renderButtons, dts.filters.platform]);
```

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: merge rendered __buttons into preview data"
```

---

## Task 17: Render action row in `DiscordView`

**Files:**
- Modify: `src/components/discordview.jsx`

- [ ] **Step 1: Add the action-row renderer**

In `src/components/discordview.jsx`, find the `DiscordView` component (around line 113). After the existing embeds rendering block (around line 154, the `embeds && embeds.map(...)` line), insert the action row:

```jsx
              {embed ? (
                <Embed {...embed} />
              ) : (
                embeds &&
                embeds.map((e, i) => <Embed key={i} {...e} />)
              )}
              <DiscordActionRows buttons={data.__buttons} />
```

- [ ] **Step 2: Add the `DiscordActionRows` helper component**

Inside the same file, define `DiscordActionRows` near the other internal components (e.g., right above `DiscordView`):

```jsx
import { discordBtnBase, discordBtnClass } from '../lib/styles';

function DiscordActionRows({ buttons }) {
  if (!Array.isArray(buttons) || buttons.length === 0) return null;
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) rows.push(buttons.slice(i, i + 5));
  return (
    <div className="mt-2 space-y-1.5">
      {rows.map((row, ri) => (
        <div key={ri} className="flex flex-wrap gap-1.5">
          {row.map((b) => (
            <span
              key={b.id}
              className={`${discordBtnBase} ${discordBtnClass[b.style] || discordBtnClass.secondary}`}
            >
              {b.label}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
```

(If `discordview.jsx` already has its own imports at the top, merge the `discordBtnBase, discordBtnClass` import into the existing styles import line instead of duplicating.)

- [ ] **Step 3: Commit**

```bash
git add src/components/discordview.jsx
git commit -m "feat: render Discord action rows from __buttons in preview"
```

---

## Task 18: Format badge in `TemplateSelector`

**Files:**
- Modify: `src/components/TemplateSelector.jsx`

- [ ] **Step 1: Add the badge inside the entry row**

In `src/components/TemplateSelector.jsx`, find the entry-row `<button>` (around lines 138-167). Add a small badge after the platform/language spans and before the `t.name` span. Insert right after the language span (line 154-156):

```jsx
                      {t.sourceFormat && (
                        <span
                          className={`text-[9px] font-mono uppercase border rounded px-1 shrink-0 ${
                            t.sourceFormat === 'toml'
                              ? 'border-purple-700 text-purple-300'
                              : 'border-gray-700 text-gray-500'
                          }`}
                          title={t.sourceFile || ''}
                        >
                          {t.sourceFormat}
                        </span>
                      )}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TemplateSelector.jsx
git commit -m "feat: show sourceFormat badge per entry in TemplateSelector"
```

---

## Task 19: TOML save warning toast in `handleSave`

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Append the TOML warning to the save success path**

Find `handleSave` (around lines 317-354). In the inline-template POST success branch (the `alert(\`Saved to PoracleNG ...\`)` line, around line 350), replace just that alert with:

```jsx
      let msg = `Saved to PoracleNG (${result.saved || 0} template${result.saved !== 1 ? 's' : ''})`;
      if (dts.currentTemplate.sourceFormat === 'toml') {
        msg += '\n\nTOML notice: comments and key order may be lost in the round-trip. ' +
               'The previous version was backed up to config/backups/.';
      }
      alert(msg);
```

(Using `alert` matches the surrounding pattern. A nicer toast system can be a future cleanup; not in scope.)

- [ ] **Step 2: Commit**

```bash
git add src/App.jsx
git commit -m "feat: warn on save when entry came from TOML"
```

---

## Task 20: Build, manual verification, and final smoke test

**Files:** None modified — verification only.

- [ ] **Step 1: Run unit tests**

Run: `npx vitest run`
Expected: all tests pass (excluding the pre-existing `returns null for invalid JSON output` failure unrelated to this work — that's noted as pre-existing).

- [ ] **Step 2: Run the dev server**

Run: `npm run dev` (background or separate terminal). Open the URL it prints.

- [ ] **Step 3: Connect to a PoracleNG instance running `buttons-and-snapshots`**

Use the ConnectScreen with a live PoracleNG instance.

- [ ] **Step 4: Verify the editor surfaces**

Confirm each item below. Note observations after each.

- [ ] Templates tab: pick any JSON entry. The TemplateBodyEditor (Form/Raw) still works identically.
- [ ] Templates tab: pick any TOML-sourced entry. A purple `TOML` badge shows in the editor header and in the selector row.
- [ ] Buttons section is visible below the template body editor, collapsed by default if no buttons exist, expanded otherwise.
- [ ] Click "+ Add" on the Buttons section. A new button appears with default `id`, label, and `action: redeliver`. Counter shows `1/25`.
- [ ] Expand the button. Edit the label to `Mute {{name}}` using the field picker. Live preview shows a Discord-style action row beneath the embed with the rendered label.
- [ ] Switch dispatch tab from Action → Inline template. Type something into the inline editor. Switch back to Action. Switch back to Inline template — your text is still there (non-destructive switching).
- [ ] Set `action: mute` without scope. A validation error appears under the card.
- [ ] Set `scope: gym`. The error clears.
- [ ] Add a `show_if` of `(gt iv 90)` with test data IV=95. Button stays visible. Switch to test data with IV=50. Button disappears from preview.
- [ ] Add 5 buttons total. Preview shows them in one row.
- [ ] Add 6th button. Preview wraps to a second row of 1 button.
- [ ] Add buttons up to 25. The "+ Add" button disables; counter reads `25/25`.
- [ ] Pick a `readonly: true` entry (a fallback entry). Buttons section shows existing buttons but the Add button is hidden, cards have no reorder/delete affordances, and inputs are disabled.
- [ ] Open the Config tab. The `Snapshots` section appears in the sidebar with the `enabled` toggle visible. Set it to `false`. Go back to a template with buttons — the yellow "Buttons are configured but disabled" banner appears.
- [ ] On a TOML-sourced entry, click Save. The success alert includes the "TOML notice: comments and key order may be lost" message.
- [ ] On a JSON-sourced entry, click Save. The success alert is the plain success text (no TOML notice).
- [ ] If snapshots is disabled in config, `/api/dts/actions` returns 503. The action dropdown still works using the fallback names; no errors crash the UI.

- [ ] **Step 5: Stop the dev server.**

- [ ] **Step 6: Final commit if any of Steps 1-4 surfaced fixes**

If no fixes were needed, skip. Otherwise:

```bash
git add -p   # selectively stage just the fixes
git commit -m "fix: <describe smoke-test follow-up>"
```

---

## Out of scope for this plan

- Snapshot inspector panel (`GET /api/snapshots/:messageID`) — deferred per the spec.
- Replacement of `alert()` with a proper toast component — incidental UX cleanup, not scoped here.
- Pre-existing test failure in `handlebars-helpers.test.js` (`renders null for invalid JSON output`) — unrelated.
