import Handlebars from 'handlebars';
import { registerAllHelpers } from './handlebars-helpers';
import { registerGameHelpers } from './handlebars-game-helpers';

export function createEngine() {
  const hbs = Handlebars.create();
  registerAllHelpers(hbs);
  registerGameHelpers(hbs);
  return hbs;
}

export function renderTemplate(engine, templateStr, data) {
  const compiled = engine.compile(templateStr, { noEscape: true });
  return compiled(data);
}

export function renderDtsTemplate(engine, templateObj, data) {
  const templateStr = JSON.stringify(templateObj);
  const rendered = renderTemplate(engine, templateStr, data);
  try {
    return JSON.parse(rendered);
  } catch {
    return null;
  }
}
