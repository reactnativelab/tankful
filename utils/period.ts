/**
 * Calendar-month helpers.
 *
 * Every window in Tankful is a *local* calendar month -- the same semantics
 * the existing spend/mileage helpers already use (`new Date(timestamp)` then
 * getMonth()/getFullYear()) -- never a rolling 30 days. So these build their
 * boundaries with the local-time Date constructor, which also handles the
 * cases that hand-rolled month math gets wrong: December -> January, leap
 * Februaries, and 28/29/30/31-day lengths.
 */

export interface MonthRef {
  /** Full year, e.g. 2026. */
  year: number;
  /** 0-11, matching Date#getMonth. */
  month: number;
}

export function monthRefOf(value: Date | number): MonthRef {
  const date = value instanceof Date ? value : new Date(value);
  return { year: date.getFullYear(), month: date.getMonth() };
}

/** Shifts by whole months; `delta` may be negative. Year rollover is handled by Date itself. */
export function addMonths(ref: MonthRef, delta: number): MonthRef {
  const shifted = new Date(ref.year, ref.month + delta, 1);
  return { year: shifted.getFullYear(), month: shifted.getMonth() };
}

export function startOfMonth(ref: MonthRef): Date {
  return new Date(ref.year, ref.month, 1, 0, 0, 0, 0);
}

export function startOfNextMonth(ref: MonthRef): Date {
  return startOfMonth(addMonths(ref, 1));
}

/** 28, 29, 30 or 31 -- day 0 of the next month is the last day of this one. */
export function daysInMonth(ref: MonthRef): number {
  return new Date(ref.year, ref.month + 1, 0).getDate();
}

export function isInMonth(timestamp: number, ref: MonthRef): boolean {
  const date = new Date(timestamp);
  return date.getMonth() === ref.month && date.getFullYear() === ref.year;
}

/** Sort/compare helper: negative when `a` is the earlier month. */
export function compareMonths(a: MonthRef, b: MonthRef): number {
  return a.year !== b.year ? a.year - b.year : a.month - b.month;
}

export function isSameMonth(a: MonthRef, b: MonthRef): boolean {
  return compareMonths(a, b) === 0;
}

/** Stable sortable identity, e.g. "2026-09". Used as a Map key, never shown to users. */
export function monthKey(ref: MonthRef): string {
  return `${ref.year}-${String(ref.month + 1).padStart(2, '0')}`;
}

/** e.g. "September 2026" (long) or "Sep" (short, no year -- for chart axes). */
export function formatMonthLabel(ref: MonthRef, style: 'long' | 'short' = 'long'): string {
  return startOfMonth(ref).toLocaleDateString(
    undefined,
    style === 'long' ? { month: 'long', year: 'numeric' } : { month: 'short' }
  );
}

/**
 * Fraction of the month that has elapsed at `now`, 0-1.
 *
 * Measured in elapsed milliseconds against the month's real length, so a
 * 28-day February, a 31-day January and a DST-shortened month each divide by
 * their own true duration. Months already finished return 1; months not yet
 * started return 0. The first instant of a month returns ~0, which is why
 * every consumer (forecast especially) has its own minimum-progress gate.
 */
export function monthProgress(ref: MonthRef, now: Date): number {
  const start = startOfMonth(ref).getTime();
  const end = startOfNextMonth(ref).getTime();
  const elapsed = now.getTime() - start;
  if (elapsed <= 0) return 0;
  if (elapsed >= end - start) return 1;
  return elapsed / (end - start);
}

/**
 * Day-of-month cut-off for a like-for-like comparison with an earlier month:
 * "the 31st" has no counterpart in a 30-day month, so it clamps to that
 * month's last day (which makes the comparison the whole of that month).
 */
export function clampDayToMonth(ref: MonthRef, day: number): number {
  return Math.min(Math.max(Math.trunc(day), 1), daysInMonth(ref));
}

/** Whole months from `from` to `to`; negative when `to` is earlier. */
export function monthsBetween(from: MonthRef, to: MonthRef): number {
  return (to.year - from.year) * 12 + (to.month - from.month);
}
