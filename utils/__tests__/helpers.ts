import type { FuelEntry } from '@/types';

/**
 * Fixtures for the domain tests. Dates are built with the local-time Date
 * constructor on purpose: every window in Tankful is a local calendar month,
 * so a UTC-built fixture would drift in and out of the right month depending
 * on the machine's timezone.
 */

export interface EntryInput {
  id?: string;
  vehicleId?: string;
  /** Local date parts: [year, month (0-11), day, hour?]. */
  on: [number, number, number, number?];
  odometer: number;
  litres: number;
  /** Defaults to 100 per litre, so cost is predictable without stating it. */
  pricePerLitre?: number;
  totalCost?: number;
  full?: boolean;
  notes?: string | null;
  createdAt?: number;
}

let sequence = 0;

export function entry(input: EntryInput): FuelEntry {
  const [year, month, day, hour = 12] = input.on;
  const date = new Date(year, month, day, hour, 0, 0, 0).getTime();
  const pricePerLitre = input.pricePerLitre ?? 100;
  sequence += 1;
  return {
    id: input.id ?? `entry-${sequence}`,
    vehicleId: input.vehicleId ?? 'vehicle-a',
    date,
    odometer: input.odometer,
    litresFilled: input.litres,
    pricePerLitre,
    totalCost: input.totalCost ?? input.litres * pricePerLitre,
    isTankFull: input.full ?? true,
    notes: input.notes ?? null,
    createdAt: input.createdAt ?? date,
  };
}

export function entries(...inputs: EntryInput[]): FuelEntry[] {
  return inputs.map(entry);
}

/** The store hands entries over newest-first; analysis must cope with that. */
export function newestFirst(list: FuelEntry[]): FuelEntry[] {
  return [...list].sort((a, b) => b.date - a.date);
}

export function at(year: number, month: number, day: number, hour = 12): Date {
  return new Date(year, month, day, hour, 0, 0, 0);
}

/** Rounds for comparisons where floating-point noise is not the thing under test. */
export function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
