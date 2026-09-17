import type { DistanceUnit } from '@/hooks/useSettings';
import type { FuelEntry, Vehicle } from '@/types';
import { formatCurrency, formatDate, formatMileage } from './format';
import { calculateMileageForEntry, calculateMonthlySpend } from './mileage';

export interface MonthlySummarySettings {
  currencySymbol: string;
  distanceUnit: DistanceUnit;
}

/** Entries for `vehicle` whose `date` falls in referenceDate's calendar month, oldest -> newest. */
function getMonthEntriesOldestFirst(
  entries: FuelEntry[],
  referenceDate: Date
): FuelEntry[] {
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();
  return [...entries]
    .filter((entry) => {
      const d = new Date(entry.date);
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .sort((a, b) => a.date - b.date);
}

/** Number of fill-ups logged in referenceDate's calendar month. Used to gate the share action. */
export function countFillupsInMonth(
  entries: FuelEntry[],
  referenceDate: Date = new Date()
): number {
  return getMonthEntriesOldestFirst(entries, referenceDate).length;
}

/**
 * Builds a plain-text monthly summary for the system share sheet.
 * `entries` must already be scoped to `vehicle` (any order) — e.g. the
 * `entries` field from useVehicleDashboard.
 */
export function buildMonthlySummary(
  entries: FuelEntry[],
  vehicle: Vehicle,
  settings: MonthlySummarySettings,
  referenceDate: Date = new Date()
): string {
  const monthLabel = referenceDate.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const monthEntries = getMonthEntriesOldestFirst(entries, referenceDate);

  if (monthEntries.length === 0) {
    return `${vehicle.name} — ${monthLabel}\n\nNo fill-ups logged yet this month.`;
  }

  const entriesOldestFirst = [...entries].sort((a, b) => a.date - b.date);
  const monthMileages: number[] = [];
  entriesOldestFirst.forEach((entry, index) => {
    if (!monthEntries.includes(entry)) return;
    const mileage = calculateMileageForEntry(entriesOldestFirst, index);
    if (mileage !== null) monthMileages.push(mileage);
  });
  const averageMileage =
    monthMileages.length > 0
      ? monthMileages.reduce((sum, v) => sum + v, 0) / monthMileages.length
      : null;

  const totalSpend = calculateMonthlySpend(
    entries,
    referenceDate.getMonth(),
    referenceDate.getFullYear()
  );
  const lastFillupDate = monthEntries[monthEntries.length - 1].date;

  return [
    `⛽ ${vehicle.name} — ${monthLabel}`,
    '',
    `Total spend: ${formatCurrency(totalSpend, settings.currencySymbol)}`,
    `Fill-ups logged: ${monthEntries.length}`,
    `Average mileage: ${formatMileage(averageMileage, settings.distanceUnit)}`,
    `Last fill-up: ${formatDate(lastFillupDate)}`,
  ].join('\n');
}
