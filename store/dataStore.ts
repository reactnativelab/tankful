import { initDatabase, resetAllData } from '@/db';
import {
  addFuelEntry,
  deleteFuelEntry,
  getFuelEntriesByVehicle,
  OdometerValidationError,
} from '@/db/fuelEntries';
import {
  addVehicle,
  deleteVehicle,
  getVehicles,
  updateVehicle as updateVehicleRow,
} from '@/db/vehicles';
import type {
  FuelEntry,
  NewFuelEntry,
  NewVehicle,
  Vehicle,
  VehicleUpdate,
} from '@/types';

/**
 * Module-level data store: the single owner of "is this data loading, ready,
 * or failed". React reads it through useSyncExternalStore (hooks/useDataStore);
 * nothing in here depends on React.
 */

export type ResourceStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Invariant: `data` is non-null only when status === 'ready', and `error` is
 * non-null only when status === 'error'. `refreshing` is a refetch over
 * existing data (status stays 'ready', so screens don't flash a skeleton).
 * A failed refetch drops to 'error' and clears `data` on purpose -- screens
 * never see stale rows next to an error.
 */
export interface Resource<T> {
  status: ResourceStatus;
  data: T | null;
  error: Error | null;
  refreshing: boolean;
}

export interface DbState {
  status: 'idle' | 'initializing' | 'ready' | 'error';
  error: Error | null;
}

export interface StoreState {
  db: DbState;
  vehicles: Resource<Vehicle[]>;
  /** Keyed by vehicle id. A missing key means "never requested". */
  entries: Record<string, Resource<FuelEntry[]>>;
  /** Raw selection; screens fall back to vehicles[0] when it's null or dangling. */
  selectedVehicleId: string | null;
}

export const IDLE_RESOURCE: Resource<never> = {
  status: 'idle',
  data: null,
  error: null,
  refreshing: false,
};

function ready<T>(data: T): Resource<T> {
  return { status: 'ready', data, error: null, refreshing: false };
}

function failed(error: unknown): Resource<never> {
  return {
    status: 'error',
    data: null,
    error: error instanceof Error ? error : new Error(String(error)),
    refreshing: false,
  };
}

/** Ready -> refreshing over the same data; anything else -> a fresh 'loading'. */
function begin<T>(resource: Resource<T>): Resource<T> {
  if (resource.status === 'loading' || resource.refreshing) return resource;
  if (resource.status === 'ready') return { ...resource, refreshing: true };
  return { status: 'loading', data: null, error: null, refreshing: false };
}

let state: StoreState = {
  db: { status: 'idle', error: null },
  vehicles: IDLE_RESOURCE,
  entries: {},
  selectedVehicleId: null,
};

const listeners = new Set<() => void>();

export function getState(): StoreState {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setState(update: (prev: StoreState) => StoreState): void {
  state = update(state);
  listeners.forEach((listener) => listener());
}

function setEntries(vehicleId: string, resource: Resource<FuelEntry[]>): void {
  setState((s) => ({ ...s, entries: { ...s.entries, [vehicleId]: resource } }));
}

async function ensureDb(): Promise<void> {
  if (state.db.status === 'ready') return;
  if (state.db.status !== 'initializing') {
    setState((s) => ({ ...s, db: { status: 'initializing', error: null } }));
  }
  try {
    await initDatabase();
    setState((s) => ({ ...s, db: { status: 'ready', error: null } }));
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    setState((s) => ({ ...s, db: { status: 'error', error: err } }));
    throw error;
  }
}

// --- Loading -----------------------------------------------------------------
// Every fetch takes a sequence number and only commits if it is still the
// latest for its slice, so a slow read that started before a mutation can't
// overwrite the fresher one the mutation triggered.

let vehiclesSeq = 0;
const entriesSeq = new Map<string, number>();

function nextEntriesSeq(vehicleId: string): number {
  const next = (entriesSeq.get(vehicleId) ?? 0) + 1;
  entriesSeq.set(vehicleId, next);
  return next;
}

async function loadVehicles(): Promise<void> {
  const seq = ++vehiclesSeq;
  staleVehicles = false;
  setState((s) => ({ ...s, vehicles: begin(s.vehicles) }));
  try {
    await ensureDb();
    const data = await getVehicles();
    if (seq !== vehiclesSeq) return;
    setState((s) => ({ ...s, vehicles: ready(data) }));
  } catch (error) {
    console.error('Failed to load vehicles', error);
    if (seq !== vehiclesSeq) return;
    setState((s) => ({ ...s, vehicles: failed(error) }));
  }
}

async function loadEntries(vehicleId: string): Promise<void> {
  const seq = nextEntriesSeq(vehicleId);
  staleEntries.delete(vehicleId);
  setEntries(vehicleId, begin(state.entries[vehicleId] ?? IDLE_RESOURCE));
  try {
    await ensureDb();
    const data = await getFuelEntriesByVehicle(vehicleId);
    if (seq !== entriesSeq.get(vehicleId)) return;
    setEntries(vehicleId, ready(data));
  } catch (error) {
    console.error(`Failed to load fuel entries for vehicle ${vehicleId}`, error);
    if (seq !== entriesSeq.get(vehicleId)) return;
    setEntries(vehicleId, failed(error));
  }
}

// --- Subscribers & invalidation ---------------------------------------------
// Hooks retain a slice while mounted. Invalidating a slice nobody holds only
// marks it stale; the next retain refetches it. Slices with live subscribers
// refetch immediately.

let vehicleRefs = 0;
let staleVehicles = false;
const entryRefs = new Map<string, number>();
const staleEntries = new Set<string>();

function needsLoad(resource: Resource<unknown>, stale: boolean): boolean {
  return stale || resource.status === 'idle' || resource.status === 'error';
}

/** Returns the release function. Loads the slice if it's missing, failed or stale. */
export function retainVehicles(): () => void {
  vehicleRefs += 1;
  if (needsLoad(state.vehicles, staleVehicles)) void loadVehicles();
  return () => {
    vehicleRefs = Math.max(0, vehicleRefs - 1);
  };
}

export function retainEntries(vehicleId: string): () => void {
  entryRefs.set(vehicleId, (entryRefs.get(vehicleId) ?? 0) + 1);
  const current = state.entries[vehicleId] ?? IDLE_RESOURCE;
  if (needsLoad(current, staleEntries.has(vehicleId))) void loadEntries(vehicleId);
  return () => {
    const remaining = (entryRefs.get(vehicleId) ?? 1) - 1;
    if (remaining <= 0) entryRefs.delete(vehicleId);
    else entryRefs.set(vehicleId, remaining);
  };
}

async function invalidateVehicles(): Promise<void> {
  if (vehicleRefs > 0) await loadVehicles();
  else staleVehicles = true;
}

async function invalidateEntries(vehicleId: string): Promise<void> {
  if ((entryRefs.get(vehicleId) ?? 0) > 0) await loadEntries(vehicleId);
  else staleEntries.add(vehicleId);
}

async function invalidateAll(): Promise<void> {
  await Promise.all([
    invalidateVehicles(),
    ...Object.keys(state.entries).map(invalidateEntries),
  ]);
}

/** Drops entries[vehicleId] and voids any in-flight fetch for it. */
function dropEntries(entries: StoreState['entries'], vehicleId: string): StoreState['entries'] {
  nextEntriesSeq(vehicleId);
  staleEntries.delete(vehicleId);
  const { [vehicleId]: _dropped, ...rest } = entries;
  return rest;
}

// --- Actions -----------------------------------------------------------------

/** Manual retry after an error screen; also usable as a plain refetch. Never rejects. */
export function retryVehicles(): Promise<void> {
  return loadVehicles();
}

export function retryEntries(vehicleId: string): Promise<void> {
  return loadEntries(vehicleId);
}

export function setSelectedVehicleId(id: string | null): void {
  if (state.selectedVehicleId === id) return;
  setState((s) => ({ ...s, selectedVehicleId: id }));
}

// Mutations run strictly one at a time. Each one reads-then-writes (e.g.
// createVehicle checks whether any vehicle exists before inserting), so two
// interleaved calls could otherwise both see "none yet". Each action resolves
// only after the slices it touched have been refreshed.
let mutationChain: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = mutationChain.then(task);
  mutationChain = result.catch(() => undefined);
  return result;
}

export function createVehicle(data: NewVehicle): Promise<Vehicle> {
  return enqueue(async () => {
    try {
      await ensureDb();
      const existing = await getVehicles();
      const vehicle = await addVehicle(data);
      if (existing.length === 0) {
        setSelectedVehicleId(vehicle.id);
      }
      await invalidateVehicles();
      return vehicle;
    } catch (error) {
      await invalidateVehicles();
      throw error;
    }
  });
}

export function updateVehicle(id: string, data: VehicleUpdate): Promise<Vehicle | null> {
  return enqueue(async () => {
    try {
      await ensureDb();
      const updated = await updateVehicleRow(id, data);
      await invalidateVehicles();
      return updated;
    } catch (error) {
      await invalidateVehicles();
      throw error;
    }
  });
}

export function removeVehicle(id: string): Promise<void> {
  return enqueue(async () => {
    let remaining: Vehicle[];
    try {
      await ensureDb();
      await deleteVehicle(id);
      remaining = await getVehicles();
    } catch (error) {
      await invalidateAll();
      throw error;
    }

    // Repoint the selection explicitly, in the same commit as the new vehicle
    // list, rather than leaving a dangling id for the screens' vehicles[0]
    // fallback to paper over: if the deleted vehicle was selected, select the
    // first remaining one (or nothing).
    // Entries: the deleted vehicle's slice is dropped from the map (not left
    // orphaned) so the store never holds "ready" rows for a vehicle that no
    // longer exists.
    vehiclesSeq += 1;
    staleVehicles = false;
    setState((s) => ({
      ...s,
      vehicles: ready(remaining),
      entries: dropEntries(s.entries, id),
      selectedVehicleId:
        s.selectedVehicleId === id ? (remaining[0]?.id ?? null) : s.selectedVehicleId,
    }));
  });
}

export function addEntry(data: NewFuelEntry): Promise<FuelEntry> {
  return enqueue(async () => {
    try {
      await ensureDb();
      const entry = await addFuelEntry(data);
      await invalidateEntries(data.vehicleId);
      return entry;
    } catch (error) {
      // An odometer rejection is thrown before any write, so nothing changed.
      if (!(error instanceof OdometerValidationError)) {
        await invalidateEntries(data.vehicleId);
      }
      throw error;
    }
  });
}

export function removeEntry(vehicleId: string, id: string): Promise<void> {
  return enqueue(async () => {
    try {
      await ensureDb();
      await deleteFuelEntry(id);
      await invalidateEntries(vehicleId);
    } catch (error) {
      await invalidateEntries(vehicleId);
      throw error;
    }
  });
}

/**
 * Wipes every vehicle and entry. The transaction/atomicity of the wipe itself
 * is DELETE-001's job (db/index.ts); this only keeps the store consistent.
 */
export function resetAll(): Promise<void> {
  return enqueue(async () => {
    try {
      await ensureDb();
      await resetAllData();
    } catch (error) {
      await invalidateAll();
      throw error;
    }

    vehiclesSeq += 1;
    staleVehicles = false;
    Object.keys(state.entries).forEach((vehicleId) => {
      nextEntriesSeq(vehicleId);
      staleEntries.delete(vehicleId);
    });
    setState((s) => ({
      ...s,
      vehicles: ready([]),
      entries: {},
      selectedVehicleId: null,
    }));
  });
}
