// Release times of the session pages, read by the Worker (worker/index.ts).
import { getCollection } from 'astro:content';
import { AKTIV_AB, freigaben } from '../../../lib/freigabe';

export async function GET() {
	const sitzungen = (await getCollection('sitzungen')).map((s) => s.data);
	const titel = Object.fromEntries(sitzungen.map((s) => [String(s.nr).padStart(2, '0'), s.titel]));
	return new Response(JSON.stringify({ aktivAb: AKTIV_AB, seiten: freigaben(sitzungen), titel }), {
		headers: { 'content-type': 'application/json; charset=utf-8' },
	});
}
