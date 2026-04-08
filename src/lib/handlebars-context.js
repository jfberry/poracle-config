/**
 * Parse handlebars text to determine which block helper the cursor is inside.
 *
 * Returns null if not inside a block, or an object:
 *   { helper: 'each', arg: 'pvpGreat', depth: 1 }
 *   { helper: 'pokemon', arg: 'pokemonId', depth: 1 }
 */
export function detectBlockContext(text, cursorPos) {
  const before = text.substring(0, cursorPos);

  // Find all block opens and closes before cursor
  // Match {{#helper arg}} and {{/helper}}
  const openRe = /\{\{#(\w+)\s+([^}]*?)\}\}/g;
  const closeRe = /\{\{\/(\w+)\}\}/g;

  // Build a stack of open blocks
  const stack = [];

  // Interleave opens and closes by position
  const events = [];

  let match;
  while ((match = openRe.exec(before)) !== null) {
    events.push({ type: 'open', helper: match[1], arg: match[2].trim(), pos: match.index });
  }
  while ((match = closeRe.exec(before)) !== null) {
    events.push({ type: 'close', helper: match[1], pos: match.index });
  }

  // Sort by position
  events.sort((a, b) => a.pos - b.pos);

  // Process events to build stack
  for (const event of events) {
    if (event.type === 'open') {
      stack.push({ helper: event.helper, arg: event.arg });
    } else if (event.type === 'close') {
      // Pop the matching open (search from top)
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].helper === event.helper) {
          stack.splice(i, 1);
          break;
        }
      }
    }
  }

  // The top of the stack is our current block context
  if (stack.length === 0) return null;

  const top = stack[stack.length - 1];
  return {
    helper: top.helper,
    arg: top.arg,
    depth: stack.length,
  };
}

/**
 * Generate an {{#each field}}...{{/each}} snippet for an iterable field.
 * Includes common sub-fields as a template.
 */
export function generateEachSnippet(fieldName, scopeFields) {
  if (!scopeFields || scopeFields.length === 0) {
    return `{{#each ${fieldName}}}{{this}}{{#unless isLast}}, {{/unless}}{{/each}}`;
  }

  // Pick a few key fields to include in the template
  const keyFields = scopeFields
    .filter((f) => f.preferred || ['rank', 'cp', 'name', 'fullName', 'value'].includes(f.name))
    .slice(0, 4);

  if (keyFields.length === 0) {
    return `{{#each ${fieldName}}}{{this}}{{#unless isLast}}, {{/unless}}{{/each}}`;
  }

  const body = keyFields.map((f) => `{{${f.name}}}`).join(' ');
  return `{{#each ${fieldName}}}${body}{{#unless isLast}}, {{/unless}}{{/each}}`;
}

/**
 * Generate a {{#pokemon id form}}...{{/pokemon}} snippet.
 */
export function generatePokemonSnippet() {
  return '{{#pokemon pokemonId formId}}{{fullName}} {{typeEmoji}}{{/pokemon}}';
}

/**
 * Generate a {{#getPowerUpCost start end}}...{{/getPowerUpCost}} snippet.
 */
export function generatePowerUpCostSnippet() {
  return '{{#getPowerUpCost level 50}}{{stardust}} dust, {{candy}} candy{{/getPowerUpCost}}';
}
