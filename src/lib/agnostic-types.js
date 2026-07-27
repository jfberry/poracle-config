// DTS types that ship as a single platform-agnostic entry (platform === ""),
// matching the server's dts.IsPlatformAgnosticType. `help` is the only one —
// every other type (monster, raid, quest, invasion, incident, lure, nest, gym,
// fort-update, maxbattle, showcase, and the derived types) is platform-specific
// and must carry discord/telegram. Keep in sync with the server.
export const AGNOSTIC_TYPES = ['help'];

export function isAgnostic(type) {
  return AGNOSTIC_TYPES.includes(type);
}
