import { useSyncExternalStore } from 'react';
import { getState, subscribe, type StoreState } from '@/store/dataStore';

/**
 * Subscribes to a slice of the module store. The selector must return a
 * reference that only changes when the slice does (the store replaces slices
 * immutably, so picking one out of the state is enough).
 */
export function useDataStore<T>(selector: (state: StoreState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(getState()));
}
