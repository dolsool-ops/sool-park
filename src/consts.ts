// Global site data.
export const SITE_TITLE = 'Sool Park · 박술';
export const SITE_DESCRIPTION =
	'Translator and author — philosophy, poetry and translation criticism between German and Korean.';
export const SITE_AUTHOR = 'Sool Park';

export const NAV = [
	{ href: '/aktuelles/', label: 'News' },
	{
		label: 'Work',
		children: [
			{ href: '/books/', label: 'Books' },
			{ href: '/research/', label: 'Research' },
			{ href: '/interviews/', label: 'Interviews' },
		],
	},
	{ href: '/texte/', label: 'Blog' },
	{ href: '/', label: 'Profile' },
];
