import { useMemo } from 'react';
import { useFuelIntelligence, type FuelIntelligence } from '@/hooks/useFuelIntelligence';
import type { FuelEntry } from '@/types';
import type { SpendComparison } from '@/utils/fuelAnalytics';
import { buildMonthlyReport, type MonthlyReport, type ReportComparison } from '@/utils/monthlyReport';

export interface VehicleDashboardData extends FuelIntelligence {
  /** Most recent calculable per-fill-up mileage (not the average). */
  currentMileage: number | null;
  averageMileage: number | null;
  /** This calendar month to date -- never a rolling 30 days. */
  monthlySpend: number;
  /** Month-to-date spend against the same days of last month. Null if either month has no fill-ups. */
  spendTrend: SpendComparison | null;
  /** This month's average mileage against last month's. Null if either month has none. */
  mileageTrend: ReportComparison | null;
  /** Same row as entries[0]; kept named for clarity at call sites. */
  lastEntry: FuelEntry | null;
  /** Newest-first, capped at 3, for the dashboard preview list. */
  recentEntries: FuelEntry[];
  /** This month's report, the same model the report screen and share text use. */
  report: MonthlyReport;
}

/**
 * Home's view of the shared fuel intelligence. It adds no calculations of its
 * own -- everything here is picked out of the one analysis in
 * useFuelIntelligence, so Home, Stats and the report can never disagree.
 */
export function useVehicleDashboard(vehicleId: string | null): VehicleDashboardData {
  const intelligence = useFuelIntelligence(vehicleId);
  const { analysis, vehicleBudget, insights, entries, insightsEnabled } = intelligence;

  const report = useMemo(
    () =>
      buildMonthlyReport(analysis, {
        budget: vehicleBudget,
        insight: insights[0] ?? null,
        includeForecast: insightsEnabled,
      }),
    [analysis, vehicleBudget, insights, insightsEnabled]
  );

  return {
    ...intelligence,
    currentMileage: analysis.latestObservation?.mileage ?? null,
    averageMileage: analysis.averageMileage,
    monthlySpend: analysis.currentMonth.spend,
    spendTrend: analysis.spendComparison,
    mileageTrend: report.mileageComparison,
    lastEntry: entries[0] ?? null,
    recentEntries: entries.slice(0, 3),
    report,
  };
}
