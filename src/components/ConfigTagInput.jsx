import { useState, useEffect } from 'react';
import { ResolvedLabel } from './ConfigField';
import { inputBase } from '../lib/styles';

export default function ConfigTagInput({ value, onChange, resolve, resolveIds, field, suggestions, sensitive }) {
  const datalistId = suggestions && suggestions.length > 0 ? `dl-${field.name}` : undefined;
  const [input, setInput] = useState('');
  const [resolved, setResolved] = useState({});

  const items = Array.isArray(value) ? value : [];

  // Resolve IDs when items change
  useEffect(() => {
    if (sensitive) return;
    if (!resolve || !resolveIds || items.length === 0) return;

    const request = buildResolveRequest(resolve, items);
    if (!request) return;

    resolveIds(request).then((result) => {
      const map = extractResolvedMap(resolve, result);
      setResolved(map);
    });
  }, [items.join(','), resolve, resolveIds]);

  const addItem = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (!items.includes(trimmed)) {
      onChange([...items, trimmed]);
      // Resolve the new item
      if (!sensitive && resolve && resolveIds) {
        const request = buildResolveRequest(resolve, [trimmed]);
        if (request) {
          resolveIds(request).then((result) => {
            const map = extractResolvedMap(resolve, result);
            setResolved((prev) => ({ ...prev, ...map }));
          });
        }
      }
    }
    setInput('');
  };

  const removeItem = (item) => {
    onChange(items.filter((i) => i !== item));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem();
    }
    if (e.key === 'Backspace' && input === '' && items.length > 0) {
      removeItem(items[items.length - 1]);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-xs"
          >
            {sensitive ? (
              <span className="font-mono text-gray-300 tracking-widest">••••</span>
            ) : resolve && resolved[item] ? (
              <ResolvedLabel id={item} resolved={resolved[item]} />
            ) : (
              <span className="font-mono text-gray-300">{item}</span>
            )}
            <button
              onClick={() => removeItem(item)}
              className="text-gray-500 hover:text-red-400 ml-0.5"
              type="button"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          className={`flex-1 ${inputBase}`}
          type={sensitive ? 'password' : 'text'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={sensitive ? 'Add new key...' : `Add ${field.name}... (Enter to add)`}
          list={datalistId}
        />
        {datalistId && (
          <datalist id={datalistId}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
        <button
          onClick={addItem}
          className="text-xs text-blue-400 hover:text-blue-300 px-2 border border-gray-600 rounded"
          type="button"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// Build a resolve request from a resolve hint string and list of IDs
function buildResolveRequest(resolveHint, ids) {
  if (!resolveHint || ids.length === 0) return null;

  // Parse hint: "discord:user", "discord:role", "discord:channel", "discord:user|role", "telegram:chat"
  const [platform, type] = resolveHint.split(':');

  if (platform === 'discord') {
    if (type === 'user|role') {
      // Try both
      return { discord: { users: ids, roles: ids } };
    }
    if (type === 'target') {
      return { discord: { users: ids, channels: ids } };
    }
    return { discord: { [type + 's']: ids } };
  }

  if (platform === 'telegram') {
    return { telegram: { chats: ids } };
  }

  return null;
}

// Extract a flat id->resolved map from the resolve response
function extractResolvedMap(resolveHint, result) {
  const map = {};
  const [platform, type] = resolveHint.split(':');

  if (platform === 'discord' && result.discord) {
    // Merge all resolved types (for user|role, both users and roles are returned)
    for (const resolved of Object.values(result.discord)) {
      for (const [id, data] of Object.entries(resolved)) {
        map[id] = data;
      }
    }
  }

  if (platform === 'telegram' && result.telegram) {
    for (const resolved of Object.values(result.telegram)) {
      for (const [id, data] of Object.entries(resolved)) {
        map[id] = data;
      }
    }
  }

  return map;
}
