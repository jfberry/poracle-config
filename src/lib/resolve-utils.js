// Build a /api/resolve request body from a resolve hint and one or more IDs
export function buildResolveRequest(resolveHint, ids) {
  if (!resolveHint || !ids || ids.length === 0) return null;

  if (resolveHint === 'destination') {
    return { destinations: ids };
  }

  const [platform, type] = resolveHint.split(':');

  if (platform === 'discord') {
    if (type === 'user|role') return { discord: { users: ids, roles: ids } };
    if (type === 'target') return { discord: { users: ids, channels: ids } };
    return { discord: { [type + 's']: ids } };
  }

  if (platform === 'telegram') {
    return { telegram: { chats: ids } };
  }

  return null;
}

// Extract a flat id->resolved map from the /api/resolve response.
// Each resolved entry includes a `kind` property for type-aware rendering.
export function extractResolvedMap(resolveHint, result) {
  const map = {};
  if (!result) return map;

  if (resolveHint === 'destination') {
    if (result.destinations) {
      for (const [id, data] of Object.entries(result.destinations)) {
        map[id] = data;
      }
    }
    return map;
  }

  const [platform] = resolveHint.split(':');

  if (platform === 'discord' && result.discord) {
    for (const [matchedType, resolved] of Object.entries(result.discord)) {
      const singular = matchedType.endsWith('s') ? matchedType.slice(0, -1) : matchedType;
      for (const [id, data] of Object.entries(resolved)) {
        if (!map[id]) map[id] = { ...data, kind: `discord:${singular}` };
      }
    }
  }

  if (platform === 'telegram' && result.telegram) {
    for (const [matchedType, resolved] of Object.entries(result.telegram)) {
      const singular = matchedType.endsWith('s') ? matchedType.slice(0, -1) : matchedType;
      for (const [id, data] of Object.entries(resolved)) {
        if (!map[id]) map[id] = { ...data, kind: `telegram:${singular}` };
      }
    }
  }

  return map;
}
