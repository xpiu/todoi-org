# -*- coding: utf-8 -*-
"""Rebuild the JSON-LD graph for todoi.org and swap it into index.html in place.

Everything a reader can see is read back out of index.html rather than
re-declared here: structured data that contradicts the visible page is worse
than none, and the page's prose is edited directly. The project list in llms.txt
and sitemap are refreshed in the same publication pass.

Idempotent: run it again after any copy edit.

    python3 tools/seo.py && python3 tools/ld-check.py
"""
import html as _h, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))          # tools
ROOT = os.path.dirname(HERE)              # site root
OUT  = os.path.join(ROOT, "index.html")
SITE, DATE, CSV = "https://todoi.org/", "2026-09-17", "todoi-dataset-2026-09-17.csv"

page = open(OUT, encoding="utf-8").read()
txt  = lambda x: _h.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", x))).strip()

# The contact address is read off the page's own mailto for the same reason the
# prose is: one place to change it, and no way for the two to disagree.
MAIL = re.search(r'href="mailto:([^"?]+)', page).group(1)

SCORES = [("deploy", "Ease of deployment"), ("use", "Ease of use"),
          ("enterprise", "Enterprise features"), ("flex", "Interface flexibility"),
          ("sovereignty", "Data sovereignty"), ("portability", "Portability")]
FEATS  = [("tt", "Time tracking"), ("agile", "Agile boards"),
          ("gantt", "Gantt or dependency timeline"), ("calendar", "Calendar view"),
          ("caldav", "Open calendar sync (CalDAV)")]
COMM   = {"5": "Very large", "4": "Large", "3": "Medium-large", "2": "Medium"}

rows = re.findall(r'<tr class="matrix-row"([^>]*)>(.*?)</tr>', page, re.S)
assert len(rows) == 25, len(rows)

apps = []
overview = []
for attr, body in rows:
    d    = dict(re.findall(r'data-([a-z]+)="([^"]*)"', attr))
    slug = d["slug"]
    link = re.search(r'<a class="project-name" href="([^"]+)"[^>]*>(.*?)</a>', body, re.S)
    url, name = link.group(1), txt(link.group(2))
    blurb = txt(re.search(r'<span class="project-blurb">(.*?)</span>', body, re.S).group(1))

    det = re.search(rf'<tr class="detail-row" id="detail-{slug}">(.*?)</tr>', page, re.S).group(1)
    def fact(k):
        match = re.search(rf"<dt>{k}</dt><dd>(.*?)</dd>", det, re.S)
        return txt(match.group(1)) if match else None
    repository = re.search(r'<dt>Repository</dt><dd><a href="([^"]+)"', det).group(1)
    model = {"foss": "FOSS", "open-core": "Open core", "source-available": "Source-available"}[d["model"]]
    overview.append(f'- [{name}]({url}): {blurb} {model}, {fact("Licence")}. '
                    f'Score {d["avg"]}/5, confidence {fact("Confidence")}. Source: {repository}')

    native  = [lbl for k, lbl in FEATS if d[k] == "2"]
    partial = [lbl for k, lbl in FEATS if d[k] == "1"]
    props = [{"@type": "PropertyValue", "name": lbl, "value": float(d[k]),
              "minValue": 1, "maxValue": 5} for k, lbl in SCORES]
    props += [
        {"@type": "PropertyValue", "name": "Licensing model", "value": fact("Model")},
        {"@type": "PropertyValue", "name": "Community size proxy", "value": COMM[d["community"]]},
        {"@type": "PropertyValue", "name": "Estimated external integrations",
         "value": txt(re.search(r'<td class="cell-int">(.*?)</td>', body, re.S).group(1))},
    ]
    props += [{"@type": "PropertyValue", "name": k, "value": fact(k)}
              for k in ("Deployment", "Calendar sync", "Data out", "Stack", "Hosted option")]
    if partial:
        props.append({"@type": "PropertyValue",
                      "name": "Partial rather than native",
                      "value": ", ".join(partial)})

    apps.append({
        "@type": "SoftwareApplication",
        "@id": f"{SITE}#{slug}",
        "name": name, "url": url,
        "applicationCategory": "BusinessApplication",
        "applicationSubCategory": "Project and task management",
        "operatingSystem": "Browser interface; see deployment requirements in the project record",
        "description": blurb,
        "license": fact("Licence"),
        "sameAs": [repository],
        "featureList": native,
        "additionalProperty": props,
        "review": {
            "@type": "Review", "author": {"@id": SITE + "#org"}, "datePublished": DATE,
            "reviewRating": {"@type": "Rating", "ratingValue": float(d["avg"]),
                             "bestRating": 5, "worstRating": 1},
            "reviewBody": fact("Caveat"),
            "reviewAspect": "Ease of deployment, ease of use, enterprise features, "
                            "interface flexibility, data sovereignty, portability",
        },
    })

faq = [{"@type": "Question", "name": txt(q),
        "acceptedAnswer": {"@type": "Answer", "text": txt(a)}}
       for q, a in re.findall(
           r'<summary class="acc-q">(.*?)</summary>\s*<div class="acc-a">(.*?)</div>',
           page, re.S)]
assert len(faq) == 8, len(faq)

crit = re.findall(r'<dt class="criterion-name">(.*?)</dt>\s*<dd class="criterion-text">(.*?)</dd>',
                  page, re.S)
assert len(crit) == 6, len(crit)

graph = [
 {"@type": "Organization", "@id": SITE + "#org", "name": "todoi.org", "url": SITE,
  "description": "A volunteer-run directory of open-source and source-available browser-based task and project management software.",
  "foundingDate": DATE, "email": MAIL,
  "contactPoint": {"@type": "ContactPoint", "email": MAIL, "contactType": "Corrections and additions",
                   "availableLanguage": "en"},
  "knowsAbout": ["Self-hosted software", "Open-source licensing", "Project management software",
                 "Task management", "Data sovereignty", "Software portability"]},
 {"@type": "WebSite", "@id": SITE + "#website", "name": "todoi.org", "url": SITE,
  "publisher": {"@id": SITE + "#org"}, "inLanguage": "en",
  "description": "Twenty-five open-source and source-available browser-based task managers, compared across 38 fields."},
 {"@type": "WebPage", "@id": SITE + "#webpage", "url": SITE,
  "name": txt(re.search(r"<title>(.*?)</title>", page, re.S).group(1)),
  "description": _h.unescape(re.search(r'<meta name="description" content="([^"]*)"', page).group(1)),
  "isPartOf": {"@id": SITE + "#website"}, "about": {"@id": SITE + "#dataset"},
  "mainEntity": {"@id": SITE + "#projects"}, "inLanguage": "en",
  "datePublished": DATE, "dateModified": DATE, "lastReviewed": DATE,
  "reviewedBy": {"@id": SITE + "#org"},
  "significantLink": [a["url"] for a in apps],
  "hasPart": [{"@id": SITE + "#faq"}],
  "breadcrumb": {"@id": SITE + "#breadcrumb"}},
 {"@type": "BreadcrumbList", "@id": SITE + "#breadcrumb",
  "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Directory", "item": SITE}]},
 {"@type": "FAQPage", "@id": SITE + "#faq", "name": "Questions",
  "isPartOf": {"@id": SITE + "#webpage"}, "inLanguage": "en", "mainEntity": faq},
 {"@type": "Dataset", "@id": SITE + "#dataset",
  "name": "Open-source and source-available browser-based task managers, 2026",
  "url": SITE,
  "description": "Twenty-five browser-based open-source and source-available task and project management projects, each assessed across 38 fields: licensing model, community proxy, repository stars, estimated integrations, five capability checks, deployment, calendar sync, data-out routes, stack and hosted option, plus six editorial 1-5 criteria, each carrying a written justification and a source list.",
  "creator": {"@id": SITE + "#org"}, "publisher": {"@id": SITE + "#org"},
  "dateCreated": DATE, "datePublished": DATE, "dateModified": DATE,
  "isAccessibleForFree": True, "inLanguage": "en", "temporalCoverage": DATE,
  "measurementTechnique": "Editorial assessment of project documentation, source repositories and release histories against six published criteria.",
  "keywords": ["self-hosted task manager", "open-source project management", "open core",
               "source-available", "data sovereignty", "Kanban", "Gantt", "issue tracker",
               "software comparison"],
  "variableMeasured": [{"@type": "PropertyValue", "name": txt(n), "description": txt(t),
                        "minValue": 1, "maxValue": 5} for n, t in crit]
                    + ["Licensing model", "Community size proxy", "Repository stars",
                       "Estimated integrations",
                       "Time tracking", "Agile views", "Gantt view", "Calendar view",
                       "Open calendar sync", "Deployment", "Data out", "Stack",
                       "Hosted option"],
  "distribution": [{"@type": "DataDownload", "encodingFormat": "text/csv",
                    "contentUrl": SITE + CSV, "name": "todoi.org dataset (CSV)"}],
  "hasPart": [{"@id": SITE + "#projects"}]},
 {"@type": "ItemList", "@id": SITE + "#projects", "name": "Compared projects",
  "description": "All twenty-five projects, in the order the page opens in: by community size, largest first, ties alphabetical. Community size is an editorial proxy, not a deployment count.",
  "numberOfItems": len(apps),
  "itemListOrder": "https://schema.org/ItemListOrderDescending",
  "itemListElement": [{"@type": "ListItem", "position": i + 1, "item": {"@id": a["@id"]}}
                      for i, a in enumerate(apps)]},
] + apps

# One line per node: diff-able and skimmable, without paying eight kilobytes of
# indentation on every page load for a block no reader ever sees.
c = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":"))
blob = '{"@context":"https://schema.org","@graph":[\n' + ",\n".join(c(n) for n in graph) + "\n]}"
json.loads(blob)

pat = re.compile(r'<script type="application/ld\+json">.*?</script>', re.S)
assert len(pat.findall(page)) == 1
new = pat.sub(lambda m: '<script type="application/ld+json">' + blob + "</script>", page, count=1)
if new == page:
    print("skip    json-ld (unchanged)")
else:
    open(OUT, "w", encoding="utf-8").write(new)
    print("applied json-ld")
print("ld bytes:", len(blob), "| nodes:", len(graph), "| page bytes:", len(new))

overview_path = os.path.join(ROOT, "llms.txt")
with open(overview_path, encoding="utf-8") as fh:
    overview_text = fh.read()
project_section = ("## Projects assessed\n\n"
                   "Ordered by community size, largest first, with alphabetical ties, matching the page. "
                   "Scores are unweighted means of six editorial criteria, not an overall recommendation.\n\n"
                   + "\n".join(overview) + "\n\n")
overview_text, replacements = re.subn(r"## Projects assessed\n.*?(?=## Notes for citation)",
                                     lambda m: project_section, overview_text, flags=re.S)
assert replacements == 1
with open(overview_path, "w", encoding="utf-8") as fh:
    fh.write(overview_text)

# The only indexable page is the directory. Keep error pages out of the sitemap.
modified = re.search(r'<p class="hero-meta">.*?<time datetime="([^"]+)"', page).group(1)
with open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8") as fh:
    fh.write('<?xml version="1.0" encoding="UTF-8"?>\n'
             '<!-- Generated by tools/seo.py; lastmod follows the visible page update date. -->\n'
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
             f'  <url>\n    <loc>{SITE}</loc>\n    <lastmod>{modified}</lastmod>\n  </url>\n'
             '</urlset>\n')
print("refreshed llms.txt project list and sitemap.xml")
