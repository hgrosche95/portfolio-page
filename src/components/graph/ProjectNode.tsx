import { Handle, Position, type NodeProps } from '@xyflow/react';

export type ArchitectureKind = 'frontend' | 'backend' | 'data' | 'external';
export type ProjectKind = 'fullstack' | 'agent' | 'orchestration' | 'static';

export type GraphNodeData = {
  label: string;
  sublabel?: string;
  kind: 'project' | 'architecture';
  /** Architecture nodes only: drives the colour coding and the legend. */
  archKind?: ArchitectureKind;
  /** Project nodes only: what kind of thing the project architecturally is
   *  (content.config.ts `kind`), driving the border style below. Absent on
   *  infra, which isn't any one project's "kind". */
  projectKind?: ProjectKind;
  /** Project/architecture nodes: the circle's diameter in flow units — set
   *  by NodeGraph so its own layout math (orbit spacing, column gaps) stays
   *  the single source of truth for node size. */
  diameter?: number;
  /** True on the mobile top-to-bottom layout and on a focused architecture's
   *  single-column stack, so edges connect via top/bottom handles instead
   *  of left/right ones. */
  vertical?: boolean;
  /** Project/infra nodes only: doesn't match the active tag filter. Dimmed
   *  rather than removed, so the ring's shape never needs a re-fit just
   *  because a filter changed. Never set once a project is focused — its
   *  architecture has no tags of its own to filter. */
  dimmed?: boolean;
  /** Infra-label architecture nodes only: overrides ARCH_STYLES' border/text
   *  colour so each infra label reads as visually distinct from the others,
   *  matching the colour of the edges that connect projects to it. Drawn
   *  only from tokens already in the theme, not a new palette. */
  accentColor?: string;
};

/**
 * Colour per architecture layer. Chosen so the four layers stay distinguishable
 * in both themes without introducing new palette tokens.
 */
const ARCH_STYLES: Record<ArchitectureKind, string> = {
  frontend: 'border-[var(--color-accent)] text-[var(--color-accent)]',
  backend: 'border-[var(--color-border-strong)] text-[var(--color-text)]',
  data: 'border-[var(--color-border-strong)] text-[var(--color-text-muted)]',
  external: 'border-dashed border-[var(--color-border-strong)] text-[var(--color-text-muted)]',
};

/**
 * Border style per project kind — a project's architectural shape should be
 * visible before reading a single tag. Style rather than colour, so this
 * stays inside the site's one-accent palette instead of adding new hues:
 * "fullstack" is the plain/default look precisely because it's the most
 * common shape, "agent" reuses the same dashed language ARCH_STYLES already
 * gives "external" services (an LLM call reaches out, same as those do).
 */
export const PROJECT_KIND_STYLES: Record<ProjectKind, string> = {
  fullstack: 'border-2 border-solid border-[var(--color-border)]',
  agent: 'border-2 border-dashed border-[var(--color-accent)]',
  // `double` needs >=3px to actually render as two lines, so this one
  // carries its own width instead of sharing the others' border-2.
  orchestration: 'border-4 border-double border-[var(--color-accent)]',
  static: 'border-2 border-dotted border-[var(--color-border-strong)]',
};

/** Architecture "data" nodes render as a small rounded box, not a circle —
 *  a store reads differently from a running component even at this size. */
const ARCH_DATA_WIDTH = 56;
const ARCH_DATA_HEIGHT = 40;

export default function ProjectNode({ data }: NodeProps & { data: GraphNodeData }) {
  const isArchitecture = data.kind === 'architecture';
  const diameter = data.diameter ?? 80;

  if (isArchitecture) {
    const isData = data.archKind === 'data';
    const targetPosition = data.vertical ? Position.Top : Position.Left;
    const sourcePosition = data.vertical ? Position.Bottom : Position.Right;

    return (
      <div
        className="relative"
        style={isData ? { width: ARCH_DATA_WIDTH, height: ARCH_DATA_HEIGHT } : { width: diameter, height: diameter }}
      >
        <div
          className={[
            'h-full w-full border bg-[var(--color-surface)]',
            isData ? 'rounded-md' : 'rounded-full',
            data.archKind ? ARCH_STYLES[data.archKind] : '',
          ].join(' ')}
          style={data.accentColor ? { borderColor: data.accentColor, color: data.accentColor } : undefined}
        >
          <Handle type="target" position={targetPosition} style={{ visibility: 'hidden' }} />
          <Handle type="source" position={sourcePosition} style={{ visibility: 'hidden' }} />
        </div>
        <div
          className="absolute left-1/2 top-full mt-1.5 w-28 -translate-x-1/2 text-center font-mono text-[11px] leading-tight text-[var(--color-text-muted)]"
          title={data.label}
        >
          {data.label}
        </div>
      </div>
    );
  }

  const targetPosition = data.vertical ? Position.Top : Position.Left;
  const sourcePosition = data.vertical ? Position.Bottom : Position.Right;

  return (
    <div
      style={{ width: diameter, height: diameter }}
      className={[
        'relative cursor-pointer rounded-full transition-[color,border-color,box-shadow] hover:shadow-sm',
        'bg-[var(--color-surface)] text-[var(--color-text)]',
        'hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]',
        data.projectKind ? PROJECT_KIND_STYLES[data.projectKind] : 'border-2 border-solid border-[var(--color-border)]',
        data.dimmed ? 'opacity-35' : 'opacity-100',
      ].join(' ')}
    >
      <Handle type="target" position={targetPosition} style={{ visibility: 'hidden' }} />
      <Handle type="source" position={sourcePosition} style={{ visibility: 'hidden' }} />
      <div className="absolute left-1/2 top-full mt-2 w-28 -translate-x-1/2 text-center">
        <div className="font-display text-sm font-medium" title={data.label}>
          {data.label}
        </div>
        {data.sublabel && (
          <div className="mt-0.5 truncate font-mono text-xs text-[var(--color-text-muted)]" title={data.sublabel}>
            {data.sublabel}
          </div>
        )}
      </div>
    </div>
  );
}
