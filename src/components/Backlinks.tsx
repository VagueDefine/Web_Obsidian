import React from 'react';
import { useVaultStore } from '../store/vaultStore';
import { FileText } from 'lucide-react';

export const Backlinks: React.FC = () => {
  const { activeFilePath, backlinks, setActiveFile } = useVaultStore();

  if (!activeFilePath) return null;

  // Extract the filename without extension
  const activeFileName = activeFilePath.split('/').pop()?.replace('.md', '') || '';
  const currentBacklinks = backlinks[activeFileName] || [];

  return (
    <div className="p-4 border-t border-zinc-800 bg-zinc-950">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Backlinks</h3>
      {currentBacklinks.length === 0 ? (
        <p className="text-sm text-zinc-600 italic">No backlinks found</p>
      ) : (
        <div className="space-y-2">
          {currentBacklinks.map((path) => (
            <div
              key={path}
              onClick={() => setActiveFile(path)}
              className="flex items-center p-2 rounded hover:bg-zinc-800/50 cursor-pointer text-zinc-400 hover:text-purple-400 transition-colors"
            >
              <FileText size={14} className="mr-2" />
              <span className="text-sm truncate">{path}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
