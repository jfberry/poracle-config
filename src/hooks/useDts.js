import { useState, useCallback, useMemo } from 'react';
import { defaultTemplates, getDefaultTemplate } from '../data/default-dts';
import { getTestScenario, getTestScenarioNames } from '../data/test-data';

export function useDts() {
  const [templates, setTemplates] = useState(defaultTemplates);
  const [filters, setFilters] = useState({
    type: 'monster',
    platform: 'discord',
    language: 'en',
    id: 'default-monster',
  });
  const [testScenario, setTestScenario] = useState('hundo');

  // Find current template: match type+platform+id, prefer matching language but fall back
  const currentTemplate = useMemo(() => {
    // Exact match first
    const exact = templates.find(
      (t) =>
        t.type === filters.type &&
        t.platform === filters.platform &&
        t.language === filters.language &&
        String(t.id) === String(filters.id)
    );
    if (exact) return exact;
    // Match without language (for templates that have language="" or different language)
    const noLang = templates.find(
      (t) =>
        t.type === filters.type &&
        t.platform === filters.platform &&
        String(t.id) === String(filters.id)
    );
    if (noLang) return noLang;
    // Fallback to any template of this type+platform
    const anyId = templates.find(
      (t) => t.type === filters.type && t.platform === filters.platform
    );
    if (anyId) return anyId;
    return getDefaultTemplate(filters.type);
  }, [templates, filters]);

  // Track the index of the current template for reliable updates
  const currentTemplateIndex = useMemo(() => {
    if (!currentTemplate) return -1;
    return templates.indexOf(currentTemplate);
  }, [templates, currentTemplate]);

  const currentTestData = getTestScenario(filters.type, testScenario) || {};

  const availableTypes = useMemo(
    () => [...new Set(templates.map((t) => t.type))],
    [templates]
  );

  const availableIds = useMemo(
    () => [
      ...new Set(
        templates
          .filter((t) => t.type === filters.type && t.platform === filters.platform)
          .map((t) => String(t.id))
      ),
    ],
    [templates, filters.type, filters.platform]
  );

  const availableLanguages = useMemo(
    () => [
      ...new Set(
        templates
          .filter((t) => t.type === filters.type && t.platform === filters.platform)
          .map((t) => t.language || 'en')
      ),
    ],
    [templates, filters.type, filters.platform]
  );

  const availableScenarios = getTestScenarioNames(filters.type);

  const updateTemplate = useCallback(
    (newTemplateObj) => {
      setTemplates((prev) => {
        if (currentTemplateIndex < 0 || currentTemplateIndex >= prev.length) return prev;
        const updated = [...prev];
        updated[currentTemplateIndex] = { ...updated[currentTemplateIndex], template: newTemplateObj };
        return updated;
      });
    },
    [currentTemplateIndex]
  );

  const setFiltersWithAutoId = useCallback(
    (newFilters) => {
      setFilters((prev) => {
        const merged = { ...prev, ...newFilters };
        const typeChanged = merged.type !== prev.type;
        const platformChanged = merged.platform !== prev.platform;

        if (typeChanged || platformChanged) {
          // Auto-select first matching template
          const matches = templates.filter(
            (t) => t.type === merged.type && t.platform === merged.platform
          );
          if (matches.length > 0) {
            merged.id = String(matches[0].id);
            merged.language = matches[0].language || 'en';
          }
        }

        if (typeChanged) {
          // Reset test scenario for new type
          const scenarios = getTestScenarioNames(merged.type);
          if (scenarios.length > 0) {
            setTestScenario(scenarios[0]);
          }
        }

        return merged;
      });
    },
    [templates]
  );

  const loadTemplates = useCallback((entries) => {
    // Normalize IDs to strings, default missing fields
    const normalized = entries
      .filter((e) => e.template || e.templateFile) // skip entries without templates
      .map((e) => ({
        ...e,
        id: String(e.id ?? '1'),
        platform: e.platform || 'discord',
        language: e.language || 'en',
      }));
    if (normalized.length === 0) {
      alert('No valid template entries found in file');
      return;
    }
    setTemplates(normalized);
    const first = normalized[0];
    setFilters({
      type: first.type,
      platform: first.platform,
      language: first.language,
      id: first.id,
    });
    // Set test scenario for the new type
    const scenarios = getTestScenarioNames(first.type);
    if (scenarios.length > 0) {
      setTestScenario(scenarios[0]);
    }
  }, []);

  const selectTemplate = useCallback((template) => {
    setFilters({
      type: template.type,
      platform: template.platform || 'discord',
      language: template.language || 'en',
      id: String(template.id),
    });
    // Reset test scenario for the new type
    const scenarios = getTestScenarioNames(template.type);
    if (scenarios.length > 0) {
      setTestScenario(scenarios[0]);
    }
  }, []);

  return {
    templates, filters, setFilters: setFiltersWithAutoId,
    currentTemplate, currentTestData,
    testScenario, setTestScenario,
    availableTypes, availableIds, availableLanguages, availableScenarios,
    updateTemplate, loadTemplates, selectTemplate,
  };
}
