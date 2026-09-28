import type { FuelEntry } from '@/types';

/**
 * Per-entry fuel maths. This module owns the primitives only -- what a single
 * fill-up (or a whole list of them) is worth. Anything that needs a calendar
 * window lives in utils/fuelAnalytics, which builds on these; there is one
 * implementation of each rule and everything else consumes it.
 */

/**
 * Chronological order, oldest -> newest, which is what every calculation
 * below expects. `date` is what the user picked, so two fill-ups can share
 * one; `createdAt` breaks the tie deterministically by insertion order.
 */
export function sortEntriesOldestFirst(entries: FuelEntry[]): FuelEntry[] {
  return [...entries].sort((a, b) => a.date - b.date || a.createdAt - b.createdAt);
}

/**
 * Distance covered since the previous fill-up. Unlike mileage this doesn't
 * care about full tanks -- the odometer moved regardless of how the tank was
 * filled. Null when there is no previous entry or the reading didn't advance
 * (which a backdated entry can produce).
 */
export function calculateDistanceForEntry(
  entries: FuelEntry[],
  index: number
): number | null {
  if (index <= 0 || index >= entries.length) return null;
  const distance = entries[index].odometer - entries[index - 1].odometer;
  return distance > 0 ? distance : null;
}

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

  const distance = calculateDistanceForEntry(entries, index);
  if (distance === null) return null;

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

export function calculateTotalSpend(entries: FuelEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.totalCost, 0);
}

export function calculateTotalLitres(entries: FuelEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.litresFilled, 0);
}

/**
 * Distance actually recorded between fill-ups: the sum of the positive gaps
 * between consecutive odometer readings. For a clean history this equals
 * (last reading - first reading); summing the gaps instead means one
 * out-of-order reading can't drag the whole total negative.
 * `entries` may be in any order.
 */
export function calculateTravelledDistance(entries: FuelEntry[]): number {
  const oldestFirst = sortEntriesOldestFirst(entries);
  let distance = 0;
  for (let i = 1; i < oldestFirst.length; i++) {
    distance += calculateDistanceForEntry(oldestFirst, i) ?? 0;
  }
  return distance;
}

/**
 * Money per unit of distance over the whole history.
 *
 * The first fill-up is deliberately left out of the numerator: it paid for
 * the fuel in the tank *before* any of the measured distance was covered, so
 * counting it would inflate the rate. Every later fill-up replaces fuel burnt
 * over a gap that is in the denominator, which keeps this figure equal to the
 * per-month rate aggregated over the same entries.
 * `entries` may be in any order. Null if fewer than 2 entries or no distance.
 */
export function calculateCostPerDistance(entries: FuelEntry[]): number | null {
  if (entries.length < 2) return null;

  const oldestFirst = sortEntriesOldestFirst(entries);
  let distance = 0;
  let cost = 0;

  for (let i = 1; i < oldestFirst.length; i++) {
    const gap = calculateDistanceForEntry(oldestFirst, i);
    if (gap === null) continue;
    distance += gap;
    cost += oldestFirst[i].totalCost;
  }

  if (distance <= 0) return null;
  return cost / distance;
}
