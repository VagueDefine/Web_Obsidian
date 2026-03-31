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

  setVault: (name, files) => {
    set({ vaultName: name, files });
    get().parseLinks();
  },

  setPlugins: (plugins) => set({ plugins }),

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
    set({ githubToken: null, owner: null, repo: null, branch: null, files: [], vaultName: '', activeFilePath: null });
  },

  switchVault: () => {
    set({ owner: null, repo: null, branch: null, files: [], vaultName: '', activeFilePath: null });
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
  }
}));
