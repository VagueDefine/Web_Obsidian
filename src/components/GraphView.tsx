import React, { useEffect, useRef } from 'react';
import { useVaultStore } from '../store/vaultStore';
import * as d3 from 'd3';
import { Search, RefreshCw } from 'lucide-react';
import _ from 'lodash';

export const GraphView: React.FC<{ local?: boolean }> = ({ local = false }) => {
  const { files, links, activeFilePath, setActiveFile } = useVaultStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const updateGraph = () => {
      const width = containerRef.current?.clientWidth || 400;
      const height = containerRef.current?.clientHeight || 400;

      // Build nodes and links for D3
      const nodes: any[] = [];
      const nodeMap: Record<string, any> = {};

      const buildNodesRecursive = (list: any[]) => {
        for (const file of list) {
          if (file.type === 'file' && file.name.endsWith('.md')) {
            const node = { id: file.path, name: file.name.replace('.md', '') };
            nodes.push(node);
            nodeMap[file.path] = node;
            // Map by name for wikilinks [[Note Name]]
            nodeMap[file.name.replace('.md', '')] = node;
          }
          if (file.children) buildNodesRecursive(file.children);
        }
      };

      buildNodesRecursive(files);

      let d3Links = links
        .map((link) => {
          const source = nodeMap[link.source];
          // Try to find target by path or by name
          const target = nodeMap[link.target] || nodeMap[link.target + '.md'];
          if (source && target) return { source: source.id, target: target.id };
          return null;
        })
        .filter(Boolean) as any[];

      let finalNodes = nodes;
      if (local && activeFilePath) {
        const neighborIds = new Set<string>();
        neighborIds.add(activeFilePath);
        
        // 1. Add neighbors (direct links)
        d3Links.forEach(link => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          
          if (sourceId === activeFilePath) neighborIds.add(targetId);
          if (targetId === activeFilePath) neighborIds.add(sourceId);
        });

        // 2. Add folder siblings (files in the same directory)
        const currentFolder = activeFilePath.includes('/') 
          ? activeFilePath.substring(0, activeFilePath.lastIndexOf('/')) 
          : '';
        
        nodes.forEach(n => {
          const nodeFolder = n.id.includes('/') 
            ? n.id.substring(0, n.id.lastIndexOf('/')) 
            : '';
          if (nodeFolder === currentFolder) {
            neighborIds.add(n.id);
          }
        });

        finalNodes = nodes.filter(n => neighborIds.has(n.id));
        d3Links = d3Links.filter(l => {
          const s = typeof l.source === 'string' ? l.source : l.source.id;
          const t = typeof l.target === 'string' ? l.target : l.target.id;
          return neighborIds.has(s) && neighborIds.has(t);
        });
      }

      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();

      // Add zoom behavior
      const g = svg.append('g');
      const zoom = d3.zoom<SVGSVGElement, any>()
        .scaleExtent([0.1, 8])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });

      svg.call(zoom);

      const simulation = d3
        .forceSimulation(finalNodes)
        .force('link', d3.forceLink(d3Links).id((d: any) => d.id).distance(local ? 80 : 60))
        .force('charge', d3.forceManyBody().strength(local ? -100 : -50))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(local ? 40 : 20))
        .alphaDecay(0.08)
        .velocityDecay(0.5);

      const link = g
        .append('g')
        .attr('stroke', '#27272a')
        .attr('stroke-opacity', 0.3)
        .selectAll('line')
        .data(d3Links)
        .join('line')
        .attr('stroke-width', 1);

      const node = g
        .append('g')
        .selectAll('g')
        .data(finalNodes)
        .join('g')
        .attr('cursor', 'pointer')
        .attr('class', 'node-group')
        .on('click', (event, d: any) => {
          if (event.defaultPrevented) return;
          setActiveFile(d.id);
        })
        .on('mouseover', (event, d: any) => {
          const connectedNodeIds = new Set<string>();
          connectedNodeIds.add(d.id);
          
          link.transition().duration(300)
            .attr('stroke', (l: any) => {
              if (l.source.id === d.id || l.target.id === d.id) {
                connectedNodeIds.add(l.source.id);
                connectedNodeIds.add(l.target.id);
                return '#a855f7';
              }
              return '#27272a';
            })
            .attr('stroke-opacity', (l: any) => (l.source.id === d.id || l.target.id === d.id ? 1 : 0.05));

          node.transition().duration(300)
            .attr('opacity', (n: any) => (connectedNodeIds.has(n.id) ? 1 : 0.1));
          
          // Highlight labels of connected nodes
          node.selectAll('text')
            .transition().duration(300)
            .attr('fill', (n: any) => (connectedNodeIds.has(n.id) ? '#ffffff' : '#3f3f46'))
            .attr('font-weight', (n: any) => (n.id === d.id ? 'bold' : 'normal'));
        })
        .on('mouseout', () => {
          link.transition().duration(300)
            .attr('stroke', '#27272a')
            .attr('stroke-opacity', 0.3);
          
          node.transition().duration(300)
            .attr('opacity', 1);
          
          node.selectAll('text')
            .transition().duration(300)
            .attr('fill', '#a1a1aa')
            .attr('font-weight', 'normal');
        })
        .call(
          d3.drag<SVGGElement, any>()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended)
        );

      node.append('circle')
        .attr('r', (d: any) => (d.id === activeFilePath ? 6 : 4))
        .attr('fill', (d: any) => (d.id === activeFilePath ? '#a855f7' : '#52525b'))
        .attr('stroke', (d: any) => (d.id === activeFilePath ? '#d8b4fe' : '#18181b'))
        .attr('stroke-width', 1.5);

      node.append('text')
        .text((d: any) => d.name)
        .attr('font-size', '9px')
        .attr('fill', (d: any) => (d.id === activeFilePath ? '#ffffff' : '#a1a1aa'))
        .attr('dx', 8)
        .attr('dy', 3)
        .style('pointer-events', 'none')
        .style('text-shadow', '0 0 4px rgba(0,0,0,0.8)');

      node.append('title').text((d: any) => d.id);

      simulation.on('tick', () => {
        link
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);

        node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
      });

      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }

      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }

      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }

      return simulation;
    };

    const simulation = updateGraph();

    const debouncedUpdate = _.debounce(() => {
      updateGraph();
    }, 200);

    const resizeObserver = new ResizeObserver(() => {
      debouncedUpdate();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      simulation.stop();
      resizeObserver.disconnect();
    };
  }, [files, links, activeFilePath]);

  return (
    <div ref={containerRef} className="h-full w-full bg-zinc-950 flex flex-col relative">
      <div className="absolute top-2 right-2 z-10 flex space-x-1">
        <button 
          onClick={() => {
            const svg = d3.select(svgRef.current);
            svg.transition().duration(750).call(d3.zoom<SVGSVGElement, any>().transform as any, d3.zoomIdentity);
          }}
          className="p-1.5 bg-zinc-900/80 hover:bg-zinc-800 rounded border border-zinc-800 text-zinc-500 hover:text-zinc-300 transition-all"
          title="Reset View"
        >
          <Search size={12} />
        </button>
        <button 
          onClick={() => {
            // Re-trigger the effect by changing a dummy state or just calling the update function
            // For now, we'll just reset the zoom, but we could also re-run the simulation
            window.dispatchEvent(new Event('resize'));
          }}
          className="p-1.5 bg-zinc-900/80 hover:bg-zinc-800 rounded border border-zinc-800 text-zinc-500 hover:text-zinc-300 transition-all"
          title="Refresh Graph"
        >
          <RefreshCw size={12} />
        </button>
      </div>
      <div className="flex-1 relative overflow-hidden">
        <svg ref={svgRef} className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'all' }} />
      </div>
    </div>
  );
};
