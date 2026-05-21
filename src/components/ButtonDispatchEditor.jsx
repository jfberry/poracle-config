import { useState, useEffect } from 'react';
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
  actionsReason,
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

  // When the parent button reference changes (e.g. via identity edit),
  // re-seed the inactive tabs' staged values from the new prop. Don't
  // touch the active tab — it's the source of truth for in-flight edits.
  useEffect(() => {
    setStaged((prev) => {
      const next = { ...prev };
      if (activeTab !== 'action') {
        next.action = {
          action: button.action ?? 'redeliver',
          scope: button.scope,
          params: button.params || {},
        };
      }
      if (activeTab !== 'link') {
        next.link = { response_template_id: button.response_template_id ?? '' };
      }
      if (activeTab !== 'inline') {
        next.inline = { response_template_inline: button.response_template_inline ?? {} };
      }
      if (activeTab !== 'text') {
        next.text = { response_text: button.response_text ?? '' };
      }
      return next;
    });
  }, [button, activeTab]);

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
              Action registry unavailable
              {actionsReason === 'snapshots-disabled' && ' — enable [snapshots] in config to load action metadata.'}
              {actionsReason === 'older-poracleng' && ' — this PoracleNG version does not expose /api/dts/actions; consider upgrading.'}
              {actionsReason === 'network' && actionsError ? ` (${actionsError})` : ''}
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
            {typeof staged.inline.response_template_inline === 'string' ? (
              <TemplateBodyEditor
                templateFileContent={staged.inline.response_template_inline}
                platform={platform}
                readOnly={readOnly}
                onFileContentChange={(text) =>
                  writeActive({ response_template_inline: text })
                }
              />
            ) : (
              <TemplateBodyEditor
                template={staged.inline.response_template_inline || {}}
                platform={platform}
                readOnly={readOnly}
                onChange={(next) => writeActive({ response_template_inline: next })}
              />
            )}
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
    case 'link': {
      const v = staged.link.response_template_id;
      return v ? { ...stripped, response_template_id: v } : stripped;
    }
    case 'inline': {
      const v = staged.inline.response_template_inline;
      // Object: always include (an empty object is a valid editing state).
      // String: only include if non-empty.
      if (typeof v === 'string') {
        return v ? { ...stripped, response_template_inline: v } : stripped;
      }
      return { ...stripped, response_template_inline: v ?? {} };
    }
    case 'text': {
      const v = staged.text.response_text;
      return v ? { ...stripped, response_text: v } : stripped;
    }
    default:
      return stripped;
  }
}
