import { useEffect } from 'react';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { useTheme, type Mode } from '../lib/stores.ts';
import { MoonIcon, SunIcon } from './icons.tsx';
import { cx } from '../styles/modules.ts';

/**
 * Light and dark, as a two-seat radio group: arrows move the selection, the
 * occupied seat is the single tab stop. The stylesheet draws the seats from
 * <html data-theme>, which the head script set before paint, so the server
 * renders one HTML for everyone and nothing flashes.
 */
export function ThemeSwitch() {
  const { mode, followsSystem, choose, sync } = useTheme();

  useEffect(() => sync(), [sync]);

  // With no saved choice, stay in step with the operating system.
  useEffect(() => {
    if (!followsSystem) return;
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia('(prefers-color-scheme: dark)');
    } catch {
      return;
    }
    const follow = (e: MediaQueryListEvent) => {
      if (document.documentElement.getAttribute('data-theme-source') !== 'system') return;
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      sync();
    };
    mq.addEventListener('change', follow);
    return () => mq.removeEventListener('change', follow);
  }, [followsSystem, sync]);

  return (
    <RadioGroup
      className={cx('theme-switch')}
      id="theme-switch"
      aria-label="Colour theme"
      value={mode}
      onValueChange={(value) => choose(value as Mode)}
    >
      <span className={cx('theme-switch-thumb')} aria-hidden="true" />
      <Radio.Root
        value="light"
        className={cx('theme-switch-opt')}
        data-theme-value="light"
        title="Light"
        nativeButton
        render={<button type="button" />}
      >
        <SunIcon />
        <span className={cx('sr-only')}>Light</span>
      </Radio.Root>
      <Radio.Root
        value="dark"
        className={cx('theme-switch-opt')}
        data-theme-value="dark"
        title="Dark"
        nativeButton
        render={<button type="button" />}
      >
        <MoonIcon />
        <span className={cx('sr-only')}>Dark</span>
      </Radio.Root>
    </RadioGroup>
  );
}
