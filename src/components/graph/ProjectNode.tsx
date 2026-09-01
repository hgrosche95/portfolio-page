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
        'rounded border px-4 py-2 font-mono text-sm shadow-sm transition-colors',
        'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]',
        isHub
          ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
          : 'hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] cursor-pointer',
      ].join(' ')}
    >
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
      <div>{data.label}</div>
      {data.sublabel && <div className="text-xs text-[var(--color-text-muted)]">{data.sublabel}</div>}
      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
    </div>
  );
}
