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
import ProjectNode, {
  type ArchitectureKind,
  type GraphNodeData,
  type ProjectKind,
  PROJECT_KIND_STYLES,
} from './graph/ProjectNode';

const nodeTypes = { project: ProjectNode };

export type ArchitectureNode = { id: string; label: string; kind: ArchitectureKind };
export type Architecture = { nodes: ArchitectureNode[]; edges: [string, string][] };
export type GraphProject = {
  slug: string;
  label: string;
  sublabel: string;
  techStack: string[];
  kind: ProjectKind;
  architecture?: Architecture;
};

/**
 * Shared infrastructure worth its own orbit slot, drawn from real techStack
 * entries rather than authored per-project — the same "the data defines the
 * graph" approach the rest of this component already uses. Keep this to
 * genuine shared infra (hosting, CI, containers), not languages or
 * frameworks that just happen to repeat across projects.
 */
const INFRA_LABELS = ['Azure', 'Docker', 'GitHub Actions'] as const;

/**
 * One colour per infra label (cycled if there were ever more than three),
 * drawn only from tokens already in the theme — see ProjectNode's
 * `accentColor` doc for why this exists instead of just leaving these grey.
 */
const INFRA_ACCENTS = ['var(--color-accent)', 'var(--color-text-muted)', 'var(--color-border-strong)'];

/** Infra labels actually used by at least one project, in a fixed order. */
function infraLabelsFor(projects: GraphProject[]): string[] {
  return INFRA_LABELS.filter((label) => projects.some((project) => project.techStack.includes(label)));
}

/**
 * Dims project/infra nodes that don't match the active tag filter, rather
 * than hiding them — so the ring's shape never needs a re-fit just because a
 * filter changed. Only meaningful in the overview: once a project is
 * focused, only its own architecture is on screen, which has no tags of its
 * own to filter against.
 */
function withDimming(nodes: Node<GraphNodeData>[], projects: GraphProject[], filterTags: string[]): Node<GraphNodeData>[] {
  if (filterTags.length === 0) return nodes;

  const techStackBySlug = new Map(projects.map((project) => [project.slug, project.techStack]));
  const infraLabels = infraLabelsFor(projects);

  return nodes.map((node) => {
    const tags = node.id === 'infra' ? infraLabels : techStackBySlug.get(node.id);
    const dimmed = !!tags && !tags.some((tag) => filterTags.includes(tag));

    return { ...node, data: { ...node.data, dimmed } };
  });
}

/** Circle diameters, in flow units — the single source both ProjectNode's
 *  rendering and this file's own layout math read from. */
const PROJECT_DIAMETER = 80;
const ARCH_DIAMETER = 60;
/** Extra vertical room a node's label (rendered below the circle, not
 *  inside it) needs — folded into every spacing constant below so labels
 *  never crowd their neighbour's circle. */
const LABEL_BLOCK_HEIGHT = 46;

/** Project rows on mobile share two columns, so the list needs about half
 *  the scrolling a single column would. */
const MOBILE_COLS = 2;
/** Horizontal distance between the two mobile columns' centres — wide
 *  enough that a label under one column can't be mistaken for its
 *  neighbour's. */
const MOBILE_COL_GAP = 170;
/** Vertical distance between two mobile rows' centres. */
const MOBILE_ROW_GAP = 190;
/** Horizontal distance between two depth-columns in a focused architecture
 *  on desktop. */
const ARCH_COL_GAP = 190;
/** Distance between two siblings at the same depth: vertical on desktop
 *  (they share a column), horizontal on mobile (they share a row, wrapping
 *  onto another one past MOBILE_ARCH_COLS). */
const ARCH_ROW_GAP = 130;
const ARCH_MOBILE_SIBLING_GAP = 140;
/** Siblings at the same depth share at most this many columns on mobile
 *  before wrapping - more than that and fitView has to zoom out to fit the
 *  width, which leaves the container mostly empty top and bottom instead. */
const MOBILE_ARCH_COLS = 2;
/** Vertical distance between two depth-rows in a focused architecture on
 *  mobile. */
const ARCH_MOBILE_GAP = 110;
/** Minimum clearance between two adjacent ring nodes' labels. */
const MIN_ORBIT_GAP = 30;
/** A ring node's effective width for spacing purposes — wider than the
 *  circle itself, since its label can outrun the circle it sits under. */
const ORBIT_LABEL_WIDTH = 170;

/** Matches Tailwind's `sm` breakpoint, i.e. where the ring layout appears. */
const DESKTOP_QUERY = '(min-width: 640px)';

/**
 * Below `sm`, projects stack top-to-bottom instead of sharing the desktop's
 * ring — squeezing a ring into a narrow column would either crowd every
 * label or force the circles down to illegible sizes, where a plain list
 * just works.
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
export function computeDepths(architecture: Architecture): Map<string, number> {
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
 * The ring a slot sits on has N members: evenly spaced starting at the top,
 * going clockwise. Radius is whatever keeps adjacent labels from crowding,
 * not a fixed number — so adding a project file grows the ring instead of
 * packing it tighter.
 */
function orbitRadius(memberCount: number): number {
  if (memberCount <= 1) return 220;
  return Math.max(200, (ORBIT_LABEL_WIDTH + MIN_ORBIT_GAP) / (2 * Math.sin(Math.PI / memberCount)));
}

function orbitAngle(index: number, memberCount: number): number {
  return -Math.PI / 2 + (index / memberCount) * 2 * Math.PI;
}

/** Centre-to-top-left conversion, since React Flow positions by top-left. */
function topLeft(centerX: number, centerY: number, width: number, height: number): { x: number; y: number } {
  return { x: centerX - width / 2, y: centerY - height / 2 };
}

/**
 * The overview: on mobile, a plain top-to-bottom stack; on desktop, every
 * project shares one ring, with infra (if any) docked at a fixed spot below
 * it. No node connects to any other here — this is a set of equally-weighted
 * projects, not a hub-and-spoke structure. Clicking one swaps the whole view
 * to its architecture (see buildFocusedGraph) instead of fanning out in place.
 */
function buildOverviewGraph(projects: GraphProject[], isDesktop: boolean): { nodes: Node<GraphNodeData>[]; edges: Edge[] } {
  const nodes: Node<GraphNodeData>[] = [];
  const edges: Edge[] = [];

  if (!isDesktop) {
    // Mobile: two columns instead of one long column, no ring, no infra —
    // see useIsDesktop. Two columns roughly halves how far the page has to
    // scroll to see every project.
    projects.forEach((project, index) => {
      const col = index % MOBILE_COLS;
      const row = Math.floor(index / MOBILE_COLS);
      const x = (col - (MOBILE_COLS - 1) / 2) * MOBILE_COL_GAP;
      const y = row * MOBILE_ROW_GAP;
      nodes.push({
        id: project.slug,
        type: 'project',
        position: topLeft(x, y, PROJECT_DIAMETER, PROJECT_DIAMETER),
        data: {
          label: project.label,
          sublabel: project.sublabel,
          kind: 'project',
          projectKind: project.kind,
          diameter: PROJECT_DIAMETER,
          vertical: true,
          href: `/projects/${project.slug}`,
        },
        draggable: false,
        ariaLabel: project.architecture ? `Architektur von ${project.label} öffnen` : `Projekt ${project.label} öffnen`,
        ariaRole: 'button',
      });
    });

    return { nodes, edges };
  }

  // Desktop: projects share one ring. Infra sits on its own fixed spot below
  // the ring instead of taking a slot: it isn't a project like the others,
  // so it shouldn't read as an equally-weighted planet among them.
  const radius = orbitRadius(projects.length);

  projects.forEach((project, index) => {
    const angle = orbitAngle(index, projects.length);
    const center = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    nodes.push({
      id: project.slug,
      type: 'project',
      position: topLeft(center.x, center.y, PROJECT_DIAMETER, PROJECT_DIAMETER),
      data: {
        label: project.label,
        sublabel: project.sublabel,
        kind: 'project',
        projectKind: project.kind,
        diameter: PROJECT_DIAMETER,
        href: `/projects/${project.slug}`,
      },
      draggable: false,
      ariaLabel: project.architecture ? `Architektur von ${project.label} öffnen` : `Projekt ${project.label} öffnen`,
      ariaRole: 'button',
    });
  });

  const infraLabels = infraLabelsFor(projects);
  if (infraLabels.length > 0) {
    const infraCenter = { x: 0, y: radius + 150 };
    nodes.push({
      id: 'infra',
      type: 'project',
      position: topLeft(infraCenter.x, infraCenter.y, PROJECT_DIAMETER, PROJECT_DIAMETER),
      data: {
        label: 'Infrastruktur',
        sublabel: infraLabels.join(', '),
        kind: 'project',
        diameter: PROJECT_DIAMETER,
      },
      draggable: false,
      ariaLabel: 'Geteilte Infrastruktur anzeigen',
      ariaRole: 'button',
    });
  }

  return { nodes, edges };
}

/**
 * One project's (or infra's) architecture, laid out on its own — this is
 * the entire graph while a node is focused, not a fan-out alongside the
 * ring. Nodes at the same depth (nothing between them in the dependency
 * chain) are siblings and get spread out side by side; the depth itself
 * runs left-to-right on desktop and top-to-bottom on mobile. Without that
 * sibling spread, two things pointing into the same node (or one node
 * fanning out into several) would all land on the same axis and read as a
 * single straight line instead of a branch.
 */
function buildFocusedGraph(architecture: Architecture, isDesktop: boolean): { nodes: Node<GraphNodeData>[]; edges: Edge[] } {
  const depths = computeDepths(architecture);

  const rowsByDepth = new Map<number, number>();
  for (const node of architecture.nodes) {
    const depth = depths.get(node.id) ?? 0;
    rowsByDepth.set(depth, (rowsByDepth.get(depth) ?? 0) + 1);
  }

  const centers = new Map<string, { x: number; y: number }>();

  if (isDesktop) {
    const placed = new Map<number, number>();
    for (const node of architecture.nodes) {
      const depth = depths.get(node.id) ?? 0;
      const row = placed.get(depth) ?? 0;
      placed.set(depth, row + 1);
      const siblingCount = rowsByDepth.get(depth) ?? 1;
      centers.set(node.id, { x: depth * ARCH_COL_GAP, y: (row - (siblingCount - 1) / 2) * ARCH_ROW_GAP });
    }
  } else {
    // A depth with more than two siblings wraps onto extra sub-rows instead
    // of spreading arbitrarily wide - four siblings in one row (Run-Engine's
    // fan-out, say) would force fitView to zoom out to fit the width, which
    // shrinks everything and leaves the container mostly empty top/bottom.
    const depthOrder = [...rowsByDepth.keys()].sort((a, b) => a - b);
    const yByDepth = new Map<number, number>();
    let cursorY = 0;
    for (const depth of depthOrder) {
      yByDepth.set(depth, cursorY);
      const subRows = Math.ceil((rowsByDepth.get(depth) ?? 1) / MOBILE_ARCH_COLS);
      cursorY += subRows * ARCH_MOBILE_GAP;
    }
    const placed = new Map<number, number>();
    for (const node of architecture.nodes) {
      const depth = depths.get(node.id) ?? 0;
      const indexInDepth = placed.get(depth) ?? 0;
      placed.set(depth, indexInDepth + 1);
      const cols = Math.min(rowsByDepth.get(depth) ?? 1, MOBILE_ARCH_COLS);
      const col = indexInDepth % MOBILE_ARCH_COLS;
      const subRow = Math.floor(indexInDepth / MOBILE_ARCH_COLS);
      centers.set(node.id, {
        x: (col - (cols - 1) / 2) * ARCH_MOBILE_SIBLING_GAP,
        y: (yByDepth.get(depth) ?? 0) + subRow * ARCH_MOBILE_GAP,
      });
    }
  }

  const nodes: Node<GraphNodeData>[] = architecture.nodes.map((node) => {
    const center = centers.get(node.id) ?? { x: 0, y: 0 };
    const isData = node.kind === 'data';
    const width = isData ? 56 : ARCH_DIAMETER;
    const height = isData ? 40 : ARCH_DIAMETER;
    return {
      id: node.id,
      type: 'project',
      position: topLeft(center.x, center.y, width, height),
      data: { label: node.label, kind: 'architecture', archKind: node.kind, diameter: ARCH_DIAMETER, vertical: !isDesktop },
      draggable: false,
      selectable: false,
      focusable: false,
    };
  });

  const edges: Edge[] = architecture.edges.map(([from, to]) => ({ id: `${from}-${to}`, source: from, target: to }));

  return { nodes, edges };
}

/** Architecture/infra-label node footprint (ProjectNode's small box/circle). */
const ARCH_DATA_WIDTH = 56;
const ARCH_DATA_HEIGHT = 40;

/**
 * Each node's own rendered footprint, padded by LABEL_BLOCK_HEIGHT since
 * every node's title/sublabel renders below the circle, not inside it —
 * without that padding, graphHeight would size the container to fit the
 * circles alone and crop the bottom row's labels.
 */
function nodeFootprint(node: Node<GraphNodeData>): { width: number; height: number } {
  if (node.data.kind === 'architecture' && node.data.archKind === 'data') {
    return { width: ARCH_DATA_WIDTH, height: ARCH_DATA_HEIGHT + LABEL_BLOCK_HEIGHT };
  }
  const diameter = node.data.diameter ?? PROJECT_DIAMETER;
  return { width: diameter, height: diameter + LABEL_BLOCK_HEIGHT };
}

/**
 * The graph's true bounding box, label overhang included - unlike React
 * Flow's own automatic fitView bounds, which only know each node's
 * rendered DOM size (the circle itself, since the label below it is an
 * absolutely-positioned child that doesn't enlarge its parent's measured
 * box). Fitting to that node-only box left the bottom row's labels
 * poking past the canvas's own overflow:hidden edge while the top still
 * carried slack, since the box's estimated aspect never quite matched
 * the actual content. GraphCanvas fits to this box explicitly instead.
 */
function graphBounds(nodes: Node<GraphNodeData>[]): { x: number; y: number; width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const { width, height } = nodeFootprint(node);
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + width);
    maxY = Math.max(maxY, node.position.y + height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function graphExtent(nodes: Node<GraphNodeData>[]): { width: number; height: number } {
  const { width, height } = graphBounds(nodes);
  return { width, height };
}

/**
 * A container height from the taller of the two axes actually needed: the
 * ring is roughly as wide as it is tall, but a focused architecture with
 * several depth-columns can need noticeably more width than height (or vice
 * versa on mobile's single column). `width` only matters here as a
 * stand-in for "how much fitView would have to shrink this to fit the
 * fixed-width container" — the container's own width is always 100% of its
 * parent regardless.
 */
function graphHeight(nodes: Node<GraphNodeData>[]): number {
  const { width, height } = graphExtent(nodes);
  return Math.max(360, Math.max(width * 0.55, height) + 120);
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
  const { fitBounds } = useReactFlow();

  useEffect(() => {
    // fitBounds to our own label-inclusive box (see graphBounds) rather
    // than fitView's automatic one, which only knows each node's own
    // rendered circle and would let the bottom row's label poke past the
    // canvas's overflow:hidden edge.
    //
    // The container itself resizes synchronously with this render (no CSS
    // transition on its height - see the className below), but React Flow
    // still learns its container's new pixel size from a ResizeObserver,
    // which reports asynchronously, after this effect already ran. Calling
    // fitBounds here measures the container before that update lands, so it
    // fits our bounds against a stale (often much taller, pre-resize) size
    // - which is a *smaller* effective zoom than correct, and the real
    // content then overflows the actual, already-shrunk container. A
    // double rAF defers the call to after the browser's next layout pass,
    // by which point the observer has caught up.
    let frame2 = 0;
    const frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => {
        fitBounds(graphBounds(nodes), { padding: 0.1, duration: 200 });
      });
    });
    return () => {
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
    };
    // Re-fit whenever the visible layout actually changes (overview vs. a
    // focused architecture, or a desktop/mobile switch) - not on every
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
      panOnScroll={false}
      zoomOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
      preventScrolling={false}
      proOptions={{ hideAttribution: true }}
    />
  );
}

const LEGEND: { kind: ProjectKind; label: string }[] = [
  { kind: 'fullstack', label: 'Full-Stack-App' },
  { kind: 'agent', label: 'KI / Agent' },
  { kind: 'orchestration', label: 'Orchestrierung' },
  { kind: 'static', label: 'Statische Seite' },
];

/** Desktop-only, next to the filter: explains the ring's border language
 *  before anyone has to guess what a dashed vs. a dotted node means. */
function KindLegend() {
  return (
    <div className="mb-3 hidden flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-xs text-[var(--color-text-muted)] sm:flex">
      {LEGEND.map(({ kind, label }) => (
        <span key={kind} className="flex items-center gap-1.5">
          <span className={['size-3 rounded-full bg-[var(--color-surface)]', PROJECT_KIND_STYLES[kind]].join(' ')} />
          {label}
        </span>
      ))}
    </div>
  );
}

export default function NodeGraph({ projects }: NodeGraphProps) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const isDesktop = useIsDesktop();

  // ProjectFilter.astro is a static component elsewhere on the page; a
  // CustomEvent is the only channel a plain script and a React island can
  // share without either one depending on the other.
  useEffect(() => {
    const onFilterChange = (event: Event) => {
      setFilterTags((event as CustomEvent<{ tags: string[] }>).detail?.tags ?? []);
    };
    window.addEventListener('project-filter-change', onFilterChange);
    return () => window.removeEventListener('project-filter-change', onFilterChange);
  }, []);

  const focusedProject = focusedId ? projects.find((project) => project.slug === focusedId) : undefined;
  const infraLabels = infraLabelsFor(projects);
  const infraAccentOf = new Map(infraLabels.map((label, index) => [label, INFRA_ACCENTS[index % INFRA_ACCENTS.length]]));

  // The current focus state's nodes, at whichever breakpoint is asked for -
  // shared by the actual render below and by both height calculations, so
  // a resize crossing the sm breakpoint always has the right height ready
  // for its new layout instead of momentarily reusing the old one's.
  function buildForBreakpoint(desktop: boolean): { nodes: Node<GraphNodeData>[]; edges: Edge[] } {
    if (focusedId === 'infra') {
      const infraArchitecture: Architecture = {
        nodes: infraLabels.map((label) => ({ id: label, label, kind: 'external' })),
        edges: [],
      };
      const built = buildFocusedGraph(infraArchitecture, desktop);
      return { nodes: built.nodes.map((node) => ({ ...node, data: { ...node.data, accentColor: infraAccentOf.get(node.id) } })), edges: built.edges };
    }
    if (focusedProject?.architecture) {
      return buildFocusedGraph(focusedProject.architecture, desktop);
    }
    return buildOverviewGraph(projects, desktop);
  }

  const { nodes: builtNodes, edges } = buildForBreakpoint(isDesktop);
  const nodes = focusedId ? builtNodes : withDimming(builtNodes, projects, filterTags);

  // Sized from the current state alone - an architecture with only a
  // handful of nodes is usually much shorter than the ring/grid overview,
  // and forcing it into a container tall enough for the overview (or for
  // another project's deeper architecture) just left most of that height
  // as empty top/bottom margin. The container transitions its height (see
  // the className below) so switching states resizes smoothly instead of
  // jumping.
  const desktopHeight = graphHeight(isDesktop ? nodes : buildForBreakpoint(true).nodes);
  const mobileHeight = graphHeight(!isDesktop ? nodes : buildForBreakpoint(false).nodes);

  // Mouse: a direct click handler, fires exactly once per click. Architecture
  // nodes render with selectable/focusable both false, but React Flow still
  // calls onNodeClick for them - without this guard, a click on one (its id
  // is an architecture-local id like "api", never a project slug) fell
  // through to goToProject and 404'd on /projects/api.
  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    if (focusedId) return;
    if (node.id === 'infra') {
      setFocusedId('infra');
      return;
    }
    const project = projects.find((candidate) => candidate.slug === node.id);
    if (project?.architecture) {
      setFocusedId(project.slug);
      return;
    }
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
    if (focusedId) return; // architecture nodes have nothing to activate
    // The title link handles its own Enter activation; intercepting here
    // would open the architecture instead of following the link.
    if ((event.target as HTMLElement).closest('a')) return;
    const nodeEl = (event.target as HTMLElement).closest<HTMLElement>('[data-id]');
    const id = nodeEl?.dataset.id;
    if (!id) return;
    event.preventDefault();
    if (id === 'infra') {
      setFocusedId('infra');
      return;
    }
    const project = projects.find((candidate) => candidate.slug === id);
    if (project?.architecture) {
      setFocusedId(project.slug);
      return;
    }
    goToProject(id);
  };

  const orientation =
    focusedId === 'infra'
      ? `Geteilte Infrastruktur — ${infraLabels.length} Dienste.`
      : focusedProject?.architecture
        ? `${focusedProject.label} — ${focusedProject.architecture.nodes.length} Komponenten, ${focusedProject.architecture.edges.length} Verbindungen.`
        : 'Projekte im Ring — Klick auf einen Knoten öffnet dessen Architektur.';

  return (
    <div>
      {isDesktop && <KindLegend />}
      <div className="relative">
        {focusedId && (
          <button
            type="button"
            onClick={() => setFocusedId(null)}
            aria-label="Zur Übersicht"
            className="absolute left-3 top-3 z-10 grid size-8 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] font-mono text-sm text-[var(--color-text)] shadow-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            ←
          </button>
        )}
        <div
          className="static-flow project-graph h-(--graph-height-mobile) sm:h-(--graph-height-desktop)"
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
      </div>
      <p className="mt-3 font-mono text-xs text-[var(--color-text-muted)]">{orientation}</p>
      {focusedProject && (
        <a
          href={`/projects/${focusedProject.slug}`}
          className="mt-2 inline-flex items-center gap-1 font-mono text-xs text-[var(--color-accent)] hover:underline"
        >
          Projekt öffnen ↗
        </a>
      )}
    </div>
  );
}
