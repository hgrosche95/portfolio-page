import { useEffect, useRef, useState } from 'react';
import { ReactFlow, ReactFlowProvider, useReactFlow, type Node, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import StageNode, { type StageNodeData } from './graph/StageNode';
import deployInfo from '../data/deploy-info.json';

const nodeTypes = { stage: StageNode };

const formattedTimestamp = new Date(deployInfo.timestamp).toLocaleString('de-DE', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

// A merge commit's "from owner/branch" tail is noise in a box this small; the PR number says it.
const commitMessage = deployInfo.message.replace(/^(Merge pull request #\d+) from \S+$/, '$1');

/** Real numbers from this deploy's CI run when there are any, else just the tools. */
function testSummary(): string {
  const tests = deployInfo.tests as { passed: number; total: number; durationMs: number } | null | undefined;
  if (!tests) return 'Vitest · Frontend + API';
  const seconds = (tests.durationMs / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 });
  return `${tests.passed}/${tests.total} Tests grün · ${seconds}\u00a0s`;
}

const stages: { id: string; label: string; sublabel: string }[] = [
  { id: 'commit', label: 'Commit', sublabel: `${deployInfo.shortSha} · ${commitMessage}` },
  { id: 'test', label: 'Test', sublabel: testSummary() },
  { id: 'build', label: 'Build', sublabel: `Astro · ${deployInfo.branch}` },
  { id: 'deploy', label: 'Deploy', sublabel: 'Azure Static Web Apps' },
  { id: 'live', label: 'Live', sublabel: formattedTimestamp },
];

interface PipelineCanvasProps {
  nodes: Node<StageNodeData>[];
  edges: Edge[];
  stacked: boolean;
}

/**
 * Split out so it can reach `useReactFlow` (only available inside a
 * ReactFlowProvider). The `fitView` prop on `<ReactFlow>` only fits once on
 * mount — `stacked` starts false and flips shortly after via the matchMedia
 * effect, so a static fitView would freeze the camera on the layout from
 * that first render instead of the one actually on screen. Re-fitting
 * imperatively whenever the layout changes keeps zoom and centering correct.
 */
function PipelineCanvas({ nodes, edges, stacked }: PipelineCanvasProps) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    fitView({ padding: stacked ? 0.04 : 0.02 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, stacked]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      nodesFocusable={false}
      // The library's hidden hints tell screen-reader users to "press enter to
      // select" and "use the arrow keys to move" nodes, none of which works here.
      ariaLabelConfig={{
        'node.a11yDescription.default': '',
        'node.a11yDescription.keyboardDisabled': '',
        'edge.a11yDescription.default': '',
      }}
      panOnDrag={false}
      panOnScroll={false}
      zoomOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
      preventScrolling={false}
      proOptions={{ hideAttribution: true }}
    />
  );
}

export default function DeployPipeline() {
  const [activeStage, setActiveStage] = useState(-1);
  const [stacked, setStacked] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

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
    // With reduced motion the stages are simply all lit, no stepwise reveal.
    if (reduceMotion) {
      setActiveStage(stages.length - 1);
      return;
    }
    let timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      timers = stages.map((_, index) => setTimeout(() => setActiveStage(index), index * 500));
    };

    // On the homepage the pipeline is a station on the trace: the stages
    // light up once the scroll signal reaches it (TraceSection dispatches
    // "trace:arrive"). Already reached, or no trace on the page: start now.
    const station = rootRef.current?.closest<HTMLElement>('[data-trace-stop]');
    const traceLive = document.documentElement.classList.contains('trace-live');
    if (!station || !traceLive || station.classList.contains('reached')) {
      run();
      return () => timers.forEach(clearTimeout);
    }
    const onArrive = (event: Event) => {
      if ((event as CustomEvent<HTMLElement>).detail !== station) return;
      document.removeEventListener('trace:arrive', onArrive);
      run();
    };
    document.addEventListener('trace:arrive', onArrive);
    return () => {
      document.removeEventListener('trace:arrive', onArrive);
      timers.forEach(clearTimeout);
    };
  }, [reduceMotion]);

  const nodes: Node<StageNodeData>[] = stages.map((stage, index) => ({
    id: stage.id,
    type: 'stage',
    position: stacked ? { x: 0, y: index * 90 } : { x: index * 230, y: 0 },
    data: { label: stage.label, sublabel: stage.sublabel, active: index <= activeStage, vertical: stacked },
    draggable: false,
  }));

  const edges: Edge[] = stages.slice(1).map((stage, index) => ({
    id: `${stages[index].id}-${stage.id}`,
    source: stages[index].id,
    target: stage.id,
    animated: !reduceMotion && index < activeStage,
  }));

  // Narrow screens get a plain vertical list at body size instead of the
  // diagram: fitView would scale five stacked boxes down to unreadable text.
  if (stacked) {
    return (
      <ol
        ref={(el) => {
          rootRef.current = el;
        }}
        className="pipeline-list"
        aria-label="Deployment-Pipeline dieser Seite"
      >
        {stages.map((stage, index) => (
          <li key={stage.id} data-active={index <= activeStage ? '' : undefined}>
            <span className="stage">{stage.label}</span>
            <span className="detail">{stage.sublabel}</span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div
      ref={(el) => {
        rootRef.current = el;
      }}
      className="static-flow"
      role="group"
      aria-label="Deployment-Pipeline dieser Seite: Commit, Test, Build, Deploy, Live"
      style={{ height: stacked ? 380 : 120 }}
    >
      <ReactFlowProvider>
        <PipelineCanvas nodes={nodes} edges={edges} stacked={stacked} />
      </ReactFlowProvider>
    </div>
  );
}
