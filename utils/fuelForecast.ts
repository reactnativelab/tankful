import type { FuelAnalysis } from './fuelAnalytics';

/**
 * Month-end spending forecast.
 *
 * The model is deliberately small and explainable, because the user is being
 * shown a number about their own money that hasn't happened yet:
 *
 *   pace        = spend so far this month / fraction of the month elapsed
 *   projection  = p * pace + (1 - p) * usual monthly spend      (p = progress)
 *   projection  = max(projection, spend so far)
 *
 * The weight is the month's own progress, which is what keeps it honest at
 * both ends. On the 3rd, `pace` is one fill-up multiplied by ten and barely
 * counts (p = 0.1); by the 25th it is nearly the whole answer (p = 0.8) and
 * the historical average has faded out. The floor exists because money
 * already spent cannot un-spend itself.
 *
 * With no history to blend, the pace alone is used -- but only after a
 * quarter of the month and two fill-ups, so a single large tank on the 2nd
 * never becomes a headline.
 */

export type ForecastBasis = 'pace-and-history' | 'pace';

export interface SpendForecast {
  /** Projected total for the whole month, including what has already been spent. */
  projected: number;
  /** Spent so far this month -- the actual half of the pair. */
  actual: number;
  /** Fraction of the month elapsed when this was computed, 0-1. */
  monthProgress: number;
  basis: ForecastBasis;
  /** Fill-ups logged this month; the sample the pace half rests on. */
  fillCount: number;
  /**
   * How much weight to give it. 'low' is still worth showing, with the
   * "early estimate" wording the UI uses; anything weaker returns null.
   */
  confidence: 'low' | 'medium' | 'high';
}

/** With history to fall back on, a fill-up and a little of the month is enough. */
export const MIN_PROGRESS_WITH_HISTORY = 0.1;
export const MIN_FILLS_WITH_HISTORY = 1;

/** Without it, the pace is the only evidence, so it needs more of both. */
export const MIN_PROGRESS_WITHOUT_HISTORY = 0.25;
export const MIN_FILLS_WITHOUT_HISTORY = 2;

/** Below this the estimate is labelled as early rather than presented flatly. */
const LOW_CONFIDENCE_PROGRESS = 0.35;
const HIGH_CONFIDENCE_PROGRESS = 0.6;

/**
 * Null whenever the data can't support a projection: no month in progress, no
 * fill-ups yet, or too little of either to say anything the user couldn't say
 * better themselves. Callers show nothing (or an explanatory line) rather
 * than a placeholder number.
 */
export function forecastMonthSpend(analysis: FuelAnalysis): SpendForecast | null {
  const progress = analysis.monthProgress;
  const actual = analysis.currentMonth.spend;
  const fillCount = analysis.currentMonth.fillCount;
  const history = analysis.rollingMonthlySpend;

  if (progress <= 0 || progress >= 1) return null;
  if (!Number.isFinite(actual) || actual < 0) return null;

  const minProgress = history ? MIN_PROGRESS_WITH_HISTORY : MIN_PROGRESS_WITHOUT_HISTORY;
  const minFills = history ? MIN_FILLS_WITH_HISTORY : MIN_FILLS_WITHOUT_HISTORY;
  if (progress < minProgress || fillCount < minFills) return null;

  const pace = actual / progress;
  const projected = history
    ? progress * pace + (1 - progress) * history.value
    : pace;

  if (!Number.isFinite(projected)) return null;

  const confidence: SpendForecast['confidence'] =
    progress >= HIGH_CONFIDENCE_PROGRESS && (history !== null || fillCount >= 3)
      ? 'high'
      : progress >= LOW_CONFIDENCE_PROGRESS
        ? 'medium'
        : 'low';

  return {
    projected: Math.max(projected, actual),
    actual,
    monthProgress: progress,
    basis: history ? 'pace-and-history' : 'pace',
    fillCount,
    confidence,
  };
}

/**
 * Why a forecast isn't available yet, phrased for the user. Returns null when
 * one *is* available (the caller should show the number instead).
 */
export function describeForecastGap(analysis: FuelAnalysis): string | null {
  if (forecastMonthSpend(analysis) !== null) return null;
  if (analysis.monthProgress >= 1) return null;
  if (analysis.currentMonth.fillCount === 0) {
    return 'Log this month’s first fill-up to see a month-end estimate.';
  }
  if (!analysis.rollingMonthlySpend) {
    return 'A month-end estimate needs a couple more fill-ups this month, or a month or two of history.';
  }
  return 'It’s early in the month — an estimate will appear in a few days.';
}
