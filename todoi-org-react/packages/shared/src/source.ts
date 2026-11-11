import { SOURCE_LAYERS, type Level, type SourceMap } from './directory.ts';

/**
 * A record's class is computed from its source map, never stored, so a label
 * cannot outlive the facts under it. Two questions, in order:
 *
 *   1. The product's own code, the app and its server: open, readable under
 *      restrictions, closed, or split between those?
 *   2. What sits around it: closed extras on an open product, or open parts
 *      around a closed one?
 *
 * Open core and closed core are mirror images: an open base with closed
 * extras, and a closed base with open parts.
 */
export const SOURCE_CLASSES = ['foss', 'open-core', 'source-available', 'mixed-source', 'closed-core', 'closed'] as const;
export type SourceClass = (typeof SOURCE_CLASSES)[number];

export function sourceClass(map: SourceMap): SourceClass {
  const core = [map.app, map.server].flatMap((m) => (m ? [m.level] : []));
  if (core.length === 0) throw new RangeError('a source map needs an app or a server');
  if (core.every((l) => l === 2)) return map.extras?.level === 0 ? 'open-core' : 'foss';
  if (core.every((l) => l === 1)) return 'source-available';
  if (core.every((l) => l === 0)) return map.parts?.level === 2 ? 'closed-core' : 'closed';
  return 'mixed-source';
}

/** A layer's state in words, as a screen reader and the dataset say it. A missing layer is "None". */
export const SOURCE_WORDS: Record<Level, string> = { 0: 'Closed', 1: 'Partly open', 2: 'Open' };
export const SOURCE_ABSENT = 'None';

export function sourceWord(mark: { level: Level } | null): string {
  return mark ? SOURCE_WORDS[mark.level] : SOURCE_ABSENT;
}

/** The map as four glyphs, app to parts: "●●○●". For plain-text outputs. */
export function sourceStrip(map: SourceMap): string {
  const glyph = ['○', '◐', '●'] as const;
  return SOURCE_LAYERS.map((k) => (map[k] ? glyph[map[k].level] : '·')).join('');
}
