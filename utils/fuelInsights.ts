import type { DistanceUnit } from '@/types';
import {
  TREND_SIGNIFICANCE_PERCENT,
  type FuelAnalysis,
  type ObservationTrend,
  type SpendComparison,
} from './fuelAnalytics';
import type { BudgetStatus } from './fuelBudget';
import type { SpendForecast } from './fuelForecast';
import {
  ANOMALY_POSSIBLE_FACTORS,
  MIN_BASELINE_OBSERVATIONS,
  type MileageAnomaly,
} from './mileageAnomaly';
import { MIN_OBSERVATIONS_FOR_OUTLIER_CHECK, OUTLIER_FACTOR } from './personalRecords';
import { formatCurrency, formatMileage, formatPercent } from './format';

/**
 * The insight engine: analysis in, short human sentences out.
 *
 * It is deliberately a plain function over already-computed analysis --
 * no React, no data access, no second opinion on how mileage or monthly
 * spending is calculated. Every sentence it produces is traceable to one
 * threshold below, and nothing is generated from data too thin to support it.
 */

export type InsightId =
  | 'budget-exceeded'
  | 'mileage-below-usual'
  | 'mileage-above-usual'
  | 'budget-near-limit'
  | 'spending-up'
  | 'spending-down'
  | 'forecast-above-usual'
  | 'forecast-below-usual'
  | 'personal-best-mileage'
  | 'mileage-improving'
  | 'mileage-declining'
  | 'cost-per-distance-improved'
  | 'cost-per-distance-increased'
  | 'insufficient-data';

export type InsightCategory =
  | 'efficiency'
  | 'spending'
  | 'budget'
  | 'forecast'
  | 'record'
  | 'data';

export type InsightTone = 'positive' | 'neutral' | 'attention';

/** Semantic icon name; the UI maps these to its own icon set. */
export type InsightIcon =
  | 'trending-up'
  | 'trending-down'
  | 'wallet'
  | 'alert'
  | 'trophy'
  | 'forecast'
  | 'info';

export interface Insight {
  id: InsightId;
  category: InsightCategory;
  tone: InsightTone;
  icon: InsightIcon;
  /** Higher wins when the UI has room for only one or two. */
  priority: number;
  title: string;
  description: string;
  /** Headline figure, already formatted. */
  metric?: string;
  /** Extra context for the roomier surfaces (Stats, the report). */
  footnote?: string;
  /** True when the figure quoted is a projection rather than something that happened. */
  estimated?: boolean;
}

export interface InsightPresentation {
  currencySymbol: string;
  distanceUnit: DistanceUnit;
}

export interface InsightInput {
  analysis: FuelAnalysis;
  budget: BudgetStatus | null;
  forecast: SpendForecast | null;
  anomaly: MileageAnomaly | null;
  presentation: InsightPresentation;
}

/** A month-over-month move smaller than this is noise from fill-up timing, not a spending change. */
export const SPENDING_SIGNIFICANT_PERCENT = 10;

/** How far the projection has to sit from the usual monthly spend to be worth saying. */
export const FORECAST_SIGNIFICANT_PERCENT = 10;

/**
 * Insights that say the same thing in different words are collapsed: the
 * higher-priority one is kept and the others are never built into sentences.
 * Facts beat projections (an actual month-over-month rise outranks a forecast
 * of one), and a budget already blown makes every softer budget line moot.
 */
const SUPPRESSES: Partial<Record<InsightId, InsightId[]>> = {
  'budget-exceeded': ['budget-near-limit', 'forecast-above-usual'],
  'mileage-below-usual': ['mileage-declining'],
  'mileage-above-usual': ['mileage-improving'],
  'personal-best-mileage': ['mileage-above-usual'],
  'spending-up': ['forecast-above-usual'],
  'spending-down': ['forecast-below-usual'],
};

function costPerDistance(value: number, presentation: InsightPresentation): string {
  return `${formatCurrency(value, presentation.currencySymbol)}/${presentation.distanceUnit}`;
}

function budgetInsight(
  budget: BudgetStatus | null,
  monthLabel: string,
  presentation: InsightPresentation
): Insight[] {
  if (!budget) return [];
  const spent = formatCurrency(budget.spent, presentation.currencySymbol);
  const amount = formatCurrency(budget.amount, presentation.currencySymbol);

  if (budget.level === 'exceeded') {
    return [
      {
        id: 'budget-exceeded',
        category: 'budget',
        tone: 'attention',
        icon: 'wallet',
        priority: 100,
        title: 'Over your monthly budget',
        description: `You have spent ${spent} of your ${amount} budget for ${monthLabel}, which is ${formatCurrency(budget.overBy, presentation.currencySymbol)} over.`,
        metric: formatPercent(budget.percentUsed),
      },
    ];
  }

  if (budget.level === 'high' || budget.level === 'approaching') {
    return [
      {
        id: 'budget-near-limit',
        category: 'budget',
        tone: budget.level === 'high' ? 'attention' : 'neutral',
        icon: 'wallet',
        priority: budget.level === 'high' ? 80 : 75,
        title: `${formatPercent(budget.percentUsed)} of your budget used`,
        description: `${spent} of ${amount} for ${monthLabel}, with ${formatCurrency(budget.remaining, presentation.currencySymbol)} left.`,
        metric: formatPercent(budget.percentUsed),
      },
    ];
  }

  return [];
}

function anomalyInsight(
  anomaly: MileageAnomaly | null,
  presentation: InsightPresentation
): Insight[] {
  if (!anomaly) return [];
  const latest = formatMileage(anomaly.latest, presentation.distanceUnit);
  const baseline = formatMileage(anomaly.baseline, presentation.distanceUnit);
  const percent = formatPercent(anomaly.percent);

  if (anomaly.direction === 'below') {
    return [
      {
        id: 'mileage-below-usual',
        category: 'efficiency',
        tone: 'attention',
        icon: 'trending-down',
        priority: 90,
        title: 'Mileage below your usual range',
        description: `Your latest full tank came out at ${latest}, about ${percent} below your recent average of ${baseline}.`,
        metric: latest,
        footnote: ANOMALY_POSSIBLE_FACTORS,
      },
    ];
  }

  return [
    {
      id: 'mileage-above-usual',
      category: 'efficiency',
      tone: 'positive',
      icon: 'trending-up',
      priority: 30,
      title: 'Mileage above your usual range',
      description: `Your latest full tank came out at ${latest}, about ${percent} above your recent average of ${baseline}.`,
      metric: latest,
    },
  ];
}

function spendingInsight(
  comparison: SpendComparison | null,
  presentation: InsightPresentation
): Insight[] {
  if (!comparison || comparison.direction === 'flat') return [];
  if (comparison.percent < SPENDING_SIGNIFICANT_PERCENT) return [];

  const current = formatCurrency(comparison.current, presentation.currencySymbol);
  const previous = formatCurrency(comparison.previous, presentation.currencySymbol);
  const percent = formatPercent(comparison.percent);
  // The comparison is like-for-like: month-to-date against the same days of
  // the previous month. The wording has to say so, or "12% more than last
  // month" reads as a claim about two whole months.
  const against =
    comparison.basis === 'month-to-date'
      ? `by this point in ${comparison.previousLabel}`
      : `in ${comparison.previousLabel}`;

  if (comparison.direction === 'up') {
    return [
      {
        id: 'spending-up',
        category: 'spending',
        tone: 'neutral',
        icon: 'trending-up',
        priority: 72,
        title: `Fuel spending is up ${percent}`,
        description: `${current} so far against ${previous} ${against}.`,
        metric: current,
      },
    ];
  }

  return [
    {
      id: 'spending-down',
      category: 'spending',
      tone: 'positive',
      icon: 'trending-down',
      priority: 40,
      title: `Fuel spending is down ${percent}`,
      description: `${current} so far against ${previous} ${against}.`,
      metric: current,
    },
  ];
}

function forecastInsight(
  analysis: FuelAnalysis,
  forecast: SpendForecast | null,
  presentation: InsightPresentation
): Insight[] {
  const usual = analysis.rollingMonthlySpend;
  if (!forecast || !usual || usual.value <= 0) return [];

  const differencePercent = ((forecast.projected - usual.value) / usual.value) * 100;
  if (Math.abs(differencePercent) < FORECAST_SIGNIFICANT_PERCENT) return [];

  const projected = formatCurrency(forecast.projected, presentation.currencySymbol);
  const average = formatCurrency(usual.value, presentation.currencySymbol);
  const footnote = `Estimated from this month’s pace and your last ${usual.monthsCounted} months.`;

  if (differencePercent > 0) {
    return [
      {
        id: 'forecast-above-usual',
        category: 'forecast',
        tone: 'neutral',
        icon: 'forecast',
        priority: 70,
        title: 'Trending above your usual month',
        description: `At this pace the month looks like about ${projected}, against your usual ${average}.`,
        metric: projected,
        footnote,
        estimated: true,
      },
    ];
  }

  return [
    {
      id: 'forecast-below-usual',
      category: 'forecast',
      tone: 'positive',
      icon: 'forecast',
      priority: 35,
      title: 'Trending below your usual month',
      description: `At this pace the month looks like about ${projected}, against your usual ${average}.`,
      metric: projected,
      footnote,
      estimated: true,
    },
  ];
}

/**
 * A personal best only counts once there is a history to beat, and never on a
 * value flagged as an outlier -- congratulating someone on a mistyped
 * odometer reading is worse than saying nothing.
 */
function personalBestInsight(
  analysis: FuelAnalysis,
  presentation: InsightPresentation
): Insight[] {
  const { observations, latestObservation, bestMileage } = analysis;
  if (!latestObservation || bestMileage === null) return [];
  if (observations.length < MIN_OBSERVATIONS_FOR_OUTLIER_CHECK) return [];
  if (latestObservation.mileage < bestMileage) return [];

  const others = observations.slice(0, -1).map((observation) => observation.mileage);
  const previousBest = Math.max(...others);
  if (latestObservation.mileage <= previousBest) return [];
  if (latestObservation.mileage > OUTLIER_FACTOR * previousBest) return [];

  return [
    {
      id: 'personal-best-mileage',
      category: 'record',
      tone: 'positive',
      icon: 'trophy',
      priority: 55,
      title: 'New personal best',
      description: `${formatMileage(latestObservation.mileage, presentation.distanceUnit)} on your latest full tank, past your previous best of ${formatMileage(previousBest, presentation.distanceUnit)}.`,
      metric: formatMileage(latestObservation.mileage, presentation.distanceUnit),
    },
  ];
}

function mileageTrendInsight(
  trend: ObservationTrend | null,
  presentation: InsightPresentation
): Insight[] {
  if (!trend || trend.direction === 'flat') return [];
  if (trend.percent < TREND_SIGNIFICANCE_PERCENT) return [];

  const recent = formatMileage(trend.recent, presentation.distanceUnit);
  const baseline = formatMileage(trend.baseline, presentation.distanceUnit);
  const percent = formatPercent(trend.percent);
  const description = `Your last ${trend.recentCount} full tanks averaged ${recent}, against ${baseline} before that.`;

  if (trend.direction === 'up') {
    return [
      {
        id: 'mileage-improving',
        category: 'efficiency',
        tone: 'positive',
        icon: 'trending-up',
        priority: 50,
        title: `Mileage is up ${percent}`,
        description,
        metric: recent,
      },
    ];
  }

  return [
    {
      id: 'mileage-declining',
      category: 'efficiency',
      tone: 'neutral',
      icon: 'trending-down',
      priority: 45,
      title: `Mileage is down ${percent}`,
      description,
      metric: recent,
    },
  ];
}

function costTrendInsight(
  trend: ObservationTrend | null,
  presentation: InsightPresentation
): Insight[] {
  if (!trend || trend.direction === 'flat') return [];
  if (trend.percent < TREND_SIGNIFICANCE_PERCENT) return [];

  const recent = costPerDistance(trend.recent, presentation);
  const baseline = costPerDistance(trend.baseline, presentation);
  const percent = formatPercent(trend.percent);

  if (trend.direction === 'down') {
    return [
      {
        id: 'cost-per-distance-improved',
        category: 'spending',
        tone: 'positive',
        icon: 'trending-down',
        priority: 34,
        title: `Costing ${percent} less to drive`,
        description: `Recently ${recent}, against ${baseline} before. Fuel prices move this as much as driving does.`,
        metric: recent,
      },
    ];
  }

  return [
    {
      id: 'cost-per-distance-increased',
      category: 'spending',
      tone: 'neutral',
      icon: 'trending-up',
      priority: 32,
      title: `Costing ${percent} more to drive`,
      description: `Recently ${recent}, against ${baseline} before. Fuel prices move this as much as driving does.`,
      metric: recent,
    },
  ];
}

/**
 * What to say when nothing can honestly be said yet: the next thing to log,
 * not a fabricated observation.
 */
export function buildInsufficientDataInsight(analysis: FuelAnalysis): Insight {
  const { entryCount, fullTankCount, observations } = analysis;

  let description: string;
  if (entryCount === 0) {
    description = 'Log your first fill-up and Tankful will start tracking what it costs to run this vehicle.';
  } else if (observations.length === 0) {
    description =
      fullTankCount >= 1
        ? 'Mileage needs two full-tank fill-ups in a row. Log your next one as a full tank to get the first reading.'
        : 'Mark your fill-ups as full tanks when you fill all the way up — that is what makes mileage measurable.';
  } else if (observations.length <= MIN_BASELINE_OBSERVATIONS) {
    description = `A few more full-tank fill-ups (${observations.length} so far) and Tankful can tell a real change from normal variation.`;
  } else {
    description = 'Nothing stands out in your fuel data this month, which is usually good news.';
  }

  return {
    id: 'insufficient-data',
    category: 'data',
    tone: 'neutral',
    icon: 'info',
    priority: 0,
    title: entryCount === 0 ? 'Nothing logged yet' : 'Still building a picture',
    description,
  };
}

export interface GenerateInsightsOptions {
  /** How many to return, highest priority first. Home shows 1, Stats shows 3. */
  limit?: number;
  /**
   * Whether to fall back to the "what to log next" insight when nothing else
   * qualifies. Home wants that guidance; a compact strip may not.
   */
  includeFallback?: boolean;
}

/**
 * Candidate insights, ranked, de-duplicated and trimmed. Ordering is by
 * priority alone, so the same data always produces the same headline.
 */
export function generateInsights(
  input: InsightInput,
  options: GenerateInsightsOptions = {}
): Insight[] {
  const { analysis, budget, forecast, anomaly, presentation } = input;
  const { limit = 3, includeFallback = true } = options;

  const candidates: Insight[] = [
    ...budgetInsight(budget, analysis.currentMonth.label, presentation),
    ...anomalyInsight(anomaly, presentation),
    ...spendingInsight(analysis.spendComparison, presentation),
    ...forecastInsight(analysis, forecast, presentation),
    ...personalBestInsight(analysis, presentation),
    ...mileageTrendInsight(analysis.mileageTrend, presentation),
    ...costTrendInsight(analysis.costPerDistanceTrend, presentation),
  ].sort((a, b) => b.priority - a.priority);

  const selected: Insight[] = [];
  const suppressed = new Set<InsightId>();

  for (const insight of candidates) {
    if (selected.length >= limit) break;
    if (suppressed.has(insight.id)) continue;
    selected.push(insight);
    SUPPRESSES[insight.id]?.forEach((id) => suppressed.add(id));
  }

  if (selected.length === 0 && includeFallback) {
    return [buildInsufficientDataInsight(analysis)];
  }

  return selected;
}

/**
 * Why mileage can't be shown yet, phrased as the next thing to do. Null once
 * at least one full-tank pair exists. The three cases are genuinely different
 * problems, and telling someone to "mark fill-ups as full tanks" when they
 * already do is worse than saying nothing.
 */
export function describeMileageAvailability(analysis: FuelAnalysis): string | null {
  if (analysis.observations.length > 0) return null;
  if (analysis.fullTankCount === 0) {
    return 'Mark a fill-up as a full tank when you fill all the way up — that is what makes mileage measurable.';
  }
  if (analysis.fullTankCount === 1) {
    return 'One full tank logged so far. The next one, logged as a full tank too, gives you a first reading.';
  }
  return 'Your full tanks have partial fills between them, so no pair lines up yet. Two full tanks in a row will produce a reading.';
}

// --- Chart alternatives ------------------------------------------------------
// A chart that only exists as a picture is unreadable to a screen reader, so
// each one ships with the same information as a sentence. These live with the
// other user-facing sentences rather than in the chart components.

/** Spoken equivalent of the mileage-over-time chart. */
export function describeMileageSeries(
  analysis: FuelAnalysis,
  presentation: InsightPresentation
): string {
  const { observations, averageMileage, bestMileage, worstMileage, mileageTrend } = analysis;
  if (observations.length === 0) {
    return 'No mileage readings yet. Two full-tank fill-ups in a row produce the first one.';
  }

  const unit = presentation.distanceUnit;
  const parts = [
    `${observations.length} mileage ${observations.length === 1 ? 'reading' : 'readings'}, latest ${formatMileage(observations[observations.length - 1].mileage, unit)}.`,
  ];
  if (averageMileage !== null) parts.push(`Average ${formatMileage(averageMileage, unit)}.`);
  if (bestMileage !== null && worstMileage !== null && observations.length > 1) {
    parts.push(
      `Ranging from ${formatMileage(worstMileage, unit)} to ${formatMileage(bestMileage, unit)}.`
    );
  }
  if (mileageTrend && mileageTrend.direction !== 'flat') {
    parts.push(
      `The last ${mileageTrend.recentCount} readings average ${formatMileage(mileageTrend.recent, unit)}, ${mileageTrend.direction === 'up' ? 'up from' : 'down from'} ${formatMileage(mileageTrend.baseline, unit)} before.`
    );
  }
  return parts.join(' ');
}

/** Spoken equivalent of the monthly spending chart. */
export function describeSpendSeries(
  points: { label: string; total: number; isCurrent: boolean }[],
  presentation: InsightPresentation
): string {
  if (points.length === 0) return 'No monthly spending to show yet.';
  const spoken = points
    .map(
      (point) =>
        `${point.label} ${formatCurrency(point.total, presentation.currencySymbol)}${point.isCurrent ? ' so far' : ''}`
    )
    .join(', ');
  return `Fuel spending by month: ${spoken}.`;
}
