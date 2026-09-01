import { ReactFlow, type Node, type Edge, type OnSelectionChangeFunc } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ProjectNode, { type GraphNodeData } from './graph/ProjectNode';

const nodeTypes = { project: ProjectNode };

export type GraphProject = { slug: string; label: string; sublabel: string };

interface NodeGraphProps {
  projects: GraphProject[];
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

  // Selection (not a raw click handler) is what fires for both mouse clicks
  // and keyboard activation (Enter/Space on a focused node), so this is the
  // one place that needs to handle navigation for it to work for both.
  const handleSelectionChange: OnSelectionChangeFunc = ({ nodes: selected }) => {
    const project = selected.find((node) => node.id !== 'hub');
    if (project) {
      window.location.href = `/projects/${project.id}`;
    }
  };

  return (
    <div className="h-72 rounded border border-[var(--color-border)] sm:h-[420px]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onSelectionChange={handleSelectionChange}
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
