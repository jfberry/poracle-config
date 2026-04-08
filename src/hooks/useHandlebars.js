import { useState, useMemo, useCallback } from 'react';
import { createEngine, renderDtsTemplate, registerPartials, setEmojiMap } from '../lib/handlebars-engine';

export function useHandlebars() {
  const engine = useMemo(() => createEngine(), []);
  const [renderError, setRenderError] = useState(null);
  // Increment to force consumers to re-render after emoji updates
  const [, setEmojiVersion] = useState(0);

  const render = useCallback(
    (templateObj, data, platform) => {
      try {
        const result = renderDtsTemplate(engine, templateObj, data, platform);
        setRenderError(null);
        return result;
      } catch (err) {
        setRenderError(err.message);
        return null;
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

  return { render, renderError, setPartials, setEmojis };
}
