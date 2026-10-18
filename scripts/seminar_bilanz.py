"""Usage of the seminar preparation (Claude Code sessions on this Mac) for the public balance page.

Reads the local transcripts of the given sessions (main session plus its subagents),
counts every API response once and converts tokens into energy, CO2e and water with the
same rough factors as the status pane (00 VIBE/claude-mods/status-pane):
  0.5 J per input/cache-write token, 6 J per output token, 0.05 J per cache-read token,
  PUE 1.2, 0.37 kg CO2e/kWh (US grid), 1.15 L cooling water per kWh.
Good to a factor of a few either way; providers publish no per-token figures.

Writes seminar-kontext/bilanz.json (gitignored). Upload it with
  npx wrangler kv key put bilanz:lokal --path seminar-kontext/bilanz.json --binding SEMINAR --remote

Usage: python scripts/seminar_bilanz.py <session-id> [<session-id> …]
"""
import glob
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

PROJECTS = os.path.expanduser('~/.claude/projects')
J = {'input': 0.5, 'output': 6.0, 'cacheRead': 0.05, 'cacheWrite': 0.5}
PUE, KG_CO2E_PER_KWH, L_PER_KWH = 1.2, 0.37, 1.15

files = []
for sid in sys.argv[1:]:
    files += glob.glob(f'{PROJECTS}/*/{sid}.jsonl') + glob.glob(f'{PROJECTS}/*/{sid}/**/*.jsonl', recursive=True)

responses = {}   # (message id, request id) -> token counts; one response spans several lines
for f in files:
    for line in open(f, encoding='utf-8', errors='replace'):
        try:
            d = json.loads(line)
        except ValueError:
            continue
        m = d.get('message') or {}
        u = m.get('usage')
        if d.get('type') != 'assistant' or not u:
            continue
        v = [u.get('input_tokens') or 0, u.get('output_tokens') or 0,
             u.get('cache_read_input_tokens') or 0, u.get('cache_creation_input_tokens') or 0]
        key = (m.get('id'), d.get('requestId'))
        old = responses.get(key)
        responses[key] = [max(a, b) for a, b in zip(old, v)] if old else v

tok = dict(zip(['input', 'output', 'cacheRead', 'cacheWrite'], (sum(r[i] for r in responses.values()) for i in range(4))))
kwh = sum(tok[k] * J[k] for k in J) * PUE / 3.6e6
out = {
    'stand': datetime.now(timezone.utc).isoformat(timespec='minutes'),
    'vorbereitung': {'antworten': len(responses), 'tokens': tok, 'kwh': round(kwh, 4),
                     'g_co2e': round(kwh * KG_CO2E_PER_KWH * 1000, 1), 'l_wasser': round(kwh * L_PER_KWH, 3)},
}
ziel = Path(__file__).resolve().parent.parent / 'seminar-kontext' / 'bilanz.json'
ziel.write_text(json.dumps(out, indent=1), encoding='utf-8')
print(json.dumps(out, indent=1))
