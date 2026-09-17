export const CREATE_VEHICLES_TABLE = `
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  fuelType TEXT NOT NULL,
  plate TEXT,
  createdAt INTEGER NOT NULL
);
`;

export const CREATE_FUEL_ENTRIES_TABLE = `
CREATE TABLE IF NOT EXISTS fuel_entries (
  id TEXT PRIMARY KEY NOT NULL,
  vehicleId TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  date INTEGER NOT NULL,
  odometer REAL NOT NULL,
  litresFilled REAL NOT NULL,
  pricePerLitre REAL NOT NULL,
  totalCost REAL NOT NULL,
  isTankFull INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  createdAt INTEGER NOT NULL
);
`;

export const CREATE_FUEL_ENTRIES_VEHICLE_INDEX = `
CREATE INDEX IF NOT EXISTS idx_fuel_entries_vehicleId ON fuel_entries(vehicleId);
`;

/** Raw row shapes as returned by expo-sqlite, before mapping to app types. */
export interface VehicleRow {
  id: string;
  name: string;
  type: string;
  fuelType: string;
  plate: string | null;
  createdAt: number;
}

export interface FuelEntryRow {
  id: string;
  vehicleId: string;
  date: number;
  odometer: number;
  litresFilled: number;
  pricePerLitre: number;
  totalCost: number;
  isTankFull: number;
  notes: string | null;
  createdAt: number;
}
