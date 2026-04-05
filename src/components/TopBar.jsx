export default function TopBar({
  filters, setFilters, availableTypes, availableIds, onLoadFile, onSave,
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700 text-sm">
      <div className="flex items-center gap-3">
        <span className="font-bold text-blue-400">Poracle DTS Editor</span>
        <span className="text-gray-600">|</span>
        <label className="text-gray-400">Type:</label>
        <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          className="bg-gray-800 text-yellow-300 px-2 py-0.5 rounded text-sm border border-gray-600">
          {availableTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label className="text-gray-400">Template:</label>
        <select value={filters.id} onChange={(e) => setFilters({ ...filters, id: e.target.value })}
          className="bg-gray-800 text-yellow-300 px-2 py-0.5 rounded text-sm border border-gray-600">
          {availableIds.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        <label className="text-gray-400">Platform:</label>
        <select value={filters.platform} onChange={(e) => setFilters({ ...filters, platform: e.target.value })}
          className="bg-gray-800 text-yellow-300 px-2 py-0.5 rounded text-sm border border-gray-600">
          <option value="discord">discord</option>
        </select>
        <label className="text-gray-400">Lang:</label>
        <select value={filters.language} onChange={(e) => setFilters({ ...filters, language: e.target.value })}
          className="bg-gray-800 text-yellow-300 px-2 py-0.5 rounded text-sm border border-gray-600">
          <option value="en">en</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={onLoadFile}
          className="bg-gray-800 text-teal-300 px-3 py-0.5 rounded text-sm border border-gray-600 hover:bg-gray-700">Load File</button>
        <button onClick={onSave}
          className="bg-gray-800 text-teal-300 px-3 py-0.5 rounded text-sm border border-gray-600 hover:bg-gray-700">Save</button>
      </div>
    </div>
  );
}
