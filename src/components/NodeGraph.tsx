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
 * Marks project/infra nodes dimmed rather than hidden — for two independent
 * reasons that both resolve to the same visual treatment: not matching the
 * active tag filter, or being a sibling of whichever node is currently
 * expanded. Never touches positions or the node/edge set, so the graph's
 * shape (the ring, the shared infra edges) never needs a re-fit just
 * because a filter or an expand state changed. Hub and architecture
 * sub-nodes are never dimmed: the hub isn't tied to any one tag or expand
 * state, and sub-nodes only ever appear inside an already-relevant project.
 */
function withDimming(
  nodes: Node<GraphNodeData>[],
  projects: GraphProject[],
  filterTags: string[],
  expanded: string | null,
  isDesktop: boolean,
): Node<GraphNodeData>[] {
  if (filterTags.length === 0 && !expanded) return nodes;

  const techStackBySlug = new Map(projects.map((project) => [project.slug, project.techStack]));
  const infraLabels = infraLabelsFor(projects);

  return nodes.map((node) => {
    if (node.id === 'hub' || node.id.includes('--') || node.id === 'ring') return node;

    const tags = node.id === 'infra' ? infraLabels : techStackBySlug.get(node.id);
    const filterDimmed = filterTags.length > 0 && !!tags && !tags.some((tag) => filterTags.includes(tag));
    const expandDimmed = isDesktop && !!expanded && node.id !== expanded;
    const dimmed = filterDimmed || expandDimmed;

    return { ...node, data: { ...node.data, dimmed } };
  });
}

/** Vertical distance between two collapsed project rows on mobile. */
const NODE_SPACING = 80;
/** Horizontal distance between architecture nodes sharing a tier. */
const ARCH_TIER_SPREAD = 220;
/** Vertical gap between a fanned-out architecture tier and the one before it. */
const ARCH_TIER_GAP = 110;
/** Clearance between an expanded node's own edge and its first architecture tier. */
const ARCH_GAP = 90;

/** A project/hub/infra node's rendered footprint, for layout math. */
const NODE_WIDTH = 256;
const NODE_HEIGHT = 56;
/** Minimum gap between two adjacent ring nodes' edges, so labels never crowd. */
const MIN_ORBIT_GAP = 40;

/** Matches Tailwind's `sm` breakpoint, i.e. where the expand button appears. */
const DESKTOP_QUERY = '(min-width: 640px)';

/**
 * Below `sm`, the expand-architecture button is hidden (an unfolded
 * architecture would be far too wide for a phone — see ProjectNode), so
 * mobile only ever needs the plain hub-and-projects view. Rather than
 * squeeze the desktop's orbit into a narrow column, mobile gets its own
 * top-to-bottom stack, which is what a linear list actually wants on a
 * narrow screen.
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
 * The ring a slot sits on has N members (every project, plus infra on
 * desktop): evenly spaced starting at the top, going clockwise. Radius is
 * whatever keeps adjacent nodes from crowding, not a fixed number — so
 * adding a project file grows the ring instead of packing it tighter.
 */
function orbitRadius(memberCount: number): number {
  if (memberCount <= 1) return 220;
  return Math.max(220, (NODE_WIDTH + MIN_ORBIT_GAP) / (2 * Math.sin(Math.PI / memberCount)));
}

function orbitAngle(index: number, memberCount: number): number {
  return -Math.PI / 2 + (index / memberCount) * 2 * Math.PI;
}

/** Centre-to-top-left conversion for a plain project/hub-sized box. */
function nodeTopLeft(centerX: number, centerY: number): { x: number; y: number } {
  return { x: centerX - NODE_WIDTH / 2, y: centerY - NODE_HEIGHT / 2 };
}

/**
 * Places one tier of an expanded node's fanned-out architecture (or infra's
 * fanned-out labels), upward from its docked anchor — the same depth/row
 * grid the pre-orbit hub-and-spoke layout always used, just turned 90°.
 * Deeper tiers stack up (not further right) and siblings within a tier
 * spread sideways: the page's width is fixed by its max-width and is what
 * a rightward fan-out was competing for (an architecture with several
 * layers pushed the layout wide enough that fitView had to shrink
 * everything to fit, however tightly the dock was clamped to the ring).
 * Height has no such ceiling - the page just scrolls a little further - so
 * a project's own depth (usually its largest dimension) grows into that
 * instead, and only a tier's own width (its widest single row of siblings,
 * reliably smaller) still competes for page width.
 */
function fanOutward(
  anchorX: number,
  anchorY: number,
  depth: number,
  tierWidth: number,
  row: number,
): { x: number; y: number } {
  return {
    x: anchorX + (row - (tierWidth - 1) / 2) * ARCH_TIER_SPREAD,
    y: anchorY - (NODE_HEIGHT / 2 + ARCH_GAP + depth * ARCH_TIER_GAP),
  };
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

  const lastY = (projects.length - 1) * NODE_SPACING;

  const nodes: Node<GraphNodeData>[] = [
    {
      id: 'hub',
      type: 'project',
      position: isDesktop ? nodeTopLeft(0, 0) : { x: 0, y: 0 },
      data: {
        label: 'Henrik',
        sublabel: `${projects.length} Projekte`,
        kind: 'hub',
        vertical: !isDesktop,
      },
      draggable: false,
    },
  ];
  const edges: Edge[] = [];

  if (!isDesktop) {
    // Mobile: unchanged plain top-to-bottom stack, no ring, no infra.
    projects.forEach((project, index) => {
      nodes.push({
        id: project.slug,
        type: 'project',
        position: { x: 0, y: (index + 1) * NODE_SPACING },
        data: {
          label: project.label,
          sublabel: project.sublabel,
          kind: 'project',
          projectKind: project.kind,
          vertical: true,
        },
        draggable: false,
        ariaLabel: `Projekt ${project.label} öffnen`,
        ariaRole: 'button',
      });
      edges.push({ id: `hub-${project.slug}`, source: 'hub', target: project.slug, animated: true });
    });

    return { nodes, edges };
  }

  // Desktop: projects share one ring around the hub — a ring, not spokes,
  // since the connection is "shares this orbit", not a drawn line per
  // project, which is also what leaves room for as many projects as exist
  // without the graph turning into a spoke thicket. Infra sits on its own
  // fixed spot below the ring instead of taking a ring slot: it isn't a
  // project like the others, so it shouldn't read as an equally-weighted
  // planet among them.
  const radius = orbitRadius(projects.length);
  const angleOf = new Map(projects.map((project, index) => [project.slug, orbitAngle(index, projects.length)]));
  // Where the single expanded item (a project or infra) relocates to: clear
  // above the ring, so its architecture fan-out always opens upward into
  // empty space, regardless of which ring slot it came from. A fixed,
  // unrotated docking spot (rather than pulling a node further out along
  // its own ring angle) is what keeps the detail view's size and shape
  // independent of the expanded item's position and architecture
  // complexity: the previous per-angle version could send a node's fan-out
  // straight back through the ring, or blow up the layout's overall extent
  // (and therefore fitView's zoom) enough to make labels illegible. Above
  // rather than beside the ring specifically because the page has a fixed
  // max-width but no height ceiling - see fanOutward.
  const dock = { x: 0, y: -(radius + NODE_HEIGHT + 100) };
  const infraAnchor = { x: 0, y: radius + 140 };

  nodes.push({
    id: 'ring',
    type: 'project',
    // Centred on the hub — unlike every other node here, the ring's own
    // footprint is radius*2, not the fixed NODE_WIDTH/NODE_HEIGHT nodeTopLeft
    // assumes, so it needs its own top-left math.
    position: { x: -radius, y: -radius },
    data: { kind: 'ring', diameter: radius * 2 },
    style: { width: radius * 2, height: radius * 2 },
    draggable: false,
    selectable: false,
    focusable: false,
  });

  function projectCenter(slug: string): { x: number; y: number } {
    if (slug === expanded) return dock;
    const angle = angleOf.get(slug) ?? 0;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  }

  // The one edge leaving the ring: a spoke back to the hub, only for
  // whichever ring project is currently docked out — showing it left its
  // slot instead of implying every project is individually wired to the
  // hub. Infra gets its own permanent edge below instead: it was never on
  // the ring to begin with, so it needs a constant connection rather than
  // one that only appears once "pulled out".
  if (expanded && expanded !== 'infra') {
    edges.push({ id: `hub-${expanded}`, source: 'hub', target: expanded, animated: true, style: { strokeDasharray: '4 4' } });
  }

  projects.forEach((project) => {
    const center = projectCenter(project.slug);
    nodes.push({
      id: project.slug,
      type: 'project',
      position: nodeTopLeft(center.x, center.y),
      data: {
        label: project.label,
        sublabel: project.sublabel,
        kind: 'project',
        projectKind: project.kind,
        ...(project.architecture
          ? { expanded: expanded === project.slug, onToggle: () => toggle(project.slug) }
          : {}),
      },
      draggable: false,
      ariaLabel: `Projekt ${project.label} öffnen`,
      ariaRole: 'button',
    });
  });

  // Infra always sits at its own fixed spot below the ring, expanded or
  // not — unlike a ring project, it never relocates to the dock. Its
  // detail is always the same flat, single-tier list of labels, so it has
  // none of the variable depth a project's architecture can have, and
  // nothing to gain from the dock's ability to grow upward: keeping it in
  // place means it never has to jump across the ring to open, and its
  // labels landing right underneath it (rather than far away, docked
  // alongside a project's own detail view) is what actually keeps this
  // state compact instead of forcing fitView to zoom in hard just to fill
  // a container sized for the biggest project's architecture (see maxZoom
  // below, which is the other half of that fix).
  const infraLabels = infraLabelsFor(projects);
  nodes.push({
    id: 'infra',
    type: 'project',
    position: nodeTopLeft(infraAnchor.x, infraAnchor.y),
    data: {
      label: 'Infrastruktur',
      sublabel: infraLabels.join(', '),
      kind: 'project',
      expanded: expanded === 'infra',
      onToggle: () => toggle('infra'),
    },
    draggable: false,
    ariaLabel: expanded === 'infra' ? 'Infrastruktur ausblenden' : 'Infrastruktur anzeigen',
    ariaRole: 'button',
  });
  // Infra isn't on the ring, so — unlike a project — it needs a constant
  // line to the hub rather than one that only appears once expanded.
  edges.push({ id: 'hub-infra', source: 'hub', target: 'infra', animated: true });

  if (expanded === 'infra') {
    const accentOf = new Map(infraLabels.map((label, index) => [label, INFRA_ACCENTS[index % INFRA_ACCENTS.length]]));
    const labelY = infraAnchor.y + NODE_HEIGHT / 2 + ARCH_GAP;

    infraLabels.forEach((label, row) => {
      const labelX = infraAnchor.x + (row - (infraLabels.length - 1) / 2) * ARCH_TIER_SPREAD;
      nodes.push({
        id: `infra--${label}`,
        type: 'project',
        position: { x: labelX - 96, y: labelY - 20 },
        data: { label, kind: 'architecture', archKind: 'external', accentColor: accentOf.get(label) },
        draggable: false,
        selectable: false,
      });
    });

    // Every project on the ring converges on this same small label cluster,
    // so their lines inevitably cross near it — colouring each one to
    // match its target label (see accentOf above) is what keeps "which
    // line goes where" answerable despite the crossing, rather than trying
    // to physically route the lines apart.
    for (const project of projects) {
      for (const label of infraLabels) {
        if (!project.techStack.includes(label)) continue;
        edges.push({
          id: `infra-${project.slug}-${label}`,
          source: project.slug,
          target: `infra--${label}`,
          style: { stroke: accentOf.get(label) },
        });
      }
    }
  }

  if (architecture && depths && expandedProject) {
    const placed = new Map<number, number>();

    for (const node of architecture.nodes) {
      const depth = depths.get(node.id) ?? 0;
      const row = placed.get(depth) ?? 0;
      placed.set(depth, row + 1);
      const columnRows = rowsByColumn.get(depth) ?? 1;
      const pos = fanOutward(dock.x, dock.y, depth, columnRows, row);

      nodes.push({
        id: `${expandedProject.slug}--${node.id}`,
        type: 'project',
        position: { x: pos.x - 96, y: pos.y - 20 },
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

/** Architecture/infra-label node footprint (ProjectNode's `w-48` box). */
const ARCH_NODE_WIDTH = 192;
const ARCH_NODE_HEIGHT = 40;

/**
 * Each node's own rendered footprint, since positions here are already
 * top-left: the ring (diameter can run past 700 units) and an architecture
 * label are both far smaller/larger than a plain project box, so a single
 * flat padding added after the fact (as a hub-and-spoke layout could get
 * away with, everything there being the same size) would over- or
 * under-count depending on which shape happened to land on the extreme.
 */
function nodeFootprint(node: { id: string; data: GraphNodeData }): { width: number; height: number } {
  if (node.data.kind === 'ring' && node.data.diameter) {
    return { width: node.data.diameter, height: node.data.diameter };
  }
  if (node.id.includes('--')) return { width: ARCH_NODE_WIDTH, height: ARCH_NODE_HEIGHT };
  return { width: NODE_WIDTH, height: NODE_HEIGHT };
}

function graphExtent(nodes: Node<GraphNodeData>[]): { width: number; height: number } {
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
  return { width: maxX - minX, height: maxY - minY };
}

/**
 * A container height from the taller of the two axes actually needed: the
 * collapsed ring is roughly as wide as it is tall, but an expanded state's
 * upward fan-out (see fanOutward) can need noticeably more height than
 * width. `width` only matters here as a stand-in for "how much fitView
 * would have to shrink this to fit the fixed-width container" — the
 * container's own width is always 100% of its parent regardless.
 */
function graphHeight(nodes: Node<GraphNodeData>[]): number {
  const { width, height } = graphExtent(nodes);
  return Math.max(360, Math.max(width * 0.55, height) + 120);
}

/**
 * The hub, the docked item, and its own detail nodes — the part of the
 * graph actually worth reading once something is expanded. Everything else
 * (the ring's far side, its other members) is still rendered and still
 * visible in the background, but fitView zooming to include it too was the
 * direct cause of illegible text on a project with a wide architecture: the
 * more of the ring fitView had to fit alongside the fan-out, the more it
 * had to shrink everything to do it. Restricting both the sizing math and
 * the actual fitView call to this subset keeps the zoom level tied to the
 * detail view's own size, not the ring's.
 */
function focusNodes(nodes: Node<GraphNodeData>[], expandedId: string): Node<GraphNodeData>[] {
  return nodes.filter(
    (node) => node.id === 'hub' || node.id === expandedId || node.id.startsWith(`${expandedId}--`),
  );
}

interface NodeGraphProps {
  projects: GraphProject[];
}

interface GraphCanvasProps {
  nodes: Node<GraphNodeData>[];
  edges: Edge[];
  onNodeClick: NodeMouseHandler;
  /** Desktop only: id of the expanded project/infra, so fitView can zoom to
   *  just its detail view instead of the whole ring — see focusNodes. */
  expanded: string | null;
}

/**
 * Split out so it can reach `useReactFlow` (only available inside a
 * ReactFlowProvider). Re-fitting imperatively on state change, instead of
 * remounting the whole <ReactFlow> via a `key`, is what makes the camera
 * move fit the new layout instead of hard-cutting to it.
 */
function GraphCanvas({ nodes, edges, onNodeClick, expanded }: GraphCanvasProps) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    // The container's height is shared across every reachable state (see
    // desktopHeight) so toggling never resizes it — but that means a state
    // simpler than the one that sized the container (infra's flat label
    // list, next to a project with a deep architecture) has room to spare,
    // and fitView fills that room by zooming in past 1:1 rather than
    // leaving it as slack. Capping at 1 keeps that spare room as whitespace
    // instead, which is what it already reads as everywhere else on this
    // page (see graphHeight).
    fitView({ padding: 0.12, duration: 300, maxZoom: 1, nodes: expanded ? focusNodes(nodes, expanded) : undefined });
    // Re-fit on every node/edge change, i.e. whenever the visible layout
    // actually changes (toggle, or a desktop/mobile switch) - not on every
    // render, since `nodes`/`edges` are rebuilt fresh each time regardless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, expanded]);

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
          <span className={['size-3 rounded-sm bg-[var(--color-surface)]', PROJECT_KIND_STYLES[kind]].join(' ')} />
          {label}
        </span>
      ))}
    </div>
  );
}

export default function NodeGraph({ projects }: NodeGraphProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
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

  const toggle = (slug: string) => setExpanded((current) => (current === slug ? null : slug));

  const { nodes: builtNodes, edges } = buildGraph(projects, expanded, isDesktop, toggle);
  const nodes = withDimming(builtNodes, projects, filterTags, expanded, isDesktop);

  // Sized from the tallest of every reachable state (collapsed, plus each
  // project's own expansion) rather than just the current one, so the
  // container never resizes - and shoves the rest of the page around - when
  // toggling. A borderless canvas with spare room just reads as page
  // whitespace, not a mis-sized box, so this costs nothing visually.
  const desktopHeight = Math.max(
    graphHeight(buildGraph(projects, null, true, toggle).nodes),
    graphHeight(focusNodes(buildGraph(projects, 'infra', true, toggle).nodes, 'infra')),
    ...projects
      .filter((project) => project.architecture)
      .map((project) => graphHeight(focusNodes(buildGraph(projects, project.slug, true, toggle).nodes, project.slug))),
  );
  const mobileHeight = graphHeight(buildGraph(projects, null, false, toggle).nodes);

  // Mouse: a direct click handler, fires exactly once per click.
  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    if (node.id === 'hub' || node.id === 'ring' || node.id.includes('--')) return;
    // Infra has no page of its own — clicking it toggles the same as its
    // arrow button, instead of navigating.
    if (node.id === 'infra') {
      toggle('infra');
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
    // The expand button is a real button and handles its own keyboard
    // activation; intercepting here would navigate instead of expanding.
    if ((event.target as HTMLElement).closest('button')) return;
    const nodeEl = (event.target as HTMLElement).closest<HTMLElement>('[data-id]');
    const id = nodeEl?.dataset.id;
    if (!id || id === 'hub' || id === 'ring' || id.includes('--')) return;
    event.preventDefault();
    if (id === 'infra') {
      toggle('infra');
      return;
    }
    goToProject(id);
  };

  return (
    <div>
      {isDesktop && <KindLegend />}
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
          <GraphCanvas nodes={nodes} edges={edges} onNodeClick={handleNodeClick} expanded={isDesktop ? expanded : null} />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
