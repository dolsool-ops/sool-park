// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://sool-park.com',
	integrations: [
		mdx(),
		sitemap({ filter: (page) => !['/teaching/digitalitaet/noch-nicht/', '/teaching/digitalitaet/karte/', '/karte/'].some((p) => page.includes(p)) }),
	],
	// short address for the projector: sool-park.com/karte
	redirects: { '/karte': '/teaching/digitalitaet/karte/' },
	// dev only: the seminar chat runs in the Worker (`wrangler dev` on port 8787)
	vite: { server: { proxy: { '/api': 'http://127.0.0.1:8787' } } },
});
