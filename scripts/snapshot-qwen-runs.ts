/**
 * Condenses the qwen-pipeline run log into src/data/qwen-runs.json for the
 * project page.
 *
 * The log (~/.claude/qwen-runs.jsonl) only exists on the machine the
 * pipeline runs on, so unlike fetch-github-stats.ts this is not part of
 * prebuild: CI could never read it. Run it by hand after new runs and commit
 * the result:
 *
 *   node scripts/snapshot-qwen-runs.ts [path/to/qwen-runs.jsonl]
 *
 * Only numbers and short hand-written task labels leave the log. Task
 * prompts, branch names and notes stay where they are.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

type Run = {
  date: string;
  project: string;
  result: string;
  total?: number;
  cost?: number;
  lines?: number;
  kind?: string;
  harness?: string;
  bench?: string;
  task?: string;
};

const LOG = process.argv[2] ?? join(homedir(), '.claude', 'qwen-runs.jsonl');
const OUT = 'src/data/qwen-runs.json';

/** Benchmark tasks by the start of their prompt. Unknown tasks fall back to the prompt's first words. */
const TASK_LABELS: [prefix: string, label: string][] = [
  ['Fuege Schwierigkeitsstufen', 'Schwierigkeitsstufen 0–5'],
  ['Fuege Verbrauchsgegenstaende', 'Verbrauchsgegenstände'],
  ['Bestellen und Bewerten haben kein Rate-Limit', 'Rate-Limit fürs Bestellen'],
  ['Erledigt hat keinen Rueckweg', 'Rückweg für „Erledigt“'],
];

/** The first runs were logged with German result keys. */
function normalizeResult(result: string): string {
  return { gruen: 'green', abbruch: 'aborted', fertig: 'done' }[result] ?? result;
}

function labelFor(task = ''): string {
  return TASK_LABELS.find(([prefix]) => task.startsWith(prefix))?.[1] ?? task.split(/[.:]/)[0].slice(0, 40);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const round = (value: number | null, digits = 1) => (value === null ? null : Number(value.toFixed(digits)));
const minutes = (run: Run) => (run.total ?? 0) / 60;

const runs: Run[] = readFileSync(LOG, 'utf-8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line))
  .map((run: Run) => ({ ...run, result: normalizeResult(run.result) }))
  // "kein-server": the local model was not running, so the pipeline never started.
  .filter((run) => run.result !== 'kein-server');

/*
 * Pipeline runs outside the benchmark: every /qwen-style run that either
 * finished green or was given up on. /q runs are counted apart, since they
 * check nothing and so have no result worth comparing.
 */
const pipelineRuns = runs.filter((run) => !run.bench && run.kind !== 'q');
const green = pipelineRuns.filter((run) => run.result === 'green');

/*
 * Benchmark tasks, grouped by prompt rather than by bench id: an aborted
 * preparation and its later retry are the same task, and both cost money.
 */
const benchRuns = runs.filter((run) => run.bench);
const taskOrder: string[] = [];
const tasks = new Map<string, Run[]>();
for (const run of benchRuns) {
  const label = labelFor(run.task);
  if (!tasks.has(label)) {
    tasks.set(label, []);
    taskOrder.push(label);
  }
  tasks.get(label)!.push(run);
}

// In the order they were first actually implemented, not prepared: an early
// aborted preparation should not put a task ahead of ones that ran before it.
const firstImplementation = (label: string) =>
  tasks.get(label)!.find((run) => !run.bench!.endsWith('/prepare'))?.date ?? '9999';
taskOrder.sort((a, b) => firstImplementation(a).localeCompare(firstImplementation(b)));

const bench = taskOrder.map((label) => {
  const taskRuns = tasks.get(label)!;
  const prepare = taskRuns.filter((run) => run.bench!.endsWith('/prepare'));
  const byHarness = (harness: string) =>
    taskRuns
      .filter((run) => !run.bench!.endsWith('/prepare') && run.harness === harness)
      .map((run) => ({ minutes: round(minutes(run)), green: run.result === 'green', lines: run.lines ?? 0 }));
  return {
    label,
    project: taskRuns[0].project,
    prepareCostUsd: round(
      prepare.reduce((sum, run) => sum + (run.cost ?? 0), 0),
      2,
    ),
    claude: byHarness('claude'),
    opencode: byHarness('opencode'),
  };
});

const dates = runs.map((run) => run.date).sort();
const snapshot = {
  updatedAt: new Date().toISOString(),
  firstRun: dates[0],
  lastRun: dates.at(-1),
  totalRuns: runs.length,
  quickRuns: runs.filter((run) => run.kind === 'q').length,
  pipeline: {
    runs: pipelineRuns.length,
    green: green.length,
    aborted: pipelineRuns.filter((run) => run.result === 'aborted').length,
    medianMinutes: round(median(green.map(minutes))),
    medianCostUsd: round(median(green.map((run) => run.cost ?? 0)), 2),
    maxCostUsd: round(Math.max(...green.map((run) => run.cost ?? 0)), 2),
    medianLines: median(green.map((run) => run.lines ?? 0)),
  },
  bench,
};

writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`${OUT}: ${runs.length} Läufe, ${bench.length} Benchmark-Aufgaben`);
