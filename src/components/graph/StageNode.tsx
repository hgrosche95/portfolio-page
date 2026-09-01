import { Handle, Position, type NodeProps } from '@xyflow/react';

export type StageNodeData = {
  label: string;
  sublabel?: string;
  active: boolean;
};

export default function StageNode({ data }: NodeProps & { data: StageNodeData }) {
  return (
    <div
      className={[
        'w-56 rounded border px-4 py-2 font-mono text-sm shadow-sm transition-all duration-500',
        data.active
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)] opacity-100'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] opacity-50',
      ].join(' ')}
    >
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
      <div>{data.label}</div>
      {data.sublabel && (
        <div className="truncate text-xs" title={data.sublabel}>
          {data.sublabel}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
    </div>
  );
}
