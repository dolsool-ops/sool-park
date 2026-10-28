// Anonymous cards for an in-class exercise: students write a short answer on their phone,
// the wall page shows all answers on the projector.
//
// - The question is not in this repository (it is public): it lives in KV under `karten:frage`
//   and is only handed out while the pad is open.
// - Open during the session window below, or when KV `karten:schalter` is "auf" / "zu".
// - Anonymous: only the text is stored. Against spam a salted hash of the IP address is kept
//   for three hours; no names, no cookies, no IP addresses.
// - Cards expire at the end of the semester.

export interface KartenKV {
	get(key: string): Promise<string | null>;
	put(key: string, value: string, options?: { expirationTtl?: number; expiration?: number; metadata?: unknown }): Promise<void>;
	list(options: { prefix: string; cursor?: string }): Promise<{ keys: { name: string; metadata?: unknown }[]; list_complete: boolean; cursor?: string }>;
}

export interface KartenEnv {
	SEMINAR: KartenKV;
	KARTEN_JETZT?: string; // local tests only: pretend it is this moment (ISO)
}

const FENSTER = { von: '2026-10-28T17:45:00+01:00', bis: '2026-10-28T20:15:00+01:00' };
const LOESCHEN = Date.parse('2027-03-31T23:59:00+02:00') / 1000;
const MAX_BYTES = 1000; // stored as KV metadata, which allows 1024 bytes
const PRO_GERAET = 50; // cards per address within three hours (a class may share one address behind the university NAT)
const PREFIX = 'karten:01:';

const antwort = (status: number, daten: unknown) =>
	new Response(JSON.stringify(daten), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
	});

async function offen(env: KartenEnv): Promise<boolean> {
	const schalter = await env.SEMINAR.get('karten:schalter');
	if (schalter === 'auf') return true;
	if (schalter === 'zu') return false;
	const jetzt = env.KARTEN_JETZT ? new Date(env.KARTEN_JETZT) : new Date();
	return jetzt >= new Date(FENSTER.von) && jetzt < new Date(FENSTER.bis);
}

async function pruefsumme(text: string): Promise<string> {
	const daten = new TextEncoder().encode(text);
	const hash = await crypto.subtle.digest('SHA-256', daten);
	return [...new Uint8Array(hash)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// GET  /api/seminar-karten        → { offen, frage? }
// POST /api/seminar-karten        → { ok } (body { text })
// GET  /api/seminar-karten/wand   → { offen, frage?, karten: string[] }
export async function karten(request: Request, env: KartenEnv, pfad: string): Promise<Response> {
	const istOffen = await offen(env);
	const frage = istOffen ? await env.SEMINAR.get('karten:frage') : null;

	if (pfad === '/api/seminar-karten/wand') {
		if (!istOffen) return antwort(200, { offen: false, karten: [] });
		const liste: string[] = [];
		let cursor: string | undefined;
		do {
			const teil = await env.SEMINAR.list({ prefix: PREFIX, cursor });
			for (const k of teil.keys) {
				const t = (k.metadata as { t?: string } | undefined)?.t;
				if (t) liste.push(t);
			}
			cursor = teil.list_complete ? undefined : teil.cursor;
		} while (cursor);
		return antwort(200, { offen: true, frage, karten: liste });
	}

	if (request.method === 'GET') return antwort(200, istOffen ? { offen: true, frage } : { offen: false });
	if (request.method !== 'POST') return antwort(405, { fehler: 'Nur GET oder POST.' });
	if (!istOffen || !frage) return antwort(403, { fehler: 'Die Karten sind gerade nicht geöffnet.' });

	let text = '';
	try {
		text = String(((await request.json()) as { text?: unknown }).text ?? '').trim();
	} catch {
		return antwort(400, { fehler: 'Ungültige Anfrage.' });
	}
	if (!text) return antwort(400, { fehler: 'Die Karte ist leer.' });
	if (new TextEncoder().encode(JSON.stringify({ t: text })).length > MAX_BYTES) return antwort(400, { fehler: 'Die Karte ist zu lang – bitte kürzer fassen.' });

	const ip = request.headers.get('cf-connecting-ip') ?? 'lokal';
	const geraet = `karten:rate:${await pruefsumme(`${ip}|${FENSTER.von}|karten`)}`;
	const anzahl = Number((await env.SEMINAR.get(geraet)) ?? 0);
	if (anzahl >= PRO_GERAET) return antwort(429, { fehler: 'Von diesem Gerät sind schon genug Karten gekommen.' });
	await env.SEMINAR.put(geraet, String(anzahl + 1), { expirationTtl: 3 * 3600 });

	await env.SEMINAR.put(`${PREFIX}${crypto.randomUUID()}`, '', { expiration: LOESCHEN, metadata: { t: text } });
	return antwort(200, { ok: true });
}
