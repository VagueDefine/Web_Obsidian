import React, { useState, useEffect } from 'react';
import { useVaultStore } from '../store/vaultStore';
import { fetchUserRepos, fetchRepoBranches, createRepo, fetchGitHubRepo, fetchFileContent } from '../services/githubService';
import { Github, Plus, FolderOpen, ChevronRight, Loader2, Globe, Lock, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const VaultSwitcher: React.FC = () => {
  const { githubToken, setGithubAuth, setVault, setRepoInfo, logout, updateFile } = useVaultStore();
  const [view, setView] = useState<'login' | 'main' | 'create' | 'select-repo' | 'select-branch'>('login');
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);

  const [manualToken, setManualToken] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);

  useEffect(() => {
    if (githubToken) {
      setView('main');
    } else {
      setView('login');
    }
  }, [githubToken]);

  const handleManualTokenSubmit = () => {
    if (manualToken.trim()) {
      setGithubAuth(manualToken.trim());
    }
  };

  const handleLogin = async () => {
    const res = await fetch('/api/auth/github/url');
    const { url } = await res.json();
    
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      url,
      'github_auth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GITHUB_AUTH_SUCCESS') {
        setGithubAuth(event.data.token);
        window.removeEventListener('message', handleMessage);
      }
    };
    window.addEventListener('message', handleMessage);
  };

  const loadRepos = async () => {
    setIsLoading(true);
    try {
      const data = await fetchUserRepos(githubToken!);
      setRepos(data);
      setView('select-repo');
    } catch (e) {
      alert('Failed to load repositories');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRepo = async (repo: any) => {
    setSelectedRepo(repo);
    setIsLoading(true);
    try {
      const data = await fetchRepoBranches(githubToken!, repo.owner.login, repo.name);
      setBranches(data);
      setView('select-branch');
    } catch (e) {
      alert('Failed to load branches');
    } finally {
      setIsLoading(false);
    }
  };

  const scanFilesForLinks = async (fileList: any[], owner: string, repo: string, branch: string, token: string | null) => {
    const mdFiles: any[] = [];
    const collectMd = (list: any[]) => {
      for (const f of list) {
        if (f.type === 'file' && f.name.endsWith('.md')) mdFiles.push(f);
        if (f.children) collectMd(f.children);
      }
    };
    collectMd(fileList);

    // Fetch contents in batches to avoid hitting rate limits too fast
    const batchSize = 5;
    for (let i = 0; i < mdFiles.length; i += batchSize) {
      const batch = mdFiles.slice(i, i + batchSize);
      const updates: Record<string, any> = {};
      
      await Promise.all(batch.map(async (file) => {
        try {
          const { content } = await fetchFileContent(owner, repo, file.path, token, branch);
          updates[file.path] = { content };
        } catch (e) {
          console.warn(`Failed to scan ${file.path} for links:`, e);
        }
      }));

      if (Object.keys(updates).length > 0) {
        useVaultStore.getState().updateFiles(updates);
      }
      
      // Small delay between batches to be nice to GitHub API
      if (i + batchSize < mdFiles.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  const handleOpenVault = async (branchName: string) => {
    setIsLoading(true);
    try {
      const { files, branch } = await fetchGitHubRepo(selectedRepo.owner.login, selectedRepo.name, githubToken, branchName);
      
      setRepoInfo(selectedRepo.owner.login, selectedRepo.name, branch);
      setVault(selectedRepo.name, files);

      // Start background scan for .md files to build graph
      scanFilesForLinks(files, selectedRepo.owner.login, selectedRepo.name, branch, githubToken);
    } catch (e) {
      alert('Failed to open vault');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRepo = async () => {
    if (!newRepoName) return;
    setIsLoading(true);
    try {
      const repo = await createRepo(githubToken!, newRepoName, isPrivate);
      setSelectedRepo(repo);
      handleOpenVault(repo.default_branch || 'main');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (view === 'login') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center max-w-md mx-auto">
        <div className="w-20 h-20 bg-purple-500/10 rounded-3xl flex items-center justify-center mb-8 border border-purple-500/20">
          <Github className="text-purple-400" size={40} />
        </div>
        <h1 className="text-3xl font-bold mb-4">Web Obsidian</h1>
        <p className="text-zinc-400 mb-8">
          Sign in with GitHub to manage your vaults, create new ones, and sync your notes across devices.
        </p>
        
        <div className="w-full space-y-4">
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center space-x-3 bg-white text-black px-8 py-3 rounded-xl font-bold hover:bg-zinc-200 transition-all active:scale-95"
          >
            <Github size={20} />
            <span>Continue with GitHub</span>
          </button>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-800"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-zinc-950 px-2 text-zinc-500 font-bold">Or use a token</span>
            </div>
          </div>

          {!showTokenInput ? (
            <button
              onClick={() => setShowTokenInput(true)}
              className="w-full py-3 text-sm font-bold text-zinc-400 hover:text-white transition-colors"
            >
              Login with Personal Access Token
            </button>
          ) : (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <input
                type="password"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500/50 transition-all"
              />
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowTokenInput(false)}
                  className="flex-1 py-3 text-sm font-bold text-zinc-500 hover:bg-zinc-900 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleManualTokenSubmit}
                  disabled={!manualToken}
                  className="flex-[2] bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
                >
                  Connect Token
                </button>
              </div>
              <p className="text-[10px] text-zinc-600 text-left leading-relaxed">
                You can create a token in GitHub Settings &gt; Developer settings &gt; Personal access tokens. 
                Required scopes: <code className="text-zinc-400">repo</code>.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-8 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/20">
            <Github className="text-purple-400" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Vault Switcher</h1>
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">GitHub Integration</p>
          </div>
        </div>
        <button onClick={logout} className="p-2 text-zinc-500 hover:text-red-400 transition-colors">
          <LogOut size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {view === 'main' && (
          <>
            <button
              onClick={loadRepos}
              className="group flex items-center p-6 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-purple-500/50 transition-all text-left"
            >
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mr-6 border border-blue-500/20 group-hover:scale-110 transition-transform">
                <FolderOpen className="text-blue-400" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg">Open vault from GitHub</h3>
                <p className="text-sm text-zinc-500">Select an existing repository from your account</p>
              </div>
              <ChevronRight className="text-zinc-700 group-hover:text-purple-400 transition-colors" />
            </button>

            <button
              onClick={() => setView('create')}
              className="group flex items-center p-6 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-purple-500/50 transition-all text-left"
            >
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mr-6 border border-green-500/20 group-hover:scale-110 transition-transform">
                <Plus className="text-green-400" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg">Create new vault</h3>
                <p className="text-sm text-zinc-500">Create a new repository for your notes</p>
              </div>
              <ChevronRight className="text-zinc-700 group-hover:text-purple-400 transition-colors" />
            </button>
          </>
        )}

        {view === 'select-repo' && (
          <div className="space-y-2">
            <button onClick={() => setView('main')} className="text-xs text-zinc-500 hover:text-zinc-300 mb-4 flex items-center">
              ← Back to main
            </button>
            <div className="max-h-[400px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              {repos.map(repo => (
                <button
                  key={repo.id}
                  onClick={() => handleSelectRepo(repo)}
                  className="w-full flex items-center p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-purple-500/30 transition-all text-left"
                >
                  {repo.private ? <Lock size={16} className="mr-3 text-zinc-600" /> : <Globe size={16} className="mr-3 text-zinc-600" />}
                  <span className="flex-1 font-medium">{repo.name}</span>
                  <span className="text-[10px] text-zinc-600 uppercase font-bold">{repo.language || 'Markdown'}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {view === 'select-branch' && (
          <div className="space-y-2">
            <button onClick={() => setView('select-repo')} className="text-xs text-zinc-500 hover:text-zinc-300 mb-4 flex items-center">
              ← Back to repositories
            </button>
            <h3 className="text-sm font-bold mb-4">Select branch for <span className="text-purple-400">{selectedRepo.name}</span></h3>
            <div className="grid grid-cols-2 gap-2">
              {branches.map(branch => (
                <button
                  key={branch.name}
                  onClick={() => handleOpenVault(branch.name)}
                  className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-purple-500/30 transition-all text-sm font-medium"
                >
                  {branch.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {view === 'create' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <button onClick={() => setView('main')} className="text-xs text-zinc-500 hover:text-zinc-300 mb-6 flex items-center">
              ← Back
            </button>
            <h3 className="text-xl font-bold mb-6">Create New Vault</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Vault Name</label>
                <input
                  type="text"
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  placeholder="my-new-notes"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
                <div className="flex items-center">
                  {isPrivate ? <Lock size={18} className="mr-3 text-zinc-500" /> : <Globe size={18} className="mr-3 text-zinc-500" />}
                  <div>
                    <p className="text-sm font-bold">{isPrivate ? 'Private Repository' : 'Public Repository'}</p>
                    <p className="text-[10px] text-zinc-600 uppercase font-bold">Visibility settings</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPrivate(!isPrivate)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${isPrivate ? 'bg-purple-600' : 'bg-zinc-800'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isPrivate ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

              <button
                onClick={handleCreateRepo}
                disabled={!newRepoName || isLoading}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-purple-500/10"
              >
                {isLoading ? <Loader2 className="animate-spin mx-auto" /> : 'Create and Open Vault'}
              </button>
            </div>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="fixed inset-0 bg-zinc-950/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <Loader2 size={40} className="text-purple-500 animate-spin mb-4" />
          <p className="text-zinc-400 font-medium">Syncing with GitHub...</p>
        </div>
      )}
    </div>
  );
};
