import { describe, expect, it } from 'vitest';
import type { Level, SourceMap } from './directory.ts';
import { sourceClass, sourceStrip } from './source.ts';

const m = (level: Level) => ({ level, label: '', note: null });
const map = (app: Level | null, server: Level | null, extras: Level | null, parts: Level | null): SourceMap => ({
  app: app === null ? null : m(app),
  server: server === null ? null : m(server),
  extras: extras === null ? null : m(extras),
  parts: parts === null ? null : m(parts),
});

describe('sourceClass', () => {
  it.each([
    ['foss', map(2, 2, null, null)],
    // Open code that needs a paid key is still open code.
    ['foss', map(2, 2, 1, 2)],
    ['open-core', map(2, 2, 0, 2)],
    ['source-available', map(1, 1, 0, 1)],
    ['mixed-source', map(2, 1, 1, 2)],
    ['mixed-source', map(2, 0, 0, 2)],
    ['closed-core', map(0, 0, null, 2)],
    // API tooling or dormant parts do not make a closed product open in part.
    ['closed', map(0, 0, null, 1)],
    ['closed', map(0, 0, null, 0)],
    // A product with no server is judged on its app alone.
    ['closed', map(0, null, null, 1)],
    ['foss', map(2, null, null, null)],
  ] as const)('%s', (expected, source) => {
    expect(sourceClass(source)).toBe(expected);
  });

  it('refuses a map with neither an app nor a server', () => {
    expect(() => sourceClass(map(null, null, null, 2))).toThrow();
  });

  it('open core and closed core are mirror images', () => {
    expect(sourceStrip(map(2, 2, 0, null))).toBe('●●○·');
    expect(sourceStrip(map(0, 0, null, 2))).toBe('○○·●');
  });
});
