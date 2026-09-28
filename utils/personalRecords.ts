import { isSameMonth, monthRefOf } from './period';
import type { FuelAnalysis, MonthStats } from './fuelAnalytics';

/**
 * Personal records for the selected vehicle. Every record is a real row from
 * that vehicle's own history -- never an average, never a blend of vehicles,
 * and never shown at all when there isn't enough history for the word
 * "record" to mean anything.
 */

export type PersonalRecordId =
  | 'best-mileage'
  | 'lowest-cost-per-distance'
  | 'longest-distance'
  | 'largest-fill'
  | 'highest-monthly-spend'
  | 'lowest-monthly-spend'
  | 'most-fuel-in-month';

/** Tells the UI which formatter to use, so no formatted strings live in here. */
export type RecordValueKind = 'mileage' | 'costPerDistance' | 'distance' | 'litres' | 'currency';

export interface PersonalRecord {
  id: PersonalRecordId;
  title: string;
  /** One short line on what the number actually measures. */
  caption: string;
  kind: RecordValueKind;
  value: number;
  /** When it happened -- a fill-up date, or a month. */
  occurredAt:
    | { type: 'date'; timestamp: number }
    | { type: 'month'; label: string };
  /**
   * Set when the value is far outside the rest of the history. The record is
   * still shown with its real value: a strange result is usually a mistyped
   * odometer or litre figure, and that is the user's row to correct, not
   * Tankful's to quietly drop.
   */
  unusual?: boolean;
}

/** Monthly records need more than one month, or the only month is also the best and the worst. */
export const MIN_MONTHS_FOR_MONTHLY_RECORD = 2;

/** Below this there is no "rest of the history" to call a value unusual against. */
export const MIN_OBSERVATIONS_FOR_OUTLIER_CHECK = 4;

/** A mileage this many times the median is almost certainly a data-entry slip. */
export const OUTLIER_FACTOR = 3;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function maxBy<T>(items: T[], valueOf: (item: T) => number): T | null {
  let best: T | null = null;
  let bestValue = -Infinity;
  for (const item of items) {
    const value = valueOf(item);
    if (Number.isFinite(value) && value > bestValue) {
      best = item;
      bestValue = value;
    }
  }
  return best;
}

function minBy<T>(items: T[], valueOf: (item: T) => number): T | null {
  return maxBy(items, (item) => -valueOf(item));
}

export function buildPersonalRecords(analysis: FuelAnalysis): PersonalRecord[] {
  const records: PersonalRecord[] = [];
  const { observations, entriesOldestFirst } = analysis;

  const bestMileage = maxBy(observations, (observation) => observation.mileage);
  if (bestMileage) {
    const mileages = observations.map((observation) => observation.mileage);
    const unusual =
      observations.length >= MIN_OBSERVATIONS_FOR_OUTLIER_CHECK &&
      bestMileage.mileage > OUTLIER_FACTOR * median(mileages);
    records.push({
      id: 'best-mileage',
      title: 'Best mileage',
      caption: 'Your highest full-tank result',
      kind: 'mileage',
      value: bestMileage.mileage,
      occurredAt: { type: 'date', timestamp: bestMileage.date },
      unusual,
    });
  }

  const cheapestKilometre = minBy(
    observations.filter((observation) => observation.distance > 0),
    (observation) => observation.cost / observation.distance
  );
  if (cheapestKilometre) {
    records.push({
      id: 'lowest-cost-per-distance',
      title: 'Cheapest distance',
      caption: 'Lowest cost per unit of distance between two full tanks',
      kind: 'costPerDistance',
      value: cheapestKilometre.cost / cheapestKilometre.distance,
      occurredAt: { type: 'date', timestamp: cheapestKilometre.date },
    });
  }

  const longestRun = maxBy(observations, (observation) => observation.distance);
  if (longestRun) {
    records.push({
      id: 'longest-distance',
      title: 'Longest run',
      caption: 'Furthest you have gone between two full tanks',
      kind: 'distance',
      value: longestRun.distance,
      occurredAt: { type: 'date', timestamp: longestRun.date },
    });
  }

  const largestFill = maxBy(entriesOldestFirst, (entry) => entry.litresFilled);
  if (largestFill && largestFill.litresFilled > 0) {
    records.push({
      id: 'largest-fill',
      title: 'Largest fill-up',
      caption: 'Most fuel added in one go',
      kind: 'litres',
      value: largestFill.litresFilled,
      occurredAt: { type: 'date', timestamp: largestFill.date },
    });
  }

  const monthsWithData = analysis.months.filter((month) => month.fillCount > 0);
  if (monthsWithData.length >= MIN_MONTHS_FOR_MONTHLY_RECORD) {
    const pushMonth = (
      month: MonthStats | null,
      id: PersonalRecordId,
      title: string,
      caption: string,
      kind: RecordValueKind,
      value: (month: MonthStats) => number
    ) => {
      if (!month) return;
      records.push({
        id,
        title,
        caption,
        kind,
        value: value(month),
        occurredAt: { type: 'month', label: month.label },
      });
    };

    pushMonth(
      maxBy(monthsWithData, (month) => month.spend),
      'highest-monthly-spend',
      'Priciest month',
      'Most you have spent on fuel in one month',
      'currency',
      (month) => month.spend
    );

    // The month in progress is excluded from the *lowest* records only: it is
    // still filling up, so today's partial total would win a race it hasn't
    // finished. Highest-so-far is safe -- that money is already spent.
    const referenceMonth = monthRefOf(analysis.referenceDate);
    const completedMonths = monthsWithData.filter(
      (month) => !isSameMonth(month.ref, referenceMonth)
    );
    if (completedMonths.length >= MIN_MONTHS_FOR_MONTHLY_RECORD) {
      pushMonth(
        minBy(completedMonths, (month) => month.spend),
        'lowest-monthly-spend',
        'Leanest month',
        'Least you have spent on fuel in a completed month',
        'currency',
        (month) => month.spend
      );
    }

    pushMonth(
      maxBy(monthsWithData, (month) => month.litres),
      'most-fuel-in-month',
      'Most fuel in a month',
      'Largest volume bought in one month',
      'litres',
      (month) => month.litres
    );
  }

  return records;
}
