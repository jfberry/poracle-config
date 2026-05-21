import { renderTemplate, setActivePlatform } from './handlebars-engine';

/**
 * Resolves a button's configured response into a preview-ready payload.
 *
 * Returns one of:
 *   { kind: 'message', data: <Discord webhook-shaped object> }
 *   { kind: 'action',  label: <human-readable description> }
 *   { kind: 'error',   message: <error string> }
 *   null if the button has no resolvable response
 */
export function renderButtonResponse(engine, button, templates, data, platform) {
  if (!button) return null;
  if (platform) setActivePlatform(platform);

  // Action dispatch — no message, just an info chip.
  if (button.action) {
    const parts = [`Action: ${button.action}`];
    if (button.scope) parts.push(`scope: ${button.scope}`);
    if (button.params && Object.keys(button.params).length > 0) {
      parts.push('params: ' + Object.entries(button.params).map(([k, v]) => `${k}=${v}`).join(', '));
    }
    return { kind: 'action', label: parts.join(' · ') };
  }

  // Linked template
  if (button.response_template_id) {
    const linked = pickLinkedTemplate(templates, button.response_template_id, platform);
    if (!linked) {
      return { kind: 'error', message: `Linked template "${button.response_template_id}" not found.` };
    }
    return renderTemplatePayload(engine, linked.template ?? linked.templateFileContent, data);
  }

  // Inline template
  if (button.response_template_inline != null) {
    return renderTemplatePayload(engine, button.response_template_inline, data);
  }

  // Plain text
  if (button.response_text != null) {
    try {
      const content = renderTemplate(engine, String(button.response_text), data);
      return { kind: 'message', data: { content } };
    } catch (err) {
      return { kind: 'error', message: `Plain-text render failed: ${err.message}` };
    }
  }

  return null;
}

function pickLinkedTemplate(templates, id, platform) {
  const candidates = templates.filter((t) => t.type === 'buttonResponse' && String(t.id) === String(id));
  if (candidates.length === 0) return null;
  return candidates.find((t) => t.platform === platform) ?? candidates[0];
}

function renderTemplatePayload(engine, body, data) {
  if (body == null) return { kind: 'error', message: 'Response template has no body.' };
  // Object — render each leaf string through the engine.
  if (typeof body === 'object') {
    try {
      const rendered = renderObjectLeaves(engine, body, data);
      return { kind: 'message', data: rendered };
    } catch (err) {
      return { kind: 'error', message: `Render failed: ${err.message}` };
    }
  }
  // String — render then attempt JSON.parse.
  try {
    const out = renderTemplate(engine, String(body), data);
    try {
      return { kind: 'message', data: JSON.parse(out) };
    } catch {
      // Not JSON — treat as plain content
      return { kind: 'message', data: { content: out } };
    }
  } catch (err) {
    return { kind: 'error', message: `Render failed: ${err.message}` };
  }
}

function renderObjectLeaves(engine, value, data) {
  if (value == null) return value;
  if (typeof value === 'string') return renderTemplate(engine, value, data);
  if (Array.isArray(value)) return value.map((v) => renderObjectLeaves(engine, v, data));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = renderObjectLeaves(engine, v, data);
    return out;
  }
  return value;
}
