import { useFuelEntries } from '@/hooks/useFuelEntries';
import {
  calculateAverageMileage,
  calculateMileageForEntry,
  calculateMileageTrend,
  calculateMonthlySpend,
  calculateSpendTrend,
  type MileageTrend,
  type SpendTrend,
} from '@/utils/mileage';
import type { FuelEntry } from '@/types';

export interface VehicleDashboardData {
  loading: boolean;
  /** Set when the entries read failed; render an error state, not the empty state. */
  error: Error | null;
  retry: () => Promise<void>;
  /** All entries for the vehicle, newest first. */
  entries: FuelEntry[];
  /** Most recent calculable per-fill-up mileage (not the average). */
  currentMileage: number | null;
  averageMileage: number | null;
  monthlySpend: number;
  /** This month's spend vs. last month's. Null if either month has no entries. */
  spendTrend: SpendTrend | null;
  /** This month's average mileage vs. last month's. Null if either month has no calculable mileage. */
  mileageTrend: MileageTrend | null;
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
 * Derives the stats the Home dashboard needs from the shared store's entries
 * for the vehicle, which the store keeps fresh after logging a fill-up or
 * adding a vehicle in a modal. `vehicleId` of null yields empty data.
 */
export function useVehicleDashboard(
  vehicleId: string | null
): VehicleDashboardData {
  const { loading, error, retry, entries } = useFuelEntries(vehicleId);

  const entriesOldestFirst = [...entries].reverse();
  const now = new Date();

  return {
    loading,
    error,
    retry,
    entries,
    currentMileage: getMostRecentMileage(entriesOldestFirst),
    averageMileage: calculateAverageMileage(entriesOldestFirst),
    monthlySpend: calculateMonthlySpend(entries, now.getMonth(), now.getFullYear()),
    spendTrend: calculateSpendTrend(entries, now),
    mileageTrend: calculateMileageTrend(entries, now),
    lastEntry: entries[0] ?? null,
    recentEntries: entries.slice(0, 3),
  };
}
