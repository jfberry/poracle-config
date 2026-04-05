import { useState, useCallback } from 'react';
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

  const currentTemplate = templates.find(
    (t) =>
      t.type === filters.type &&
      t.platform === filters.platform &&
      t.language === filters.language &&
      String(t.id) === String(filters.id)
  ) || getDefaultTemplate(filters.type);

  const currentTestData = getTestScenario(filters.type, testScenario) || {};

  const availableTypes = [...new Set(templates.map((t) => t.type))];
  const availableIds = [
    ...new Set(
      templates
        .filter((t) => t.type === filters.type && t.platform === filters.platform)
        .map((t) => String(t.id))
    ),
  ];
  const availableScenarios = getTestScenarioNames(filters.type);

  const updateTemplate = useCallback(
    (newTemplateObj) => {
      setTemplates((prev) =>
        prev.map((t) =>
          t.type === filters.type &&
          t.platform === filters.platform &&
          t.language === filters.language &&
          String(t.id) === String(filters.id)
            ? { ...t, template: newTemplateObj }
            : t
        )
      );
    },
    [filters]
  );

  const setFiltersWithAutoId = useCallback(
    (newFilters) => {
      setFilters((prev) => {
        const merged = { ...prev, ...newFilters };
        // When type changes, auto-select first matching template id
        if (merged.type !== prev.type) {
          const firstMatch = templates.find(
            (t) => t.type === merged.type && t.platform === merged.platform
          );
          if (firstMatch) merged.id = String(firstMatch.id);
        }
        return merged;
      });
    },
    [templates]
  );

  const loadTemplates = useCallback((entries) => {
    setTemplates(entries);
    if (entries.length > 0) {
      const first = entries[0];
      setFilters({
        type: first.type,
        platform: first.platform || 'discord',
        language: first.language || 'en',
        id: String(first.id),
      });
    }
  }, []);

  return {
    templates, filters, setFilters: setFiltersWithAutoId,
    currentTemplate, currentTestData,
    testScenario, setTestScenario,
    availableTypes, availableIds, availableScenarios,
    updateTemplate, loadTemplates,
  };
}
