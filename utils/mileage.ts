import type { FuelEntry } from '@/types';

/**
 * Mileage for a single entry requires both it and the chronologically
 * previous entry to be a full tank (partial fills break the litres-per-km
 * math). `entries` must be sorted oldest -> newest; `index` is the entry
 * being evaluated.
 */
export function calculateMileageForEntry(
  entries: FuelEntry[],
  index: number
): number | null {
  if (index <= 0 || index >= entries.length) return null;

  const current = entries[index];
  const previous = entries[index - 1];

  if (!current.isTankFull || !previous.isTankFull) return null;
  if (current.litresFilled <= 0) return null;

  const distance = current.odometer - previous.odometer;
  if (distance <= 0) return null;

  return distance / current.litresFilled;
}

/**
 * Mean of all valid per-entry mileages. `entries` must be sorted oldest -> newest.
 */
export function calculateAverageMileage(entries: FuelEntry[]): number | null {
  const values: number[] = [];

  for (let i = 1; i < entries.length; i++) {
    const mileage = calculateMileageForEntry(entries, i);
    if (mileage !== null) values.push(mileage);
  }

  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Best (highest) of a set of already-computed mileage values. Filter nulls before calling. */
export function calculateBestMileage(mileageValues: number[]): number | null {
  if (mileageValues.length === 0) return null;
  return Math.max(...mileageValues);
}

/** Worst (lowest) of a set of already-computed mileage values. Filter nulls before calling. */
export function calculateWorstMileage(mileageValues: number[]): number | null {
  if (mileageValues.length === 0) return null;
  return Math.min(...mileageValues);
}

/** Sum of totalCost for entries whose `date` falls in the given month/year. month is 0-11. */
export function calculateMonthlySpend(
  entries: FuelEntry[],
  month: number,
  year: number
): number {
  return entries.reduce((sum, entry) => {
    const d = new Date(entry.date);
    if (d.getMonth() === month && d.getFullYear() === year) {
      return sum + entry.totalCost;
    }
    return sum;
  }, 0);
}

export interface MonthlySpend {
  label: string;
  total: number;
}

/**
 * Monthly spend for the 6 calendar months ending in referenceDate's month
 * (oldest -> newest), including months with ₹0 spend. Generalizes
 * calculateMonthlySpend to a fixed-length series for the Stats bar chart.
 */
export function calculateMonthlySpendSeries(
  entries: FuelEntry[],
  referenceDate: Date
): MonthlySpend[] {
  const months: { month: number; year: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    months.push({ month: d.getMonth(), year: d.getFullYear() });
  }

  return months.map(({ month, year }) => ({
    label: new Date(year, month, 1).toLocaleDateString(undefined, { month: 'short' }),
    total: calculateMonthlySpend(entries, month, year),
  }));
}

export function calculateTotalSpend(entries: FuelEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.totalCost, 0);
}

export function calculateTotalLitres(entries: FuelEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.litresFilled, 0);
}

/**
 * All-time total spend divided by total distance traveled (last odometer -
 * first odometer, by date). `entries` may be in any order. Null if fewer
 * than 2 entries or the odometer span isn't positive.
 */
export function calculateCostPerDistance(entries: FuelEntry[]): number | null {
  if (entries.length < 2) return null;

  const oldestFirst = [...entries].sort((a, b) => a.date - b.date);
  const distance =
    oldestFirst[oldestFirst.length - 1].odometer - oldestFirst[0].odometer;
  if (distance <= 0) return null;

  return calculateTotalSpend(entries) / distance;
}

export interface SpendTrend {
  direction: 'up' | 'down' | 'flat';
  /** Absolute percentage change vs. the previous calendar month; pair with `direction`. */
  percent: number;
}

/**
 * Compares referenceDate's calendar month spend to the previous calendar
 * month's. Null if either month has no fill-ups logged at all (not just
 * ₹0 spend), since there's nothing meaningful to compare against.
 */
export function calculateSpendTrend(
  entries: FuelEntry[],
  referenceDate: Date = new Date()
): SpendTrend | null {
  const currentMonth = referenceDate.getMonth();
  const currentYear = referenceDate.getFullYear();
  const previousDate = new Date(currentYear, currentMonth - 1, 1);
  const previousMonth = previousDate.getMonth();
  const previousYear = previousDate.getFullYear();

  const isInMonth = (entry: FuelEntry, month: number, year: number) => {
    const d = new Date(entry.date);
    return d.getMonth() === month && d.getFullYear() === year;
  };

  const currentHasData = entries.some((e) => isInMonth(e, currentMonth, currentYear));
  const previousHasData = entries.some((e) => isInMonth(e, previousMonth, previousYear));
  if (!currentHasData || !previousHasData) return null;

  const currentSpend = calculateMonthlySpend(entries, currentMonth, currentYear);
  const previousSpend = calculateMonthlySpend(entries, previousMonth, previousYear);
  if (previousSpend === 0) return null;

  const percent = ((currentSpend - previousSpend) / previousSpend) * 100;
  return {
    direction: percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat',
    percent: Math.abs(percent),
  };
}
