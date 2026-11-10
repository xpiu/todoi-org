/**
 * The Score is computed, never stored: the unweighted mean of the six criteria
 * and the community (or market) band, read as 1 to 5, rounded half up to one
 * decimal. Every input carries one decimal, so the arithmetic is done in tenths
 * as integers and no float rounding can move a .x5 boundary.
 */
export function tenths(value: number): number {
  return Math.round(value * 10);
}

export function computeScore(criteria: readonly number[], band: number): number {
  const parts = [...criteria.map(tenths), tenths(band)];
  const sum = parts.reduce((a, b) => a + b, 0);
  const n = parts.length;
  // round-half-up of sum / n, in tenths: floor((2 * sum + n) / (2 * n))
  const rounded = Math.floor((2 * sum + n) / (2 * n));
  return rounded / 10;
}

/** One decimal, always: 4 reads "4.0", as every score on the page does. */
export function formatScore(value: number): string {
  return value.toFixed(1);
}

/** The gauge fill for a 1-5 value: 1 is empty, 5 is full, two decimals. */
export function fill(value: number): string {
  return Math.max(0, Math.min(1, (value - 1) / 4)).toFixed(2);
}

/** 27695 → "27.7k", 497 → "497". */
export function formatStars(stars: number): string {
  if (stars < 1000) return String(stars);
  return `${(Math.round(stars / 100) / 10).toFixed(1)}k`;
}

/**
 * Star counts span two orders of magnitude, so equal linear bands would put
 * almost the whole directory in the first colour. These thresholds approximate
 * a logarithmic scale while staying stable as projects are added.
 */
export function starGrade(stars: number): 1 | 2 | 3 | 4 | 5 {
  if (stars < 1000) return 1;
  if (stars < 5000) return 2;
  if (stars < 15000) return 3;
  if (stars < 40000) return 4;
  return 5;
}

/** Band 1-5 as the page names it. */
export const BAND_LABELS = ['Small', 'Medium', 'Medium-large', 'Large', 'Very large'] as const;
export type BandLabel = (typeof BAND_LABELS)[number];

export function bandLabel(band: number): BandLabel {
  const label = BAND_LABELS[band - 1];
  if (!label) throw new RangeError(`band out of range: ${band}`);
  return label;
}

export function bandOf(label: string): number {
  const i = (BAND_LABELS as readonly string[]).indexOf(label);
  if (i < 0) throw new RangeError(`unknown band label: ${label}`);
  return i + 1;
}
