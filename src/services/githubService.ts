import { VaultFile } from '../types';

const getHeaders = (token: string | null) => ({
  'Authorization': token ? `token ${token}` : '',
  'Accept': 'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
});

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

export const fetchUserRepos = async (token: string) => {
  const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error('Failed to fetch repositories');
  return await response.json();
};

export const fetchRepoBranches = async (token: string, owner: string, repo: string) => {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error('Failed to fetch branches');
  return await response.json();
};

export const createRepo = async (token: string, name: string, isPrivate: boolean = true) => {
  const response = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ name, private: isPrivate, auto_init: true }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create repository');
  }
  return await response.json();
};

export const fetchGitHubRepo = async (owner: string, repo: string, token: string | null, customBranch?: string): Promise<{ files: VaultFile[], branch: string }> => {
  // 1. Fetch repo info to get the default branch if not provided
  const repoInfoUrl = `https://api.github.com/repos/${owner}/${repo}`;
  const repoResponse = await fetch(repoInfoUrl, { headers: getHeaders(token), cache: 'no-store' });
  
  if (!repoResponse.ok) {
    const errorData = await repoResponse.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(`GitHub API Error: ${errorData.message || repoResponse.statusText}`);
  }

  const repoData = await repoResponse.json();
  const branch = customBranch || repoData.default_branch || 'main';

  // 2. Get the SHA of the branch
  const branchUrl = `https://api.github.com/repos/${owner}/${repo}/branches/${branch}`;
  const branchResponse = await fetch(branchUrl, { headers: getHeaders(token) });
  if (!branchResponse.ok) {
    throw new Error(`Branch "${branch}" not found in repository "${owner}/${repo}".`);
  }
  const branchData = await branchResponse.json();
  const sha = branchData.commit.sha;

  // 3. Fetch the tree using the SHA
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`;
  
  const response = await fetch(apiUrl, { headers: getHeaders(token) });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(`Failed to fetch repository tree: ${errorData.message || response.statusText}`);
  }
  
  const data = await response.json();
  const tree = data.tree;
  
  const root: VaultFile[] = [];
  const pathMap: Record<string, VaultFile> = {};

  for (const item of tree) {
    const parts = item.path.split('/');
    const name = parts[parts.length - 1];
    const path = item.path;
    const type = item.type === 'tree' ? 'dir' : 'file';

    const file: VaultFile = { name, path, type, sha: item.sha };
    if (type === 'dir') file.children = [];

    pathMap[path] = file;

    if (parts.length === 1) {
      root.push(file);
    } else {
      const parentPath = parts.slice(0, -1).join('/');
      const parent = pathMap[parentPath];
      if (parent && parent.children) {
        parent.children.push(file);
      }
    }
  }

  return { files: root, branch };
};

export const fetchFileContent = async (owner: string, repo: string, path: string, token: string | null, branch: string = 'main'): Promise<{ content: string, downloadUrl?: string, isBinary: boolean, sha: string }> => {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${branch}`;
  
  // 1. Fetch metadata first to get download_url and check type
  const metaResponse = await fetch(url, { headers: getHeaders(token), cache: 'no-store' });
  if (!metaResponse.ok) throw new Error(`Failed to fetch file metadata: ${path}`);
  const data = await metaResponse.json();
  
  const isImage = /\.(png|jpe?g|gif|svg|webp|ico)$/i.test(path);
  const isBinary = isImage || data.size > 1024 * 1024 * 2; // Treat > 2MB as binary for safety if not explicitly text

  if (isImage) {
    return { content: '', downloadUrl: data.download_url, isBinary: true, sha: data.sha };
  }

  // 2. Fetch raw content for text files
  const rawResponse = await fetch(data.download_url, { cache: 'no-store' });

  if (!rawResponse.ok) {
    // Fallback to metadata if download_url fails (unlikely)
    return { content: '', downloadUrl: data.download_url, isBinary: true, sha: data.sha };
  }

  try {
    const content = await rawResponse.text();
    return { content, downloadUrl: data.download_url, isBinary: false, sha: data.sha };
  } catch (e) {
    return { content: '', downloadUrl: data.download_url, isBinary: true, sha: data.sha };
  }
};

export const commitFile = async (token: string, owner: string, repo: string, path: string, content: string, branch: string, currentSha?: string) => {
  // 1. Get current file SHA if it exists
  let sha = currentSha;
  
  // Always fetch latest SHA to prevent conflict, especially if currentSha is not provided or might be stale
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${branch}&_t=${Date.now()}`, {
      headers: getHeaders(token),
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      sha = data.sha;
    }
  } catch (e) {}

  // 2. Commit
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(path)}`, {
    method: 'PUT',
    headers: getHeaders(token),
    body: JSON.stringify({
      message: `Update ${path}`,
      content: btoa(unescape(encodeURIComponent(content))),
      sha,
      branch,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to commit file');
  }
  return await response.json();
};
