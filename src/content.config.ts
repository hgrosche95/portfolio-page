import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    githubRepo: z.string(),
    techStack: z.array(z.string()),
    order: z.number(),
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
