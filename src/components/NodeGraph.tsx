import type { KeyboardEvent } from 'react';
import { ReactFlow, type Node, type Edge, type NodeMouseHandler } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ProjectNode, { type GraphNodeData } from './graph/ProjectNode';

const nodeTypes = { project: ProjectNode };

export type GraphProject = { slug: string; label: string; sublabel: string };

interface NodeGraphProps {
  projects: GraphProject[];
}

function goToProject(slug: string) {
  window.location.href = `/projects/${slug}`;
}

export default function NodeGraph({ projects }: NodeGraphProps) {
  const nodes: Node<GraphNodeData>[] = [
    {
      id: 'hub',
      type: 'project',
      position: { x: 0, y: ((projects.length - 1) * 100) / 2 },
      data: { label: 'Henrik', sublabel: 'verbindet Systeme', kind: 'hub' },
      draggable: false,
    },
    ...projects.map((project, index) => ({
      id: project.slug,
      type: 'project',
      position: { x: 340, y: index * 100 },
      data: { label: project.label, sublabel: project.sublabel, kind: 'project' as const },
      draggable: false,
      ariaLabel: `Projekt ${project.label} öffnen`,
      ariaRole: 'button',
    })),
  ];

  const edges: Edge[] = projects.map((project) => ({
    id: `hub-${project.slug}`,
    source: 'hub',
    target: project.slug,
    animated: true,
  }));

  // Mouse: a direct click handler, fires exactly once per click.
  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    if (node.id === 'hub') return;
    goToProject(node.id);
  };

  // Keyboard: React Flow's own node keydown handler only updates internal
  // selection state on Enter/Space, it never calls onNodeClick — so this is
  // a separate handler on the wrapping div. It works via ordinary DOM event
  // bubbling: the focused node wrapper is a descendant of this div, so its
  // keydown reaches us here even though we don't render that wrapper
  // ourselves. Reading data-id (which React Flow sets on every node
  // wrapper) is what tells us which node was focused.
  const handleContainerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const nodeEl = (event.target as HTMLElement).closest<HTMLElement>('[data-id]');
    const id = nodeEl?.dataset.id;
    if (id && id !== 'hub') {
      event.preventDefault();
      goToProject(id);
    }
  };

  return (
    <div
      className="h-72 rounded border border-[var(--color-border)] sm:h-[420px]"
      onKeyDown={handleContainerKeyDown}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        nodesDraggable={false}
        nodesConnectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      />
    </div>
  );
}
