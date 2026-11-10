import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * One theme in two modes: every colour resolves through tokens, and dark
 * redefines the same names. Fails if dark leaves a colour undefined, if the
 * two dark blocks (system preference, explicit choice) disagree, or if a text
 * pair the page relies on drops below WCAG AA.
 */
const css = readFileSync(fileURLToPath(new URL('./global.css', import.meta.url)), 'utf8');

function block(start: RegExp): Map<string, string> {
  const m = start.exec(css);
  if (!m) throw new Error(`no block ${start}`);
  let depth = 0;
  let i = css.indexOf('{', m.index);
  const from = i + 1;
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) break;
  }
  const body = css.slice(from, i).replace(/\/\*[\s\S]*?\*\//g, '');
  return new Map([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((x) => [x[1]!, x[2]!.replace(/\s+/g, ' ').trim()]));
}

const light = block(/^:root \{/m);
const darkSystem = block(/:root:not\(\[data-theme='light'\]\) \{/);
const darkChosen = block(/^:root\[data-theme='dark'\] \{/m);

const isColour = (v: string) => /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\(|color-mix\()/i.test(v);

function resolve(tokens: Map<string, string>, name: string, depth = 0): string {
  const v = tokens.get(name) ?? light.get(name);
  if (!v) throw new Error(`undefined token ${name}`);
  const ref = /^var\((--[\w-]+)\)$/.exec(v);
  return ref && depth < 10 ? resolve(tokens, ref[1]!, depth + 1) : v;
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

describe('colour tokens', () => {
  it('dark redefines every colour light defines', () => {
    const colours = [...light].filter(([, v]) => isColour(v)).map(([k]) => k);
    expect(colours.length).toBeGreaterThan(20);
    const missing = colours.filter((k) => !darkChosen.has(k));
    expect(missing).toEqual([]);
  });

  it('the two dark blocks agree', () => {
    expect(Object.fromEntries(darkSystem)).toEqual(Object.fromEntries(darkChosen));
  });

  it('dark introduces no name light does not define', () => {
    expect([...darkChosen.keys()].filter((k) => !light.has(k))).toEqual([]);
  });

  const TEXT_PAIRS: [string, string][] = [
    ['--ink', '--paper'],
    ['--ink-2', '--paper'],
    ['--ink-faint', '--paper'],
    ['--ink', '--paper-raised'],
    ['--ink-2', '--paper-raised'],
    ['--ink-faint', '--paper-raised'],
    ['--ink-2', '--paper-sunken'],
    ['--ink-faint', '--paper-sunken'],
    ['--accent', '--paper'],
    ['--accent', '--paper-raised'],
    ['--on-accent', '--accent'],
    ['--accent-strong', '--accent-soft'],
  ];
  for (const [mode, tokens] of [
    ['light', light],
    ['dark', darkChosen],
  ] as const) {
    it.each(TEXT_PAIRS)(`${mode}: %s on %s reaches 4.5:1`, (fg, bg) => {
      const ratio = contrast(resolve(tokens, fg), resolve(tokens, bg));
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  }
});
