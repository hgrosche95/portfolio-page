import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/** One box in the project's schematic. */
const architectureNode = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(['frontend', 'backend', 'data', 'external']),
  /** Small second line under the label, e.g. "Auth · Rate-Limit". */
  sub: z.string().optional(),
  /** Shown when the node is clicked on the project page. */
  description: z.string().optional(),
  /** Column index into `lanes`. */
  lane: z.number().int().min(0).optional(),
  /** Vertical slot; fractions like 1.3 are fine, they just shift the box. */
  row: z.number().min(0).optional(),
});

/**
 * One hop of a playable scenario. `from === to` means work happening inside
 * a single component (e.g. a validation step), drawn as a pause, not a move.
 */
const scenarioStep = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string(),
  detail: z.string().optional(),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    /** One or two sentences for the project card grid on the homepage. */
    summary: z.string(),
    githubRepo: z.string(),
    /** What the repo actually uses today — the tags shown everywhere. */
    techStack: z.array(z.string()),
    /**
     * Intended but not yet built. Kept apart from techStack so a claim is
     * never made before the code backs it up, and so only the project page
     * shows it: cards and graph nodes stay a statement of what exists.
     */
    plannedTech: z.array(z.string()).optional(),
    order: z.number(),
    /**
     * What kind of thing this project architecturally is, not what it's
     * built with — drives the node's border style in the homepage graph
     * (solid/dashed/double/dotted) so a project's shape is visible before
     * reading a single tag. A judgement call, not derived from techStack:
     * a project with an LLM call and a web frontend is still "agent" if
     * the agent is the point of the project, not the frontend.
     */
    kind: z.enum(['fullstack', 'agent', 'orchestration', 'static']),
    /**
     * Optional live deployment. Set both, or neither: without a URL there is
     * nothing to label. The label exists because "Live ansehen" is wrong for
     * something you actually play.
     */
    liveUrl: z.string().url().optional(),
    liveLabel: z.string().optional(),
    /**
     * Shows a "server is awake / asleep" check next to the live button.
     * Only true for projects with a scale-to-zero backend behind the demo,
     * where the first request after idling can take 30-40s - without a
     * warning that reads as the demo being broken. The matching target URL
     * lives server-side in api/src/functions/live-status.ts, on a fixed
     * allowlist rather than taken from this field, so the check can never be
     * pointed at an arbitrary URL by editing content: the two must be kept
     * in sync by hand when this flag changes.
     */
    liveStatusCheck: z.boolean().optional(),
    /** Where it runs, one line for the project page's data sheet. */
    hosting: z.string().optional(),
    /**
     * Architecture decisions shown beside the write-up: what was chosen, what
     * was considered and dropped, and why. Structured rather than prose so
     * the rejected options can be shown as such, not buried in a sentence.
     */
    decisions: z
      .array(
        z.object({
          topic: z.string(),
          rejected: z.array(z.string()).default([]),
          chosen: z.string(),
          reason: z.string(),
        }),
      )
      .optional(),
    /**
     * Optional internal architecture, unfolded from the project's node in the
     * homepage graph. Kept here rather than in the component so that adding a
     * project MDX file stays the only step needed to extend the graph.
     * `edges` reference node ids; the first node is linked from the project.
     */
    architecture: z
      .object({
        /** Column titles for the schematic. Once set, every node needs lane + row. */
        lanes: z.array(z.string()).optional(),
        nodes: z.array(architectureNode),
        edges: z.array(z.tuple([z.string(), z.string()])),
        scenarios: z
          .array(z.object({ name: z.string(), steps: z.array(scenarioStep).min(1) }))
          .optional(),
      })
      /*
       * Cross-field checks a per-field schema can't express: every reference
       * must point at a real node, and a scenario may only travel along an
       * existing edge. A typo in the frontmatter breaks the build instead of
       * showing up live as a packet that silently goes nowhere.
       */
      .superRefine((arch, ctx) => {
        const ids = new Set(arch.nodes.map((node) => node.id));
        // Sorted, so a step may use an edge in either direction.
        const pairKey = (a: string, b: string) => [a, b].sort().join('|');
        const connected = new Set(arch.edges.map(([a, b]) => pairKey(a, b)));

        arch.edges.forEach(([a, b], i) => {
          for (const id of [a, b]) {
            if (!ids.has(id)) {
              ctx.addIssue({ code: 'custom', path: ['edges', i], message: `Kante verweist auf unbekannten Knoten "${id}"` });
            }
          }
        });

        const lanes = arch.lanes;
        if (lanes) {
          arch.nodes.forEach((node, i) => {
            if (node.lane === undefined || node.row === undefined) {
              ctx.addIssue({ code: 'custom', path: ['nodes', i], message: `"${node.id}" braucht lane und row, sobald lanes gesetzt ist` });
            } else if (node.lane >= lanes.length) {
              ctx.addIssue({
                code: 'custom',
                path: ['nodes', i, 'lane'],
                message: `"${node.id}" liegt in Spalte ${node.lane}, es gibt aber nur ${lanes.length}`,
              });
            }
          });
        }

        arch.scenarios?.forEach((scenario, s) => {
          scenario.steps.forEach((step, i) => {
            const path = ['scenarios', s, 'steps', i];
            if (!ids.has(step.from) || !ids.has(step.to)) {
              ctx.addIssue({ code: 'custom', path, message: `Schritt "${step.label}" verweist auf einen unbekannten Knoten` });
            } else if (step.from !== step.to && !connected.has(pairKey(step.from, step.to))) {
              ctx.addIssue({ code: 'custom', path, message: `Keine Leitung zwischen "${step.from}" und "${step.to}"` });
            }
          });
        });
      })
      .optional(),
  }),
});

export const collections = { projects };
