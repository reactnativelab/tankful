import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { deleteFuelEntry, getFuelEntriesByVehicle } from '@/db/fuelEntries';
import { calculateMileageForEntry } from '@/utils/mileage';
import type { FuelEntry } from '@/types';

export interface FuelEntriesData {
  loading: boolean;
  /** Newest first, matching getFuelEntriesByVehicle. */
  entries: FuelEntry[];
  /** Per-entry mileage (or null), keyed by entry id. */
  mileageById: Map<string, number | null>;
  refresh: () => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
}

/**
 * Fetches a vehicle's fuel entries for the History list and derives each
 * entry's own mileage against its immediately preceding fill-up.
 * calculateMileageForEntry expects oldest->newest order, so entries are
 * reversed once and walked in a single pass to build an id->mileage map,
 * rather than re-sorting per row.
 */
export function useFuelEntries(vehicleId: string | null): FuelEntriesData {
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!vehicleId) {
      setEntries([]);
      return;
    }
    const data = await getFuelEntriesByVehicle(vehicleId);
    setEntries(data);
  }, [vehicleId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      refresh().finally(() => setLoading(false));
    }, [refresh])
  );

  const mileageById = useMemo(() => {
    const oldestFirst = [...entries].reverse();
    const map = new Map<string, number | null>();
    oldestFirst.forEach((entry, i) => {
      map.set(entry.id, calculateMileageForEntry(oldestFirst, i));
    });
    return map;
  }, [entries]);

  const removeEntry = useCallback(async (id: string) => {
    await deleteFuelEntry(id);
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  return { loading, entries, mileageById, refresh, removeEntry };
}
