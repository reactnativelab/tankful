import * as SQLite from 'expo-sqlite';
import { retryablePromise } from '@/utils/retryablePromise';
import {
  CREATE_FUEL_ENTRIES_TABLE,
  CREATE_FUEL_ENTRIES_VEHICLE_INDEX,
  CREATE_VEHICLES_TABLE,
} from './schema';

const DATABASE_NAME = 'tankful.db';

/** Runs once per process: creates tables if missing and enables FK enforcement. */
async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync(CREATE_VEHICLES_TABLE);
  await db.execAsync(CREATE_FUEL_ENTRIES_TABLE);
  await db.execAsync(CREATE_FUEL_ENTRIES_VEHICLE_INDEX);
}

/**
 * Open + migrate as one memoized attempt (retryablePromise): a rejection --
 * whether the open itself failed or migrations did -- is not cached, so the
 * next call starts over. A migration failure additionally best-effort closes
 * the now-half-open handle (open, but never fully migrated) so a retry
 * reopens a fresh connection rather than reusing that one; migrations are
 * CREATE TABLE IF NOT EXISTS, so re-running them on a fresh handle is safe.
 */
const openAndMigrate = retryablePromise(async (): Promise<SQLite.SQLiteDatabase> => {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  try {
    await runMigrations(db);
  } catch (error) {
    await db.closeAsync().catch(() => {});
    throw error;
  }
  return db;
});

/** Singleton DB connection. Safe to call repeatedly; migrations run only once. */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  return openAndMigrate();
}

/** Awaits DB open + migrations. Call once at app startup before rendering. */
export function initDatabase(): Promise<void> {
  return openAndMigrate().then(() => undefined);
}

/**
 * Deletes every row from both tables -- all vehicles and all fuel entries --
 * atomically. Row-level delete rather than drop/recreate so it doesn't need
 * to re-run migrations afterwards. Does not touch AsyncStorage settings
 * (currency, units, theme, hasSeenOnboarding); this is a data reset, not a
 * factory reset.
 *
 * withExclusiveTransactionAsync opens a separate connection, so PRAGMA
 * foreign_keys = ON (set only on the main connection in runMigrations) isn't
 * guaranteed here -- fuel_entries is deleted before vehicles regardless, same
 * order as before. The transaction protects against a crash/kill mid-delete
 * leaving some vehicles wiped and others surviving.
 */
export async function resetAllData(): Promise<void> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM fuel_entries;');
    await txn.runAsync('DELETE FROM vehicles;');
  });
}
