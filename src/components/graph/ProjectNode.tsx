import type { MouseEvent } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export type ArchitectureKind = 'frontend' | 'backend' | 'data' | 'external';
export type ProjectKind = 'fullstack' | 'agent' | 'orchestration' | 'static';

export type GraphNodeData = {
  label: string;
  sublabel?: string;
  kind: 'hub' | 'project' | 'architecture' | 'ring';
  /** Architecture nodes only: drives the colour coding and the legend. */
  archKind?: ArchitectureKind;
  /** Project nodes only: what kind of thing the project architecturally is
   *  (content.config.ts `kind`), driving the border style below. Absent on
   *  the hub and on infra, neither of which is any one project's "kind". */
  projectKind?: ProjectKind;
  /** Project nodes only: absent when the project declares no architecture. */
  expanded?: boolean;
  onToggle?: () => void;
  /** Hub/project nodes only: true on the mobile top-to-bottom layout, so
   *  edges connect via top/bottom handles instead of left/right ones. */
  vertical?: boolean;
  /** Project/infra nodes only: doesn't match the active tag filter, or a
   *  sibling of the node currently expanded. Dimmed rather than removed, so
   *  the graph's shape and the shared infra edges stay intact instead of
   *  needing a re-fit on every filter or expand change. */
  dimmed?: boolean;
  /** Ring nodes only: the decorative orbit's diameter, in flow units. */
  diameter?: number;
  /** Infra-label architecture nodes only: overrides ARCH_STYLES' border/text
   *  colour so each infra label reads as visually distinct from the others,
   *  matching the colour of the edges that connect projects to it. Every
   *  project's line converges on the same docked cluster when infra is
   *  expanded, so colour (rather than shape, already used up by `kind`) is
   *  what lets a line be traced to its label instead of just "some line
   *  passing near the infra node". Drawn only from tokens already in the
   *  theme, not a new palette. */
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

export default function ProjectNode({ data }: NodeProps & { data: GraphNodeData }) {
  const isHub = data.kind === 'hub';
  const isArchitecture = data.kind === 'architecture';
  const isRing = data.kind === 'ring';

  if (isRing) {
    return (
      <div
        aria-hidden="true"
        style={{ width: data.diameter, height: data.diameter }}
        className="rounded-full border border-dashed border-[var(--color-border)]"
      />
    );
  }

  if (isArchitecture) {
    return (
      <div
        className={[
          'w-48 rounded border bg-[var(--color-surface)] px-3 py-1.5 font-mono text-xs',
          data.archKind ? ARCH_STYLES[data.archKind] : '',
        ].join(' ')}
        style={data.accentColor ? { borderColor: data.accentColor, color: data.accentColor } : undefined}
      >
        <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
        <div className="truncate" title={data.label}>
          {data.label}
        </div>
        <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
      </div>
    );
  }

  // The toggle sits inside the node, which itself navigates on click — so the
  // button must stop the click from bubbling up to React Flow's node handler.
  const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    data.onToggle?.();
  };

  const targetPosition = data.vertical ? Position.Top : Position.Left;
  const sourcePosition = data.vertical ? Position.Bottom : Position.Right;

  return (
    <div
      className={[
        'w-64 rounded px-4 py-2 text-sm transition-[color,background-color,border-color,box-shadow] hover:shadow-sm',
        'bg-[var(--color-surface)] text-[var(--color-text)]',
        isHub
          ? 'border-2 border-solid border-[var(--color-accent)] text-[var(--color-accent)]'
          : (data.projectKind ? PROJECT_KIND_STYLES[data.projectKind] : 'border-2 border-solid border-[var(--color-border)]'),
        !isHub && 'group hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] cursor-pointer',
        data.dimmed ? 'opacity-35' : 'opacity-100',
      ].join(' ')}
    >
      <Handle type="target" position={targetPosition} style={{ visibility: 'hidden' }} />
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-display font-medium" title={data.label}>
            {data.label}
          </div>
          {data.sublabel && (
            <div className="truncate font-mono text-xs text-[var(--color-text-muted)]" title={data.sublabel}>
              {data.sublabel}
            </div>
          )}
        </div>
        {data.onToggle && (
          <button
            type="button"
            onClick={handleToggle}
            aria-expanded={data.expanded}
            aria-label={data.expanded ? 'Details ausblenden' : 'Details anzeigen'}
            title={data.expanded ? 'Details ausblenden' : 'Details anzeigen'}
            // Hidden on phones: an unfolded architecture is ~1170 units wide,
            // which fitView would shrink past legibility on a 375px screen.
            // The project page describes the same architecture in prose.
            className="nodrag hidden size-7 shrink-0 place-items-center rounded border border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] sm:grid"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={[
                'size-3.5 transition-transform',
                data.expanded ? 'rotate-180' : '',
              ].join(' ')}
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        )}
      </div>
      <Handle type="source" position={sourcePosition} style={{ visibility: 'hidden' }} />
    </div>
  );
}
