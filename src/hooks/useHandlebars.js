import { useState, useMemo, useCallback } from 'react';
import { createEngine, renderDtsTemplate, renderTemplate, registerPartials, setEmojiMap, setActivePlatform } from '../lib/handlebars-engine';
import { renderButtons as renderButtonsImpl } from '../lib/render-buttons';
import { renderButtonResponse as renderButtonResponseImpl } from '../lib/render-button-response';

export function useHandlebars() {
  const engine = useMemo(() => createEngine(), []);
  // Increment to force consumers to re-render after emoji updates
  const [, setEmojiVersion] = useState(0);

  // Pure: returns { result, error }. Callers render inside a useMemo, so this
  // must NOT set React state (doing so caused render-phase update loops).
  const render = useCallback(
    (templateObj, data, platform, rawTemplateStr) => {
      // Default config-derived variables that aren't part of webhook enrichment.
      // `prefix` is the command prefix — PoracleNG reads it from config (default
      // "!"); help templates use `{{prefix}}` heavily. Real data overrides these.
      const ctx = { prefix: '!', ...(data || {}) };
      try {
        let result;
        if (rawTemplateStr != null) {
          // templateFile mode — render raw Handlebars text then parse as JSON
          if (platform) setActivePlatform(platform);
          const rendered = renderTemplate(engine, rawTemplateStr, ctx);
          try {
            result = JSON.parse(rendered);
          } catch (err) {
            throw new Error(`Template file rendered to invalid JSON: ${err.message}\n\nRendered output:\n${rendered.substring(0, 500)}`);
          }
        } else {
          result = renderDtsTemplate(engine, templateObj, ctx, platform);
        }
        return { result, error: null };
      } catch (err) {
        return { result: null, error: err.message };
      }
    },
    [engine]
  );

  const renderButtons = useCallback(
    (buttons, data, platform) => {
      try {
        return renderButtonsImpl(engine, buttons, data, platform);
      } catch {
        return [];
      }
    },
    [engine]
  );

  const renderButtonResponse = useCallback(
    (button, templates, data, platform) => {
      try {
        return renderButtonResponseImpl(engine, button, templates, data, platform);
      } catch (err) {
        return { kind: 'error', message: err.message || String(err) };
      }
    },
    [engine]
  );

  const setPartials = useCallback(
    (partials) => {
      registerPartials(engine, partials);
    },
    [engine]
  );

  const setEmojis = useCallback((platform, map) => {
    setEmojiMap(platform, map);
    setEmojiVersion((v) => v + 1);
  }, []);

  return { render, renderButtons, renderButtonResponse, setPartials, setEmojis };
}
