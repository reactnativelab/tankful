import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getFuelEntriesByVehicle } from '@/db/fuelEntries';
import {
  calculateAverageMileage,
  calculateMileageForEntry,
  calculateMonthlySpend,
  calculateSpendTrend,
  type SpendTrend,
} from '@/utils/mileage';
import type { FuelEntry } from '@/types';

export interface VehicleDashboardData {
  loading: boolean;
  /** All entries for the vehicle, newest first. */
  entries: FuelEntry[];
  /** Most recent calculable per-fill-up mileage (not the average). */
  currentMileage: number | null;
  averageMileage: number | null;
  monthlySpend: number;
  /** This month's spend vs. last month's. Null if either month has no entries. */
  spendTrend: SpendTrend | null;
  /** Same row as entries[0]; kept named for clarity at call sites. */
  lastEntry: FuelEntry | null;
  /** Newest-first, capped at 3, for the dashboard preview list. */
  recentEntries: FuelEntry[];
}

/** Scans newest -> oldest for the most recent computable mileage value. */
function getMostRecentMileage(entriesOldestFirst: FuelEntry[]): number | null {
  for (let i = entriesOldestFirst.length - 1; i >= 1; i--) {
    const mileage = calculateMileageForEntry(entriesOldestFirst, i);
    if (mileage !== null) return mileage;
  }
  return null;
}

/**
 * Fetches a vehicle's fuel entries and derives the stats the Home dashboard
 * needs. Refetches on every focus so it stays fresh after logging a
 * fill-up or adding a vehicle in a modal. `vehicleId` of null yields empty data.
 */
export function useVehicleDashboard(
  vehicleId: string | null
): VehicleDashboardData {
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

  const entriesOldestFirst = [...entries].reverse();
  const now = new Date();

  return {
    loading,
    entries,
    currentMileage: getMostRecentMileage(entriesOldestFirst),
    averageMileage: calculateAverageMileage(entriesOldestFirst),
    monthlySpend: calculateMonthlySpend(entries, now.getMonth(), now.getFullYear()),
    spendTrend: calculateSpendTrend(entries, now),
    lastEntry: entries[0] ?? null,
    recentEntries: entries.slice(0, 3),
  };
}
