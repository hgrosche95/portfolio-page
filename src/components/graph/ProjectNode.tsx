import { Handle, Position, type NodeProps } from '@xyflow/react';

export type GraphNodeData = {
  label: string;
  sublabel?: string;
  kind: 'hub' | 'project';
};

export default function ProjectNode({ data }: NodeProps & { data: GraphNodeData }) {
  const isHub = data.kind === 'hub';

  return (
    <div
      className={[
        'w-56 rounded border px-4 py-2 font-mono text-sm shadow-sm transition-colors',
        'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]',
        isHub
          ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
          : 'hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] cursor-pointer',
      ].join(' ')}
    >
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
      <div className="truncate" title={data.label}>{data.label}</div>
      {data.sublabel && (
        <div className="truncate text-xs text-[var(--color-text-muted)]" title={data.sublabel}>
          {data.sublabel}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
    </div>
  );
}
