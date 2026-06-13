#!/usr/bin/env python3
"""One-off importer: WordPress.com JSON backup -> Astro Markdown content.
Re-runnable. Source: ../_wp-backup/*.json  Target: ../src/content/*
"""
import json, re, html, os, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
BK = ROOT / "_wp-backup"
C = ROOT / "src" / "content"

# ---------- helpers ----------
def unescape(s): return html.unescape(s or "").strip()

def html_to_md(h):
    if not h: return ""
    h = re.sub(r"(?is)<!--.*?-->", "", h)
    h = re.sub(r"(?is)<(script|style).*?</\1>", "", h)
    # linked image  <a ...><img ...></a>  -> just the image (drop pointless self-link)
    h = re.sub(r"(?is)<a\b[^>]*>\s*(<img\b[^>]*>)\s*</a>", r"\1", h)
    # empty link pointing at an image file -> image
    h = re.sub(r'(?is)<a\b[^>]*href="([^"]+\.(?:jpe?g|png|gif)[^"]*)"[^>]*>\s*</a>', r'<img src="\1">', h)
    h = re.sub(r"(?is)<blockquote[^>]*>(.*?)</blockquote>",
               lambda m: "\n" + "\n".join("> " + l for l in
               re.sub(r"<[^>]+>", "", m.group(1)).strip().splitlines()) + "\n", h)
    h = re.sub(r"(?is)<(strong|b)>(.*?)</\1>", r"**\2**", h)
    h = re.sub(r"(?is)<(em|i)>(.*?)</\1>", r"*\2*", h)
    h = re.sub(r'(?is)<a [^>]*href="([^"]+)"[^>]*>(.*?)</a>', r"[\2](\1)", h)
    h = re.sub(r'(?is)<img [^>]*?src="([^"]+)"[^>]*?>',
               lambda m: f"\n![]({m.group(1)})\n", h)
    h = re.sub(r"(?i)<h[1-6][^>]*>", "\n## ", h)
    h = re.sub(r"(?i)</h[1-6]>", "\n\n", h)
    h = re.sub(r"(?i)<li[^>]*>", "- ", h)
    h = re.sub(r"(?i)</li>", "\n", h)
    h = re.sub(r"(?i)<br\s*/?>", "  \n", h)
    h = re.sub(r"(?i)</p>", "\n\n", h)
    h = re.sub(r"(?i)<p[^>]*>", "", h)
    h = re.sub(r"(?i)<hr\s*/?>", "\n---\n", h)
    h = re.sub(r"<[^>]+>", "", h)
    h = html.unescape(h)
    h = h.replace(" ", " ")
    h = re.sub(r"[ \t]+\n", lambda m: "  \n" if m.group(0).startswith("  ") else "\n", h)
    h = re.sub(r"\n{3,}", "\n\n", h)
    return h.strip()

def excerpt(md, n=160):
    t = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", md)        # images
    t = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", t)     # links -> link text
    t = re.sub(r"https?://\S+", "", t)                  # bare URLs
    t = re.sub(r"/wp-content/\S+", "", t)               # local media paths
    t = re.sub(r"[#>*`\[\]()!]", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    return (t[:n].rstrip() + "…") if len(t) > n else t

def yaml_str(s):
    return '"' + (s or "").replace("\\", "\\\\").replace('"', '\\"') + '"'

def write(path, fm, body):
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = ["---"]
    for k, v in fm.items():
        if v is None: continue
        if isinstance(v, list):
            lines.append(f"{k}:")
            for it in v: lines.append(f"  - {yaml_str(it)}")
        elif isinstance(v, (int, float)) and not isinstance(v, bool):
            lines.append(f"{k}: {v}")
        elif isinstance(v, bool):
            lines.append(f"{k}: {'true' if v else 'false'}")
        else:
            lines.append(f"{k}: {yaml_str(str(v))}")
    lines.append("---\n")
    path.write_text("\n".join(lines) + body + "\n", encoding="utf-8")

# ---------- categories map ----------
cats = {c["id"]: c["name"] for c in json.load(open(BK / "categories.json"))}

def rubrik_for(names):
    j = " ".join(names)
    if "번역비평" in j or "논고" in j: return "Translation Criticism"
    if "시" in j: return "Poetry (Translation)"
    if "번역" in j: return "Translation"
    if "비트겐슈타인" in j or "니체" in j: return "Philosophy"
    if "Essays" in j or "Kunst" in j: return "Essay"
    return "Note"

# ---------- texte (47 posts) ----------
posts = json.load(open(BK / "posts-full.json"))
n_t = 0
for p in posts:
    title = unescape(p["title"]["rendered"]) or "(ohne Titel)"
    date = p["date"][:10]
    body = html_to_md(p["content"]["rendered"])
    if not body.strip(): continue
    names = [cats.get(cid, "") for cid in p.get("categories", [])]
    names = [n for n in names if n and n != "Uncategorized"]
    fm = {
        "title": title,
        "pubDate": date,
        "rubrik": rubrik_for(names),
        "tags": names or None,
        "description": excerpt(body),
    }
    write(C / "texte" / f"{date}-{p['id']}.md", fm, body)
    n_t += 1

# ---------- uebersetzungen (books) ----------
books = [
    dict(slug="luhmann-reden-und-schweigen", title="Reden und Schweigen",
         autor="Niklas Luhmann", jahr=2013, verlag="Moonji",
         description="Übersetzung des Luhmann-Textes, erschienen in der Zeitschrift „Literature and Society“ (Moonji).",
         body="Niklas Luhmann, *Reden und Schweigen* — koreanische Übersetzung, erschienen in *Literature and Society* (Moonji), 2013."),
    dict(slug="faraday-maxwell", title="Faraday, Maxwell and the Electromagnetic Field",
         autor="Nancy Forbes / Basil Mahon", jahr=2015, verlag="Banni",
         description="Mein allererstes Buchprojekt — aus dem Englischen, gemeinsam mit meinem Vater, Prof. Chan Park (Physik, Chonbuk-Universität).",
         body="Das populärwissenschaftliche, doch teilweise sehr anspruchsvolle Buch war mein allererstes Buchprojekt. Es wurde in Zusammenarbeit mit meinem Vater, Prof. Chan Park, der an der Chonbuk-Universität Physik lehrt, aus dem Englischen übersetzt."),
    dict(slug="wittgenstein-kriegstagebuecher", title="Kriegstagebücher",
         autor="Ludwig Wittgenstein", jahr=2015, verlag="Itta",
         description="Weltweit die erste unzensierte Gesamtdarstellung von Wittgensteins Aufzeichnungen aus dem Ersten Weltkrieg (MS 101–103).",
         body="Das Buch ist eine Zusammenstellung von MS 101, MS 102 und MS 103. Es ist somit weltweit die erste unzensierte Gesamtdarstellung von Wittgensteins Aufzeichnungen, die im Ersten Weltkrieg entstanden sind.\n\nDie Darstellung im Buch folgt der physischen Gestalt der Manuskripte: Auf Versoseiten sind „private“, auf Rectoseiten „philosophische“ Bemerkungen abgedruckt."),
    dict(slug="nietzsche-geburt-der-tragoedie", title="Die Geburt der Tragödie",
         autor="Friedrich Nietzsche", jahr=2017, verlag="Itta",
         description="Die siebte koreanische Übersetzung von Nietzsches Tragödienbuch — in zweijähriger gemeinsamer Arbeit mit Chulgon Kim.",
         body="Diese Arbeit mit Herrn Chulgon Kim stellt schon die siebte Übersetzung von Nietzsches Tragödienbuch auf Koreanisch dar. Gleichwohl kann behauptet werden, dass uns durch zweijährige, intensivste Besprechung der gemeinsamen Übersetzung eine poetische Sprache auf Koreanisch gelungen ist, die Nietzsches Wort einfängt.\n\n*In Bearbeitung befindet sich „Götzendämmerung“, ebenfalls in Kooperation mit Herrn Chulgon Kim.*"),
    dict(slug="novalis-hymnen-an-die-nacht", title="Hymnen an die Nacht und philosophische Fragmente",
         autor="Novalis", jahr=2018, verlag="Itta",
         description="Novalis — in Korea nur als Verfasser der „Blauen Blume“ bekannt — erstmals als Dichterphilosoph vorgestellt.",
         body="Novalis, in Korea nur bekannt als Verfasser der „Blauen Blume“ (so der koreanische Titel des *Heinrich von Ofterdingen*), wird in diesem Buch erstmals als Dichterphilosoph dargestellt.\n\nDie philosophischen Fragmente, darunter „Blüthenstaub“, „Glauben und Liebe“ sowie eine Auswahl aus dem Nachlass („logologische Fragmente“, „Poeticismen“ usw.), werden zum ersten Mal dem koreanischen Publikum bekannt gemacht."),
    dict(slug="trakl-das-dichterische-werk", title="Das dichterische Werk",
         autor="Georg Trakl", jahr=2019, verlag="Itta", status="Im Druck",
         description="Übersetzung von Trakls dichterischem Werk.",
         body="In dieser Übersetzung sind die Gedichte Georg Trakls versammelt."),
]
for b in books:
    body = b.pop("body")
    slug = b.pop("slug")
    write(C / "books" / f"{slug}.md", b, body)

print(f"texte: {n_t} files, uebersetzungen: {len(books)} files")
