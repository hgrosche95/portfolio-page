import { useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ReactFlow, type Node, type Edge, type NodeMouseHandler } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ProjectNode, { type ArchitectureKind, type GraphNodeData } from './graph/ProjectNode';

const nodeTypes = { project: ProjectNode };

export type ArchitectureNode = { id: string; label: string; kind: ArchitectureKind };
export type Architecture = { nodes: ArchitectureNode[]; edges: [string, string][] };
export type GraphProject = {
  slug: string;
  label: string;
  sublabel: string;
  architecture?: Architecture;
};

/** Vertical distance between two collapsed project nodes, in flow units. */
const NODE_SPACING = 80;
/** Vertical distance between architecture nodes sharing a column. */
const ARCH_ROW = 52;
/** x of the project column, the first architecture column, and the column gap. */
const PROJECT_X = 300;
const ARCH_X = 610;
const ARCH_COLUMN = 185;

/** Roughly a project node's rendered height, for the content extent below. */
const NODE_HEIGHT = 56;

/**
 * The container is sized from the nodes actually on screen rather than from a
 * fixed value, so adding a project MDX file stays the only step needed and an
 * unfolded architecture gets the room it needs without leaving dead space.
 */
function graphHeight(nodes: { position: { y: number } }[]): number {
  const ys = nodes.map((node) => node.position.y);
  const extent = Math.max(...ys) - Math.min(...ys) + NODE_HEIGHT;
  return Math.max(360, extent + 100);
}

/**
 * Column index per architecture node: 0 for nodes nothing points at, otherwise
 * one past the deepest predecessor. Walked iteratively so a cycle in the
 * authored data settles instead of recursing forever.
 */
function computeDepths(architecture: Architecture): Map<string, number> {
  const depths = new Map(architecture.nodes.map((node) => [node.id, 0]));

  for (let pass = 0; pass < architecture.nodes.length; pass += 1) {
    let changed = false;
    for (const [from, to] of architecture.edges) {
      const candidate = (depths.get(from) ?? 0) + 1;
      if (candidate > (depths.get(to) ?? 0)) {
        depths.set(to, candidate);
        changed = true;
      }
    }
    if (!changed) break;
  }

  return depths;
}

function goToProject(slug: string) {
  window.location.href = `/projects/${slug}`;
}

interface NodeGraphProps {
  projects: GraphProject[];
}

export default function NodeGraph({ projects }: NodeGraphProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (slug: string) => setExpanded((current) => (current === slug ? null : slug));

  const expandedProject = projects.find((project) => project.slug === expanded);
  const architecture = expandedProject?.architecture;

  // Architecture nodes live in their own columns to the right of the project
  // column, so they can never collide with a project and the project rows stay
  // put when one unfolds.
  const depths = architecture ? computeDepths(architecture) : null;
  const rowsByColumn = new Map<number, number>();
  if (architecture && depths) {
    for (const node of architecture.nodes) {
      const depth = depths.get(node.id) ?? 0;
      rowsByColumn.set(depth, (rowsByColumn.get(depth) ?? 0) + 1);
    }
  }

  const expandedIndex = projects.findIndex((project) => project.slug === expanded);
  const projectY = (index: number) => index * NODE_SPACING;

  const lastY = projectY(projects.length - 1);

  const nodes: Node<GraphNodeData>[] = [
    {
      id: 'hub',
      type: 'project',
      position: { x: 0, y: lastY / 2 },
      data: { label: 'Henrik', sublabel: 'verbindet Systeme', kind: 'hub' },
      draggable: false,
    },
    ...projects.map((project, index) => ({
      id: project.slug,
      type: 'project',
      position: { x: PROJECT_X, y: projectY(index) },
      data: {
        label: project.label,
        sublabel: project.sublabel,
        kind: 'project' as const,
        ...(project.architecture
          ? { expanded: expanded === project.slug, onToggle: () => toggle(project.slug) }
          : {}),
      },
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

  if (architecture && depths && expandedProject) {
    const baseY = projectY(expandedIndex);
    const placed = new Map<number, number>();

    for (const node of architecture.nodes) {
      const depth = depths.get(node.id) ?? 0;
      const row = placed.get(depth) ?? 0;
      placed.set(depth, row + 1);

      const columnRows = rowsByColumn.get(depth) ?? 1;
      // Centre each column against the project node's own row.
      const offset = (row - (columnRows - 1) / 2) * ARCH_ROW;

      nodes.push({
        id: `${expandedProject.slug}--${node.id}`,
        type: 'project',
        position: { x: ARCH_X + depth * ARCH_COLUMN, y: baseY + offset },
        data: { label: node.label, kind: 'architecture', archKind: node.kind },
        draggable: false,
        selectable: false,
      });
    }

    // Link the project to every entry point (a node nothing else points at).
    for (const node of architecture.nodes) {
      if ((depths.get(node.id) ?? 0) !== 0) continue;
      edges.push({
        id: `${expandedProject.slug}-entry-${node.id}`,
        source: expandedProject.slug,
        target: `${expandedProject.slug}--${node.id}`,
      });
    }

    for (const [from, to] of architecture.edges) {
      edges.push({
        id: `${expandedProject.slug}-${from}-${to}`,
        source: `${expandedProject.slug}--${from}`,
        target: `${expandedProject.slug}--${to}`,
      });
    }
  }

  // Mouse: a direct click handler, fires exactly once per click.
  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    if (node.id === 'hub' || node.id.includes('--')) return;
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
    // The expand button is a real button and handles its own keyboard
    // activation; intercepting here would navigate instead of expanding.
    if ((event.target as HTMLElement).closest('button')) return;
    const nodeEl = (event.target as HTMLElement).closest<HTMLElement>('[data-id]');
    const id = nodeEl?.dataset.id;
    if (id && id !== 'hub' && !id.includes('--')) {
      event.preventDefault();
      goToProject(id);
    }
  };

  return (
    <div
      className="h-72 sm:h-(--graph-height)"
      style={{ '--graph-height': `${graphHeight(nodes)}px` } as CSSProperties}
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
        fitViewOptions={{ padding: 0.12 }}
        // Refit whenever the expanded project changes, so the architecture that
        // just appeared is brought into view instead of overflowing.
        key={expanded ?? 'collapsed'}
      />
    </div>
  );
}
