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
