import type { DistanceUnit } from '@/hooks/useSettings';
import type { FuelEntry } from '@/types';
import { calculateMileageForEntry } from './mileage';

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
  const mileageUnitLabel = settings.distanceUnit === 'km' ? 'km/l' : 'mi/gal';
  const headers = [
    'Date',
    'Odometer',
    'Litres Filled',
    `Price/Litre (${settings.currencySymbol})`,
    `Total Cost (${settings.currencySymbol})`,
    'Full Tank',
    `Mileage (${mileageUnitLabel})`,
    'Notes',
  ];

  const oldestFirst = [...entries].sort((a, b) => a.date - b.date);

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
