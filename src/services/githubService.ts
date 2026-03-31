import { VaultFile } from '../types';

const getHeaders = (token: string | null) => ({
  'Authorization': token ? `token ${token}` : '',
  'Accept': 'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
});

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
  const repoInfoUrl = `https://api.github.com/repos/${owner}/${repo}?t=${Date.now()}`;
  const repoResponse = await fetch(repoInfoUrl, { 
    headers: getHeaders(token),
    cache: 'no-store'
  });
  
  if (!repoResponse.ok) {
    const errorData = await repoResponse.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(`GitHub API Error: ${errorData.message || repoResponse.statusText}`);
  }

  const repoData = await repoResponse.json();
  const branch = customBranch || repoData.default_branch || 'main';

  // 2. Get the SHA of the branch
  const branchUrl = `https://api.github.com/repos/${owner}/${repo}/branches/${branch}?t=${Date.now()}`;
  const branchResponse = await fetch(branchUrl, { 
    headers: getHeaders(token),
    cache: 'no-store'
  });
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
  const tree = data.tree || [];
  
  const root: VaultFile[] = [];
  const pathMap: Record<string, VaultFile> = {};

  // Sort tree by path length to ensure parents are processed before children
  const sortedTree = [...tree].sort((a, b) => a.path.split('/').length - b.path.split('/').length);

  for (const item of sortedTree) {
    const parts = item.path.split('/');
    const name = parts[parts.length - 1];
    const path = item.path;
    const type = item.type === 'tree' ? 'dir' : 'file';

    const file: VaultFile = { name, path, type };
    if (type === 'dir') file.children = [];

    pathMap[path] = file;

    if (parts.length === 1) {
      root.push(file);
    } else {
      const parentPath = parts.slice(0, -1).join('/');
      const parent = pathMap[parentPath];
      if (parent && parent.children) {
        parent.children.push(file);
      } else {
        // If parent is missing (shouldn't happen with sortedTree), add to root as fallback
        root.push(file);
      }
    }
  }

  return { files: root, branch };
};

export const fetchFileContent = async (owner: string, repo: string, path: string, token: string | null, branch: string = 'main'): Promise<{ content: string, downloadUrl?: string, isBinary: boolean }> => {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}&t=${Date.now()}`;
  
  // 1. Fetch metadata first to get download_url and check type
  let metaResponse;
  try {
    metaResponse = await fetch(url, { 
      headers: getHeaders(token),
      cache: 'no-store'
    });
  } catch (e) {
    console.error(`Meta fetch failed for ${path}:`, e);
    throw new Error(`Failed to fetch file metadata: ${path} (Network error)`);
  }

  if (!metaResponse.ok) {
    const errorData = await metaResponse.json().catch(() => ({}));
    console.error(`Meta fetch failed for ${path}:`, metaResponse.status, errorData);
    throw new Error(`Failed to fetch file metadata: ${path} (${metaResponse.status})`);
  }
  const data = await metaResponse.json();
  
  const isImage = /\.(png|jpe?g|gif|svg|webp|ico)$/i.test(path);
  const isBinary = isImage || data.size > 1024 * 1024 * 2; // Treat > 2MB as binary for safety if not explicitly text

  if (isImage) {
    return { content: '', downloadUrl: data.download_url, isBinary: true };
  }

  // If content is already in the metadata, use it
  if (data.content && data.encoding === 'base64') {
    try {
      const content = decodeURIComponent(escape(atob(data.content.replace(/\s/g, ''))));
      return { content, downloadUrl: data.download_url, isBinary: false };
    } catch (e) {
      console.error(`Base64 decoding failed for ${path}:`, e);
      // Fallback to raw fetch if decoding fails
    }
  }

  // 2. Fetch raw content for text files
  let rawResponse;
  try {
    rawResponse = await fetch(data.download_url);
  } catch (e) {
    console.error(`Raw fetch failed for ${path}:`, e);
    throw new Error(`Failed to fetch raw file content: ${path} (Network error)`);
  }

  if (!rawResponse.ok) {
    console.error(`Raw fetch failed for ${path}:`, rawResponse.status);
    // Fallback to metadata if download_url fails (unlikely)
    return { content: '', downloadUrl: data.download_url, isBinary: true };
  }

  try {
    const content = await rawResponse.text();
    return { content, downloadUrl: data.download_url, isBinary: false };
  } catch (e) {
    console.error(`Raw text parsing failed for ${path}:`, e);
    return { content: '', downloadUrl: data.download_url, isBinary: true };
  }
};

export const commitFile = async (token: string, owner: string, repo: string, path: string, content: string, branch: string) => {
  // 1. Get current file SHA if it exists
  let sha: string | undefined;
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}&t=${Date.now()}`, {
      headers: getHeaders(token),
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      sha = data.sha;
    }
  } catch (e) {}

  // 2. Commit
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
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
