import { useMemo } from 'react';
import { useFuelEntries } from '@/hooks/useFuelEntries';
import {
  calculateBestMileage,
  calculateMonthlySpendSeries,
  calculateTotalLitres,
  calculateTotalSpend,
  calculateWorstMileage,
  type MonthlySpend,
} from '@/utils/mileage';

export interface MileagePoint {
  value: number;
  label: string;
}

export interface VehicleStatsData {
  loading: boolean;
  /** False when there are fewer than 2 full-tank entries for this vehicle. */
  hasEnoughData: boolean;
  bestMileage: number | null;
  worstMileage: number | null;
  totalLitres: number;
  totalSpend: number;
  /** Per-fill-up mileage, oldest -> newest, skipping entries with no computable value. */
  mileageSeries: MileagePoint[];
  /** Last 6 calendar months of spend, oldest -> newest, including ₹0 months. */
  monthlySpendSeries: MonthlySpend[];
}

/**
 * Derives the Stats screen's data from the same entries + mileageById that
 * useFuelEntries already computes for History, rather than walking the
 * entries a third way.
 */
export function useVehicleStats(vehicleId: string | null): VehicleStatsData {
  const { loading, entries, mileageById } = useFuelEntries(vehicleId);

  return useMemo(() => {
    const fullTankCount = entries.filter((entry) => entry.isTankFull).length;
    const hasEnoughData = fullTankCount >= 2;

    const oldestFirst = [...entries].reverse();
    const mileageValues: number[] = [];
    const mileageSeries: MileagePoint[] = [];

    oldestFirst.forEach((entry) => {
      const mileage = mileageById.get(entry.id) ?? null;
      if (mileage !== null) {
        mileageValues.push(mileage);
        mileageSeries.push({
          value: mileage,
          label: new Date(entry.date).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          }),
        });
      }
    });

    return {
      loading,
      hasEnoughData,
      bestMileage: calculateBestMileage(mileageValues),
      worstMileage: calculateWorstMileage(mileageValues),
      totalLitres: calculateTotalLitres(entries),
      totalSpend: calculateTotalSpend(entries),
      mileageSeries,
      monthlySpendSeries: calculateMonthlySpendSeries(entries, new Date()),
    };
  }, [loading, entries, mileageById]);
}
