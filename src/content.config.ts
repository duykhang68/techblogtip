import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string().min(8),
    description: z.string().min(25).max(200),
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    category: z.string().min(2),
    tags: z.array(z.string()).default([]),
    series: z.string().optional(),
    author: z.string().default('TechBlogTip'),
    cover: z.string().endsWith('.webp').optional(),
    coverAlt: z.string().optional(),
    draft: z.boolean().default(false),
    sourceType: z.enum(['google-sheets','notion','obsidian','manual']).optional(),
    sourceId: z.string().min(8).optional(),
    sourceRevision: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  }).refine(v => !v.cover || (v.coverAlt && v.coverAlt.length >= 8), {
    message: 'Every WebP cover must have descriptive alt text',
  }),
});
export const collections = { articles };
