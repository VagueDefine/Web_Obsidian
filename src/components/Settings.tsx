import React, { useState } from 'react';
import { useVaultStore } from '../store/vaultStore';
import { 
  X, 
  Settings as SettingsIcon, 
  Puzzle, 
  Monitor, 
  Type, 
  FileText, 
  Search, 
  Shield, 
  Globe, 
  Command,
  ChevronRight,
  ExternalLink,
  Info,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsProps {
  onClose: () => void;
}

type SettingsTab = 'appearance' | 'editor' | 'files' | 'community-plugins' | 'about';

export const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const { 
    plugins, 
    togglePlugin, 
    vaultName, 
    owner, 
    repo, 
    branch,
    fontSize,
    setFontSize,
    showLineNumbers,
    spellcheck,
    readableLineLength,
    newFileLocation,
    newFileFolderPath,
    attachmentLocation,
    attachmentFolderPath,
    updateSetting,
    discoverPlugins
  } = useVaultStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('community-plugins');
  const [searchQuery, setSearchQuery] = useState('');

  const tabs = [
    { id: 'appearance', name: 'Appearance', icon: Monitor },
    { id: 'editor', name: 'Editor', icon: Type },
    { id: 'files', name: 'Files & Links', icon: FileText },
    { id: 'community-plugins', name: 'Community Plugins', icon: Puzzle },
    { id: 'about', name: 'About', icon: Info },
  ];

  const filteredPlugins = plugins.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-4 lg:p-12"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-5xl h-full max-h-[800px] overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/30">
          <div className="flex items-center space-x-3">
            <SettingsIcon size={18} className="text-zinc-500" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Settings</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-500 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r border-zinc-800 bg-zinc-950/20 overflow-y-auto custom-scrollbar p-3 space-y-1">
            <div className="px-3 py-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Options</div>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all text-sm ${
                  activeTab === tab.id 
                    ? 'bg-purple-500/10 text-purple-400 font-medium' 
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                }`}
              >
                <tab.icon size={16} className={activeTab === tab.id ? 'text-purple-400' : 'text-zinc-500'} />
                <span>{tab.name}</span>
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-zinc-900/50 p-8">
            <AnimatePresence mode="wait">
              {activeTab === 'community-plugins' && (
                <motion.div
                  key="plugins"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-8"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-1">Community Plugins</h3>
                      <p className="text-sm text-zinc-500">Extend the functionality of your vault with community-made plugins.</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button 
                        onClick={() => discoverPlugins()}
                        className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-purple-400 transition-all"
                        title="Refresh Plugins"
                      >
                        <RefreshCw size={14} />
                      </button>
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                        <input 
                          type="text"
                          placeholder="Search plugins..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="bg-zinc-950 border border-zinc-800 rounded-lg py-1.5 pl-9 pr-4 text-xs outline-none focus:border-purple-500/50 w-64 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {filteredPlugins.length > 0 ? (
                      filteredPlugins.map(plugin => (
                        <div 
                          key={plugin.id}
                          className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-5 flex items-start justify-between group hover:border-zinc-700 transition-all"
                        >
                          <div className="flex-1 pr-8">
                            <div className="flex items-center space-x-3 mb-1">
                              <h4 className="font-bold text-zinc-200">{plugin.name}</h4>
                              <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded font-mono">v{plugin.version}</span>
                            </div>
                            <p className="text-xs text-zinc-500 mb-3 leading-relaxed">{plugin.description}</p>
                            <div className="flex items-center space-x-4 text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
                              <span className="flex items-center space-x-1">
                                <span>By</span>
                                <span className="text-zinc-400">{plugin.author}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <span>ID:</span>
                                <span className="text-zinc-400 font-mono">{plugin.id}</span>
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end space-y-4">
                            <button
                              onClick={() => togglePlugin(plugin.id, !plugin.enabled)}
                              className={`w-12 h-6 rounded-full transition-all relative ${
                                plugin.enabled ? 'bg-purple-600' : 'bg-zinc-800'
                              }`}
                            >
                              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                                plugin.enabled ? 'right-1' : 'left-1'
                              }`} />
                            </button>
                            <button className="p-2 text-zinc-600 hover:text-zinc-400 transition-colors">
                              <SettingsIcon size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-20 text-center">
                        <Puzzle size={40} className="mx-auto text-zinc-800 mb-4" />
                        <p className="text-zinc-600 font-medium">No plugins found in <code className="text-zinc-500">.obsidian/plugins/</code></p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'about' && (
                <motion.div
                  key="about"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-12 max-w-2xl"
                >
                  <div className="text-center py-8">
                    <div className="w-24 h-24 bg-purple-500/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-purple-500/20 shadow-2xl shadow-purple-500/10">
                      <div className="w-12 h-12 bg-white/20 rounded-full" />
                    </div>
                    <h3 className="text-3xl font-bold text-white mb-2">Web Obsidian</h3>
                    <p className="text-zinc-500">A high-performance, GitHub-synced Obsidian clone for the web.</p>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-zinc-950/30 border border-zinc-800 rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400">Current Vault</span>
                        <span className="text-sm font-bold text-purple-400">{vaultName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400">GitHub Repository</span>
                        <span className="text-sm font-mono text-zinc-500">{owner}/{repo}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400">Active Branch</span>
                        <span className="text-sm font-mono text-zinc-500">{branch}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <a 
                        href="https://obsidian.md" 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center justify-between p-4 bg-zinc-950/30 border border-zinc-800 rounded-xl hover:bg-zinc-800/50 transition-all group"
                      >
                        <span className="text-sm text-zinc-400 group-hover:text-zinc-200">Obsidian Official</span>
                        <ExternalLink size={14} className="text-zinc-600" />
                      </a>
                      <a 
                        href="https://github.com" 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center justify-between p-4 bg-zinc-950/30 border border-zinc-800 rounded-xl hover:bg-zinc-800/50 transition-all group"
                      >
                        <span className="text-sm text-zinc-400 group-hover:text-zinc-200">GitHub Docs</span>
                        <ExternalLink size={14} className="text-zinc-600" />
                      </a>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'appearance' && (
                <motion.div
                  key="appearance"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-8"
                >
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">Appearance</h3>
                    <p className="text-sm text-zinc-500">Customize how Web Obsidian looks and feels.</p>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-zinc-950/30 border border-zinc-800 rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h4 className="font-bold text-zinc-200">Base color scheme</h4>
                          <p className="text-xs text-zinc-500">Switch between light and dark mode.</p>
                        </div>
                        <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                          <button className="px-4 py-1.5 text-xs font-bold bg-zinc-800 text-white rounded-md shadow-sm">Dark</button>
                          <button className="px-4 py-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors">Light</button>
                        </div>
                      </div>

                      <div className="h-px bg-zinc-800/50 mb-6" />

                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-zinc-200">Font size</h4>
                          <p className="text-xs text-zinc-500">Adjust the base font size for the editor and UI.</p>
                        </div>
                        <div className="flex items-center space-x-4">
                          <input 
                            type="range" 
                            min="12" 
                            max="24" 
                            value={fontSize}
                            onChange={(e) => setFontSize(parseInt(e.target.value))}
                            className="w-32 accent-purple-500"
                          />
                          <span className="text-xs font-mono text-purple-400 w-8">{fontSize}px</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-zinc-950/30 border border-zinc-800 rounded-2xl p-6">
                      <h4 className="font-bold text-zinc-200 mb-4">Themes</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="aspect-video bg-zinc-900 border-2 border-purple-500 rounded-xl p-3 flex flex-col justify-between">
                          <div className="space-y-1">
                            <div className="w-1/2 h-1 bg-zinc-800 rounded" />
                            <div className="w-3/4 h-1 bg-zinc-800 rounded" />
                          </div>
                          <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Default Dark</span>
                        </div>
                        <div className="aspect-video bg-zinc-800 border border-zinc-700 rounded-xl p-3 flex flex-col justify-between opacity-50 grayscale">
                          <div className="space-y-1">
                            <div className="w-1/2 h-1 bg-zinc-700 rounded" />
                            <div className="w-3/4 h-1 bg-zinc-700 rounded" />
                          </div>
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Nord</span>
                        </div>
                        <div className="aspect-video bg-zinc-800 border border-zinc-700 rounded-xl p-3 flex flex-col justify-between opacity-50 grayscale">
                          <div className="space-y-1">
                            <div className="w-1/2 h-1 bg-zinc-700 rounded" />
                            <div className="w-3/4 h-1 bg-zinc-700 rounded" />
                          </div>
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Solarized</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              
              {activeTab === 'editor' && (
                <motion.div
                  key="editor"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-8"
                >
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">Editor</h3>
                    <p className="text-sm text-zinc-500">Configure how the markdown editor behaves.</p>
                  </div>

                  <div className="bg-zinc-950/30 border border-zinc-800 rounded-2xl p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-zinc-200">Show line numbers</h4>
                        <p className="text-xs text-zinc-500">Display line numbers on the left side of the editor.</p>
                      </div>
                      <button
                        onClick={() => updateSetting('showLineNumbers', !showLineNumbers)}
                        className={`w-10 h-5 rounded-full transition-all relative ${
                          showLineNumbers ? 'bg-purple-600' : 'bg-zinc-800'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                          showLineNumbers ? 'right-0.5' : 'left-0.5'
                        }`} />
                      </button>
                    </div>

                    <div className="h-px bg-zinc-800/50" />

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-zinc-200">Spellcheck</h4>
                        <p className="text-xs text-zinc-500">Enable browser spellcheck in the editor.</p>
                      </div>
                      <button
                        onClick={() => updateSetting('spellcheck', !spellcheck)}
                        className={`w-10 h-5 rounded-full transition-all relative ${
                          spellcheck ? 'bg-purple-600' : 'bg-zinc-800'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                          spellcheck ? 'right-0.5' : 'left-0.5'
                        }`} />
                      </button>
                    </div>

                    <div className="h-px bg-zinc-800/50" />

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-zinc-200">Readable line length</h4>
                        <p className="text-xs text-zinc-500">Limit the width of the editor to improve readability.</p>
                      </div>
                      <button
                        onClick={() => updateSetting('readableLineLength', !readableLineLength)}
                        className={`w-10 h-5 rounded-full transition-all relative ${
                          readableLineLength ? 'bg-purple-600' : 'bg-zinc-800'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                          readableLineLength ? 'right-0.5' : 'left-0.5'
                        }`} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'files' && (
                <motion.div
                  key="files"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-8"
                >
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">Files & Links</h3>
                    <p className="text-sm text-zinc-500">Manage how files are created and linked.</p>
                  </div>

                  <div className="bg-zinc-950/30 border border-zinc-800 rounded-2xl p-6 space-y-6">
                    <div className="space-y-3">
                      <h4 className="font-bold text-zinc-200">Default location for new notes</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {['root', 'current', 'folder'].map((loc) => (
                          <button
                            key={loc}
                            onClick={() => updateSetting('newFileLocation', loc)}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                              newFileLocation === loc 
                                ? 'bg-purple-500/10 border-purple-500/50 text-purple-400' 
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                            }`}
                          >
                            <span className="text-xs capitalize">{loc === 'root' ? 'Vault root' : loc === 'current' ? 'Same folder as current file' : 'In the folder specified below'}</span>
                            {newFileLocation === loc && <ChevronRight size={14} />}
                          </button>
                        ))}
                      </div>
                      {newFileLocation === 'folder' && (
                        <input 
                          type="text"
                          placeholder="Folder path (e.g. Notes/New)"
                          value={newFileFolderPath}
                          onChange={(e) => updateSetting('newFileFolderPath', e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-4 text-xs outline-none focus:border-purple-500/50"
                        />
                      )}
                    </div>

                    <div className="h-px bg-zinc-800/50" />

                    <div className="space-y-3">
                      <h4 className="font-bold text-zinc-200">Default location for new attachments</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {['root', 'current', 'subfolder', 'folder'].map((loc) => (
                          <button
                            key={loc}
                            onClick={() => updateSetting('attachmentLocation', loc)}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                              attachmentLocation === loc 
                                ? 'bg-purple-500/10 border-purple-500/50 text-purple-400' 
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                            }`}
                          >
                            <span className="text-xs capitalize">
                              {loc === 'root' ? 'Vault root' : 
                               loc === 'current' ? 'Same folder as current file' : 
                               loc === 'subfolder' ? 'In subfolder under current folder' : 
                               'In the folder specified below'}
                            </span>
                            {attachmentLocation === loc && <ChevronRight size={14} />}
                          </button>
                        ))}
                      </div>
                      {(attachmentLocation === 'folder' || attachmentLocation === 'subfolder') && (
                        <input 
                          type="text"
                          placeholder={attachmentLocation === 'subfolder' ? 'Subfolder name (default: attachments)' : 'Folder path (e.g. Assets)'}
                          value={attachmentFolderPath}
                          onChange={(e) => updateSetting('attachmentFolderPath', e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-4 text-xs outline-none focus:border-purple-500/50"
                        />
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
