import { useMemo } from 'react';
import { useFuelIntelligence, type FuelIntelligence } from '@/hooks/useFuelIntelligence';
import {
  getMonthlySpendSeries,
  type MonthlySpendPoint,
  type ObservationTrend,
} from '@/utils/fuelAnalytics';
import { describeMileageSeries, describeSpendSeries } from '@/utils/fuelInsights';
import { buildMonthlyReport, type MonthlyReport } from '@/utils/monthlyReport';

export interface MileagePoint {
  value: number;
  label: string;
}

export interface VehicleStatsData extends FuelIntelligence {
  /**
   * False when there are fewer than 2 full-tank entries for this vehicle --
   * the long-standing rule for "mileage can be calculated at all". Spending
   * and usage figures do not depend on it and are gated separately.
   */
  hasEnoughData: boolean;
  /** True once anything at all has been logged for the vehicle. */
  hasAnyEntries: boolean;
  bestMileage: number | null;
  worstMileage: number | null;
  averageMileage: number | null;
  latestMileage: number | null;
  mileageTrend: ObservationTrend | null;
  totalLitres: number;
  totalSpend: number;
  totalDistance: number;
  /** All-time spend per unit of distance. Null below 2 entries. */
  costPerDistance: number | null;
  /** Per-fill-up mileage, oldest -> newest, skipping entries with no computable value. */
  mileageSeries: MileagePoint[];
  /** Last 6 calendar months of spend, oldest -> newest, including empty months. */
  monthlySpendSeries: MonthlySpendPoint[];
  /** Spoken equivalents of the two charts, for screen readers. */
  mileageSeriesSummary: string;
  spendSeriesSummary: string;
  report: MonthlyReport;
}

/**
 * The Stats screen's view of the shared fuel intelligence: the same analysis
 * Home reads, shaped into the series and totals this screen renders.
 */
export function useVehicleStats(vehicleId: string | null): VehicleStatsData {
  const intelligence = useFuelIntelligence(vehicleId);
  const { analysis, vehicleBudget, insights, presentation, insightsEnabled } = intelligence;

  return useMemo(() => {
    const mileageSeries = analysis.observations.map((observation) => ({
      value: observation.mileage,
      label: new Date(observation.date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
    }));
    const monthlySpendSeries = getMonthlySpendSeries(analysis);

    return {
      ...intelligence,
      hasEnoughData: analysis.fullTankCount >= 2,
      hasAnyEntries: analysis.entryCount > 0,
      bestMileage: analysis.bestMileage,
      worstMileage: analysis.worstMileage,
      averageMileage: analysis.averageMileage,
      latestMileage: analysis.latestObservation?.mileage ?? null,
      mileageTrend: analysis.mileageTrend,
      totalLitres: analysis.totalLitres,
      totalSpend: analysis.totalSpend,
      totalDistance: analysis.totalDistance,
      costPerDistance: analysis.costPerDistance,
      mileageSeries,
      monthlySpendSeries,
      mileageSeriesSummary: describeMileageSeries(analysis, presentation),
      spendSeriesSummary: describeSpendSeries(monthlySpendSeries, presentation),
      report: buildMonthlyReport(analysis, {
        budget: vehicleBudget,
        insight: insights[0] ?? null,
        includeForecast: insightsEnabled,
      }),
    };
  }, [intelligence, analysis, vehicleBudget, insights, presentation, insightsEnabled]);
}
