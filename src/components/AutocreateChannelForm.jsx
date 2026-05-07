import { useState } from 'react';
import AutocreateRoleCard from './AutocreateRoleCard';
import { inputClass, labelClass } from '../lib/styles';

function CommandsList({ commands, onChange }) {
  const add = () => onChange([...commands, '']);
  const update = (i, val) => {
    const updated = [...commands];
    updated[i] = val;
    onChange(updated);
  };
  const remove = (i) => onChange(commands.filter((_, idx) => idx !== i));
  const move = (i, dir) => {
    const target = i + dir;
    if (target < 0 || target >= commands.length) return;
    const updated = [...commands];
    [updated[i], updated[target]] = [updated[target], updated[i]];
    onChange(updated);
  };

  return (
    <div>
      {commands.map((cmd, i) => (
        <div key={i} className="flex items-center gap-1 mb-1">
          <span className="text-gray-600 text-[10px] w-4 text-right shrink-0">{i + 1}.</span>
          <input
            className={`${inputClass} flex-1`}
            value={cmd}
            onChange={(e) => update(i, e.target.value)}
            placeholder="e.g. track pokemon100 pokemon000"
          />
          <button type="button" onClick={() => move(i, -1)} className="text-gray-600 hover:text-gray-300 text-xs px-0.5" title="Move up" disabled={i === 0}>{'\u2191'}</button>
          <button type="button" onClick={() => move(i, 1)} className="text-gray-600 hover:text-gray-300 text-xs px-0.5" title="Move down" disabled={i === commands.length - 1}>{'\u2193'}</button>
          <button type="button" onClick={() => remove(i)} className="text-gray-600 hover:text-red-400 text-xs px-0.5" title="Remove">{'\u2715'}</button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-[10px] text-gray-500 border border-dashed border-gray-600 rounded px-1.5 py-0.5 hover:text-gray-300 hover:border-gray-400 mt-1"
      >
        + Add Command
      </button>
      <div className="text-[10px] text-gray-600 mt-1">
        Commands run as the channel's target. <code className="bg-gray-800 px-0.5 rounded">{'{N}'}</code> = arg slot (note: {'{0}'} = args[1] from !autocreate)
      </div>
    </div>
  );
}

function ThreadCard({ thread, onChange, onDelete, onMove, isFirst, isLast, schema }) {
  const [expanded, setExpanded] = useState(false);
  const buttonStyles = schema?.buttonStyles || ['primary', 'secondary', 'success', 'danger'];

  const update = (field, value) => onChange({ ...thread, [field]: value });

  return (
    <div className={`bg-gray-800 border rounded mb-1.5 ${expanded ? 'border-gray-600' : 'border-gray-700'}`}>
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-gray-750"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-gray-500 text-xs">{expanded ? '\u25BC' : '\u25B6'}</span>
        <span className="text-gray-200 text-sm">{'\uD83E\uDDF5'} {thread.name || '(unnamed)'}</span>
        {thread.buttonStyle && thread.buttonStyle !== 'secondary' && (
          <span className="text-[10px] text-gray-500">{thread.buttonStyle}</span>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" onClick={(e) => { e.stopPropagation(); onMove(-1); }} className="text-gray-600 hover:text-gray-300 text-xs px-0.5" disabled={isFirst}>{'\u2191'}</button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onMove(1); }} className="text-gray-600 hover:text-gray-300 text-xs px-0.5" disabled={isLast}>{'\u2193'}</button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-gray-600 hover:text-red-400 text-xs px-0.5">{'\u2715'}</button>
        </div>
      </div>
      {expanded && (
        <div className="px-2.5 pb-2.5 border-t border-gray-700 pt-2 space-y-2">
          <div>
            <label className={labelClass}>Thread Name</label>
            <input className={inputClass} value={thread.name || ''} onChange={(e) => update('name', e.target.value)} placeholder="e.g. {0}-100iv-pokemon" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass}>Button Label <span className="text-gray-600">(optional)</span></label>
              <input className={inputClass} value={thread.buttonLabel || ''} onChange={(e) => update('buttonLabel', e.target.value)} placeholder="Defaults to thread name" />
            </div>
            <div className="w-32">
              <label className={labelClass}>Button Style</label>
              <select className={inputClass} value={thread.buttonStyle || 'secondary'} onChange={(e) => update('buttonStyle', e.target.value)}>
                {buttonStyles.map((s) => <option key={s} value={s}>{s || '(none)'}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Commands ({(thread.commands || []).length})</label>
            <CommandsList commands={thread.commands || []} onChange={(cmds) => update('commands', cmds)} />
          </div>
        </div>
      )}
    </div>
  );
}

function ThreadPickerForm({ picker, onChange }) {
  const update = (field, value) => onChange({ ...picker, [field]: value });

  return (
    <div className="space-y-2 bg-gray-800 border border-gray-700 rounded p-2.5">
      <div>
        <label className={labelClass}>Embed Title</label>
        <input className={inputClass} value={picker.embedTitle || ''} onChange={(e) => update('embedTitle', e.target.value)} placeholder="e.g. Choose your alerts" />
      </div>
      <div>
        <label className={labelClass}>Embed Description</label>
        <textarea className={`${inputClass} h-16 resize-y`} value={picker.embedDescription || ''} onChange={(e) => update('embedDescription', e.target.value)} placeholder="Description shown in the picker embed" />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
        <input type="checkbox" checked={!!picker.pinned} onChange={(e) => update('pinned', e.target.checked)} className="rounded" />
        Pin picker message
      </label>
    </div>
  );
}

export default function AutocreateChannelForm({ channel, onChange, schemaFlags, schema }) {
  const update = (field, value) => onChange({ ...channel, [field]: value });
  const isVoice = (channel.channelType || 'text') === 'voice';
  const channelTypes = schema?.channelTypes || ['text', 'voice'];
  const controlTypes = schema?.controlTypes || ['', 'bot', 'webhook'];

  const addRole = () => update('roles', [...(channel.roles || []), { name: '' }]);
  const updateRole = (i, role) => { const r = [...(channel.roles || [])]; r[i] = role; update('roles', r); };
  const removeRole = (i) => update('roles', (channel.roles || []).filter((_, idx) => idx !== i));

  const addThread = () => update('threads', [...(channel.threads || []), { name: '', buttonStyle: 'secondary', commands: [] }]);
  const updateThread = (i, thread) => { const t = [...(channel.threads || [])]; t[i] = thread; update('threads', t); };
  const removeThread = (i) => update('threads', (channel.threads || []).filter((_, idx) => idx !== i));
  const moveThread = (i, dir) => {
    const t = [...(channel.threads || [])];
    const target = i + dir;
    if (target < 0 || target >= t.length) return;
    [t[i], t[target]] = [t[target], t[i]];
    update('threads', t);
  };

  const hasThreads = (channel.threads || []).length > 0;
  const hasPicker = !!channel.threadPicker;

  return (
    <div className="space-y-5">
      {/* Channel Settings */}
      <section>
        <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-2">Channel Settings</div>
        <div className="space-y-2">
          <div>
            <label className={labelClass}>Channel Name</label>
            <input className={inputClass} value={channel.channelName || ''} onChange={(e) => update('channelName', e.target.value)} placeholder="e.g. {0}-pokemon-100iv" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass}>Channel Type</label>
              <select className={inputClass} value={channel.channelType || 'text'} onChange={(e) => update('channelType', e.target.value)}>
                {channelTypes.map((t) => <option key={t} value={t}>{t || 'text'}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className={labelClass}>Control Type</label>
              <select className={inputClass} value={channel.controlType || ''} onChange={(e) => update('controlType', e.target.value)}>
                {controlTypes.map((t) => <option key={t} value={t}>{t || '(none)'}</option>)}
              </select>
            </div>
          </div>
          {channel.controlType === 'webhook' && (
            <div>
              <label className={labelClass}>Webhook Name <span className="text-gray-600">(optional)</span></label>
              <input className={inputClass} value={channel.webhookName || ''} onChange={(e) => update('webhookName', e.target.value)} placeholder="Poracle" />
            </div>
          )}
          {!isVoice && (
            <div>
              <label className={labelClass}>Topic <span className="text-gray-600">(optional)</span></label>
              <input className={inputClass} value={channel.topic || ''} onChange={(e) => update('topic', e.target.value)} placeholder="Channel topic with {0} placeholders" />
            </div>
          )}
        </div>
      </section>

      {/* Roles */}
      <section>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">
            Roles ({(channel.roles || []).length})
          </span>
          <button type="button" onClick={addRole} className="text-[10px] text-gray-500 border border-dashed border-gray-600 rounded px-1.5 py-0.5 hover:text-gray-300 hover:border-gray-400">
            + Add Role
          </button>
        </div>
        {(channel.roles || []).map((role, i) => (
          <AutocreateRoleCard key={i} role={role} onChange={(r) => updateRole(i, r)} onDelete={() => removeRole(i)} schemaFlags={schemaFlags} />
        ))}
        {(channel.roles || []).length === 0 && (
          <div className="text-xs text-gray-600 italic">No role overwrites</div>
        )}
      </section>

      {/* Commands */}
      {!isVoice && (
        <section>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1.5">
            Commands ({(channel.commands || []).length})
          </div>
          <CommandsList commands={channel.commands || []} onChange={(cmds) => update('commands', cmds)} />
        </section>
      )}

      {/* Threads */}
      {!isVoice && (
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">
              Threads ({(channel.threads || []).length})
            </span>
            <button type="button" onClick={addThread} className="text-[10px] text-gray-500 border border-dashed border-gray-600 rounded px-1.5 py-0.5 hover:text-gray-300 hover:border-gray-400">
              + Add Thread
            </button>
          </div>
          {(channel.threads || []).map((thread, i) => (
            <ThreadCard
              key={i}
              thread={thread}
              onChange={(t) => updateThread(i, t)}
              onDelete={() => removeThread(i)}
              onMove={(dir) => moveThread(i, dir)}
              isFirst={i === 0}
              isLast={i === (channel.threads || []).length - 1}
              schema={schema}
            />
          ))}
          {(channel.threads || []).length === 0 && (
            <div className="text-xs text-gray-600 italic">No threads</div>
          )}
        </section>
      )}

      {/* Thread Picker */}
      {!isVoice && hasThreads && (
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Thread Picker</span>
            {!hasPicker && (
              <button type="button" onClick={() => update('threadPicker', { embedTitle: '', embedDescription: '', pinned: false })} className="text-[10px] text-gray-500 border border-dashed border-gray-600 rounded px-1.5 py-0.5 hover:text-gray-300 hover:border-gray-400">
                + Add Picker
              </button>
            )}
            {hasPicker && (
              <button type="button" onClick={() => update('threadPicker', null)} className="text-[10px] text-gray-500 hover:text-red-400">
                Remove
              </button>
            )}
          </div>
          {hasPicker && (
            <ThreadPickerForm picker={channel.threadPicker} onChange={(p) => update('threadPicker', p)} />
          )}
          {!hasPicker && (
            <div className="text-xs text-amber-500/70">Threads defined but no picker — users won't have buttons to join</div>
          )}
        </section>
      )}

      {/* Voice channel note */}
      {isVoice && (
        <div className="text-xs text-gray-500 italic border border-gray-800 rounded p-2">
          Voice channels don't support topics, commands, threads, or thread pickers.
        </div>
      )}
    </div>
  );
}
