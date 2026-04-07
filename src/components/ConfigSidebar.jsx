export default function ConfigSidebar({
  sections,
  activeSection,
  onSelect,
  dirtySections,
  search,
  onSearchChange,
  searchMatches,
  showDeprecated,
  onToggleDeprecated,
  overviewCount,
}) {
  const hasSearch = search && search.length > 0;
  return (
    <div className="w-48 border-r border-gray-700 overflow-y-auto shrink-0 flex flex-col">
      <div className="p-2 border-b border-gray-800">
        <input
          type="text"
          value={search || ''}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search fields..."
          className="w-full text-xs bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
      </div>
      <div className="py-2 flex-1">
        <button
          onClick={() => onSelect('__overview__')}
          className={`w-full text-left px-4 py-1.5 text-sm transition-colors flex items-center justify-between ${
            activeSection === '__overview__'
              ? 'bg-gray-800 text-blue-400 border-r-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
          }`}
        >
          <span className="truncate">Overview</span>
          {overviewCount > 0 && (
            <span className="text-[10px] bg-gray-700 text-gray-200 rounded px-1.5 py-0.5 ml-2 shrink-0">
              {overviewCount}
            </span>
          )}
        </button>
        {sections.map((section) => {
          const dimmed = hasSearch && !searchMatches?.has(section.name);
          return (
            <button
              key={section.name}
              onClick={() => onSelect(section.name)}
              className={`w-full text-left px-4 py-1.5 text-sm transition-colors flex items-center justify-between ${
                activeSection === section.name
                  ? 'bg-gray-800 text-blue-400 border-r-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              } ${dimmed ? 'opacity-40' : ''}`}
            >
              <span className="truncate">{section.title}</span>
              {dirtySections.has(section.name) && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 ml-2" />
              )}
            </button>
          );
        })}
      </div>
      <div className="p-2 border-t border-gray-800">
        <label className="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={!!showDeprecated}
            onChange={(e) => onToggleDeprecated(e.target.checked)}
            className="rounded"
          />
          <span>Show deprecated fields</span>
        </label>
      </div>
    </div>
  );
}
