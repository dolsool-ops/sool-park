"""Build the chat context for the seminar assistant from the reader PDF.

Writes seminar-kontext/kv.json (gitignored) in `wrangler kv bulk put` format:
  plan         – the semester plan (sessions, guiding questions, texts)
  sitzung:NN   – full reader text of session NN, with [Reader S. x] page markers

The reader is only for participants (§ 60a UrhG): never commit this file and
never put it into public/. Upload it to the SEMINAR KV namespace instead:
  npx wrangler kv bulk put seminar-kontext/kv.json --binding SEMINAR --local

Usage: python scripts/seminar_kontext.py <reader.pdf>
"""
import json
import re
import sys
from pathlib import Path

import pymupdf

doc = pymupdf.open(sys.argv[1])
out = Path(__file__).resolve().parent.parent / 'seminar-kontext'
out.mkdir(exist_ok=True)

# Table of contents: text lines, each followed by its page number
lines = [l.strip() for l in doc[1].get_text().split('\n') if l.strip()]
lines = lines[lines.index('Inhaltsverzeichnis') + 1:]
entries, buf = [], []
for l in lines:
    if l.isdigit():
        entries.append((' '.join(buf), int(l)))
        buf = []
    elif l.startswith('Reader Digitalität'):
        break
    else:
        buf.append(l)

sessions = []
for text, page in entries:
    m = re.match(r'Sitzung (\d+) · (\d\d\.\d\d\.\d{4}) · (.+)', text)
    if m:
        sessions.append(dict(nr=int(m[1]), datum=m[2], titel=m[3], kopf=page, texte=[]))
    else:
        sessions[-1]['texte'].append(text)

def page_text(p):
    t = doc[p - 1].get_text()
    t = re.sub(r'\n?Reader Digitalität · \d+\s*$', '', t.strip())
    return f'[Reader S. {p}]\n{t}'

kv, plan = [], []
for i, s in enumerate(sessions):
    end = sessions[i + 1]['kopf'] - 1 if i + 1 < len(sessions) else len(doc)
    kopf = [l.strip() for l in doc[s['kopf'] - 1].get_text().split('\n') if l.strip()]
    j = kopf.index(s['titel']) + 1 if s['titel'] in kopf else 2
    frage = []
    while j < len(kopf) and not kopf[j].startswith('TEXTE'):
        frage.append(kopf[j]); j += 1
    plan.append(f"Sitzung {s['nr']} (Mi {s['datum']}): {s['titel']}\n"
                f"  Leitfrage: {' '.join(frage)}\n  Texte: {'; '.join(s['texte'])}")
    body = '\n\n'.join(page_text(p) for p in range(s['kopf'], end + 1))
    kv.append({'key': f"sitzung:{s['nr']:02d}", 'value': body})
    print(f"Sitzung {s['nr']:2d}: S. {s['kopf']}–{end}, {len(body):7,d} Zeichen (~{len(body) // 3:,d} Tokens)")

kv.insert(0, {'key': 'plan', 'value': '\n'.join(plan)})
(out / 'kv.json').write_text(json.dumps(kv, ensure_ascii=False), encoding='utf-8')
print('→', out / 'kv.json')
