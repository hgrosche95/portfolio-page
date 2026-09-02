import { useEffect, useState, type CSSProperties, type KeyboardEvent } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
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
/** x of the project column, the first architecture column, and the column gap
 *  (desktop's left-to-right layout only — mobile lays out top-to-bottom). */
const PROJECT_X = 300;
const ARCH_X = 610;
const ARCH_COLUMN = 185;

/** Roughly a project node's rendered height, for the content extent below. */
const NODE_HEIGHT = 56;

/** Matches Tailwind's `sm` breakpoint, i.e. where the expand button appears. */
const DESKTOP_QUERY = '(min-width: 640px)';

/**
 * Below `sm`, the expand-architecture button is hidden (an unfolded
 * architecture would be far too wide for a phone — see ProjectNode), so
 * mobile only ever needs the plain hub-and-projects view. Rather than
 * squeeze the desktop's left-to-right layout into a narrow column, mobile
 * gets its own top-to-bottom stack, which is what a linear list actually
 * wants on a narrow screen.
 */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    setIsDesktop(mql.matches);
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
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

/**
 * Builds the full node/edge set for one graph state (a given expanded
 * project, on a given layout). Used both for the state actually on screen
 * and, in NodeGraph, to measure every reachable state up front so the
 * container can be sized once instead of resizing (and shoving the rest of
 * the page around) on every toggle.
 */
function buildGraph(
  projects: GraphProject[],
  expanded: string | null,
  isDesktop: boolean,
  toggle: (slug: string) => void,
): { nodes: Node<GraphNodeData>[]; edges: Edge[] } {
  const expandedProject = isDesktop ? projects.find((project) => project.slug === expanded) : undefined;
  const architecture = expandedProject?.architecture;

  const depths = architecture ? computeDepths(architecture) : null;
  const rowsByColumn = new Map<number, number>();
  if (architecture && depths) {
    for (const node of architecture.nodes) {
      const depth = depths.get(node.id) ?? 0;
      rowsByColumn.set(depth, (rowsByColumn.get(depth) ?? 0) + 1);
    }
  }

  const expandedIndex = projects.findIndex((project) => project.slug === expanded);
  const lastY = (projects.length - 1) * NODE_SPACING;

  const nodes: Node<GraphNodeData>[] = [
    {
      id: 'hub',
      type: 'project',
      position: isDesktop ? { x: 0, y: lastY / 2 } : { x: 0, y: 0 },
      data: {
        label: 'Henrik',
        sublabel: `${projects.length} Projekte`,
        kind: 'hub',
        vertical: !isDesktop,
      },
      draggable: false,
    },
    ...projects.map((project, index) => ({
      id: project.slug,
      type: 'project',
      position: isDesktop
        ? { x: PROJECT_X, y: index * NODE_SPACING }
        : { x: 0, y: (index + 1) * NODE_SPACING },
      data: {
        label: project.label,
        sublabel: project.sublabel,
        kind: 'project' as const,
        vertical: !isDesktop,
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
    const baseY = expandedIndex * NODE_SPACING;
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

  return { nodes, edges };
}

function graphHeight(nodes: { position: { y: number } }[]): number {
  const ys = nodes.map((node) => node.position.y);
  const extent = Math.max(...ys) - Math.min(...ys) + NODE_HEIGHT;
  return Math.max(360, extent + 100);
}

interface NodeGraphProps {
  projects: GraphProject[];
}

interface GraphCanvasProps {
  nodes: Node<GraphNodeData>[];
  edges: Edge[];
  onNodeClick: NodeMouseHandler;
}

/**
 * Split out so it can reach `useReactFlow` (only available inside a
 * ReactFlowProvider). Re-fitting imperatively on state change, instead of
 * remounting the whole <ReactFlow> via a `key`, is what makes the camera
 * move fit the new layout instead of hard-cutting to it.
 */
function GraphCanvas({ nodes, edges, onNodeClick }: GraphCanvasProps) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    fitView({ padding: 0.12, duration: 300 });
    // Re-fit on every node/edge change, i.e. whenever the visible layout
    // actually changes (toggle, or a desktop/mobile switch) - not on every
    // render, since `nodes`/`edges` are rebuilt fresh each time regardless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      nodesDraggable={false}
      nodesConnectable={false}
      panOnDrag={false}
      zoomOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
      proOptions={{ hideAttribution: true }}
    />
  );
}

export default function NodeGraph({ projects }: NodeGraphProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const isDesktop = useIsDesktop();

  const toggle = (slug: string) => setExpanded((current) => (current === slug ? null : slug));

  const { nodes, edges } = buildGraph(projects, expanded, isDesktop, toggle);

  // Sized from the tallest of every reachable state (collapsed, plus each
  // project's own expansion) rather than just the current one, so the
  // container never resizes - and shoves the rest of the page around - when
  // toggling. A borderless canvas with spare room just reads as page
  // whitespace, not a mis-sized box, so this costs nothing visually.
  const desktopHeight = Math.max(
    graphHeight(buildGraph(projects, null, true, toggle).nodes),
    ...projects
      .filter((project) => project.architecture)
      .map((project) => graphHeight(buildGraph(projects, project.slug, true, toggle).nodes)),
  );
  const mobileHeight = graphHeight(buildGraph(projects, null, false, toggle).nodes);

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
      className="static-flow h-(--graph-height-mobile) sm:h-(--graph-height-desktop)"
      style={
        {
          '--graph-height-mobile': `${mobileHeight}px`,
          '--graph-height-desktop': `${desktopHeight}px`,
        } as CSSProperties
      }
      onKeyDown={handleContainerKeyDown}
    >
      <ReactFlowProvider>
        <GraphCanvas nodes={nodes} edges={edges} onNodeClick={handleNodeClick} />
      </ReactFlowProvider>
    </div>
  );
}
