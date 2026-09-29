import * as Crypto from 'expo-crypto';
import { getDatabase } from './index';
import type { VehicleRow } from './schema';
import type { NewVehicle, Vehicle, VehicleUpdate } from '@/types';

function mapRow(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Vehicle['type'],
    fuelType: row.fuelType as Vehicle['fuelType'],
    plate: row.plate,
    createdAt: row.createdAt,
  };
}

export async function addVehicle(data: NewVehicle): Promise<Vehicle> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const createdAt = Date.now();

  await db.runAsync(
    `INSERT INTO vehicles (id, name, type, fuelType, plate, createdAt) VALUES (?, ?, ?, ?, ?, ?);`,
    id,
    data.name,
    data.type,
    data.fuelType,
    data.plate ?? null,
    createdAt
  );

  return { id, createdAt, ...data, plate: data.plate ?? null };
}

export async function getVehicles(): Promise<Vehicle[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<VehicleRow>(
    `SELECT * FROM vehicles ORDER BY createdAt ASC;`
  );
  return rows.map(mapRow);
}

export async function getVehicleById(id: string): Promise<Vehicle | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<VehicleRow>(
    `SELECT * FROM vehicles WHERE id = ?;`,
    id
  );
  return row ? mapRow(row) : null;
}

export async function updateVehicle(
  id: string,
  data: VehicleUpdate
): Promise<Vehicle | null> {
  const existing = await getVehicleById(id);
  if (!existing) return null;

  const merged: Vehicle = { ...existing, ...data };

  const db = await getDatabase();
  await db.runAsync(
    `UPDATE vehicles SET name = ?, type = ?, fuelType = ?, plate = ? WHERE id = ?;`,
    merged.name,
    merged.type,
    merged.fuelType,
    merged.plate,
    id
  );

  return merged;
}

/**
 * Deletes a vehicle and its fuel entries, atomically. withExclusiveTransactionAsync
 * opens a separate connection, and PRAGMA foreign_keys = ON (set in migrations) is
 * only guaranteed on the main connection -- so cascade isn't relied on here even
 * inside the transaction; entries are deleted explicitly first, same as before.
 * The transaction only protects against a crash/kill mid-delete leaving a
 * half-deleted vehicle (e.g. entries gone but the vehicle row still present).
 */
export async function deleteVehicle(id: string): Promise<void> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(`DELETE FROM fuel_entries WHERE vehicleId = ?;`, id);
    await txn.runAsync(`DELETE FROM vehicles WHERE id = ?;`, id);
  });
}
