import { VaultFile } from '../types';
import { fetchFileContent } from './githubService';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  minAppVersion: string;
  description: string;
  author: string;
}

export const discoverPlugins = async (files: VaultFile[]): Promise<string[]> => {
  const obsidianDir = files.find(f => f.name === '.obsidian' && f.type === 'dir');
  if (!obsidianDir || !obsidianDir.children) return [];

  const pluginsDir = obsidianDir.children.find(f => f.name === 'plugins' && f.type === 'dir');
  if (!pluginsDir || !pluginsDir.children) return [];

  return pluginsDir.children
    .filter(f => f.type === 'dir')
    .map(f => f.name);
};

export const loadPlugin = async (owner: string, repo: string, pluginId: string, token: string | null, branch: string = 'main'): Promise<void> => {
  try {
    const path = `.obsidian/plugins/${pluginId}/main.js`;
    const { content: code } = await fetchFileContent(owner, repo, path, token, branch);
    
    console.log(`Attempting to load plugin: ${pluginId}`);
    
    // Mock Obsidian API
    const obsidianMock = {
      Plugin: class {
        app: any;
        manifest: any;
        constructor(app: any, manifest: any) {
          this.app = app;
          this.manifest = manifest;
        }
        onload() {}
        onunload() {}
        addSettingTab() {}
        addCommand() {}
        registerEvent() {}
      },
      // Add more mocks as needed
    };

    // This is a simplified execution. Real plugins are complex.
    // We wrap the code in a function that provides the 'obsidian' module.
    const pluginFunc = new Function('require', 'module', 'exports', code);
    const module = { exports: {} as any };
    
    const requireMock = (name: string) => {
      if (name === 'obsidian') return obsidianMock;
      return {};
    };

    pluginFunc(requireMock, module, module.exports);
    
    const PluginClass = module.exports.default || module.exports;
    if (typeof PluginClass === 'function') {
      const pluginInstance = new PluginClass({ workspace: {} }, { id: pluginId });
      if (pluginInstance.onload) pluginInstance.onload();
      console.log(`Plugin ${pluginId} initialized (Mock)`);
    }
  } catch (error) {
    console.error(`Failed to load plugin ${pluginId}:`, error);
  }
};
