import { useState } from 'react';
import { inputClass, labelClass } from '../lib/styles';

const DEFAULT_CATEGORIES = {
  general: ['view', 'viewHistory', 'send', 'react', 'pingEveryone', 'embedLinks', 'attachFiles', 'sendTTS', 'externalEmoji', 'externalStickers', 'createPublicThreads', 'createPrivateThreads', 'sendThreads', 'slashCommands', 'createInvite'],
  voice: ['connect', 'speak', 'autoMic', 'stream', 'vcActivities', 'prioritySpeaker'],
  admin: ['channels', 'messages', 'roles', 'webhooks', 'threads', 'events', 'mute', 'deafen', 'move'],
};

function TriStateToggle({ value, onChange }) {
  const cycle = () => {
    if (value === null || value === undefined) onChange(true);
    else if (value === true) onChange(false);
    else onChange(null);
  };

  let display, color;
  if (value === true) { display = '\u2713'; color = 'text-green-400'; }
  else if (value === false) { display = '\u2715'; color = 'text-red-400'; }
  else { display = '\u2014'; color = 'text-gray-600'; }

  return (
    <button
      type="button"
      onClick={cycle}
      className={`w-5 h-5 flex items-center justify-center text-xs font-bold rounded ${color} hover:bg-gray-700 shrink-0`}
      title={value === true ? 'Allow (click for Deny)' : value === false ? 'Deny (click for Inherit)' : 'Inherit (click for Allow)'}
    >
      {display}
    </button>
  );
}

function groupPermissions(schemaFlags) {
  if (schemaFlags?.length > 0) {
    const groups = {};
    for (const flag of schemaFlags) {
      const cat = flag.category || 'general';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(flag);
    }
    return groups;
  }
  const groups = {};
  for (const [cat, flags] of Object.entries(DEFAULT_CATEGORIES)) {
    groups[cat] = flags.map((name) => ({ name, label: name, category: cat }));
  }
  return groups;
}

function roleSummary(role) {
  const set = [];
  const flagNames = Object.keys(DEFAULT_CATEGORIES).flatMap((c) => DEFAULT_CATEGORIES[c]);
  for (const flag of flagNames) {
    if (role[flag] === true) set.push(`${flag}: allow`);
    else if (role[flag] === false) set.push(`${flag}: deny`);
  }
  if (set.length === 0) return 'no permissions set';
  if (set.length <= 2) return set.join(', ');
  return `${set.length} set`;
}

export default function AutocreateRoleCard({ role, onChange, onDelete, schemaFlags }) {
  const [expanded, setExpanded] = useState(false);
  const grouped = groupPermissions(schemaFlags);

  const updateField = (field, value) => {
    onChange({ ...role, [field]: value });
  };

  return (
    <div className={`bg-gray-800 border rounded mb-1.5 ${expanded ? 'border-gray-600' : 'border-gray-700'}`}>
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-gray-750"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-gray-500 text-xs">{expanded ? '\u25BC' : '\u25B6'}</span>
        <span className="text-yellow-300 text-sm font-medium">
          {role.name || '(unnamed)'}
        </span>
        {!expanded && (
          <span className="text-gray-500 text-xs ml-auto mr-1 truncate">
            {roleSummary(role)}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-gray-600 hover:text-red-400 text-xs ml-auto shrink-0"
          title="Remove role"
        >
          \u2715
        </button>
      </div>

      {expanded && (
        <div className="px-2.5 pb-2.5 border-t border-gray-700 pt-2">
          <div className="mb-3">
            <label className={labelClass}>
              Role Name
              {role.name === '@everyone' && (
                <span className="text-gray-500 ml-1">(resolves to guild @everyone)</span>
              )}
            </label>
            <input
              className={inputClass}
              value={role.name || ''}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. @everyone, subscribers"
            />
          </div>

          {Object.entries(grouped).map(([category, flags]) => (
            <div key={category} className="mb-2">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-bold">
                {category}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {flags.map((flag) => (
                  <div key={flag.name} className="flex items-center gap-1.5 text-xs">
                    <TriStateToggle
                      value={role[flag.name] ?? null}
                      onChange={(v) => updateField(flag.name, v)}
                    />
                    <span className={role[flag.name] != null ? 'text-gray-200' : 'text-gray-500'}>
                      {flag.label || flag.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
