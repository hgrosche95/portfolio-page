import { Handle, Position, type NodeProps } from '@xyflow/react';

export type StageNodeData = {
  label: string;
  sublabel?: string;
  active: boolean;
  vertical?: boolean;
};

export default function StageNode({ data }: NodeProps & { data: StageNodeData }) {
  return (
    <div
      className={[
        // Vertical (mobile stack) gets ~25% larger boxes — there's no
        // neighbouring column fighting for width there, and the bigger
        // touch target reads better than the desktop row's compact size.
        data.vertical ? 'w-[280px] px-5 py-2.5 text-base' : 'w-56 px-4 py-2 text-sm',
        'rounded border font-mono shadow-sm transition-all duration-500',
        data.active
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)] opacity-100'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] opacity-50',
      ].join(' ')}
    >
      <Handle
        type="target"
        position={data.vertical ? Position.Top : Position.Left}
        style={{ visibility: 'hidden' }}
      />
      <div>{data.label}</div>
      {data.sublabel && (
        <div className={['truncate', data.vertical ? 'text-sm' : 'text-xs'].join(' ')} title={data.sublabel}>
          {data.sublabel}
        </div>
      )}
      <Handle
        type="source"
        position={data.vertical ? Position.Bottom : Position.Right}
        style={{ visibility: 'hidden' }}
      />
    </div>
  );
}
