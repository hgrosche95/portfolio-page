import { ReactFlow, type Node, type Edge, type NodeMouseHandler } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ProjectNode, { type GraphNodeData } from './graph/ProjectNode';

const nodeTypes = { project: ProjectNode };

// Placeholder project list — replaced by the real content collection in Phase 5.
// Slugs already match the eventual /projects/[slug] routes so this swap is a
// data-source change only, not a routing change.
const projects: { slug: string; label: string; sublabel: string }[] = [
  { slug: 'great-galguti-game', label: 'great_galguti_game', sublabel: 'TypeScript' },
  { slug: 'ai-trip-planer', label: 'ai-trip-planer', sublabel: 'TypeScript' },
  { slug: 'cocktail-orders', label: 'Cocktail-Orders', sublabel: 'TypeScript' },
  { slug: 'job-application-skill', label: 'job-application-skill', sublabel: 'Python' },
];

const nodes: Node<GraphNodeData>[] = [
  {
    id: 'hub',
    type: 'project',
    position: { x: 0, y: 140 },
    data: { label: 'Henrik', sublabel: 'verbindet Systeme', kind: 'hub' },
    draggable: false,
  },
  ...projects.map((project, index) => ({
    id: project.slug,
    type: 'project',
    position: { x: 340, y: index * 100 },
    data: { label: project.label, sublabel: project.sublabel, kind: 'project' as const },
    draggable: false,
  })),
];

const edges: Edge[] = projects.map((project) => ({
  id: `hub-${project.slug}`,
  source: 'hub',
  target: project.slug,
  animated: true,
}));

export default function NodeGraph() {
  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    if (node.id === 'hub') return;
    window.location.href = `/projects/${node.id}`;
  };

  return (
    <div style={{ height: 420 }} className="rounded border border-[var(--color-border)]">
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
