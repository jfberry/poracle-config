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
