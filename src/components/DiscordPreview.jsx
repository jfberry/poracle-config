import { useState } from 'react';
import DiscordView from './discordview';

export default function DiscordPreview({ data, error }) {
  const [darkTheme, setDarkTheme] = useState(true);
  const [compactMode, setCompactMode] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-700 text-sm">
        <span className="text-blue-400">Discord Preview</span>
        <div className="flex gap-2 text-xs">
          <button onClick={() => setDarkTheme(!darkTheme)} className="text-gray-400 hover:text-white">
            {darkTheme ? 'Light' : 'Dark'}
          </button>
          <button onClick={() => setCompactMode(!compactMode)} className="text-gray-400 hover:text-white">
            {compactMode ? 'Cozy' : 'Compact'}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <DiscordView data={data || {}} error={error} darkTheme={darkTheme} compactMode={compactMode} />
      </div>
    </div>
  );
}
