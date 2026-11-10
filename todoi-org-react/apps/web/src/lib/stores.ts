import { create } from 'zustand';
import { THEME_KEY } from './theme-script.ts';

export type Mode = 'light' | 'dark';

/**
 * Colour mode. The head script has already stamped <html data-theme> before
 * paint; this store mirrors it, follows the system while the visitor has not
 * chosen, and persists a choice under the static site's key.
 */
interface ThemeState {
  mode: Mode;
  /** True until the visitor picks a mode; the system preference decides meanwhile. */
  followsSystem: boolean;
  choose(mode: Mode): void;
  /** Called once on the client to read what the head script decided. */
  sync(): void;
}

function store(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* quota, disabled storage, sandboxed frame */
  }
}

export const useTheme = create<ThemeState>((set) => ({
  mode: 'light',
  followsSystem: true,
  choose(mode) {
    const root = document.documentElement;
    root.removeAttribute('data-theme-source');
    root.setAttribute('data-theme', mode);
    store(THEME_KEY, mode);
    set({ mode, followsSystem: false });
  },
  sync() {
    const root = document.documentElement;
    set({
      mode: root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
      followsSystem: root.getAttribute('data-theme-source') === 'system',
    });
  },
}));

/** Transient board UI: the phone-width filter panel. */
interface BoardUi {
  filtersOpen: boolean;
  toggleFilters(): void;
}

export const useBoardUi = create<BoardUi>((set) => ({
  filtersOpen: false,
  toggleFilters: () => set((s) => ({ filtersOpen: !s.filtersOpen })),
}));
