import { useState, useCallback, useMemo, useRef } from 'react';
import { validateTemplates } from '../lib/autocreate-validation';

/**
 * Manages autocreate template state: load, edit, validate, save, dirty tracking.
 * Follows the same pattern as useConfig.
 */
export function useAutocreate(apiClient) {
  const [templates, setTemplates] = useState([]);
  const [savedSnapshot, setSavedSnapshot] = useState([]);
  const [schema, setSchema] = useState(null);
  const [selectedTemplateName, setSelectedTemplateName] = useState(null);
  const [selectedNode, setSelectedNode] = useState({ type: 'template' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    if (!apiClient) return;
    setLoading(true);
    setError(null);
    try {
      const [templatesRes, schemaRes] = await Promise.all([
        apiClient.getAutocreateTemplates(),
        apiClient.getAutocreateSchema(),
      ]);
      const tpls = templatesRes.templates || [];
      setTemplates(tpls);
      setSavedSnapshot(JSON.parse(JSON.stringify(tpls)));
      setSchema(schemaRes.schema || null);
      if (tpls.length > 0 && !selectedTemplateName) {
        setSelectedTemplateName(tpls[0].name);
      }
      loadedRef.current = true;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiClient, selectedTemplateName]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.name === selectedTemplateName) || null,
    [templates, selectedTemplateName]
  );

  const selectedTemplateIndex = useMemo(
    () => templates.findIndex((t) => t.name === selectedTemplateName),
    [templates, selectedTemplateName]
  );

  const validation = useMemo(() => validateTemplates(templates), [templates]);

  const isDirty = useMemo(
    () => JSON.stringify(templates) !== JSON.stringify(savedSnapshot),
    [templates, savedSnapshot]
  );

  const updateSelectedTemplate = useCallback((updater) => {
    setTemplates((prev) => {
      const idx = prev.findIndex((t) => t.name === selectedTemplateName);
      if (idx < 0) return prev;
      const updated = [...prev];
      const current = updated[idx];
      updated[idx] = typeof updater === 'function' ? updater(current) : updater;
      return updated;
    });
  }, [selectedTemplateName]);

  const updateDefinition = useCallback((updater) => {
    updateSelectedTemplate((t) => ({
      ...t,
      definition: typeof updater === 'function' ? updater(t.definition) : updater,
    }));
  }, [updateSelectedTemplate]);

  const updateTemplateName = useCallback((newName) => {
    setTemplates((prev) => {
      const idx = prev.findIndex((t) => t.name === selectedTemplateName);
      if (idx < 0) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], name: newName };
      return updated;
    });
    setSelectedTemplateName(newName);
  }, [selectedTemplateName]);

  const addTemplate = useCallback(() => {
    let name = 'new-template';
    let counter = 1;
    const existing = new Set(templates.map((t) => t.name));
    while (existing.has(name)) {
      name = `new-template-${counter++}`;
    }
    const newTemplate = {
      name,
      definition: {
        channels: [{
          channelName: 'new-channel',
          channelType: 'text',
          controlType: '',
          roles: [],
          commands: [],
        }],
      },
    };
    setTemplates((prev) => [...prev, newTemplate]);
    setSelectedTemplateName(name);
    setSelectedNode({ type: 'channel', index: 0 });
  }, [templates]);

  const deleteTemplate = useCallback((name) => {
    setTemplates((prev) => prev.filter((t) => t.name !== name));
    setSelectedTemplateName((prev) => {
      if (prev === name) {
        const remaining = templates.filter((t) => t.name !== name);
        return remaining.length > 0 ? remaining[0].name : null;
      }
      return prev;
    });
    setSelectedNode({ type: 'template' });
  }, [templates]);

  const addChannel = useCallback(() => {
    const newIndex = (selectedTemplate?.definition?.channels?.length || 0);
    updateDefinition((def) => ({
      ...def,
      channels: [...(def.channels || []), {
        channelName: 'new-channel',
        channelType: 'text',
        controlType: '',
        roles: [],
        commands: [],
      }],
    }));
    setSelectedNode({ type: 'channel', index: newIndex });
  }, [updateDefinition, selectedTemplate]);

  const removeChannel = useCallback((index) => {
    updateDefinition((def) => ({
      ...def,
      channels: def.channels.filter((_, i) => i !== index),
    }));
    setSelectedNode((prev) => {
      if (prev.type === 'channel' && prev.index === index) return { type: 'template' };
      if (prev.type === 'channel' && prev.index > index) return { ...prev, index: prev.index - 1 };
      return prev;
    });
  }, [updateDefinition]);

  const moveChannel = useCallback((index, direction) => {
    updateDefinition((def) => {
      const channels = [...def.channels];
      const target = index + direction;
      if (target < 0 || target >= channels.length) return def;
      [channels[index], channels[target]] = [channels[target], channels[index]];
      return { ...def, channels };
    });
    setSelectedNode((prev) => {
      if (prev.type === 'channel' && prev.index === index) {
        return { ...prev, index: index + direction };
      }
      return prev;
    });
  }, [updateDefinition]);

  const save = useCallback(async () => {
    if (!apiClient) throw new Error('Not connected');
    const v = validateTemplates(templates);
    if (v.errors.length > 0) {
      throw new Error(`Validation errors: ${v.errors.map((e) => e.message).join(', ')}`);
    }
    const valResult = await apiClient.validateAutocreateTemplates(templates);
    if (valResult.errors?.length > 0) {
      throw new Error(`Server validation: ${valResult.errors.map((e) => e.message).join(', ')}`);
    }
    const result = await apiClient.saveAutocreateTemplates(templates);
    setSavedSnapshot(JSON.parse(JSON.stringify(templates)));
    return result;
  }, [apiClient, templates]);

  const deleteFromServer = useCallback(async (name) => {
    if (!apiClient) throw new Error('Not connected');
    await apiClient.deleteAutocreateTemplate(name);
    deleteTemplate(name);
    setSavedSnapshot((prev) => prev.filter((t) => t.name !== name));
  }, [apiClient, deleteTemplate]);

  const replaceSelectedTemplateRaw = useCallback((json) => {
    setTemplates((prev) => {
      const idx = prev.findIndex((t) => t.name === selectedTemplateName);
      if (idx < 0) return prev;
      const updated = [...prev];
      updated[idx] = json;
      return updated;
    });
    if (json.name !== selectedTemplateName) {
      setSelectedTemplateName(json.name);
    }
  }, [selectedTemplateName]);

  return {
    templates, schema, selectedTemplate, selectedTemplateIndex,
    selectedTemplateName, setSelectedTemplateName,
    selectedNode, setSelectedNode,
    loading, error, loaded: loadedRef.current,
    validation, isDirty,
    load, updateSelectedTemplate, updateDefinition, updateTemplateName,
    addTemplate, deleteTemplate, addChannel, removeChannel, moveChannel,
    save, deleteFromServer, replaceSelectedTemplateRaw,
  };
}
