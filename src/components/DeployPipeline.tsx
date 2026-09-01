import { useEffect, useState } from 'react';
import { ReactFlow, type Node, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import StageNode, { type StageNodeData } from './graph/StageNode';
import deployInfo from '../data/deploy-info.json';

const nodeTypes = { stage: StageNode };

const formattedTimestamp = new Date(deployInfo.timestamp).toLocaleString('de-DE', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const stages: { id: string; label: string; sublabel: string }[] = [
  { id: 'commit', label: 'Commit', sublabel: `${deployInfo.shortSha} — ${deployInfo.message}` },
  { id: 'build', label: 'Build', sublabel: `Astro · ${deployInfo.branch}` },
  { id: 'deploy', label: 'Deploy', sublabel: 'Azure Static Web Apps' },
  { id: 'live', label: 'Live', sublabel: formattedTimestamp },
];

export default function DeployPipeline() {
  const [activeStage, setActiveStage] = useState(-1);

  useEffect(() => {
    stages.forEach((_, index) => {
      setTimeout(() => setActiveStage(index), index * 500);
    });
  }, []);

  const nodes: Node<StageNodeData>[] = stages.map((stage, index) => ({
    id: stage.id,
    type: 'stage',
    position: { x: index * 260, y: 0 },
    data: { label: stage.label, sublabel: stage.sublabel, active: index <= activeStage },
    draggable: false,
  }));

  const edges: Edge[] = stages.slice(1).map((stage, index) => ({
    id: `${stages[index].id}-${stage.id}`,
    source: stages[index].id,
    target: stage.id,
    animated: index < activeStage,
  }));

  return (
    <div className="h-40 rounded border border-[var(--color-border)] sm:h-[200px]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      />
    </div>
  );
}
