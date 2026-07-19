// Server-driven DTS type resolution, with a thin fallback for pre-derived-types
// poracle builds. Everything guarded by `!client.supportsDerivedTypes` — plus the
// two fallback tables below — is deleted in one commit once develop is promoted.
// See docs/superpowers/specs/2026-07-19-dts-derived-types-editor.md §6.

// ─── Fallback tables (delete at promote) ───
export const DTS_TO_WEBHOOK = {
  monster: 'pokemon',
  monsterNoIv: 'pokemon',
  raid: 'raid',
  egg: 'raid',
  invasion: 'pokestop',
  lure: 'pokestop',
  quest: 'quest',
  nest: 'nest',
  gym: 'gym',
  'fort-update': 'fort_update',
  maxbattle: 'max_battle',
};

export const DTS_TO_ENRICH = {
  monsterNoIv: 'pokemon',
  egg: 'raid',
  'fort-update': 'fort_update',
  maxbattle: 'max_battle',
};

// The webhook bucket a DTS type reads from. New poracle answers via its `types`
// map; old poracle uses the hardcoded table, then the dtsType itself.
export function resolveWebhookType(client, dtsType) {
  return client?.dtsTypes?.[dtsType]?.webhookType ?? DTS_TO_WEBHOOK[dtsType] ?? dtsType;
}

// The `type` to send to POST /api/dts/enrich. New poracle accepts DTS names
// directly; old poracle needs the legacy remap.
export function resolveEnrichType(client, dtsType) {
  if (client?.supportsDerivedTypes) return dtsType;
  return DTS_TO_ENRICH[dtsType] ?? dtsType;
}

// Test scenarios for a DTS type. New poracle filters + tags server-side via
// ?dtsType=; old poracle returns every entry of the mapped webhook type
// (no client-side split — matches pre-derived-types runtime behaviour).
export async function fetchScenarios(client, dtsType) {
  if (!client) return [];
  try {
    if (client.supportsDerivedTypes) {
      const res = await client.getTestdata({ dtsType });
      return res.testdata ?? [];
    }
    const res = await client.getTestdata({ type: resolveWebhookType(client, dtsType) });
    return res.testdata ?? [];
  } catch {
    return [];
  }
}
