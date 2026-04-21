import { useState, useCallback, useMemo } from 'react';
import { defaultTemplates, getDefaultTemplate } from '../data/default-dts';
import { getTestScenario, getTestScenarioNames } from '../data/test-data';

function normalizeEntries(entries) {
  return entries
    .filter((e) => e.template || e.templateFile || e.templateFileContent)
    .map((e) => ({ ...e, id: String(e.id ?? '1'), platform: e.platform || 'discord', language: e.language ?? '' }));
}

export function useDts() {
  const [templates, setTemplates] = useState(defaultTemplates);
  const [filters, setFilters] = useState({
    type: 'monster',
    platform: 'discord',
    language: 'en',
    id: 'default-monster',
  });
  const [testScenario, setTestScenario] = useState('hundo');

  const resetScenarioForType = useCallback((type) => {
    const scenarios = getTestScenarioNames(type);
    if (scenarios.length > 0) setTestScenario(scenarios[0]);
  }, []);

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
          .map((t) => t.language ?? '')
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

  const updateTemplateFileContent = useCallback(
    (newContent) => {
      setTemplates((prev) => {
        if (currentTemplateIndex < 0 || currentTemplateIndex >= prev.length) return prev;
        const updated = [...prev];
        updated[currentTemplateIndex] = { ...updated[currentTemplateIndex], templateFileContent: newContent };
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
            merged.language = matches[0].language ?? '';
          }
        }

        if (typeChanged) {
          resetScenarioForType(merged.type);
        }

        return merged;
      });
    },
    [templates]
  );

  const loadTemplates = useCallback((entries) => {
    const normalized = normalizeEntries(entries);
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
    resetScenarioForType(first.type);
  }, [resetScenarioForType]);

  const selectTemplate = useCallback((template) => {
    setFilters({
      type: template.type,
      platform: template.platform || 'discord',
      language: template.language ?? '',
      id: String(template.id),
    });
    resetScenarioForType(template.type);
  }, [resetScenarioForType]);

  // Import entries into the current template set (merge, don't replace)
  const importTemplates = useCallback((entries) => {
    const normalized = normalizeEntries(entries);

    setTemplates((prev) => {
      const merged = [...prev];
      for (const entry of normalized) {
        const idx = merged.findIndex(
          (t) =>
            t.type === entry.type &&
            t.platform === entry.platform &&
            t.language === entry.language &&
            String(t.id) === String(entry.id)
        );
        if (idx >= 0) {
          merged[idx] = entry; // Replace existing
        } else {
          merged.push(entry); // Add new
        }
      }
      return merged;
    });

    // Select the first imported entry
    if (normalized.length > 0) {
      const first = normalized[0];
      setFilters({
        type: first.type,
        platform: first.platform,
        language: first.language,
        id: first.id,
      });
      resetScenarioForType(first.type);
    }
  }, [resetScenarioForType]);

  return {
    templates, filters, setFilters: setFiltersWithAutoId,
    currentTemplate, currentTestData,
    testScenario, setTestScenario,
    availableTypes, availableIds, availableLanguages, availableScenarios,
    updateTemplate, updateTemplateFileContent, loadTemplates, importTemplates, selectTemplate,
  };
}
