export const inputBase = 'bg-gray-800 text-gray-200 border border-gray-600 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-blue-500';
export const inputClass = `w-full ${inputBase}`;
export const labelClass = 'block text-xs text-gray-400 mb-1';

export function tabClass(active) {
  return active
    ? 'text-blue-400 border-b-2 border-blue-400 pb-1'
    : 'text-gray-500 pb-1';
}
