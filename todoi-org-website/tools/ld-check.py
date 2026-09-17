# -*- coding: utf-8 -*-
"""Assert the JSON-LD graph agrees with the page it sits in."""
import html as _h, json, re, sys
import os
import csv
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
p = os.path.join(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))), "index.html")
s = open(p, encoding="utf-8").read()
blob = re.search(r'<script type="application/ld\+json">(.*?)</script>', s, re.S).group(1)
d = json.loads(blob)
G = d["@graph"]
ids = {n["@id"] for n in G if "@id" in n}
bad = []

def walk(o, path=""):
    if isinstance(o, dict):
        if set(o) == {"@id"} and o["@id"].startswith("https://todoi.org/#") and o["@id"] not in ids:
            bad.append(f"dangling @id ref {o['@id']} at {path}")
        for k, v in o.items(): walk(v, f"{path}.{k}")
    elif isinstance(o, list):
        for i, v in enumerate(o): walk(v, f"{path}[{i}]")
    elif isinstance(o, str):
        if "&#" in o or "&amp;" in o or "<" in o:
            bad.append(f"unescaped markup in string at {path}: {o[:60]!r}")
        if o.strip() != o or "  " in o:
            bad.append(f"stray whitespace at {path}: {o[:60]!r}")
    elif o is None:
        bad.append(f"null value at {path}")
walk(G)

# every required node type present exactly once
want = ["Organization","WebSite","WebPage","BreadcrumbList","FAQPage","Dataset","ItemList"]
for t in want:
    n = sum(1 for x in G if x["@type"] == t)
    if n != 1: bad.append(f"{t}: {n} nodes (want 1)")
apps = [x for x in G if x["@type"] == "SoftwareApplication"]
if len(apps) != 25: bad.append(f"SoftwareApplication: {len(apps)}")

# each app must match its matrix row
rows = dict((dict(re.findall(r'data-([a-z]+)="([^"]*)"', a))["slug"],
             (dict(re.findall(r'data-([a-z]+)="([^"]*)"', a)), b))
            for a, b in re.findall(r'<tr class="matrix-row"([^>]*)>(.*?)</tr>', s, re.S))
KEY = {"Ease of deployment":"deploy","Ease of use":"use","Enterprise features":"enterprise",
       "Interface flexibility":"flex","Data sovereignty":"sovereignty","Portability":"portability"}
for a in apps:
    slug = a["@id"].split("#")[1]
    if slug not in rows: bad.append(f"no row for {slug}"); continue
    dd, body = rows[slug]
    link = re.search(r'<a class="project-name" href="([^"]+)"[^>]*>(.*?)</a>', body, re.S)
    if a["url"] != link.group(1): bad.append(f"{slug}: url {a['url']} != {link.group(1)}")
    if a["name"] != _h.unescape(re.sub(r"<[^>]+>", "", link.group(2)).strip()):
        bad.append(f"{slug}: name mismatch")
    if a["review"]["reviewRating"]["ratingValue"] != float(dd["avg"]):
        bad.append(f"{slug}: rating != data-avg")
    for pv in a["additionalProperty"]:
        if pv["name"] in KEY and pv["value"] != float(dd[KEY[pv["name"]]]):
            bad.append(f"{slug}: {pv['name']} {pv['value']} != {dd[KEY[pv['name']]]}")
    blurb = _h.unescape(re.search(r'<span class="project-blurb">(.*?)</span>', body, re.S).group(1))
    if a["description"] != blurb.strip(): bad.append(f"{slug}: description != blurb")

# the contact address must be the one the page offers
mail = re.search(r'href="mailto:([^"?]+)', s).group(1)
org = [x for x in G if x["@type"] == "Organization"][0]
if org.get("email") != mail: bad.append(f"Organization email {org.get('email')!r} != page {mail!r}")
if org.get("contactPoint", {}).get("email") != mail: bad.append("contactPoint email mismatch")

# FAQ must match the page verbatim
faq = [x for x in G if x["@type"] == "FAQPage"][0]["mainEntity"]
onpage = re.findall(r'<summary class="acc-q">(.*?)</summary>', s, re.S)
if len(faq) != len(onpage): bad.append("FAQ count mismatch")
for q, raw in zip(faq, onpage):
    if q["name"] != _h.unescape(re.sub(r"<[^>]+>", "", raw)).strip():
        bad.append(f"FAQ question mismatch: {q['name'][:40]!r}")

def text(raw):
    return _h.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", raw))).strip()

answers = re.findall(r'<div class="acc-a">(.*?)</div>', s, re.S)
if [q["acceptedAnswer"]["text"] for q in faq] != [text(a) for a in answers]:
    bad.append("FAQ answer mismatch")

root = Path(p).parent
dataset = next(n for n in G if n["@type"] == "Dataset")
csv_path = root / dataset["distribution"][0]["contentUrl"].removeprefix("https://todoi.org/")
with csv_path.open(encoding="utf-8", newline="") as fh:
    reader = csv.DictReader(fh)
    records = list(reader)
    if len(reader.fieldnames) != 38: bad.append("CSV column count must be 38")
expected = sorted(rows, key=lambda slug: (-int(rows[slug][0]["community"]), rows[slug][0]["name"]))
if list(rows) != expected: bad.append("HTML rows do not match default community sort")
if [r["Name"] for r in records] != [a["name"] for a in apps]:
    bad.append("CSV project count/order differs from JSON-LD")
for record, app in zip(records, apps):
    if record["License"] != app["license"]: bad.append(f'{app["name"]}: CSV licence mismatch')

cards = re.findall(r'<article class="card"([^>]*)>(.*?)</article>', s, re.S)
if len(cards) != len(rows): bad.append("Card count mismatch")
for attr, body in cards:
    attrs = dict(re.findall(r'data-([a-z]+)="([^"]*)"', attr))
    if attrs != rows.get(attrs["slug"], ({}, ""))[0]:
        bad.append(f'{attrs["slug"]}: desktop/mobile data mismatch')

class AssetCheck(HTMLParser):
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key not in ("href", "src") or not value or value.startswith(("#", "http:", "https:", "mailto:", "data:")):
                continue
            path = root / value.lstrip("/").split("?")[0].split("#")[0]
            if path.is_dir(): path = path / "index.html"
            if not path.is_file(): bad.append(f"Missing local asset: {value}")

for filename in ("index.html", "404.html"):
    AssetCheck().feed((root / filename).read_text(encoding="utf-8"))
error_page = (root / "404.html").read_text(encoding="utf-8")
if '<meta name="robots" content="noindex">' not in error_page:
    bad.append("404 page must be noindex")
sitemap = ET.parse(root / "sitemap.xml")
ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
if [n.text for n in sitemap.findall("s:url/s:loc", ns)] != ["https://todoi.org/"]:
    bad.append("Sitemap must contain only the directory")
modified = re.search(r'<p class="hero-meta">.*?<time datetime="([^"]+)"', s).group(1)
if sitemap.find("s:url/s:lastmod", ns).text != modified:
    bad.append("Sitemap date differs from visible update date")
overview = (root / "llms.txt").read_text(encoding="utf-8").split("## Projects assessed\n", 1)[1].split("## Notes for citation", 1)[0]
if re.findall(r'^- \[([^\]]+)\]', overview, re.M) != [a["name"] for a in apps]:
    bad.append("llms.txt project list differs from JSON-LD")

print("nodes:", len(G), "| apps:", len(apps), "| faq:", len(faq), "| ld bytes:", len(blob))
print("PROBLEMS:", bad if bad else "none")
sys.exit(1 if bad else 0)
