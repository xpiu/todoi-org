# -*- coding: utf-8 -*-
"""Rebuild the published dataset CSV out of index.html.

The CSV used to be a copy of the research grid, maintained beside the page.
That worked while the page and the grid were the same eleven rows; it stopped
working the moment the page grew. Reading the page instead means the download
can never describe a directory the visitor is not looking at.

Idempotent:

    python3 tools/dataset.py \\
      && python3 tools/seo.py \\
      && python3 tools/ld-check.py
"""
import csv, html as _h, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "index.html")
DATE = "2026-09-17"
OUT = os.path.join(ROOT, "todoi-dataset-%s.csv" % DATE)

page = open(SRC, encoding="utf-8").read()
txt = lambda x: _h.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", x))).strip()

SCORES = [("deploy", "Ease_of_Deployment"), ("use", "Ease_of_Use"),
          ("enterprise", "Enterprise_Features"), ("flex", "Interface_Flexibility"),
          ("sovereignty", "Data_Sovereignty"), ("portability", "Portability")]
FEATS = [("tt", "Time_Tracking"), ("agile", "Agile_Views"), ("gantt", "Gantt_View"),
         ("calendar", "Calendar_View"), ("caldav", "Open_Calendar_Sync")]
MARK = {"2": "NATIVE", "1": "PARTIAL", "0": "NO"}
COMM = {"5": "Very large", "4": "Large", "3": "Medium-large", "2": "Medium", "1": "Small"}
MODEL = {"foss": "FOSS", "open-core": "Open core", "source-available": "Source-available"}

head = ["Name", "Primary_URL", "Repository_URL", "First_Appeared_Year", "Open_Source_Model",
        "License", "Short_Description", "Community_Size_Category", "Community_Proxy_Evidence",
        "GitHub_Stars_%s" % DATE.replace("-", "_"), "GitHub_Stars_Caveat",
        "Estimated_External_Integrations", "Integration_Notes"]
head += [n for _, n in FEATS]
head += ["Deployment", "Calendar_Sync", "Data_Out", "Stack", "Hosted_Option"]
for _, n in SCORES:
    head += [n + "_Score_1_5", n + "_Review"]
head += ["Activity_or_Caveat", "Research_Confidence", "Source_URLs"]

def stars_caveat(body):
    cell = re.search(r'<td class="cell-stars">(.*?)</td>', body, re.S)
    note = re.search(r'class="stars-note[^"]*"[^>]*title="([^"]*)"', cell.group(1)) if cell else None
    return _h.unescape(note.group(1)) if note else ""


rows = re.findall(r'<tr class="matrix-row"([^>]*)>(.*?)</tr>', page, re.S)
assert len(rows) == 25, len(rows)

out = []
for attr, body in rows:
    d = dict(re.findall(r'data-([a-z]+)="([^"]*)"', attr))
    slug = d["slug"]
    link = re.search(r'<a class="project-name" href="([^"]+)"[^>]*>(.*?)</a>', body, re.S)
    det = re.search(rf'<tr class="detail-row" id="detail-{slug}">(.*?)</tr>', page, re.S).group(1)

    def fact(k):
        m = re.search(rf"<dt>{k}</dt><dd>(.*?)</dd>", det, re.S)
        return txt(m.group(1)) if m else ""

    names = ["Ease of deployment", "Ease of use", "Enterprise features",
             "Interface flexibility", "Data sovereignty", "Portability"]
    reviews = dict(zip(names, [txt(t) for t in re.findall(
        r'<dd class="crit-text">(.*?)</dd>', det, re.S)]))

    r = [txt(link.group(2)), link.group(1), fact("Repository"), fact("First appeared"),
         MODEL[d["model"]], fact("Licence"),
         txt(re.search(r'<span class="project-blurb">(.*?)</span>', body, re.S).group(1)),
         COMM[d["community"]], fact("Community signal"),
         d.get("stars", ""), stars_caveat(body),
         txt(re.search(r'<td class="cell-int">(.*?)</td>', body, re.S).group(1)),
         fact("Integrations")]
    r += [MARK[d[k]] for k, _ in FEATS]
    r += [fact("Deployment"), fact("Calendar sync"), fact("Data out"), fact("Stack"),
          fact("Hosted option")]
    for i, (k, _) in enumerate(SCORES):
        r += [d[k], reviews[names[i]]]
    srcs = re.search(r'<ul class="srcs">(.*?)</ul>', det, re.S)
    r += [fact("Caveat"), fact("Confidence"),
          " | ".join(re.findall(r'<li><a href="([^"]+)"', srcs.group(1)) if srcs else [])]
    out.append((int(d["community"]), r))

# Same order the page opens in: community size descending, then name, so the download and
# the table agree on what "first" means.
out.sort(key=lambda t: (-t[0], t[1][0].lower()))
out = [r for _, r in out]
with open(OUT, "w", encoding="utf-8", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(head)
    w.writerows(out)

print("dataset: %d rows x %d columns -> %s" % (len(out), len(head), os.path.basename(OUT)))
