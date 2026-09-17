import * as Crypto from 'expo-crypto';
import { getDatabase } from './index';
import type { FuelEntryRow } from './schema';
import type { FuelEntry, FuelEntryUpdate, NewFuelEntry } from '@/types';

function mapRow(row: FuelEntryRow): FuelEntry {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    date: row.date,
    odometer: row.odometer,
    litresFilled: row.litresFilled,
    pricePerLitre: row.pricePerLitre,
    totalCost: row.totalCost,
    isTankFull: row.isTankFull === 1,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

/** Most recent entry for a vehicle by date (ties broken by createdAt), or null if none. */
export async function getLastFuelEntry(
  vehicleId: string
): Promise<FuelEntry | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<FuelEntryRow>(
    `SELECT * FROM fuel_entries WHERE vehicleId = ? ORDER BY date DESC, createdAt DESC LIMIT 1;`,
    vehicleId
  );
  return row ? mapRow(row) : null;
}

export class OdometerValidationError extends Error {
  constructor(public readonly previousOdometer: number) {
    super(
      `Odometer reading must be greater than the previous entry's reading (${previousOdometer}).`
    );
    this.name = 'OdometerValidationError';
  }
}

export async function addFuelEntry(data: NewFuelEntry): Promise<FuelEntry> {
  const previous = await getLastFuelEntry(data.vehicleId);
  if (previous && data.odometer <= previous.odometer) {
    throw new OdometerValidationError(previous.odometer);
  }

  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const createdAt = Date.now();
  const totalCost = data.totalCost ?? data.litresFilled * data.pricePerLitre;

  await db.runAsync(
    `INSERT INTO fuel_entries
      (id, vehicleId, date, odometer, litresFilled, pricePerLitre, totalCost, isTankFull, notes, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    id,
    data.vehicleId,
    data.date,
    data.odometer,
    data.litresFilled,
    data.pricePerLitre,
    totalCost,
    data.isTankFull ? 1 : 0,
    data.notes ?? null,
    createdAt
  );

  return {
    id,
    createdAt,
    ...data,
    totalCost,
    notes: data.notes ?? null,
  };
}

export async function getFuelEntriesByVehicle(
  vehicleId: string
): Promise<FuelEntry[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<FuelEntryRow>(
    `SELECT * FROM fuel_entries WHERE vehicleId = ? ORDER BY date DESC, createdAt DESC;`,
    vehicleId
  );
  return rows.map(mapRow);
}

export async function getFuelEntryById(id: string): Promise<FuelEntry | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<FuelEntryRow>(
    `SELECT * FROM fuel_entries WHERE id = ?;`,
    id
  );
  return row ? mapRow(row) : null;
}

export async function updateFuelEntry(
  id: string,
  data: FuelEntryUpdate
): Promise<FuelEntry | null> {
  const existing = await getFuelEntryById(id);
  if (!existing) return null;

  const merged: FuelEntry = { ...existing, ...data };

  const litresOrPriceChanged =
    data.litresFilled !== undefined || data.pricePerLitre !== undefined;
  if (litresOrPriceChanged && data.totalCost === undefined) {
    merged.totalCost = merged.litresFilled * merged.pricePerLitre;
  }

  const db = await getDatabase();
  await db.runAsync(
    `UPDATE fuel_entries
     SET date = ?, odometer = ?, litresFilled = ?, pricePerLitre = ?, totalCost = ?, isTankFull = ?, notes = ?
     WHERE id = ?;`,
    merged.date,
    merged.odometer,
    merged.litresFilled,
    merged.pricePerLitre,
    merged.totalCost,
    merged.isTankFull ? 1 : 0,
    merged.notes,
    id
  );

  return merged;
}

export async function deleteFuelEntry(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM fuel_entries WHERE id = ?;`, id);
}
