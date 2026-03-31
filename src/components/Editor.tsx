import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useVaultStore } from '../store/vaultStore';
import { EditorView, basicSetup } from 'codemirror';
import { markdown as cmMarkdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorState } from '@codemirror/state';
import { commitFile, fetchFileContent } from '../services/githubService';
import { Loader2, Check, CloudOff, FileText, Download, ExternalLink, Eye, Edit3 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import _ from 'lodash';

export const Editor: React.FC = () => {
  const { activeFilePath, files, updateFile, githubToken, owner, repo, branch } = useVaultStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  // Find the active file object
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

  // Pre-process content to handle wikilinks [[link]], ![[embed]], and callouts
  const processedContent = useMemo(() => {
    if (!activeFile?.content) return '';
    let content = activeFile.content;

    // 1. Handle Excalidraw: If it's an excalidraw file, try to find the embedded SVG/PNG
    if (activeFilePath?.endsWith('.excalidraw.md')) {
      const imageMatch = content.match(/%%[\s\S]*?!\[\[(.*?)\]\]/);
      if (imageMatch) {
        // It's referencing an exported image, let's just show that
        return `![Excalidraw Export](${imageMatch[1]})`;
      }
      // If no image found, we'll use the ExcalidrawView
    }

    // 2. Replace ![[image.png|alias]] with standard markdown image syntax
    content = content.replace(/!\[\[(.*?)\]\]/g, (match, p1) => {
      const [target, alias] = p1.split('|');
      // If it's a .md file, it's an embed, not an image
      if (target.endsWith('.md')) {
        return `:::embed{target="${target}"}:::`;
      }
      return `![${alias || target}](${target})`;
    });

    // 3. Replace [[note|alias]] with standard markdown link syntax
    content = content.replace(/\[\[(.*?)\]\]/g, (match, p1) => {
      const [target, alias] = p1.split('|');
      return `[${alias || target}](wikilink:${target})`;
    });

    // 4. Handle Callouts: > [!info] -> :::callout{type="info"}:::
    content = content.replace(/^> \[!(.*?)\](.*?)$/gm, (match, type, title) => {
      return `:::callout{type="${type.toLowerCase()}" title="${title.trim()}"}:::`;
    });

    return content;
  }, [activeFile?.content, activeFilePath]);

  // Find backlinks for the active file
  const activeBacklinks = useMemo(() => {
    if (!activeFilePath) return [];
    
    // The vaultStore already maintains backlinks: Record<string, string[]>
    // But it might be by name or path. Let's find all sources that link to this path
    const fileName = activeFilePath.split('/').pop()?.replace('.md', '') || '';
    const sources = new Set<string>();
    
    // Check by path
    if (useVaultStore.getState().backlinks[activeFilePath]) {
      useVaultStore.getState().backlinks[activeFilePath].forEach(s => sources.add(s));
    }
    // Check by name
    if (useVaultStore.getState().backlinks[fileName]) {
      useVaultStore.getState().backlinks[fileName].forEach(s => sources.add(s));
    }
    
    return Array.from(sources);
  }, [activeFilePath, files, useVaultStore.getState().backlinks]);

  // Custom link renderer to handle wikilinks
  const MarkdownLink = useMemo(() => ({ href, children, ...props }: any) => {
    if (href?.startsWith('wikilink:')) {
      const target = href.replace('wikilink:', '');
      
      const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        // Try to find the file by name or path
        const findFileByTarget = (list: any[], target: string): string | null => {
          for (const file of list) {
            if (file.path === target || file.name === target || file.name === target + '.md') {
              return file.path;
            }
            if (file.children) {
              const found = findFileByTarget(file.children, target);
              if (found) return found;
            }
          }
          return null;
        };
        
        const path = findFileByTarget(files, target);
        if (path) {
          useVaultStore.getState().setActiveFile(path);
        } else {
          console.warn(`Could not find file for wikilink: ${target}`);
        }
      };

      return (
        <a 
          href="#" 
          onClick={handleClick}
          className="text-purple-400 hover:underline cursor-pointer"
          {...props}
        >
          {children}
        </a>
      );
    }

    return (
      <a 
        href={href} 
        className="text-purple-400 hover:underline" 
        target="_blank" 
        rel="noopener noreferrer" 
        {...props}
      >
        {children}
      </a>
    );
  }, [files]);

  // Custom image renderer for Markdown to resolve relative paths
  const MarkdownImage = useMemo(() => ({ src, alt }: { src?: string; alt?: string }) => {
    if (!src) return null;
    
    const resolvedSrc = (() => {
      if (src.startsWith('http') || src.startsWith('data:')) return src;
      
      // Resolve relative path or search by name
      if (owner && repo && branch) {
        // 1. Try to find the file in the vault by name (Obsidian style)
        const findFileByPathOrName = (list: any[], target: string): string | null => {
          // Normalize target (remove leading ./ or ../)
          const cleanTarget = target.replace(/^(\.\/|\.\.\/)+/, '');
          const fileName = cleanTarget.split('/').pop();

          for (const file of list) {
            if (file.path === cleanTarget || file.name === cleanTarget || file.name === fileName) {
              return file.path;
            }
            if (file.children) {
              const found = findFileByPathOrName(file.children, target);
              if (found) return found;
            }
          }
          return null;
        };

        const actualPath = findFileByPathOrName(files, src);
        
        if (actualPath) {
          const cleanPath = actualPath.replace(/\/+/g, '/').replace(/^\//, '');
          return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${cleanPath}`;
        }

        // 2. Fallback to relative path from active file
        if (activeFilePath) {
          let fullPath = src;
          if (!src.startsWith('/') && activeFilePath.includes('/')) {
            const parts = activeFilePath.split('/');
            parts.pop(); // remove filename
            const dir = parts.join('/');
            fullPath = dir ? `${dir}/${src}` : src;
          }
          const cleanPath = fullPath.replace(/\/+/g, '/').replace(/^\//, '');
          return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${cleanPath}`;
        }
      }
      return src;
    })();

    return (
      <span className="my-6 flex flex-col items-center block">
        <img 
          src={resolvedSrc} 
          alt={alt} 
          className="max-w-full rounded-lg border border-zinc-800 shadow-lg" 
          referrerPolicy="no-referrer"
          onError={(e) => {
            const target = e.currentTarget;
            if (!target.dataset.retried) {
              target.dataset.retried = 'true';
              // Try to find by just filename as a last resort
              const fileName = src.split('/').pop();
              if (fileName) {
                const findInVault = (list: any[]): string | null => {
                  for (const f of list) {
                    if (f.name === fileName) return f.path;
                    if (f.children) {
                      const found = findInVault(f.children);
                      if (found) return found;
                    }
                  }
                  return null;
                };
                const path = findInVault(files);
                if (path) {
                  target.src = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
                }
              }
            }
          }}
        />
        {alt && alt !== src && (
          <span className="text-xs text-zinc-500 mt-2 italic">{alt}</span>
        )}
      </span>
    );
  }, [files, activeFilePath, owner, repo, branch]);

  // Custom components for ReactMarkdown
  const components = useMemo(() => ({
    img: MarkdownImage,
    a: MarkdownLink,
    h1: ({node, children, ...props}: any) => {
      const text = node.children.map((c: any) => {
        if (c.type === 'text') return c.value;
        if (c.children) return c.children.map((cc: any) => cc.value || '').join('');
        return '';
      }).join('');
      const id = text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      return <h1 id={id} className="text-3xl font-bold mb-6 text-white border-b border-zinc-800 pb-2" {...props}>{children}</h1>;
    },
    h2: ({node, children, ...props}: any) => {
      const text = node.children.map((c: any) => {
        if (c.type === 'text') return c.value;
        if (c.children) return c.children.map((cc: any) => cc.value || '').join('');
        return '';
      }).join('');
      const id = text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      return <h2 id={id} className="text-2xl font-bold mt-8 mb-4 text-white" {...props}>{children}</h2>;
    },
    h3: ({node, children, ...props}: any) => {
      const text = node.children.map((c: any) => {
        if (c.type === 'text') return c.value;
        if (c.children) return c.children.map((cc: any) => cc.value || '').join('');
        return '';
      }).join('');
      const id = text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      return <h3 id={id} className="text-xl font-bold mt-6 mb-3 text-white" {...props}>{children}</h3>;
    },
    h4: ({node, children, ...props}: any) => {
      const text = node.children.map((c: any) => {
        if (c.type === 'text') return c.value;
        if (c.children) return c.children.map((cc: any) => cc.value || '').join('');
        return '';
      }).join('');
      const id = text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      return <h4 id={id} className="text-lg font-bold mt-5 mb-2 text-white" {...props}>{children}</h4>;
    },
    h5: ({node, children, ...props}: any) => {
      const text = node.children.map((c: any) => {
        if (c.type === 'text') return c.value;
        if (c.children) return c.children.map((cc: any) => cc.value || '').join('');
        return '';
      }).join('');
      const id = text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      return <h5 id={id} className="text-base font-bold mt-4 mb-2 text-white" {...props}>{children}</h5>;
    },
    h6: ({node, children, ...props}: any) => {
      const text = node.children.map((c: any) => {
        if (c.type === 'text') return c.value;
        if (c.children) return c.children.map((cc: any) => cc.value || '').join('');
        return '';
      }).join('');
      const id = text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      return <h6 id={id} className="text-sm font-bold mt-4 mb-2 text-white" {...props}>{children}</h6>;
    },
    p: ({node, children, ...props}: any) => {
      const firstChild = node?.children?.[0];
      const text = firstChild?.value || '';
      
      // Check if this paragraph contains an image
      const hasImage = node.children.some((child: any) => child.tagName === 'img');
      
      // Handle Callouts
      if (text.startsWith(':::callout')) {
        const match = text.match(/type="(.*?)" title="(.*?)"/);
        if (match) {
          const [, type, title] = match;
          const colors: Record<string, string> = {
            info: 'border-blue-500 bg-blue-500/10 text-blue-200',
            todo: 'border-purple-500 bg-purple-500/10 text-purple-200',
            warning: 'border-amber-500 bg-amber-500/10 text-amber-200',
            error: 'border-red-500 bg-red-500/10 text-red-200',
            success: 'border-emerald-500 bg-emerald-500/10 text-emerald-200',
            note: 'border-zinc-500 bg-zinc-500/10 text-zinc-200',
          };
          const colorClass = colors[type] || colors.note;
          
          // Find the content of the callout (the rest of the paragraph or following paragraphs)
          // For now, we'll just show the title nicely. 
          // Real callouts in Obsidian are block-level, but here we're inside a 'p' tag.
          return (
            <div className={`border-l-4 p-4 my-6 rounded-r-lg ${colorClass}`}>
              <div className="flex items-center space-x-2 mb-1 font-bold uppercase text-[10px] tracking-widest opacity-80">
                <span>{type}</span>
                {title && <span className="opacity-50">—</span>}
                {title && <span className="normal-case tracking-normal text-sm">{title}</span>}
              </div>
            </div>
          );
        }
      }

      // Handle Embeds
      if (text.startsWith(':::embed')) {
        const match = text.match(/target="(.*?)"/);
        if (match) {
          const target = match[1];
          const targetFile = findFile(files, target) || findFile(files, target + '.md');
          
          return (
            <div className="border border-zinc-800 rounded-xl my-8 overflow-hidden bg-zinc-900/30 group">
              <div className="p-2 px-4 border-b border-zinc-800 bg-zinc-950/50 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText size={12} className="text-zinc-500" />
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{target}</span>
                </div>
                <button 
                  onClick={() => useVaultStore.getState().setActiveFile(targetFile?.path || target)}
                  className="text-[10px] text-purple-400 hover:text-purple-300 font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Open
                </button>
              </div>
              <div className="p-6 text-sm text-zinc-400 max-h-[200px] overflow-hidden relative">
                {targetFile?.content ? (
                  <div className="line-clamp-6 opacity-80">
                    {targetFile.content.substring(0, 500)}
                    {targetFile.content.length > 500 && '...'}
                  </div>
                ) : (
                  <div className="italic text-zinc-600">Content not loaded. Click open to view.</div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-zinc-900/80 to-transparent" />
              </div>
            </div>
          );
        }
      }

      if (hasImage) {
        return <div className="mb-4 leading-relaxed" {...props}>{children}</div>;
      }

      return <p className="mb-4 leading-relaxed" {...props}>{children}</p>;
    },
    ul: ({node, ...props}: any) => <ul className="list-disc pl-6 mb-4 space-y-2" {...props} />,
    ol: ({node, ...props}: any) => <ol className="list-decimal pl-6 mb-4 space-y-2" {...props} />,
    li: ({node, ...props}: any) => <li {...props} />,
    code: ({node, ...props}: any) => <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono text-purple-300" {...props} />,
    pre: ({node, ...props}: any) => <pre className="bg-zinc-900 p-4 rounded-lg overflow-auto mb-4 border border-zinc-800" {...props} />,
    blockquote: ({node, ...props}: any) => <blockquote className="border-l-4 border-purple-500 pl-4 italic text-zinc-400 mb-4" {...props} />,
  }), [MarkdownImage, MarkdownLink, files]);

  // Special renderer for Excalidraw
  const ExcalidrawView = () => {
    if (!activeFile?.content) return null;
    
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center">
        <div className="w-24 h-24 bg-purple-500/10 rounded-3xl flex items-center justify-center mb-6 border border-purple-500/20">
          <Edit3 size={48} className="text-purple-400" />
        </div>
        <h3 className="text-xl font-bold mb-2 text-white">Excalidraw Drawing</h3>
        <p className="text-zinc-400 mb-8 max-w-md">
          This is an Excalidraw drawing. You can edit the raw JSON below or open it in Obsidian.
        </p>
        <div className="w-full max-w-4xl bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <div className="p-3 border-b border-zinc-800 bg-zinc-950/50 flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-500">Raw Data</span>
            <button 
              onClick={() => setMode('edit')}
              className="text-xs text-purple-400 hover:text-purple-300 font-bold"
            >
              Edit JSON
            </button>
          </div>
          <pre className="p-4 text-left text-xs font-mono text-zinc-400 overflow-auto max-h-[400px] custom-scrollbar">
            {activeFile.content}
          </pre>
        </div>
      </div>
    );
  };

  // Debounced save to GitHub
  const debouncedSave = useRef(
    _.debounce(async (path: string, content: string, token: string, owner: string, repo: string, branch: string) => {
      setSaveStatus('saving');
      try {
        await commitFile(token, owner, repo, path, content, branch);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error) {
        console.error('Save failed:', error);
        setSaveStatus('error');
      }
    }, 2000)
  ).current;

  const getEditorExtensions = (filePath: string | null) => {
    const extensions = [
      basicSetup,
      oneDark,
      EditorView.theme({
        '&': { height: '100%', backgroundColor: '#09090b' },
        '.cm-scroller': { overflow: 'auto' },
        '.cm-content': { padding: '20px', fontSize: '15px', lineHeight: '1.6' },
        '.cm-gutters': { backgroundColor: '#09090b', border: 'none', color: '#3f3f46' },
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && activeFilePath) {
          const content = update.state.doc.toString();
          updateFile(activeFilePath, { content });
          
          if (githubToken && owner && repo && branch) {
            debouncedSave(activeFilePath, content, githubToken, owner, repo, branch);
          }
        }
      }),
    ];

    if (filePath?.endsWith('.md')) {
      extensions.push(cmMarkdown());
    }

    return extensions;
  };

  // Fetch content if missing
  useEffect(() => {
    let isMounted = true;
    if (activeFilePath && activeFile && activeFile.content === undefined && !activeFile.isBinary && !isLoadingContent) {
      const loadContent = async () => {
        if (!githubToken || !owner || !repo || !branch) return;
        setIsLoadingContent(true);
        try {
          console.log(`Fetching content for: ${activeFilePath}`);
          const { content, downloadUrl, isBinary } = await fetchFileContent(owner, repo, activeFilePath, githubToken, branch);
          if (isMounted) {
            updateFile(activeFilePath, { content, downloadUrl, isBinary });
          }
        } catch (error) {
          console.error('Failed to load file content:', error);
          if (isMounted) {
            setSaveStatus('error');
          }
        } finally {
          if (isMounted) {
            setIsLoadingContent(false);
          }
        }
      };
      loadContent();
    }
    return () => { isMounted = false; };
  }, [activeFilePath, activeFile, githubToken, owner, repo, branch]);

  // Initialize or update editor
  useEffect(() => {
    const isEditable = activeFilePath?.endsWith('.md') || activeFilePath?.endsWith('.txt');
    
    // If not editable or binary or in preview mode, destroy existing view
    if (!activeFilePath || activeFile?.isBinary || !isEditable || mode === 'preview') {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
      return;
    }

    // Wait for editor container to be ready
    if (!editorRef.current) return;

    const content = activeFile?.content || '';

    try {
      if (!viewRef.current) {
        const state = EditorState.create({
          doc: content,
          extensions: getEditorExtensions(activeFilePath),
        });

        const view = new EditorView({
          state,
          parent: editorRef.current,
        });

        viewRef.current = view;
      } else {
        // Update existing view if content changed from outside (e.g. fetch)
        const currentDoc = viewRef.current.state.doc.toString();
        if (content !== currentDoc) {
          viewRef.current.dispatch({
            changes: { from: 0, to: currentDoc.length, insert: content }
          });
        }
      }
    } catch (err) {
      console.error('CodeMirror Error:', err);
    }
  }, [activeFilePath, activeFile?.content, activeFile?.isBinary, mode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, []);

  // Handle scroll to heading event
  useEffect(() => {
    const handleScrollToHeading = (e: any) => {
      const { text, id } = e.detail;
      
      if (mode === 'edit' && viewRef.current) {
        const doc = viewRef.current.state.doc.toString();
        const lines = doc.split('\n');
        // Find the line that starts with # and contains the text
        // We escape special characters in text for regex
        const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const lineIndex = lines.findIndex(line => 
          new RegExp(`^#{1,6}\\s+.*${escapedText}`).test(line)
        );
        
        if (lineIndex !== -1) {
          const pos = viewRef.current.state.doc.line(lineIndex + 1).from;
          viewRef.current.dispatch({
            effects: EditorView.scrollIntoView(pos, { y: 'start', yMargin: 20 })
          });
          viewRef.current.focus();
        }
      } else if (mode === 'preview') {
        // Try to find the element in the preview
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    window.addEventListener('obsidian:scroll-to-heading', handleScrollToHeading);
    return () => window.removeEventListener('obsidian:scroll-to-heading', handleScrollToHeading);
  }, [mode, activeFilePath]);

  if (!activeFilePath) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-zinc-500">
        <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 border border-zinc-800">
          <FileText size={32} className="text-zinc-700" />
        </div>
        <p className="text-sm font-medium">Select a file to start editing</p>
        <p className="text-xs text-zinc-600 mt-1">Markdown, code, and images are supported</p>
      </div>
    );
  }

  if (isLoadingContent) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950">
        <Loader2 size={32} className="text-purple-500 animate-spin mb-4" />
        <p className="text-sm text-zinc-400 font-medium">Loading content...</p>
      </div>
    );
  }

  // Handle Binary/Image files
  if (activeFile?.isBinary) {
    const isImage = /\.(png|jpe?g|gif|svg|webp|ico)$/i.test(activeFilePath);
    
    return (
      <div className="flex-1 h-full flex flex-col bg-zinc-950 overflow-hidden">
        <div className="p-2 px-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
          <div className="text-xs text-zinc-400 font-mono truncate max-w-md">
            {activeFilePath}
          </div>
          <div className="flex items-center space-x-2">
            <a 
              href={activeFile.downloadUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-1.5 hover:bg-zinc-800 rounded transition-colors text-zinc-400"
              title="Open Raw"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
        <div className="flex-1 overflow-auto flex items-center justify-center p-8 bg-zinc-900/30">
          {isImage ? (
            <div className="relative group">
              <img 
                src={activeFile.downloadUrl} 
                alt={activeFile.name} 
                className="max-w-full max-h-full rounded-lg shadow-2xl border border-zinc-800"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none rounded-lg" />
            </div>
          ) : (
            <div className="text-center max-w-sm">
              <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-zinc-800">
                <Download size={32} className="text-zinc-600" />
              </div>
              <h3 className="text-lg font-bold mb-2">Binary File</h3>
              <p className="text-sm text-zinc-500 mb-8">This file type cannot be displayed as text. You can download it or view it on GitHub.</p>
              <a 
                href={activeFile.downloadUrl} 
                download 
                className="inline-flex items-center space-x-2 bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all"
              >
                <Download size={16} />
                <span>Download File</span>
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-zinc-950 overflow-hidden">
      <div className="p-2 px-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
        <div className="text-xs text-zinc-400 font-mono truncate max-w-md">
          {activeFilePath}
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center bg-zinc-900 rounded-lg p-1">
            <button
              onClick={() => setMode('edit')}
              className={`p-1 px-2 rounded-md transition-all flex items-center space-x-1.5 ${
                mode === 'edit' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Edit3 size={12} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Edit</span>
            </button>
            <button
              onClick={() => setMode('preview')}
              className={`p-1 px-2 rounded-md transition-all flex items-center space-x-1.5 ${
                mode === 'preview' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Eye size={12} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Preview</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {!activeFilePath.endsWith('.md') && (
              <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-bold uppercase">Plain Text</span>
            )}
            {saveStatus === 'saving' && (
              <div className="flex items-center text-[10px] text-zinc-500 uppercase font-bold">
                <Loader2 size={10} className="animate-spin mr-1.5" />
                Syncing
              </div>
            )}
            {saveStatus === 'saved' && (
              <div className="flex items-center text-[10px] text-green-500 uppercase font-bold">
                <Check size={10} className="mr-1.5" />
                Synced
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="flex items-center text-[10px] text-red-500 uppercase font-bold">
                <CloudOff size={10} className="mr-1.5" />
                Error
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden relative">
        {mode === 'edit' ? (
          <div ref={editorRef} className="h-full w-full" />
        ) : activeFilePath.endsWith('.excalidraw.md') ? (
          <ExcalidrawView />
        ) : (
          <div className="h-full w-full overflow-auto p-8 text-zinc-300 max-w-none custom-scrollbar markdown-body">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={components}
            >
              {processedContent}
            </ReactMarkdown>

            {/* Backlinks Section */}
            {activeBacklinks.length > 0 && (
              <div className="mt-16 pt-8 border-t border-zinc-800">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 flex items-center space-x-2">
                  <ExternalLink size={14} />
                  <span>Backlinks</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeBacklinks.map(path => (
                    <button
                      key={path}
                      onClick={() => useVaultStore.getState().setActiveFile(path)}
                      className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all text-left group"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
                          <FileText size={16} />
                        </div>
                        <span className="text-sm text-zinc-300 group-hover:text-white transition-colors truncate">
                          {path.split('/').pop()?.replace('.md', '')}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
