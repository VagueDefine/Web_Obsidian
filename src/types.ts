export interface VaultFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  content?: string;
  sha?: string;
  downloadUrl?: string;
  isBinary?: boolean;
  children?: VaultFile[];
}

export interface Link {
  source: string; // path
  target: string; // path or name
}

export interface Plugin {
  id: string;
  name: string;
  author?: string;
  description?: string;
  version?: string;
  enabled: boolean;
}

export interface VaultState {
  vaultName: string;
  files: VaultFile[];
  activeFilePath: string | null;
  links: Link[];
  backlinks: Record<string, string[]>; // target -> [sources]
  plugins: Plugin[]; // Obsidian plugins
  
  // GitHub Auth & Repo Info
  githubToken: string | null;
  owner: string | null;
  repo: string | null;
  branch: string | null;
  fontSize: number;
  showLineNumbers: boolean;
  spellcheck: boolean;
  readableLineLength: boolean;
  newFileLocation: 'root' | 'current' | 'folder';
  newFileFolderPath: string;
  attachmentLocation: 'root' | 'current' | 'subfolder' | 'folder';
  attachmentFolderPath: string;
  
  // Actions
  setVault: (name: string, files: VaultFile[]) => void;
  setPlugins: (plugins: Plugin[]) => void;
  togglePlugin: (id: string, enabled: boolean) => Promise<void>;
  setFontSize: (size: number) => void;
  updateSetting: (key: keyof VaultState, value: any) => void;
  setActiveFile: (path: string) => void;
  updateFile: (path: string, updates: Partial<VaultFile>) => void;
  updateFiles: (updatesMap: Record<string, Partial<VaultFile>>) => void;
  parseLinks: () => void;
  discoverPlugins: () => Promise<void>;
  setGithubAuth: (token: string) => void;
  setRepoInfo: (owner: string, repo: string, branch: string) => void;
  logout: () => void;
}
