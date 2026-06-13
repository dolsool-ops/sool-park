#!/usr/bin/env python3
"""Run AFTER import_wp.py. Rewrites old randomgeist.com image URLs to the local
copies under public/wp-content/uploads, and removes image refs whose local file
is missing (originals that were never in the backup). Re-runnable, idempotent.
"""
import re, os, glob

SP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(SP, "public")
files = glob.glob(os.path.join(SP, "src/content/texte/*.md"))

# randomgeist.com (optionally via Jetpack Photon i0/i1/i2.wp.com), http/https, strip ?query
host = re.compile(r"https?://(?:i\d+\.wp\.com/)?randomgeist\.com(/wp-content/uploads/[^)\s?]+)(?:\?[^)\s]*)?")
img_local = re.compile(r"!\[[^\]]*\]\((/wp-content/uploads/[^)\s]+)\)")

rewritten = removed = refs = ok = 0
missing = set()
for f in files:
    s = open(f, encoding="utf-8").read()
    s, n = host.subn(r"\1", s)
    if n:
        rewritten += 1

    def drop_if_missing(m):
        global removed
        if not os.path.exists(os.path.join(PUB, m.group(1).lstrip("/"))):
            removed += 1
            return ""
        return m.group(0)

    s = img_local.sub(drop_if_missing, s)
    open(f, "w", encoding="utf-8").write(s)

for f in files:
    for m in img_local.finditer(open(f, encoding="utf-8").read()):
        refs += 1
        if os.path.exists(os.path.join(PUB, m.group(1).lstrip("/"))):
            ok += 1
        else:
            missing.add(m.group(1))

print(f"files rewritten: {rewritten} | broken refs removed: {removed}")
print(f"local image refs: {refs} | resolve OK: {ok} | still missing: {len(missing)}")
for mm in sorted(missing)[:10]:
    print("  MISSING:", mm)
