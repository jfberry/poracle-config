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
