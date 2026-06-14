import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Books — published book translations
const books = defineCollection({
	loader: glob({ base: './src/content/books', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			autor: z.string().optional(),
			jahr: z.number(),
			verlag: z.string().optional(),
			status: z.string().optional(),
			sprache: z.string().optional(),
			description: z.string().optional(),
			cover: z.optional(image()),
		}),
});

// Research — scholarly editions and research projects
const research = defineCollection({
	loader: glob({ base: './src/content/research', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			autor: z.string().optional(),
			jahr: z.number().optional(),
			status: z.string().optional(),
			description: z.string().optional(),
			url: z.string().optional(),
			cover: z.optional(image()),
		}),
});

// Blog — essays, translation criticism, poetry and notes
const texte = defineCollection({
	loader: glob({ base: './src/content/texte', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		pubDate: z.coerce.date(),
		rubrik: z.string().optional(),
		tags: z.array(z.string()).optional(),
		sprache: z.string().optional(),
		description: z.string().optional(),
		draft: z.boolean().optional(),
	}),
});

const interviews = defineCollection({
	loader: glob({ base: './src/content/interviews', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		pubDate: z.coerce.date(),
		medium: z.string().optional(),
		interviewer: z.string().optional(),
		url: z.string().optional(),
		description: z.string().optional(),
		ogImage: z.string().optional(),
	}),
});

const aktuelles = defineCollection({
	loader: glob({ base: './src/content/aktuelles', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		pubDate: z.coerce.date(),
		datum: z.coerce.date().optional(),
		ort: z.string().optional(),
		url: z.string().optional(),
		description: z.string().optional(),
	}),
});

export const collections = { books, research, texte, interviews, aktuelles };
