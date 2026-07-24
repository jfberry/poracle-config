import { useState, useMemo } from 'react';
import ButtonDispatchEditor from './ButtonDispatchEditor';
import HandlebarsExpressionInput from './HandlebarsExpressionInput';
import { validateButton } from '../lib/button-validation';
import { discordBtnClass, discordBtnBase, inputClass, labelClass } from '../lib/styles';

const STYLES = ['primary', 'secondary', 'success', 'danger'];
const APPLIES_TO = ['dm', 'channel', 'webhook', 'any'];
const VISIBLE_TO = [
  { value: 'anyone',     description: 'Anyone with view permission on the message can click.' },
  { value: 'registered', description: 'Clicker must be a registered Poracle user.' },
  { value: 'admin',      description: 'Listed in [discord] admins. On DM destinations the button is hidden for non-admin recipients.' },
];

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
  actionsReason,
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
            actionsReason={actionsReason}
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
                value={button.visible_to || 'anyone'}
                onChange={(e) => updateField('visible_to', e.target.value)}
              >
                {VISIBLE_TO.map((v) => <option key={v.value} value={v.value}>{v.value}</option>)}
              </select>
              <div className="text-[10px] text-gray-500 mt-1">
                {VISIBLE_TO.find((v) => v.value === (button.visible_to || 'anyone'))?.description}
              </div>
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
