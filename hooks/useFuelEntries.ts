import { useCallback, useEffect, useMemo } from 'react';
import { useDataStore } from '@/hooks/useDataStore';
import {
  IDLE_RESOURCE,
  removeEntry as removeStoreEntry,
  retainEntries,
  retryEntries,
} from '@/store/dataStore';
import { calculateMileageForEntry } from '@/utils/mileage';
import type { FuelEntry } from '@/types';

const NO_ENTRIES: FuelEntry[] = [];

export interface FuelEntriesData {
  loading: boolean;
  /** Set when the read failed with nothing loaded; render an error state, not the empty state. */
  error: Error | null;
  /** Set when a refetch failed over loaded entries; `entries` still holds the last good read. */
  refreshError: Error | null;
  /** Newest first, matching getFuelEntriesByVehicle. */
  entries: FuelEntry[];
  /** Per-entry mileage (or null), keyed by entry id. */
  mileageById: Map<string, number | null>;
  retry: () => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
}

/**
 * A vehicle's fuel entries from the shared store, plus each entry's own
 * mileage against its immediately preceding fill-up.
 * calculateMileageForEntry expects oldest->newest order, so entries are
 * reversed once and walked in a single pass to build an id->mileage map,
 * rather than re-sorting per row.
 */
export function useFuelEntries(vehicleId: string | null): FuelEntriesData {
  useEffect(() => (vehicleId ? retainEntries(vehicleId) : undefined), [vehicleId]);
  const resource = useDataStore((s) =>
    vehicleId ? (s.entries[vehicleId] ?? IDLE_RESOURCE) : IDLE_RESOURCE
  );

  const entries = resource.data ?? NO_ENTRIES;

  const mileageById = useMemo(() => {
    const oldestFirst = [...entries].reverse();
    const map = new Map<string, number | null>();
    oldestFirst.forEach((entry, i) => {
      map.set(entry.id, calculateMileageForEntry(oldestFirst, i));
    });
    return map;
  }, [entries]);

  const retry = useCallback(async () => {
    if (vehicleId) await retryEntries(vehicleId);
  }, [vehicleId]);

  const removeEntry = useCallback(
    async (id: string) => {
      if (vehicleId) await removeStoreEntry(vehicleId, id);
    },
    [vehicleId]
  );

  return {
    // With no vehicle there is nothing to load.
    loading: vehicleId !== null && (resource.status === 'idle' || resource.status === 'loading'),
    error: resource.status === 'error' ? resource.error : null,
    refreshError: resource.status === 'ready' ? resource.error : null,
    entries,
    mileageById,
    retry,
    removeEntry,
  };
}
