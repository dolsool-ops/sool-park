// When the seminar pages go online. From the start of the seminar on, a session page opens
// on the evening of the previous session (20:00 in Hildesheim), one week ahead; the first
// session is always open. Before AKTIV_AB everything is visible (course choice).
// The Worker enforces this (worker/index.ts reads termine.json); the pages only mirror it.

export const AKTIV_AB = '2026-10-28T00:00:00+01:00';
const UHRZEIT = '20:00';

interface Termin { nr: number; datum: Date; }

const slug = (nr: number) => String(nr).padStart(2, '0');

// "2026-11-04" + "20:00" → "2026-11-04T20:00:00+01:00" (offset of that day in Berlin)
function berlin(tag: string, zeit: string): string {
	const name = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', timeZoneName: 'shortOffset' })
		.formatToParts(new Date(`${tag}T12:00:00Z`))
		.find((p) => p.type === 'timeZoneName')!.value; // "GMT+1" or "GMT+2"
	const h = Number(name.replace('GMT', '') || 0);
	return `${tag}T${zeit}:00${h < 0 ? '-' : '+'}${String(Math.abs(h)).padStart(2, '0')}:00`;
}

// "01" → null (always open), "02" → evening of session 1, …
export function freigaben(termine: Termin[]): Record<string, string | null> {
	const sortiert = [...termine].sort((a, b) => a.nr - b.nr);
	return Object.fromEntries(
		sortiert.map((t, i) => [slug(t.nr), i === 0 ? null : berlin(sortiert[i - 1].datum.toISOString().slice(0, 10), UHRZEIT)]),
	);
}
