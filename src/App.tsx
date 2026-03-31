import React, { useState } from 'react';
import { FileExplorer } from './components/FileExplorer';
import { Editor } from './components/Editor';
import { GraphView } from './components/GraphView';
import { Backlinks } from './components/Backlinks';
import { Outline } from './components/Outline';
import { VaultSwitcher } from './components/VaultSwitcher';
import { useVaultStore } from './store/vaultStore';
import { Share2, Settings, Search, Menu, X, Puzzle, FolderOpen, ChevronRight, List } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const { vaultName, files, plugins, activeFilePath } = useVaultStore();
  const [showGraph, setShowGraph] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState<'graph' | 'backlinks' | 'outline'>('outline');
  const [searchQuery, setSearchQuery] = useState('');

  // Find active file for status bar info
  const findFile = (list: any[], path: string): any | null => {
    for (const file of list) {
      if (file.path === path) return file;
      if (file.children) {
        const found = findFile(file.children, path);
        if (found) return found;
      }
    }
    return null;
  };

  const activeFile = activeFilePath ? findFile(files, activeFilePath) : null;
  const wordCount = activeFile?.content ? activeFile.content.trim().split(/\s+/).length : 0;
  const charCount = activeFile?.content ? activeFile.content.length : 0;

  if (!vaultName || files.length === 0) {
    return (
      <div className="h-screen w-screen bg-zinc-950 text-zinc-100 flex items-center justify-center font-sans">
        <VaultSwitcher />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans overflow-hidden select-none">
      {/* Top Bar */}
      <header className="h-10 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-950/50 backdrop-blur-md z-50 shrink-0">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-400"
          >
            <Menu size={16} className={!isSidebarOpen ? 'rotate-90' : ''} />
          </button>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-purple-500 rounded-sm flex items-center justify-center">
              <div className="w-2 h-2 bg-white/20 rounded-full" />
            </div>
            <span className="text-xs font-bold tracking-tight uppercase text-zinc-400 truncate max-w-[200px]">{vaultName}</span>
          </div>
        </div>

        <div className="flex-1 flex justify-center px-8">
          <div className="max-w-md w-full relative group">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search size={14} className="text-zinc-600 group-focus-within:text-purple-400 transition-colors" />
            </div>
            <input 
              type="text" 
              placeholder="Quick search..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-md py-1 pl-9 pr-12 text-xs outline-none focus:border-purple-500/50 transition-all placeholder:text-zinc-700"
            />
            <div className="absolute inset-y-0 right-3 flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-[10px] font-bold text-zinc-500 border border-zinc-700">⌘</kbd>
              <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-[10px] font-bold text-zinc-500 border border-zinc-700">K</kbd>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setShowGraph(!showGraph)}
            className={`p-1.5 rounded transition-all ${showGraph ? 'bg-purple-500/20 text-purple-400' : 'hover:bg-zinc-800 text-zinc-400'}`}
            title="Graph View"
          >
            <Share2 size={16} />
          </button>
          <button className="p-1.5 hover:bg-zinc-800 rounded transition-colors text-zinc-400" title="Settings">
            <Settings size={16} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar */}
        <AnimatePresence initial={false}>
          {isSidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="border-r border-zinc-800 bg-zinc-950/30 overflow-hidden flex flex-col shrink-0"
            >
              <div className="w-[260px] flex-1 flex flex-col min-h-0">
                <FileExplorer />
                
                {/* Plugins Section */}
                {plugins.length > 0 && (
                  <div className="p-4 border-t border-zinc-800 bg-zinc-900/10">
                    <div className="flex items-center space-x-2 mb-3">
                      <Puzzle size={14} className="text-zinc-500" />
                      <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        Plugins ({plugins.length})
                      </h3>
                    </div>
                    <div className="space-y-1.5">
                      {plugins.map((id) => (
                        <div key={id} className="text-[11px] text-zinc-400 flex items-center space-x-2 py-1 px-2 hover:bg-zinc-900 rounded transition-colors cursor-default">
                          <div className="w-1.5 h-1.5 bg-purple-500/50 rounded-full" />
                          <span className="truncate">{id}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-zinc-950">
          <Editor />
        </div>

        {/* Right Sidebar (Outline, Graph & Backlinks) */}
        <div className="w-80 border-l border-zinc-800 flex flex-col bg-zinc-950 shrink-0 hidden lg:flex">
          <div className="flex border-b border-zinc-800">
            <button 
              onClick={() => setActiveRightTab('outline')}
              className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${activeRightTab === 'outline' ? 'text-purple-400 border-b border-purple-500' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Outline
            </button>
            <button 
              onClick={() => setActiveRightTab('graph')}
              className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${activeRightTab === 'graph' ? 'text-purple-400 border-b border-purple-500' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              关系图谱
            </button>
            <button 
              onClick={() => setActiveRightTab('backlinks')}
              className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${activeRightTab === 'backlinks' ? 'text-purple-400 border-b border-purple-500' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Backlinks
            </button>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeRightTab === 'outline' && <Outline />}
            {activeRightTab === 'graph' && <GraphView local={true} />}
            {activeRightTab === 'backlinks' && <Backlinks />}
          </div>
        </div>

        {/* Fullscreen Graph Overlay */}
        <AnimatePresence>
          {showGraph && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 z-[100] bg-zinc-950/95 backdrop-blur-md flex flex-col"
            >
              <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Global Graph View</h2>
                <button 
                  onClick={() => setShowGraph(false)}
                  className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1">
                <GraphView />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      {/* Status Bar */}
      <footer className="h-6 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between px-3 text-[10px] text-zinc-500 font-medium shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="uppercase tracking-tight">GitHub Synced</span>
          </div>
          <span className="text-zinc-600">|</span>
          <span>{files.length} files</span>
          {activeFile && (
            <>
              <span className="text-zinc-600">|</span>
              <span>{wordCount} words</span>
              <span className="text-zinc-600">|</span>
              <span>{charCount} characters</span>
            </>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <span className="hover:text-zinc-300 cursor-pointer transition-colors">Markdown</span>
          <span className="text-zinc-600">|</span>
          <span className="hover:text-zinc-300 cursor-pointer transition-colors uppercase">UTF-8</span>
        </div>
      </footer>
    </div>
  );
}
