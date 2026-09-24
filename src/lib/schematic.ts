/**
 * Pure geometry for the project schematics: where each box sits and how a
 * wire runs between two of them. No DOM and no Astro in here, so the same
 * code renders the static SVG at build time and drives the packet animation
 * in the browser, and the layout rules can be tested on their own.
 */

/** Width of the SVG coordinate system; the SVG itself scales to its container. */
export const VIEW_WIDTH = 760;
export const NODE_HEIGHT = 52;
/** Vertical distance from one row to the next. Leaves room for wires between boxes. */
export const ROW_PITCH = 78;
/** Boxes never get wider than this, even with only two or three lanes. */
const MAX_NODE_WIDTH = 188;
/** Smallest horizontal gap between lanes, so elbows always have room. */
const MIN_LANE_GAP = 42;
/** Horizontal distance between elbows that share one gap. */
const WIRE_SPACING = 10;

export interface SchematicInput {
  lanes: string[];
  nodes: { id: string; lane: number; row: number }[];
  edges: [string, string][];
}

export interface Box {
  x: number;
  y: number;
  lane: number;
}

export interface Wire {
  /** Order-independent id of the edge, see pairKey. */
  key: string;
  from: string;
  to: string;
  d: string;
  /** Corner points of an elbow wire, drawn as solder dots. Empty for straight wires. */
  vias: { x: number; y: number }[];
}

export interface SchematicLayout {
  width: number;
  height: number;
  nodeWidth: number;
  laneStep: number;
  lanes: { title: string; x: number }[];
  /** x of the dashed line between each pair of neighbouring lanes. */
  dividers: number[];
  boxes: Record<string, Box>;
  wires: Wire[];
  /** Per-edge horizontal offset of the elbow, keyed like Wire.key. */
  bends: Record<string, number>;
}

/** Same key for a→b and b→a, so a scenario can use an edge in either direction. */
export const pairKey = (a: string, b: string) => [a, b].sort().join('|');

/** One decimal is plenty for SVG and keeps float noise like 101.39999 out of the markup. */
const round = (value: number) => Math.round(value * 10) / 10;

function gapCenter(gap: number, nodeWidth: number, laneStep: number) {
  return round(gap * laneStep + (nodeWidth + laneStep) / 2);
}

/**
 * An elbow always bends in the gap just before the higher of the two lanes.
 * Picking it by lane rather than by direction means a→c and c→a share one
 * track, and a wire that skips a lane crosses it on its lower-lane row,
 * which is the row you keep free when placing boxes.
 */
function elbowGap(a: Box, b: Box) {
  return Math.max(a.lane, b.lane) - 1;
}

function needsElbow(a: Box, b: Box) {
  return a.lane !== b.lane && a.y !== b.y;
}

export function layoutSchematic(input: SchematicInput): SchematicLayout {
  const laneCount = input.lanes.length;
  const nodeWidth = round(Math.min(MAX_NODE_WIDTH, (VIEW_WIDTH - (laneCount - 1) * MIN_LANE_GAP) / laneCount));
  const laneStep = laneCount > 1 ? (VIEW_WIDTH - nodeWidth) / (laneCount - 1) : 0;

  const boxes: Record<string, Box> = {};
  let height = 0;
  for (const node of input.nodes) {
    const box = { x: round(node.lane * laneStep), y: round(node.row * ROW_PITCH), lane: node.lane };
    boxes[node.id] = box;
    height = Math.max(height, box.y + NODE_HEIGHT);
  }

  // Elbows sharing a gap are spread symmetrically around its centre, in
  // edge order, so parallel verticals never draw on top of each other.
  const byGap = new Map<number, string[]>();
  for (const [a, b] of input.edges) {
    if (!boxes[a] || !boxes[b] || !needsElbow(boxes[a], boxes[b])) continue;
    const gap = elbowGap(boxes[a], boxes[b]);
    byGap.set(gap, [...(byGap.get(gap) ?? []), pairKey(a, b)]);
  }
  const bends: Record<string, number> = {};
  for (const keys of byGap.values()) {
    keys.forEach((key, i) => {
      bends[key] = (i - (keys.length - 1) / 2) * WIRE_SPACING;
    });
  }

  const layout: SchematicLayout = {
    width: VIEW_WIDTH,
    height: round(height),
    nodeWidth,
    laneStep,
    lanes: input.lanes.map((title, i) => ({ title, x: round(i * laneStep) })),
    dividers: Array.from({ length: Math.max(0, laneCount - 1) }, (_, gap) => gapCenter(gap, nodeWidth, laneStep)),
    boxes,
    wires: [],
    bends,
  };

  layout.wires = input.edges.map(([from, to]) => {
    const d = wirePath(layout, from, to);
    const corner = d.match(/^M(-?[\d.]+) (-?[\d.]+) H(-?[\d.]+) V(-?[\d.]+)/);
    const vias = corner
      ? [
          { x: Number(corner[3]), y: Number(corner[2]) },
          { x: Number(corner[3]), y: Number(corner[4]) },
        ]
      : [];
    return { key: pairKey(from, to), from, to, d, vias };
  });

  return layout;
}

/**
 * SVG path from one box to another, in travel direction, so the browser can
 * move a packet along it with getPointAtLength. Three shapes:
 * vertical inside a lane, straight across on the same row, or an elbow.
 */
export function wirePath(layout: SchematicLayout, from: string, to: string): string {
  const a = layout.boxes[from];
  const b = layout.boxes[to];
  if (!a || !b) throw new Error(`Unbekannter Knoten im Schaltplan: "${a ? to : from}"`);
  const w = layout.nodeWidth;

  if (a.lane === b.lane) {
    const cx = round(a.x + w / 2);
    return b.y > a.y ? `M${cx} ${round(a.y + NODE_HEIGHT)} V${b.y}` : `M${cx} ${a.y} V${round(b.y + NODE_HEIGHT)}`;
  }

  const rightward = b.lane > a.lane;
  const x1 = rightward ? round(a.x + w) : a.x;
  const x2 = rightward ? b.x : round(b.x + w);
  const y1 = round(a.y + NODE_HEIGHT / 2);
  const y2 = round(b.y + NODE_HEIGHT / 2);
  if (!needsElbow(a, b)) return `M${x1} ${y1} H${x2}`;

  const bend = layout.bends[pairKey(from, to)] ?? 0;
  const gx = round(gapCenter(elbowGap(a, b), w, layout.laneStep) + bend);
  return `M${x1} ${y1} H${gx} V${y2} H${x2}`;
}
