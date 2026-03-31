import { create } from 'zustand';
import { VaultState, VaultFile, Link } from '../types';
import _ from 'lodash';

export const useVaultStore = create<VaultState>((set, get) => ({
  vaultName: '',
  files: [],
  activeFilePath: null,
  links: [],
  backlinks: {},
  plugins: [],
  githubToken: localStorage.getItem('github_token'),
  owner: null,
  repo: null,
  branch: null,
  fontSize: 14,
  showLineNumbers: true,
  spellcheck: true,
  readableLineLength: true,
  newFileLocation: 'root',
  newFileFolderPath: '',
  attachmentLocation: 'subfolder',
  attachmentFolderPath: 'attachments',

  setVault: (name, files) => {
    set({ vaultName: name, files });
    get().parseLinks();
    get().discoverPlugins();
  },

  setPlugins: (plugins) => set({ plugins }),

  togglePlugin: async (id, enabled) => {
    const plugins = get().plugins.map(p => p.id === id ? { ...p, enabled } : p);
    set({ plugins });

    // Persist to GitHub
    const { owner, repo, branch, githubToken } = get();
    if (!owner || !repo || !githubToken) return;

    const enabledPluginIds = plugins.filter(p => p.enabled).map(p => p.id);
    try {
      const { commitFile } = await import('../services/githubService');
      await commitFile(
        githubToken,
        owner,
        repo,
        '.obsidian/community-plugins.json',
        JSON.stringify(enabledPluginIds, null, 2),
        branch || 'main'
      );
    } catch (e) {
      console.error('Failed to persist plugin settings to GitHub', e);
    }
  },

  setFontSize: (size) => set({ fontSize: size }),

  updateSetting: (key, value) => set({ [key]: value } as any),

  setActiveFile: (path) => set({ activeFilePath: path }),

  setGithubAuth: (token) => {
    localStorage.setItem('github_token', token);
    set({ githubToken: token });
  },

  setRepoInfo: (owner, repo, branch) => {
    set({ owner, repo, branch });
  },

  logout: () => {
    localStorage.removeItem('github_token');
    set({ githubToken: null, owner: null, repo: null, branch: null, files: [], vaultName: '' });
  },

  updateFile: (path: string, updates: Partial<VaultFile>) => {
    const files = [...get().files];
    let changed = false;
    
    const updateRecursive = (list: VaultFile[]): VaultFile[] => {
      return list.map(file => {
        if (file.path === path) {
          changed = true;
          return { ...file, ...updates };
        }
        if (file.children) {
          const newChildren = updateRecursive(file.children);
          if (newChildren !== file.children) {
            return { ...file, children: newChildren };
          }
        }
        return file;
      });
    };

    const newFiles = updateRecursive(files);
    if (changed) {
      set({ files: newFiles });
      if (updates.content !== undefined) {
        get().parseLinks();
      }
    }
  },

  updateFiles: (updatesMap: Record<string, Partial<VaultFile>>) => {
    const files = get().files;
    let changed = false;

    const updateRecursive = (list: VaultFile[]): VaultFile[] => {
      return list.map(file => {
        let updatedFile = file;
        if (updatesMap[file.path]) {
          changed = true;
          updatedFile = { ...file, ...updatesMap[file.path] };
        }
        if (updatedFile.children) {
          const newChildren = updateRecursive(updatedFile.children);
          if (newChildren !== updatedFile.children) {
            updatedFile = { ...updatedFile, children: newChildren };
          }
        }
        return updatedFile;
      });
    };

    const newFiles = updateRecursive(files);
    if (changed) {
      set({ files: newFiles });
      get().parseLinks();
    }
  },

  parseLinks: () => {
    const files = get().files;
    const newLinks: Link[] = [];
    const newBacklinks: Record<string, string[]> = {};

    const findLinksRecursive = (list: VaultFile[]) => {
      for (const file of list) {
        if (file.type === 'file' && file.name.endsWith('.md') && file.content) {
          // Regex for [[wikilinks]] - handle [[link]], [[link|alias]], [[link#section]]
          const matches = file.content.matchAll(/\[\[(.*?)\]\]/g);
          for (const match of matches) {
            const rawTarget = match[1];
            const target = rawTarget.split('|')[0].split('#')[0].trim();
            
            if (target) {
              newLinks.push({ source: file.path, target });
              
              if (!newBacklinks[target]) newBacklinks[target] = [];
              if (!newBacklinks[target].includes(file.path)) {
                newBacklinks[target].push(file.path);
              }
            }
          }
        }
        if (file.children) findLinksRecursive(file.children);
      }
    };

    findLinksRecursive(files);
    set({ links: newLinks, backlinks: newBacklinks });
  },

  discoverPlugins: async () => {
    const { owner, repo, branch, githubToken, files } = get();
    if (!owner || !repo) return;

    // 1. Find .obsidian/community-plugins.json to see what's enabled
    const obsidianDir = files.find(f => f.name === '.obsidian' && f.type === 'dir');
    if (!obsidianDir || !obsidianDir.children) return;

    const communityPluginsFile = obsidianDir.children.find(f => f.name === 'community-plugins.json');
    let enabledPluginIds: string[] = [];

    if (communityPluginsFile) {
      try {
        const { fetchFileContent } = await import('../services/githubService');
        const { content } = await fetchFileContent(owner, repo, communityPluginsFile.path, githubToken, branch || 'main');
        enabledPluginIds = JSON.parse(content);
      } catch (e) {
        console.error('Failed to fetch community-plugins.json', e);
      }
    }

    // 2. Scan .obsidian/plugins/ for manifest.json of each plugin
    const pluginsDir = obsidianDir.children.find(f => f.name === 'plugins' && f.type === 'dir');
    const discoveredPlugins: any[] = [];

    if (pluginsDir && pluginsDir.children) {
      const { fetchFileContent } = await import('../services/githubService');
      
      for (const pluginFolder of pluginsDir.children) {
        if (pluginFolder.type === 'dir' && pluginFolder.children) {
          const manifestFile = pluginFolder.children.find(f => f.name === 'manifest.json');
          if (manifestFile) {
            try {
              const { content } = await fetchFileContent(owner, repo, manifestFile.path, githubToken, branch || 'main');
              const manifest = JSON.parse(content);
              discoveredPlugins.push({
                id: manifest.id,
                name: manifest.name,
                author: manifest.author,
                description: manifest.description,
                version: manifest.version,
                enabled: enabledPluginIds.includes(manifest.id)
              });
            } catch (e) {
              console.warn(`Failed to fetch manifest for plugin ${pluginFolder.name}`, e);
            }
          }
        }
      }
    }

    set({ plugins: discoveredPlugins });
  }
}));
