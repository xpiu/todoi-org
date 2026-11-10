import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False during the server render and the hydration pass, true afterwards.
 * Attributes that only make sense with JavaScript running (hidden on a
 * closed record) are rendered from this, so hydration always matches.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
