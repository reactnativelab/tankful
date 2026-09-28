import type { DistanceUnit, FuelEntry } from '@/types';
import { mileageUnitLabel } from './format';
import { calculateMileageForEntry, sortEntriesOldestFirst } from './mileage';

export interface FuelHistoryCsvSettings {
  currencySymbol: string;
  distanceUnit: DistanceUnit;
}

/** Wraps a field in quotes and escapes embedded quotes only when needed, per RFC 4180. */
function csvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Builds a CSV of a single vehicle's full fuel-entry history, oldest ->
 * newest. Pure string-building only -- no filesystem or sharing side
 * effects, same separation as buildMonthlySummary. `entries` may be in any
 * order; they're sorted here for both the output order and the mileage
 * calc (which needs oldest -> newest).
 */
export function buildFuelHistoryCsv(
  entries: FuelEntry[],
  settings: FuelHistoryCsvSettings
): string {
  const unitLabel = mileageUnitLabel(settings.distanceUnit);
  const headers = [
    'Date',
    'Odometer',
    'Litres Filled',
    `Price/Litre (${settings.currencySymbol})`,
    `Total Cost (${settings.currencySymbol})`,
    'Full Tank',
    `Mileage (${unitLabel})`,
    'Notes',
  ];

  const oldestFirst = sortEntriesOldestFirst(entries);

  const rows = oldestFirst.map((entry, index) => {
    const mileage = calculateMileageForEntry(oldestFirst, index);
    return [
      new Date(entry.date).toISOString().slice(0, 10),
      String(entry.odometer),
      String(entry.litresFilled),
      String(entry.pricePerLitre),
      String(entry.totalCost),
      entry.isTankFull ? 'Yes' : 'No',
      mileage !== null ? mileage.toFixed(2) : '',
      entry.notes ?? '',
    ]
      .map(csvField)
      .join(',');
  });

  return [headers.map(csvField).join(','), ...rows].join('\n');
}
