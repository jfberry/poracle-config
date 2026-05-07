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
