import React from 'react';
import { useVaultStore } from '../store/vaultStore';
import { VaultFile } from '../types';
import { Folder, File, ChevronRight, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FileItemProps {
  file: VaultFile;
  depth: number;
}

const FileItem: React.FC<FileItemProps> = ({ file, depth }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const { activeFilePath, setActiveFile } = useVaultStore();

  const isSelected = activeFilePath === file.path;

  const handleClick = () => {
    if (file.type === 'dir') {
      setIsOpen(!isOpen);
    } else {
      setActiveFile(file.path);
    }
  };

  return (
    <div className="select-none">
      <div
        onClick={handleClick}
        className={`group flex items-center py-0.5 px-2 cursor-pointer hover:bg-zinc-800/80 transition-colors ${
          isSelected ? 'bg-purple-500/20 text-purple-300' : 'text-zinc-400'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <div className="w-4 flex items-center justify-center mr-1">
          {file.type === 'dir' && (
            <div className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
              <ChevronRight size={12} className="text-zinc-500" />
            </div>
          )}
        </div>
        
        {file.type === 'dir' ? (
          <Folder size={14} className={`mr-2 ${isSelected ? 'text-purple-400' : 'text-zinc-500'}`} />
        ) : (
          <File size={14} className={`mr-2 ${isSelected ? 'text-purple-400' : 'text-zinc-600'}`} />
        )}
        
        <span className={`text-[13px] truncate ${isSelected ? 'font-medium' : ''}`}>
          {file.name.replace('.md', '')}
        </span>
      </div>
      
      <AnimatePresence initial={false}>
        {isOpen && file.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {file.children
              .sort((a, b) => {
                if (a.type === b.type) return a.name.localeCompare(b.name);
                return a.type === 'dir' ? -1 : 1;
              })
              .map((child) => (
                <FileItem key={child.path} file={child} depth={depth + 1} />
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const FileExplorer: React.FC = () => {
  const { files, vaultName } = useVaultStore();

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-900 w-72">
      <div className="p-4 py-3 flex items-center justify-between">
        <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
          {vaultName || 'Vault'}
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
        {files
          .sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'dir' ? -1 : 1;
          })
          .map((file) => (
            <FileItem key={file.path} file={file} depth={0} />
          ))}
      </div>
    </div>
  );
};
