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
