import { expect, test, type Page } from '@playwright/test';

/**
 * Parity with the static site: the same text, the same order, the same
 * filter results, for the same URL. Needs the static site served:
 *   STATIC_URL=http://127.0.0.1:8080
 */
const STATIC = process.env.STATIC_URL;
test.skip(!STATIC, 'STATIC_URL not set: no static site to compare against');

const VIEWS = [
  '',
  '?sort=name-asc',
  '?sort=avg-desc',
  '?sort=year-asc',
  '?sort=integrations-desc',
  '?f=tt,gantt',
  '?f=calendar&lic=foss',
  '?q=kanban',
  '?q=zzzz-nothing',
  '?f=tt,agile,gantt,calendar&lic=source-available',
  '?q=board&sort=use-desc',
];
const COMMERCIAL_VIEWS = [
  '',
  '?sort=price-asc',
  '?sort=price-desc',
  '?sort=value-desc',
  '?sort=control-asc',
  '?f=free,gantt',
  '?lic=personal,software',
  '?q=atlassian',
  '?f=tt,sync&lic=enterprise',
  '?f=free&lic=enterprise',
];

async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  // The static script applies the view on DOMContentLoaded; React after hydration.
  await page.waitForTimeout(150);
}

/** What a reader sees: visible text per region, whitespace folded. */
async function snapshot(page: Page) {
  return page.evaluate(() => {
    const fold = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
    const visible = (el: Element) => (el as HTMLElement).offsetParent !== null || el.getClientRects().length > 0;
    const text = (sel: string) => fold((document.querySelector(sel) as HTMLElement | null)?.innerText);
    // The sort field: a native <select> lists every option in its text, Base UI's
    // Select shows the chosen one. Compare the chosen label, then the rest without it.
    const sortEl = document.querySelector('#sort-field');
    const sortLabel =
      sortEl instanceof HTMLSelectElement ? fold(sortEl.selectedOptions[0]?.textContent) : fold(sortEl?.textContent);
    const controlsEl = document.querySelector('.controls')!.cloneNode(true) as HTMLElement;
    controlsEl.querySelector('#sort-field')?.closest('.select-wrap')?.remove();
    document.body.appendChild(controlsEl);
    const controls = fold(controlsEl.innerText);
    controlsEl.remove();
    const rows = [...document.querySelectorAll('tr.matrix-row')].filter(visible).map((r) => r.getAttribute('data-slug'));
    const rowText = [...document.querySelectorAll('tr.matrix-row')]
      .filter(visible)
      .map((r) => fold((r as HTMLElement).innerText));
    // Screen-reader text the matrix carries per row (score), and the sort state.
    const sr = [...document.querySelectorAll('tr.matrix-row')]
      .filter(visible)
      .map((r) => fold(r.querySelector('[data-score-sr]')?.textContent));
    const ariaSort = [...document.querySelectorAll('thead th')].map((th) => th.getAttribute('aria-sort'));
    return {
      header: text('.site-header'),
      hero: text('.hero'),
      sortLabel,
      controls,
      head: [...document.querySelectorAll('table.matrix thead th')].map((th) => fold(th.textContent)).join(' | '),
      rows,
      rowText,
      sr,
      ariaSort,
      count: text('#result-count'),
      sortDir: document.querySelector('#sort-dir')?.getAttribute('aria-label'),
      empty: visible(document.querySelector('#empty')!) ? text('#empty') : '(hidden)',
      updated: text('.matrix-updated'),
      foot: text('.matrix-foot'),
      routes: text('#start'),
      method: text('#method'),
      faqQuestions: [...document.querySelectorAll('.acc-q')].map((q) => fold(q.textContent)),
      faqAnswers: [...document.querySelectorAll('.acc-a')].map((a) => fold(a.textContent)),
      contribute: text('#contribute'),
      crosslink: text('.crosslink'),
      footer: text('.site-footer'),
    };
  });
}

for (const [path, views] of [
  ['/', VIEWS],
  ['/commercial-task-managers/', COMMERCIAL_VIEWS],
] as const) {
  for (const view of views) {
    test(`text and order match the static site: ${path}${view || ' (default)'}`, async ({ page, baseURL }) => {
      await page.goto(`${STATIC}${path}${view}`);
      await settle(page);
      const want = await snapshot(page);
      await page.goto(`${baseURL}${path}${view}`);
      await settle(page);
      const got = await snapshot(page);
      for (const key of Object.keys(want) as (keyof typeof want)[]) {
        expect.soft(got[key], key).toEqual(want[key]);
      }
    });
  }
}

/** Every record's expanded detail: the same text as the static page's. */
for (const path of ['/', '/commercial-task-managers/']) {
  test(`every record's detail matches: ${path}`, async ({ page, baseURL }) => {
    const read = async (url: string) => {
      await page.goto(url);
      await settle(page);
      return page.evaluate(() =>
        Object.fromEntries(
          [...document.querySelectorAll('tr.detail-row')].map((row) => [
            row.id,
            {
              // textContent: details are collapsed, and hidden text is still the record.
              // Every text-bearing element's own text, in order: exact, and blind to the
              // source formatting between block elements.
              text: [...(row.querySelector('.detail')?.querySelectorAll('*') ?? [])]
                .filter((el) => !el.closest('.detail-foot, svg'))
                .flatMap((el) =>
                  [...el.childNodes]
                    .filter((n) => n.nodeType === Node.TEXT_NODE)
                    .map((n) => n.textContent!.replace(/\s+/g, ' ').trim())
                    .filter(Boolean)
                    .join(' ') || [],
                )
                // Screen-reader capability lines: one consistent full stop after the level.
                .map((t) => t.replace(/: (Native|Partial|Not native)(?!\.)/g, ': $1.')),
              links: [...row.querySelectorAll('.detail a')].map((a) => `${a.getAttribute('href')} ${a.textContent}`),
            },
          ]),
        ),
      );
    };
    const want = await read(`${STATIC}${path}`);
    const got = await read(`${baseURL}${path}`);
    expect(Object.keys(got).sort()).toEqual(Object.keys(want).sort());
    for (const id of Object.keys(want)) expect.soft(got[id], id).toEqual(want[id]);
  });
}
