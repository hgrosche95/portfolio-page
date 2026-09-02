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
  const [stacked, setStacked] = useState(false);

  useEffect(() => {
    // The section caps out at max-w-5xl (~992px usable), but the four
    // stages need ~1040px laid out horizontally — so anything narrower
    // than that gets squeezed by fitView, not just phones. Match the lg
    // breakpoint so the row only ever appears once it has full room.
    const mql = window.matchMedia('(max-width: 1023px)');
    const update = () => setStacked(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    stages.forEach((_, index) => {
      setTimeout(() => setActiveStage(index), index * 500);
    });
  }, []);

  const nodes: Node<StageNodeData>[] = stages.map((stage, index) => ({
    id: stage.id,
    type: 'stage',
    position: stacked ? { x: 0, y: index * 110 } : { x: index * 260, y: 0 },
    data: { label: stage.label, sublabel: stage.sublabel, active: index <= activeStage, vertical: stacked },
    draggable: false,
  }));

  const edges: Edge[] = stages.slice(1).map((stage, index) => ({
    id: `${stages[index].id}-${stage.id}`,
    source: stages[index].id,
    target: stage.id,
    animated: index < activeStage,
  }));

  return (
    <div className="static-flow" style={{ height: stacked ? 400 : 200 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        nodesFocusable={false}
        panOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: stacked ? 0.08 : 0.2 }}
      />
    </div>
  );
}
