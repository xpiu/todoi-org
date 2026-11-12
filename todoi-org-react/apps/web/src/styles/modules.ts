/**
 * The component stylesheets, in the cascade order the original single sheet
 * had them: global.css (fonts, tokens, reset, base) loads before this file and
 * late.css (buttons, utilities, print) after it. Each component's rules live
 * in its own CSS Module next to it.
 *
 * Every element keeps its hook class (`matrix-row`), which tests, scripts and
 * other modules' :global() selectors name, and gains its module class beside
 * it: cx('matrix-row') → 'matrix-row Matrix_matrix-row' in development, a
 * short hash in production.
 */
// One file holds the whole order, so the bundler keeps it in one stylesheet.
import './global.css';
import chrome from '../components/SiteChrome.module.css';
import hero from '../features/directory/Hero.module.css';
import controls from '../features/directory/Controls.module.css';
import matrix from '../features/directory/Matrix.module.css';
import cells from '../features/directory/cells.module.css';
import tip from '../features/directory/tip.module.css';
import detail from '../features/directory/RecordDetail.module.css';
import cards from '../features/directory/Cards.module.css';
import board from '../features/directory/Board.module.css';
import fieldMap from '../features/directory/FieldMap.module.css';
import sections from '../features/directory/Sections.module.css';
import './late.css';

const scoped: Readonly<Record<string, string>> = {
  ...chrome,
  ...hero,
  ...controls,
  ...matrix,
  ...cells,
  ...tip,
  ...detail,
  ...cards,
  ...board,
  ...fieldMap,
  ...sections,
};

/** Each hook class, followed by its module class when a module styles it. */
export function cx(...names: (string | false | null | undefined)[]): string {
  const out: string[] = [];
  for (const group of names) {
    if (!group) continue;
    for (const name of group.split(/\s+/)) {
      if (!name) continue;
      out.push(name);
      const local = scoped[name];
      if (local) out.push(local);
    }
  }
  return out.join(' ');
}
