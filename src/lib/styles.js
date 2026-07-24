export const inputBase = 'bg-gray-800 text-gray-200 border border-gray-600 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-blue-500';
export const inputClass = `w-full ${inputBase}`;
export const labelClass = 'block text-xs text-gray-400 mb-1';

export function tabClass(active) {
  return active
    ? 'text-blue-400 border-b-2 border-blue-400 pb-1'
    : 'text-gray-500 pb-1';
}

// Discord button color tokens.
// Used by ButtonCard previews and the DiscordView live action row.
export const discordBtnClass = {
  primary:   'bg-[#5865f2] hover:bg-[#4752c4] text-white',
  secondary: 'bg-[#4e5058] hover:bg-[#6d6f78] text-white',
  success:   'bg-[#248046] hover:bg-[#1a6334] text-white',
  danger:    'bg-[#da373c] hover:bg-[#a12d2f] text-white',
};

// Common shape for a rendered Discord-style button (preview + ButtonCard swatch).
export const discordBtnBase =
  'inline-flex items-center justify-center font-medium text-sm px-3 py-1.5 rounded min-w-[60px] transition-colors';
