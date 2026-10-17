// Cloudflare Worker: static site from ./dist plus the seminar chat at /api/seminar-chat.
// The chat needs the access code handed out in the first session, keeps a monthly
// budget, and answers from the reader text of the session (KV namespace SEMINAR,
// filled by scripts/seminar_kontext.py). Nothing the students write is stored.
import Anthropic from '@anthropic-ai/sdk';
import { PERSONA } from './persona';

interface KV {
	get(key: string): Promise<string | null>;
	put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface Env {
	ASSETS: { fetch(request: Request): Promise<Response> };
	SEMINAR: KV;
	ANTHROPIC_API_KEY: string;
	SEMINAR_CODE: string;
	BUDGET_USD?: string; // monthly cap, default 21 (≈ 20 €)
}

const MODEL = 'claude-opus-5-5';
// USD per million tokens (Claude Opus 5.5): input, output, 5-minute cache write, cache read
const PRICE = { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 };
const PER_HOUR = 40; // questions per IP and hour
const MAX_TURNS = 20;
const MAX_CHARS = 4000;

type Turn = { role: 'user' | 'assistant'; content: string };

const json = (status: number, fehler: string) =>
	new Response(JSON.stringify({ fehler }), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

const sameCode = (a: string, b: string) => {
	if (!a || !b || a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
};

async function chat(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'POST') return json(405, 'Nur POST.');
	let body: { code?: string; nr?: string; messages?: Turn[] };
	try {
		body = await request.json();
	} catch {
		return json(400, 'Ungültige Anfrage.');
	}
	if (!sameCode(String(body.code ?? '').trim(), env.SEMINAR_CODE ?? '')) return json(401, 'Der Zugangscode stimmt nicht.');

	const nr = String(body.nr ?? '');
	const messages = (body.messages ?? []).slice(-MAX_TURNS);
	if (!/^\d\d$/.test(nr)) return json(400, 'Unbekannte Sitzung.');
	if (
		!messages.length ||
		messages[messages.length - 1].role !== 'user' ||
		messages.some((m) => !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > MAX_CHARS)
	)
		return json(400, 'Ungültiger Gesprächsverlauf.');
	while (messages[0]?.role !== 'user') messages.shift();

	// Rate limit and monthly budget (KV is eventually consistent; this is a soft guard,
	// the hard cap is the spend limit in the Anthropic Console)
	const month = new Date().toISOString().slice(0, 7);
	const hour = new Date().toISOString().slice(0, 13);
	const ip = request.headers.get('cf-connecting-ip') ?? 'lokal';
	const [spent, count] = await Promise.all([env.SEMINAR.get(`budget:${month}`), env.SEMINAR.get(`rate:${ip}:${hour}`)]);
	if (Number(spent ?? 0) >= Number(env.BUDGET_USD ?? 21)) return json(429, 'Das Monatsbudget für den Chat ist aufgebraucht.');
	if (Number(count ?? 0) >= PER_HOUR) return json(429, 'Zu viele Fragen in kurzer Zeit – bitte später weiter.');
	await env.SEMINAR.put(`rate:${ip}:${hour}`, String(Number(count ?? 0) + 1), { expirationTtl: 7200 });

	const [plan, texte, gedaechtnis] = await Promise.all([
		env.SEMINAR.get('plan'),
		env.SEMINAR.get(`sitzung:${nr}`),
		env.SEMINAR.get('gedaechtnis'),
	]);

	const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
	const stream = client.beta.messages.stream({
		model: MODEL,
		max_tokens: 16000,
		output_config: { effort: 'medium' },
		betas: ['server-side-fallback-2026-07-01'],
		fallbacks: 'default',
		system: [
			{ type: 'text', text: PERSONA },
			{ type: 'text', text: `# Semesterplan\n\n${plan ?? '(fehlt)'}` },
			{ type: 'text', text: `# Reader-Texte zu Sitzung ${Number(nr)}\n\n${texte ?? '(Für diese Sitzung liegt kein Text vor.)'}` },
			{
				type: 'text',
				text: `# Seminargedächtnis\n\n${gedaechtnis ?? '(Noch keine Sitzung festgehalten.)'}`,
				cache_control: { type: 'ephemeral' },
			},
		],
		messages: messages.map((m) => ({ role: m.role, content: m.content })),
	});

	const encoder = new TextEncoder();
	const out = new TransformStream<Uint8Array, Uint8Array>();
	const writer = out.writable.getWriter();

	(async () => {
		try {
			for await (const event of stream) {
				if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
					await writer.write(encoder.encode(event.delta.text));
				}
			}
			const final = await stream.finalMessage();
			if (final.stop_reason === 'refusal') await writer.write(encoder.encode('\n\n[Dazu kann ich hier nichts sagen.]'));
			if (final.stop_reason === 'max_tokens') await writer.write(encoder.encode(' …'));
			const u = final.usage;
			const cost =
				(u.input_tokens * PRICE.input +
					u.output_tokens * PRICE.output +
					(u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite +
					(u.cache_read_input_tokens ?? 0) * PRICE.cacheRead) /
				1e6;
			const now = Number((await env.SEMINAR.get(`budget:${month}`)) ?? 0);
			await env.SEMINAR.put(`budget:${month}`, (now + cost).toFixed(4));
		} catch (err) {
			const msg = err instanceof Anthropic.APIError ? `API-Fehler ${err.status}` : 'Verbindung unterbrochen';
			await writer.write(encoder.encode(`\n\n[${msg} – bitte noch einmal versuchen.]`));
		} finally {
			await writer.close();
		}
	})();

	return new Response(out.readable, {
		headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
	});
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === '/api/seminar-chat') return chat(request, env);
		return env.ASSETS.fetch(request);
	},
};
