import type { MouseEvent } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export type ArchitectureKind = 'frontend' | 'backend' | 'data' | 'external';

export type GraphNodeData = {
  label: string;
  sublabel?: string;
  kind: 'hub' | 'project' | 'architecture';
  /** Architecture nodes only: drives the colour coding and the legend. */
  archKind?: ArchitectureKind;
  /** Project nodes only: absent when the project declares no architecture. */
  expanded?: boolean;
  onToggle?: () => void;
  /** Hub/project nodes only: true on the mobile top-to-bottom layout, so
   *  edges connect via top/bottom handles instead of left/right ones. */
  vertical?: boolean;
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

export default function ProjectNode({ data }: NodeProps & { data: GraphNodeData }) {
  const isHub = data.kind === 'hub';
  const isArchitecture = data.kind === 'architecture';

  if (isArchitecture) {
    return (
      <div
        className={[
          'w-48 rounded border bg-[var(--color-surface)] px-3 py-1.5 font-mono text-xs shadow-sm',
          data.archKind ? ARCH_STYLES[data.archKind] : '',
        ].join(' ')}
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
        'w-64 rounded border px-4 py-2 font-mono text-sm shadow-sm transition-colors',
        'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]',
        isHub
          ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
          : 'group hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] cursor-pointer',
      ].join(' ')}
    >
      <Handle type="target" position={targetPosition} style={{ visibility: 'hidden' }} />
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate" title={data.label}>
            {data.label}
          </div>
          {data.sublabel && (
            <div className="truncate text-xs text-[var(--color-text-muted)]" title={data.sublabel}>
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
