import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

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
    /**
     * Optional internal architecture, unfolded from the project's node in the
     * homepage graph. Kept here rather than in the component so that adding a
     * project MDX file stays the only step needed to extend the graph.
     * `edges` reference node ids; the first node is linked from the project.
     */
    architecture: z
      .object({
        nodes: z.array(
          z.object({
            id: z.string(),
            label: z.string(),
            kind: z.enum(['frontend', 'backend', 'data', 'external']),
          }),
        ),
        edges: z.array(z.tuple([z.string(), z.string()])),
      })
      .optional(),
  }),
});

export const collections = { projects };
