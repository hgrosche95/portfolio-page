import { mkdirSync, writeFileSync } from 'node:fs';

/*
 * Measured results that change with every run, read at build time.
 *
 * The AI Trip Planner runs its evals every night against the real stack and
 * appends the result to history.json on its `eval-data` branch. Hard-coding
 * those numbers would make them stale by the next morning, so the homepage
 * row takes them from the latest run instead, with its date.
 *
 * Writes src/data/eval-stats.json, keyed by project id, in the same shape as
 * the `metrics` field of a project. If the source is unreachable the project
 * keeps its static `metrics` from the content file; a build never fails here.
 */

type HistoryEntry = {
  timestamp: string;
  provider: string;
  knowledge?: { topK?: number; recall?: number; injectionResistance?: number };
  scenarios?: { summary?: { scenarios?: number; passed?: number; costUsd?: number } };
};

type Metrics = {
  items: { value: string; label: string }[];
  source: { label: string; url: string };
};

const SOURCES = [
  {
    project: 'ai-trip-planer',
    history: 'https://raw.githubusercontent.com/hgrosche95/ai-trip-planer/eval-data/history.json',
    page: 'https://witty-pond-0504bdc0f.7.azurestaticapps.net/evals',
    // The provider the live demo actually runs on; the nightly job also
    // compares other providers, which are not what visitors get.
    provider: 'groq',
  },
];

const percent = (value: number) => `${Math.round(value * 100)} %`;

async function fetchMetrics(source: (typeof SOURCES)[number]): Promise<Metrics | null> {
  const response = await fetch(source.history, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const { entries } = (await response.json()) as { entries: HistoryEntry[] };

  const latest = entries
    .filter((entry) => entry.provider === source.provider)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  const summary = latest?.scenarios?.summary;
  const knowledge = latest?.knowledge;
  if (!latest || !summary?.scenarios || summary.passed == null) return null;

  const items: Metrics['items'] = [
    { value: `${summary.passed}/${summary.scenarios}`, label: 'Eval-Szenarien bestanden, gegen den echten Stack' },
  ];
  if (knowledge?.recall != null) {
    items.push({ value: percent(knowledge.recall), label: `Recall@${knowledge.topK ?? 3} der Wissenssuche` });
  }
  if (knowledge?.injectionResistance != null) {
    items.push({ value: percent(knowledge.injectionResistance), label: 'Prompt-Injections abgewehrt' });
  }
  if (summary.costUsd != null) {
    const cost = summary.costUsd.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    items.push({ value: `${cost} $`, label: 'Kosten des ganzen Eval-Laufs' });
  }

  const date = new Date(latest.timestamp).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  });
  return { items, source: { label: `Nachtlauf vom ${date} · Verlauf live: /evals`, url: source.page } };
}

async function main() {
  const stats: Record<string, Metrics> = {};
  for (const source of SOURCES) {
    try {
      const metrics = await fetchMetrics(source);
      if (metrics) stats[source.project] = metrics;
      else console.warn(`WARNUNG: keine verwertbaren Eval-Daten für ${source.project}`);
    } catch (error) {
      // Decorative for the build: the project falls back to its static metrics.
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`WARNUNG: Eval-Daten für ${source.project} nicht geladen: ${reason}`);
    }
  }

  mkdirSync('src/data', { recursive: true });
  writeFileSync('src/data/eval-stats.json', JSON.stringify(stats, null, 2));
  console.log(`eval-stats.json written for ${Object.keys(stats).length}/${SOURCES.length} project(s)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
