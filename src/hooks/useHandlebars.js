import { useState, useMemo, useCallback } from 'react';
import { createEngine, renderDtsTemplate, renderTemplate, registerPartials, setEmojiMap, setActivePlatform } from '../lib/handlebars-engine';
import { renderButtons as renderButtonsImpl } from '../lib/render-buttons';
import { renderButtonResponse as renderButtonResponseImpl } from '../lib/render-button-response';

export function useHandlebars() {
  const engine = useMemo(() => createEngine(), []);
  const [renderError, setRenderError] = useState(null);
  // Increment to force consumers to re-render after emoji updates
  const [, setEmojiVersion] = useState(0);

  const render = useCallback(
    (templateObj, data, platform, rawTemplateStr) => {
      try {
        let result;
        if (rawTemplateStr != null) {
          // templateFile mode — render raw Handlebars text then parse as JSON
          if (platform) setActivePlatform(platform);
          const rendered = renderTemplate(engine, rawTemplateStr, data);
          try {
            result = JSON.parse(rendered);
          } catch (err) {
            throw new Error(`Template file rendered to invalid JSON: ${err.message}\n\nRendered output:\n${rendered.substring(0, 500)}`);
          }
        } else {
          result = renderDtsTemplate(engine, templateObj, data, platform);
        }
        setRenderError(null);
        return result;
      } catch (err) {
        setRenderError(err.message);
        return null;
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

  return { render, renderButtons, renderButtonResponse, renderError, setPartials, setEmojis };
}
