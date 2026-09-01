import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    githubRepo: z.string(),
    techStack: z.array(z.string()),
    order: z.number(),
  }),
});

export const collections = { projects };
