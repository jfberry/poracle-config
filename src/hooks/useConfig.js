import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

export function useConfig(apiClient) {
  const [schema, setSchema] = useState(null); // array of sections
  const [values, setValues] = useState({}); // {sectionName: {field: value}}
  const [originalValues, setOriginalValues] = useState({}); // snapshot at load
  const [activeSection, setActiveSection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saveResult, setSaveResult] = useState(null);
  const [geofenceAreas, setGeofenceAreas] = useState([]);
  const [overriddenFields, setOverriddenFields] = useState(new Set());
  const resolveCache = useRef(new Map());

  // Fetch schema and values
  const load = useCallback(async () => {
    if (!apiClient) return;
    resolveCache.current.clear();
    setLoading(true);
    setError(null);
    try {
      const [schemaRes, valuesRes] = await Promise.all([
        apiClient.getConfigSchema(),
        apiClient.getConfigValues(),
      ]);
      const sections = schemaRes.sections || [];
      setSchema(sections);
      setValues(valuesRes.values || {});
      setOriginalValues(JSON.parse(JSON.stringify(valuesRes.values || {})));
      setOverriddenFields(new Set(valuesRes.overridden || []));
      if (sections.length > 0) {
        setActiveSection((prev) => prev || sections[0].name);
      }
      try {
        const geo = await apiClient.getGeofenceAll();
        const areas = Array.isArray(geo)
          ? geo
          : (geo.geofences || geo.areas || geo.geofence || []);
        const names = areas
          .map((a) => (typeof a === 'string' ? a : (a?.name || a?.id)))
          .filter(Boolean);
        setGeofenceAreas(names);
      } catch {
        setGeofenceAreas([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  // Update a single field value
  const updateField = useCallback((section, field, value) => {
    setValues((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  }, []);

  // Compute dirty fields (changed from original)
  const dirtyFields = useMemo(() => {
    const dirty = {};
    let count = 0;
    for (const section of Object.keys(values)) {
      const orig = originalValues[section] || {};
      const curr = values[section] || {};
      const sectionDirty = {};
      for (const field of Object.keys(curr)) {
        if (JSON.stringify(curr[field]) !== JSON.stringify(orig[field])) {
          // Skip sensitive fields that are still masked
          if (curr[field] === '****') continue;
          sectionDirty[field] = curr[field];
          count++;
        }
      }
      if (Object.keys(sectionDirty).length > 0) {
        dirty[section] = sectionDirty;
      }
    }
    return { dirty, count };
  }, [values, originalValues]);

  // Check which dirty sections have fields requiring restart
  const restartRequired = useMemo(() => {
    if (!schema || dirtyFields.count === 0) return { required: false, fields: [] };
    const fields = [];
    for (const section of schema) {
      if (!dirtyFields.dirty[section.name]) continue;
      for (const field of section.fields) {
        if (dirtyFields.dirty[section.name][field.name] !== undefined && !field.hotReload) {
          fields.push(`${section.name}.${field.name}`);
        }
      }
    }
    return { required: fields.length > 0, fields };
  }, [schema, dirtyFields]);

  // Which sections have dirty fields (for sidebar dots)
  const dirtySections = useMemo(() => {
    return new Set(Object.keys(dirtyFields.dirty));
  }, [dirtyFields]);

  // Save dirty fields
  const save = useCallback(async () => {
    if (!apiClient || dirtyFields.count === 0) return;
    setSaveResult(null);
    try {
      const result = await apiClient.saveConfigValues(dirtyFields.dirty);
      setSaveResult(result);
      // Update original values to reflect saved state
      setOriginalValues(JSON.parse(JSON.stringify(values)));
      return result;
    } catch (err) {
      setSaveResult({ status: 'error', message: err.message });
      throw err;
    }
  }, [apiClient, dirtyFields, values]);

  // Migrate config.toml to overrides.json
  const migrate = useCallback(async () => {
    if (!apiClient) throw new Error('Not connected');
    const result = await apiClient.migrateConfig();
    await load();
    return result;
  }, [apiClient, load]);

  // Resolve IDs — batch resolve and cache
  const resolveIds = useCallback(async (request) => {
    if (!apiClient) return {};

    // Check cache and filter out already-resolved IDs
    const uncached = { discord: {}, telegram: {} };
    const fromCache = { discord: {}, telegram: {} };
    let needsFetch = false;

    if (request.discord) {
      for (const [type, ids] of Object.entries(request.discord)) {
        uncached.discord[type] = [];
        fromCache.discord[type] = {};
        for (const id of ids) {
          const cacheKey = `discord:${type}:${id}`;
          if (resolveCache.current.has(cacheKey)) {
            fromCache.discord[type][id] = resolveCache.current.get(cacheKey);
          } else {
            uncached.discord[type].push(id);
            needsFetch = true;
          }
        }
        if (uncached.discord[type].length === 0) delete uncached.discord[type];
      }
      if (Object.keys(uncached.discord).length === 0) delete uncached.discord;
    }

    if (request.telegram) {
      for (const [type, ids] of Object.entries(request.telegram)) {
        uncached.telegram[type] = [];
        fromCache.telegram[type] = {};
        for (const id of ids) {
          const cacheKey = `telegram:${type}:${id}`;
          if (resolveCache.current.has(cacheKey)) {
            fromCache.telegram[type][id] = resolveCache.current.get(cacheKey);
          } else {
            uncached.telegram[type].push(id);
            needsFetch = true;
          }
        }
        if (uncached.telegram[type].length === 0) delete uncached.telegram[type];
      }
      if (Object.keys(uncached.telegram).length === 0) delete uncached.telegram;
    }

    // Fetch uncached
    let fetched = {};
    if (needsFetch) {
      try {
        fetched = await apiClient.resolve(uncached);
        // Store in cache
        if (fetched.discord) {
          for (const [type, resolved] of Object.entries(fetched.discord)) {
            for (const [id, data] of Object.entries(resolved)) {
              resolveCache.current.set(`discord:${type}:${id}`, data);
            }
          }
        }
        if (fetched.telegram) {
          for (const [type, resolved] of Object.entries(fetched.telegram)) {
            for (const [id, data] of Object.entries(resolved)) {
              resolveCache.current.set(`telegram:${type}:${id}`, data);
            }
          }
        }
      } catch {
        // Resolution failure is not critical
      }
    }

    // Merge cached + fetched
    const result = { discord: {}, telegram: {} };
    for (const platform of ['discord', 'telegram']) {
      for (const type of Object.keys(fromCache[platform] || {})) {
        result[platform][type] = { ...fromCache[platform][type] };
      }
      for (const type of Object.keys(fetched[platform] || {})) {
        result[platform][type] = { ...result[platform][type], ...fetched[platform][type] };
      }
    }
    return result;
  }, [apiClient]);

  return {
    schema,
    values,
    originalValues,
    activeSection,
    setActiveSection,
    loading,
    error,
    saveResult,
    load,
    updateField,
    dirtyFields,
    dirtySections,
    restartRequired,
    save,
    resolveIds,
    geofenceAreas,
    overriddenFields,
    migrate,
  };
}
