import type { FuelEntry } from '@/types';
import {
  calculateAverageMileage,
  calculateBestMileage,
  calculateCostPerDistance,
  calculateDistanceForEntry,
  calculateMileageForEntry,
  calculateTotalLitres,
  calculateTotalSpend,
  calculateTravelledDistance,
  calculateWorstMileage,
  sortEntriesOldestFirst,
} from './mileage';
import {
  addMonths,
  clampDayToMonth,
  compareMonths,
  daysInMonth,
  formatMonthLabel,
  isSameMonth,
  monthKey,
  monthProgress,
  monthRefOf,
  type MonthRef,
} from './period';

/**
 * The analysis model: one pass over a vehicle's fill-ups that produces every
 * derived figure Home, Stats, the monthly report, the forecast, the anomaly
 * check, the records and the insight engine need. Nothing here touches React,
 * SQLite or settings, and no screen recomputes any of it for itself.
 *
 * Scope rule: an analysis always belongs to exactly one vehicle. The caller
 * passes that vehicle's entries and nothing else.
 */

export type TrendDirection = 'up' | 'down' | 'flat';

export interface Trend {
  direction: TrendDirection;
  /** Absolute percentage change; pair it with `direction` for the sign. */
  percent: number;
}

/** A single measured full-tank-to-full-tank result. */
export interface MileageObservation {
  /** The later ("closing") fill-up of the pair -- the one the result is attributed to. */
  entryId: string;
  date: number;
  month: MonthRef;
  mileage: number;
  distance: number;
  litres: number;
  /** What the closing fill-up cost: the fuel that covered `distance`. */
  cost: number;
}

export interface MonthStats {
  ref: MonthRef;
  key: string;
  /** e.g. "September 2026". */
  label: string;
  entries: FuelEntry[];
  spend: number;
  litres: number;
  fillCount: number;
  fullTankCount: number;
  partialCount: number;
  /**
   * Distance recorded in the month: the odometer gaps closed by its fill-ups.
   * Actual data, not an estimate -- but it only covers ground between logged
   * fill-ups, so it understates a month that ends mid-tank.
   */
  distance: number;
  /** Spend on the fill-ups that closed those gaps -- the numerator matching `distance`. */
  pairedSpend: number;
  /** `pairedSpend / distance`. Null until at least one gap has been closed. */
  costPerDistance: number | null;
  observations: MileageObservation[];
  /** Mean of the month's full-tank observations. Null when it has none. */
  averageMileage: number | null;
}

export interface SpendComparison extends Trend {
  /**
   * 'month-to-date' compares the same slice of both months (day 1..N); once
   * the month is over both sides are whole months.
   */
  basis: 'month-to-date' | 'full-month';
  /** Inclusive day-of-month both windows end on. */
  throughDay: number;
  current: number;
  previous: number;
  previousLabel: string;
}

export interface RollingSpendAverage {
  value: number;
  /** How many of the window's months actually had fill-ups logged. */
  monthsCounted: number;
  /** How many calendar months were looked at. */
  windowMonths: number;
}

/** A recent-window vs earlier-window comparison over mileage observations. */
export interface ObservationTrend extends Trend {
  recent: number;
  baseline: number;
  recentCount: number;
  baselineCount: number;
}

export interface FuelAnalysis {
  referenceDate: number;
  /** Chronological, oldest -> newest. The canonical order for every calculation. */
  entriesOldestFirst: FuelEntry[];
  entryCount: number;
  fullTankCount: number;
  observations: MileageObservation[];
  latestObservation: MileageObservation | null;
  averageMileage: number | null;
  bestMileage: number | null;
  worstMileage: number | null;
  totalSpend: number;
  totalLitres: number;
  /** Sum of the odometer gaps between logged fill-ups. */
  totalDistance: number;
  /** All-time money per distance. Null below 2 entries or with no distance. */
  costPerDistance: number | null;
  /** Every month with at least one fill-up, oldest -> newest. */
  months: MonthStats[];
  monthsByKey: Map<string, MonthStats>;
  /** Always present, zero-filled when the month has no fill-ups yet. */
  currentMonth: MonthStats;
  previousMonth: MonthStats;
  /** 0-1 of the reference month elapsed. */
  monthProgress: number;
  spendComparison: SpendComparison | null;
  rollingMonthlySpend: RollingSpendAverage | null;
  mileageTrend: ObservationTrend | null;
  costPerDistanceTrend: ObservationTrend | null;
}

// --- Thresholds --------------------------------------------------------------
// Every number below is a data-sufficiency rule, not a taste call. They are
// exported so the UI can explain them ("add 2 more fill-ups...") instead of
// restating them.

/** Months looked back over for the rolling spend average (the current month is never in it). */
export const ROLLING_SPEND_WINDOW_MONTHS = 6;

/** Fewer than this many months with data in that window and the average would be one month wearing a hat. */
export const MIN_MONTHS_FOR_ROLLING_AVERAGE = 2;

/** Newest observations that form the "recently" side of a trend. */
export const TREND_RECENT_WINDOW = 3;

/** Observations before that window which form the baseline, and the minimum that makes it stable. */
export const TREND_BASELINE_WINDOW = 6;
export const MIN_TREND_BASELINE = 3;

/** A trend below this is ordinary tank-to-tank variation, not a change worth reporting. */
export const TREND_SIGNIFICANCE_PERCENT = 5;

function emptyMonth(ref: MonthRef): MonthStats {
  return {
    ref,
    key: monthKey(ref),
    label: formatMonthLabel(ref),
    entries: [],
    spend: 0,
    litres: 0,
    fillCount: 0,
    fullTankCount: 0,
    partialCount: 0,
    distance: 0,
    pairedSpend: 0,
    costPerDistance: null,
    observations: [],
    averageMileage: null,
  };
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Signed percentage change, or null when `previous` can't carry a ratio. */
export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function directionOf(change: number): TrendDirection {
  if (change > 0) return 'up';
  if (change < 0) return 'down';
  return 'flat';
}

function toTrend(change: number): Trend {
  return { direction: directionOf(change), percent: Math.abs(change) };
}

/** Sum of the entries in `entries` whose day-of-month is at or before `throughDay`. */
function spendThroughDay(entries: FuelEntry[], throughDay: number): number {
  return entries.reduce(
    (sum, entry) =>
      new Date(entry.date).getDate() <= throughDay ? sum + entry.totalCost : sum,
    0
  );
}

/**
 * Month-over-month spending, compared like for like.
 *
 * On the 5th of the month, holding 5 days of spending up against the whole of
 * last month says "you're down 80%" when nothing has changed, so the current
 * month-to-date is compared against the *same day window* of the previous
 * month (day 1 to today). A 31st with no counterpart clamps to the previous
 * month's last day, which makes that side the whole month -- the only honest
 * reading available. Once the reference month is over, both sides are full
 * months and the basis says so.
 *
 * Null when either month has no fill-ups logged at all, or the previous
 * window is 0 (no ratio to quote), matching how the old spend trend behaved.
 */
function buildSpendComparison(
  current: MonthStats,
  previous: MonthStats,
  referenceDate: Date
): SpendComparison | null {
  if (current.fillCount === 0 || previous.fillCount === 0) return null;

  const monthLength = daysInMonth(current.ref);
  const isReferenceMonth = isSameMonth(current.ref, monthRefOf(referenceDate));
  const throughDay = isReferenceMonth ? referenceDate.getDate() : monthLength;

  const currentSpend = throughDay >= monthLength ? current.spend : spendThroughDay(current.entries, throughDay);
  const previousSpend = spendThroughDay(
    previous.entries,
    clampDayToMonth(previous.ref, throughDay)
  );

  const change = percentChange(currentSpend, previousSpend);
  if (change === null) return null;

  return {
    ...toTrend(change),
    basis: throughDay >= monthLength ? 'full-month' : 'month-to-date',
    throughDay,
    current: currentSpend,
    previous: previousSpend,
    previousLabel: previous.label,
  };
}

/**
 * Mean monthly spend over the months *before* the reference month.
 *
 * Only the ROLLING_SPEND_WINDOW_MONTHS calendar months immediately before it
 * are considered, and only those with at least one fill-up are averaged: a
 * month with nothing logged almost always means "didn't log", not "spent
 * nothing", and counting it as a zero would drag the average toward a number
 * the user never experienced. Needs MIN_MONTHS_FOR_ROLLING_AVERAGE of them.
 */
function buildRollingSpendAverage(
  monthsByKey: Map<string, MonthStats>,
  referenceMonth: MonthRef
): RollingSpendAverage | null {
  const totals: number[] = [];
  for (let back = 1; back <= ROLLING_SPEND_WINDOW_MONTHS; back++) {
    const month = monthsByKey.get(monthKey(addMonths(referenceMonth, -back)));
    if (month && month.fillCount > 0) totals.push(month.spend);
  }
  if (totals.length < MIN_MONTHS_FOR_ROLLING_AVERAGE) return null;
  return {
    value: mean(totals),
    monthsCounted: totals.length,
    windowMonths: ROLLING_SPEND_WINDOW_MONTHS,
  };
}

/**
 * "Lately, versus before": the last TREND_RECENT_WINDOW observations against
 * the TREND_BASELINE_WINDOW that preceded them. This is a sustained shift,
 * deliberately not the same question as the anomaly check (which asks whether
 * the single newest result is out of line) -- see utils/mileageAnomaly.
 */
function buildObservationTrend(
  observations: MileageObservation[],
  valueOf: (observation: MileageObservation) => number
): ObservationTrend | null {
  if (observations.length < TREND_RECENT_WINDOW + MIN_TREND_BASELINE) return null;

  const recentValues = observations.slice(-TREND_RECENT_WINDOW).map(valueOf);
  const baselineValues = observations
    .slice(0, -TREND_RECENT_WINDOW)
    .slice(-TREND_BASELINE_WINDOW)
    .map(valueOf);

  if (baselineValues.length < MIN_TREND_BASELINE) return null;

  const recent = mean(recentValues);
  const baseline = mean(baselineValues);
  const change = percentChange(recent, baseline);
  if (change === null) return null;

  return {
    ...toTrend(change),
    recent,
    baseline,
    recentCount: recentValues.length,
    baselineCount: baselineValues.length,
  };
}

export interface FuelAnalysisOptions {
  /** "Now" for every window. Injected by tests and by the report screen. */
  referenceDate?: Date;
}

/**
 * Builds the analysis in a single chronological pass. `entries` may arrive in
 * any order (the store hands them over newest-first) and must all belong to
 * one vehicle.
 */
export function analyzeFuelData(
  entries: FuelEntry[],
  options: FuelAnalysisOptions = {}
): FuelAnalysis {
  const referenceDate = options.referenceDate ?? new Date();
  const entriesOldestFirst = sortEntriesOldestFirst(entries);

  const monthsByKey = new Map<string, MonthStats>();
  const observations: MileageObservation[] = [];

  const monthFor = (timestamp: number): MonthStats => {
    const ref = monthRefOf(timestamp);
    const key = monthKey(ref);
    let month = monthsByKey.get(key);
    if (!month) {
      month = emptyMonth(ref);
      monthsByKey.set(key, month);
    }
    return month;
  };

  entriesOldestFirst.forEach((entry, index) => {
    const month = monthFor(entry.date);
    month.entries.push(entry);
    month.spend += entry.totalCost;
    month.litres += entry.litresFilled;
    month.fillCount += 1;
    if (entry.isTankFull) month.fullTankCount += 1;
    else month.partialCount += 1;

    const distance = calculateDistanceForEntry(entriesOldestFirst, index);
    if (distance !== null) {
      month.distance += distance;
      month.pairedSpend += entry.totalCost;
    }

    const mileage = calculateMileageForEntry(entriesOldestFirst, index);
    if (mileage !== null && distance !== null) {
      const observation: MileageObservation = {
        entryId: entry.id,
        date: entry.date,
        month: month.ref,
        mileage,
        distance,
        litres: entry.litresFilled,
        cost: entry.totalCost,
      };
      observations.push(observation);
      month.observations.push(observation);
    }
  });

  for (const month of monthsByKey.values()) {
    month.costPerDistance = month.distance > 0 ? month.pairedSpend / month.distance : null;
    month.averageMileage =
      month.observations.length > 0
        ? mean(month.observations.map((observation) => observation.mileage))
        : null;
  }

  const months = [...monthsByKey.values()].sort((a, b) => compareMonths(a.ref, b.ref));

  const currentRef = monthRefOf(referenceDate);
  const previousRef = addMonths(currentRef, -1);
  const currentMonth = monthsByKey.get(monthKey(currentRef)) ?? emptyMonth(currentRef);
  const previousMonth = monthsByKey.get(monthKey(previousRef)) ?? emptyMonth(previousRef);

  const mileageValues = observations.map((observation) => observation.mileage);

  return {
    referenceDate: referenceDate.getTime(),
    entriesOldestFirst,
    entryCount: entriesOldestFirst.length,
    fullTankCount: entriesOldestFirst.filter((entry) => entry.isTankFull).length,
    observations,
    latestObservation: observations[observations.length - 1] ?? null,
    averageMileage: calculateAverageMileage(entriesOldestFirst),
    bestMileage: calculateBestMileage(mileageValues),
    worstMileage: calculateWorstMileage(mileageValues),
    totalSpend: calculateTotalSpend(entriesOldestFirst),
    totalLitres: calculateTotalLitres(entriesOldestFirst),
    totalDistance: calculateTravelledDistance(entriesOldestFirst),
    costPerDistance: calculateCostPerDistance(entriesOldestFirst),
    months,
    monthsByKey,
    currentMonth,
    previousMonth,
    monthProgress: monthProgress(currentRef, referenceDate),
    spendComparison: buildSpendComparison(currentMonth, previousMonth, referenceDate),
    rollingMonthlySpend: buildRollingSpendAverage(monthsByKey, currentRef),
    mileageTrend: buildObservationTrend(observations, (observation) => observation.mileage),
    costPerDistanceTrend: buildObservationTrend(observations, (observation) =>
      observation.distance > 0 ? observation.cost / observation.distance : 0
    ),
  };
}

/** The month a report or comparison is being built for, resolved against the analysis. */
export function getMonthStats(analysis: FuelAnalysis, ref: MonthRef): MonthStats {
  return analysis.monthsByKey.get(monthKey(ref)) ?? emptyMonth(ref);
}

/**
 * The same spend comparison the analysis exposes for the current month, for
 * any month -- what a report of an earlier month needs. Months that have
 * already ended compare whole month against whole month.
 */
export function compareMonthSpend(analysis: FuelAnalysis, ref: MonthRef): SpendComparison | null {
  return buildSpendComparison(
    getMonthStats(analysis, ref),
    getMonthStats(analysis, addMonths(ref, -1)),
    new Date(analysis.referenceDate)
  );
}

/** Rolling spend average over the months preceding `ref` (never including it). */
export function getRollingSpendAverage(
  analysis: FuelAnalysis,
  ref: MonthRef
): RollingSpendAverage | null {
  return buildRollingSpendAverage(analysis.monthsByKey, ref);
}

export interface MonthlySpendPoint {
  key: string;
  /** Short axis label, e.g. "Sep". */
  label: string;
  total: number;
  isCurrent: boolean;
}

/**
 * A fixed-length spend series ending at the analysis's reference month,
 * including months with nothing logged (a gap in the bars is information).
 * Derived from the already-bucketed months, so it costs `count` lookups
 * rather than another pass over the history.
 */
export function getMonthlySpendSeries(analysis: FuelAnalysis, count = 6): MonthlySpendPoint[] {
  const currentRef = monthRefOf(analysis.referenceDate);
  const points: MonthlySpendPoint[] = [];
  for (let back = count - 1; back >= 0; back--) {
    const ref = addMonths(currentRef, -back);
    const month = analysis.monthsByKey.get(monthKey(ref));
    points.push({
      key: monthKey(ref),
      label: formatMonthLabel(ref, 'short'),
      total: month?.spend ?? 0,
      isCurrent: back === 0,
    });
  }
  return points;
}

// --- Shared memo -------------------------------------------------------------

interface CachedAnalysis {
  dayKey: string;
  analysis: FuelAnalysis;
}

/**
 * Home, Stats and the report all read the same entries array instance out of
 * the data store, so the analysis is cached against that instance: switching
 * vehicles or reloading after a mutation hands over a different array and
 * therefore recomputes, while two screens mounted over the same data share
 * one pass. The day key invalidates it across midnight, since the month
 * windows and month progress move on.
 */
const analysisCache = new WeakMap<FuelEntry[], CachedAnalysis>();

export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function getFuelAnalysis(entries: FuelEntry[], referenceDate: Date = new Date()): FuelAnalysis {
  const dayKey = localDayKey(referenceDate);
  const cached = analysisCache.get(entries);
  if (cached && cached.dayKey === dayKey) return cached.analysis;

  const analysis = analyzeFuelData(entries, { referenceDate });
  analysisCache.set(entries, { dayKey, analysis });
  return analysis;
}
