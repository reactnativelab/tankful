import * as SQLite from 'expo-sqlite';
import {
  CREATE_FUEL_ENTRIES_TABLE,
  CREATE_FUEL_ENTRIES_VEHICLE_INDEX,
  CREATE_VEHICLES_TABLE,
} from './schema';

const DATABASE_NAME = 'tankful.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let migrationsPromise: Promise<void> | null = null;

/** Runs once per process: creates tables if missing and enables FK enforcement. */
async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync(CREATE_VEHICLES_TABLE);
  await db.execAsync(CREATE_FUEL_ENTRIES_TABLE);
  await db.execAsync(CREATE_FUEL_ENTRIES_VEHICLE_INDEX);
}

/** Singleton DB connection. Safe to call repeatedly; migrations run only once. */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }
  return dbPromise;
}

/** Awaits DB open + migrations. Call once at app startup before rendering. */
export function initDatabase(): Promise<void> {
  if (!migrationsPromise) {
    migrationsPromise = getDatabase().then(runMigrations);
  }
  return migrationsPromise;
}
