/**
 * Inline HTML from the editorial copy: turned into plain text for JSON-LD and
 * llms.txt, and sanitised on every editor write to a short allow-list.
 */
const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  ndash: '–',
  mdash: '—',
  hellip: '…',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/** Paragraphs joined by a space, tags dropped, entities decoded, whitespace folded. */
export function htmlToText(html: string): string {
  return decodeEntities(html.replace(/<\/p>\s*<p[^>]*>/gi, ' ').replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

const ALLOWED = new Set(['p', 'strong', 'em', 'a', 'time', 'br']);
const ALLOWED_ATTRS: Record<string, string[]> = { a: ['href'], time: ['datetime'] };

function escapeText(s: string): string {
  return s.replace(/&(?!(#x[0-9a-f]+|#\d+|[a-z]+);)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return decodeEntities(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Keep <p>, <strong>, <em>, <a href> (http, https and mailto only), <time
 * datetime> and <br>; drop every other tag (its text stays, as text) and every
 * other attribute. Comments and the contents of script and style go entirely.
 */
export function sanitizeInline(html: string): string {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|template|iframe|object)\b[\s\S]*?<\/\1\s*>/gi, '');
  let out = '';
  let last = 0;
  const open: string[] = [];
  const tag = /<\s*(\/?)\s*([a-z][a-z0-9]*)\b([^>]*)>/gi;
  for (let m = tag.exec(cleaned); m; m = tag.exec(cleaned)) {
    out += escapeText(cleaned.slice(last, m.index));
    last = tag.lastIndex;
    const closing = m[1] === '/';
    const name = m[2]!.toLowerCase();
    if (!ALLOWED.has(name)) continue;
    if (closing) {
      const i = open.lastIndexOf(name);
      if (i < 0) continue;
      // Close anything left open inside it, so the output is always well nested.
      while (open.length > i) out += `</${open.pop()}>`;
      continue;
    }
    if (name === 'br') {
      out += '<br>';
      continue;
    }
    let attrs = '';
    for (const a of ALLOWED_ATTRS[name] ?? []) {
      const am = new RegExp(`\\b${a}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(m[3] ?? '');
      const value = am ? (am[2] ?? am[3] ?? am[4] ?? '') : null;
      if (value === null) continue;
      if (a === 'href' && !/^(https?:|mailto:|\/|#)/i.test(decodeEntities(value).trim())) continue;
      attrs += ` ${a}="${escapeAttr(value)}"`;
    }
    out += `<${name}${attrs}>`;
    open.push(name);
  }
  out += escapeText(cleaned.slice(last));
  while (open.length) out += `</${open.pop()}>`;
  return out;
}
