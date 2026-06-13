import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';

export async function GET(context) {
	const texte = (await getCollection('texte'))
		.filter((t) => !t.data.draft)
		.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: texte.map((t) => ({
			title: t.data.title,
			pubDate: t.data.pubDate,
			description: t.data.description ?? '',
			link: `/texte/${t.id}/`,
		})),
	});
}
