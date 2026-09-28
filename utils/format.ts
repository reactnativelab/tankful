import type { DistanceUnit } from '@/types';

/** Shown wherever a value can't be computed or isn't a real number. */
export const EMPTY_VALUE = '—';

/**
 * Derived values can go non-finite when the data behind them is degenerate
 * (a division that ends up 0/0, an overflowing sum), and "NaN km/l" or
 * "₹Infinity" is never something a user should read. Every formatter below
 * funnels through this first and falls back to EMPTY_VALUE instead.
 */
function isDisplayable(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Three-digit grouping, done by hand rather than via toLocaleString: the
 * output has to be identical on every device (it is asserted in tests and
 * shared as text), and Hermes' Intl coverage varies by platform.
 */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Money, at a fixed 2 decimals with grouped thousands: "₹5,420.00".
 * A negative amount keeps the sign outside the symbol ("-₹40.00"), which is
 * how currency is written in every locale Tankful ships a preset for.
 */
export function formatCurrency(amount: number, symbol = '₹'): string {
  if (!isDisplayable(amount)) return EMPTY_VALUE;
  const sign = amount < 0 ? '-' : '';
  const [whole, fraction] = Math.abs(amount).toFixed(2).split('.');
  return `${sign}${symbol}${groupThousands(whole)}.${fraction}`;
}

export function formatNumber(value: number, decimals = 1): string {
  if (!isDisplayable(value)) return EMPTY_VALUE;
  const sign = value < 0 ? '-' : '';
  const [whole, fraction] = Math.abs(value).toFixed(decimals).split('.');
  return `${sign}${groupThousands(whole)}${fraction ? `.${fraction}` : ''}`;
}

/**
 * Distance per litre, in the user's distance unit. Tankful measures fuel in
 * litres only (Settings > Fuel Unit is fixed at L), so the mile label is
 * mi/L -- it is not a US MPG figure and must not be labelled as one.
 */
export function mileageUnitLabel(unit: DistanceUnit): string {
  return unit === 'km' ? 'km/l' : 'mi/L';
}

export function formatMileage(
  value: number | null,
  unit: DistanceUnit,
  decimals = 1
): string {
  if (!isDisplayable(value)) return EMPTY_VALUE;
  return `${formatNumber(value, decimals)} ${mileageUnitLabel(unit)}`;
}

/** A travelled or derived distance, e.g. "1,820 km". */
export function formatDistance(value: number | null, unit: DistanceUnit, decimals = 0): string {
  if (!isDisplayable(value)) return EMPTY_VALUE;
  return `${formatNumber(value, decimals)} ${unit}`;
}

/** An odometer reading. Same presentation as a distance -- whole units, grouped. */
export function formatOdometer(value: number, unit: DistanceUnit): string {
  return formatDistance(value, unit, 0);
}

export function formatLitres(value: number | null, decimals = 1): string {
  if (!isDisplayable(value)) return EMPTY_VALUE;
  return `${formatNumber(value, decimals)} L`;
}

/**
 * A percentage that is already expressed as 0-100 (not 0-1). Whole numbers by
 * default: a change quoted to two decimals implies a precision the underlying
 * fill-up data doesn't have.
 */
export function formatPercent(value: number | null, decimals = 0): string {
  if (!isDisplayable(value)) return EMPTY_VALUE;
  return `${formatNumber(value, decimals)}%`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
