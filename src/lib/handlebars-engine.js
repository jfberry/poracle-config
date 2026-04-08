import Handlebars from 'handlebars';
import { registerAllHelpers } from './handlebars-helpers';
import { registerGameHelpers, setEmojiMap, getEmojiMap, setActivePlatform } from './handlebars-game-helpers';

export { setEmojiMap, getEmojiMap, setActivePlatform };

export function createEngine() {
  const hbs = Handlebars.create();
  registerAllHelpers(hbs);
  registerGameHelpers(hbs);
  return hbs;
}

/**
 * Register Handlebars partials on the engine.
 * partials is an object: { name: templateString, ... }
 */
export function registerPartials(engine, partials) {
  // Unregister any previously registered partials
  for (const name of Object.keys(engine.partials)) {
    engine.unregisterPartial(name);
  }
  if (partials) {
    for (const [name, template] of Object.entries(partials)) {
      engine.registerPartial(name, template);
    }
  }
}

export function renderTemplate(engine, templateStr, data) {
  const compiled = engine.compile(templateStr, { noEscape: true });
  return compiled(data);
}

export function renderDtsTemplate(engine, templateObj, data, platform) {
  if (platform) setActivePlatform(platform);
  const templateStr = JSON.stringify(templateObj);
  const rendered = renderTemplate(engine, templateStr, data);
  try {
    return JSON.parse(rendered);
  } catch (err) {
    throw new Error(`Template rendered to invalid JSON: ${err.message}\n\nRendered output:\n${rendered.substring(0, 500)}`);
  }
}
