import { useMemo } from 'react';
import { useFuelEntries } from '@/hooks/useFuelEntries';
import { useSettings } from '@/hooks/useSettings';
import type { FuelEntry, VehicleBudget } from '@/types';
import {
  analyzeFuelData,
  getFuelAnalysis,
  localDayKey,
  type FuelAnalysis,
} from '@/utils/fuelAnalytics';
import { calculateBudgetStatus, type BudgetStatus } from '@/utils/fuelBudget';
import { forecastMonthSpend, type SpendForecast } from '@/utils/fuelForecast';
import { generateInsights, type Insight, type InsightPresentation } from '@/utils/fuelInsights';
import { detectMileageAnomaly, type MileageAnomaly } from '@/utils/mileageAnomaly';
import { buildPersonalRecords, type PersonalRecord } from '@/utils/personalRecords';
import { getVehicleBudget } from '@/utils/settingsSchema';

/**
 * One analysis per vehicle, shared by every surface that needs it.
 *
 * Home, Stats and the monthly report all read the same entries array out of
 * the data store, and utils/fuelAnalytics caches its analysis against that
 * array, so opening all three does the work once. Everything derived from it
 * (budget, forecast, anomaly, records, insights) is computed here rather than
 * in the screens.
 *
 * Vehicle isolation: every figure comes from `entries`, which the store keys
 * by vehicle id, and the derivation is synchronous -- there is no in-flight
 * calculation that could land on the wrong vehicle after a switch.
 */
export interface FuelIntelligence {
  loading: boolean;
  /** The entries read failed; screens show an error state rather than an empty one. */
  error: Error | null;
  /** A refetch failed; `entries` and everything derived from them are the last good read. */
  refreshError: Error | null;
  retry: () => Promise<void>;
  /** Newest first, as the store holds them. */
  entries: FuelEntry[];
  mileageById: Map<string, number | null>;
  analysis: FuelAnalysis;
  /**
   * Set when deriving the intelligence failed. Core tracking keeps working;
   * the screens replace the affected sections with a recoverable notice.
   */
  intelligenceError: Error | null;
  budget: BudgetStatus | null;
  /** The raw configuration behind `budget`, for screens that edit it. */
  vehicleBudget: VehicleBudget | null;
  forecast: SpendForecast | null;
  anomaly: MileageAnomaly | null;
  records: PersonalRecord[];
  insights: Insight[];
  /** Mirrors the Settings toggle; false means the derived surfaces stay hidden. */
  insightsEnabled: boolean;
  presentation: InsightPresentation;
}

interface DerivedIntelligence {
  analysis: FuelAnalysis;
  intelligenceError: Error | null;
  budget: BudgetStatus | null;
  forecast: SpendForecast | null;
  anomaly: MileageAnomaly | null;
  records: PersonalRecord[];
  insights: Insight[];
}

export function useFuelIntelligence(vehicleId: string | null): FuelIntelligence {
  const { loading, error, refreshError, retry, entries, mileageById } = useFuelEntries(vehicleId);
  const { currencySymbol, distanceUnit, vehicleBudgets, insightsEnabled } = useSettings();

  const vehicleBudget = useMemo(
    () => getVehicleBudget(vehicleBudgets, vehicleId),
    [vehicleBudgets, vehicleId]
  );

  const presentation = useMemo<InsightPresentation>(
    () => ({ currencySymbol, distanceUnit }),
    [currencySymbol, distanceUnit]
  );

  // Recomputed when the day rolls over, so a screen left open past midnight
  // moves its month windows on at the next render instead of going stale.
  const dayKey = localDayKey(new Date());

  const derived = useMemo<DerivedIntelligence>(() => {
    // Two layers of failure, handled separately on purpose. If the interpretive
    // layer (insights, forecast, anomaly, records) throws, the measured figures
    // are still sound and stay on screen. Only a failure in the analysis itself
    // -- which would make every number suspect -- blanks the lot, and the
    // screens then say so rather than presenting zeros as facts.
    let analysis: FuelAnalysis;
    let budget: BudgetStatus | null;
    try {
      analysis = getFuelAnalysis(entries);
      budget = calculateBudgetStatus(analysis.currentMonth.spend, vehicleBudget);
    } catch (cause) {
      console.error('Failed to analyse fuel data', cause);
      return {
        analysis: analyzeFuelData([]),
        intelligenceError: cause instanceof Error ? cause : new Error(String(cause)),
        budget: null,
        forecast: null,
        anomaly: null,
        records: [],
        insights: [],
      };
    }

    const withoutExtras: DerivedIntelligence = {
      analysis,
      intelligenceError: null,
      budget,
      forecast: null,
      anomaly: null,
      records: [],
      insights: [],
    };

    // The user has switched the derived surfaces off. The budget they
    // explicitly configured is not one of them, so it stays.
    if (!insightsEnabled) return withoutExtras;

    try {
      const forecast = forecastMonthSpend(analysis);
      const anomaly = detectMileageAnomaly(analysis);
      return {
        ...withoutExtras,
        forecast,
        anomaly,
        records: buildPersonalRecords(analysis),
        insights: generateInsights({ analysis, budget, forecast, anomaly, presentation }),
      };
    } catch (cause) {
      console.error('Failed to derive fuel insights', cause);
      return {
        ...withoutExtras,
        intelligenceError: cause instanceof Error ? cause : new Error(String(cause)),
      };
    }
    // `dayKey` is intentionally a dependency: it is what makes the windows
    // roll over at midnight.
  }, [entries, vehicleBudget, insightsEnabled, presentation, dayKey]);

  // A stable object identity: the screen-level hooks (useVehicleDashboard,
  // useVehicleStats) memoise their own shaping against it, which only works
  // if this doesn't change on every render.
  return useMemo(
    () => ({
      loading,
      error,
      refreshError,
      retry,
      entries,
      mileageById,
      vehicleBudget,
      insightsEnabled,
      presentation,
      ...derived,
    }),
    [
      loading,
      error,
      refreshError,
      retry,
      entries,
      mileageById,
      vehicleBudget,
      insightsEnabled,
      presentation,
      derived,
    ]
  );
}
