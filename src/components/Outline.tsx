import React from 'react';
import { useVaultStore } from '../store/vaultStore';
import { Hash } from 'lucide-react';

export const Outline: React.FC = () => {
  const { files, activeFilePath } = useVaultStore();

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
  const [activeHeading, setActiveHeading] = React.useState<string | null>(null);
  
  // Use IntersectionObserver to highlight active heading
  React.useEffect(() => {
    if (!activeFile || !activeFile.content) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries.find((entry) => entry.isIntersecting);
        if (visibleEntry) {
          setActiveHeading(visibleEntry.target.id);
        }
      },
      { rootMargin: '-10% 0px -80% 0px' }
    );

    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach((h) => observer.observe(h));

    return () => observer.disconnect();
  }, [activeFilePath, activeFile]);

  if (!activeFile || !activeFile.content) {
    return (
      <div className="p-8 text-center">
        <p className="text-zinc-500 text-[10px] italic uppercase tracking-widest">No outline available</p>
      </div>
    );
  }

  // Simple regex to find headings
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings = [];
  let match;
  
  while ((match = headingRegex.exec(activeFile.content)) !== null) {
    const text = match[2];
    // Match the refined ID generation in Editor.tsx
    const id = text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    headings.push({
      level: match[1].length,
      text,
      id,
      index: match.index
    });
  }

  if (headings.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-zinc-500 text-[10px] italic uppercase tracking-widest">No headings found</p>
      </div>
    );
  }

  const scrollToHeading = (id: string, text: string) => {
    // 1. Try to find in DOM (Preview mode)
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveHeading(id);
      return;
    }

    // 2. Dispatch event for Editor to handle (Edit mode or just-rendered Preview)
    window.dispatchEvent(new CustomEvent('obsidian:scroll-to-heading', { 
      detail: { id, text } 
    }));
    setActiveHeading(id);
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-zinc-950">
      <div className="space-y-1">
        {headings.map((heading, i) => (
          <div 
            key={i}
            onClick={() => scrollToHeading(heading.id, heading.text)}
            className={`group flex items-center space-x-2 py-1.5 px-2 rounded transition-all cursor-pointer ${activeHeading === heading.id ? 'bg-purple-500/10 text-purple-400' : 'hover:bg-zinc-900 text-zinc-400'}`}
            style={{ paddingLeft: `${(heading.level - 1) * 12 + 8}px` }}
          >
            <Hash size={10} className={`${activeHeading === heading.id ? 'text-purple-400' : 'text-zinc-600 group-hover:text-purple-400'} shrink-0`} />
            <span className={`text-[11px] truncate ${activeHeading === heading.id ? 'font-bold' : 'group-hover:text-zinc-200'}`}>
              {heading.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
