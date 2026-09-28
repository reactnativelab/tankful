import type {
  FuelEntry,
  NewFuelEntry,
  NewVehicle,
  Vehicle,
  VehicleUpdate,
} from '@/types';

/**
 * The data store's pure logic: "is this data loading, ready, or failed",
 * independent of React and of SQLite. This file touches neither -- it takes
 * its database access as injected `DataStoreDeps`, so the app wires it to the
 * real @/db modules (see store/dataStore.ts) and tests wire it to stubs.
 * Nothing here depends on React; screens read a store instance through
 * useSyncExternalStore (hooks/useDataStore).
 */

export type ResourceStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Invariant: `data` is non-null only when status === 'ready'. `refreshing` is
 * a refetch over existing data (status stays 'ready', so screens don't flash a
 * skeleton). `error` is set in two cases:
 *   - status === 'error': the slice never loaded; there is no data to show.
 *   - status === 'ready': a background refetch failed. The last good data is
 *     kept and the error rides alongside it, so a transient read failure
 *     doesn't replace a working screen with a full-screen error. The next
 *     successful load clears it.
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

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/** A failed load: keeps ready data (error alongside); otherwise a full 'error'. */
function failed<T>(resource: Resource<T>, error: unknown): Resource<T> {
  if (resource.status === 'ready') {
    return { ...resource, error: toError(error), refreshing: false };
  }
  return { status: 'error', data: null, error: toError(error), refreshing: false };
}

/** Ready -> refreshing over the same data; anything else -> a fresh 'loading'. */
function begin<T>(resource: Resource<T>): Resource<T> {
  if (resource.status === 'loading' || resource.refreshing) return resource;
  if (resource.status === 'ready') return { ...resource, refreshing: true };
  return { status: 'loading', data: null, error: null, refreshing: false };
}

/**
 * Everything the store needs from the database, injected so this file never
 * imports @/db itself. `isOdometerValidationError` stands in for an
 * `instanceof` check on a db-layer error class, for the same reason.
 */
export interface DataStoreDeps {
  initDatabase: () => Promise<void>;
  resetAllData: () => Promise<void>;
  getVehicles: () => Promise<Vehicle[]>;
  addVehicle: (data: NewVehicle) => Promise<Vehicle>;
  updateVehicle: (id: string, data: VehicleUpdate) => Promise<Vehicle | null>;
  deleteVehicle: (id: string) => Promise<void>;
  getFuelEntriesByVehicle: (vehicleId: string) => Promise<FuelEntry[]>;
  addFuelEntry: (data: NewFuelEntry) => Promise<FuelEntry>;
  deleteFuelEntry: (id: string) => Promise<void>;
  /** An odometer rejection is thrown before any write, so nothing changed. */
  isOdometerValidationError: (error: unknown) => boolean;
}

export interface DataStore {
  getState: () => StoreState;
  subscribe: (listener: () => void) => () => void;
  /** Returns the release function. Loads the slice if it's missing, failed (fully or on refresh) or stale. */
  retainVehicles: () => () => void;
  retainEntries: (vehicleId: string) => () => void;
  /** Manual retry after an error screen; also usable as a plain refetch. Never rejects. */
  retryVehicles: () => Promise<void>;
  retryEntries: (vehicleId: string) => Promise<void>;
  setSelectedVehicleId: (id: string | null) => void;
  createVehicle: (data: NewVehicle) => Promise<Vehicle>;
  updateVehicle: (id: string, data: VehicleUpdate) => Promise<Vehicle | null>;
  removeVehicle: (id: string) => Promise<void>;
  addEntry: (data: NewFuelEntry) => Promise<FuelEntry>;
  removeEntry: (vehicleId: string, id: string) => Promise<void>;
  /** Wipes every vehicle and entry (the transaction/atomicity of the wipe itself is the deps' job). */
  resetAll: () => Promise<void>;
}

/**
 * Builds one isolated store instance over `deps`. The app builds exactly one,
 * wired to the real @/db modules (store/dataStore.ts); a test builds its own
 * per test, wired to stubs, so no test ever touches SQLite and no state leaks
 * between tests.
 */
export function createDataStore(deps: DataStoreDeps): DataStore {
  let state: StoreState = {
    db: { status: 'idle', error: null },
    vehicles: IDLE_RESOURCE,
    entries: {},
    selectedVehicleId: null,
  };

  const listeners = new Set<() => void>();

  function getState(): StoreState {
    return state;
  }

  function subscribe(listener: () => void): () => void {
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
      await deps.initDatabase();
      setState((s) => ({ ...s, db: { status: 'ready', error: null } }));
    } catch (error) {
      setState((s) => ({ ...s, db: { status: 'error', error: toError(error) } }));
      throw error;
    }
  }

  // --- Loading -----------------------------------------------------------
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
      const data = await deps.getVehicles();
      if (seq !== vehiclesSeq) return;
      setState((s) => ({ ...s, vehicles: ready(data) }));
    } catch (error) {
      console.error('Failed to load vehicles', error);
      if (seq !== vehiclesSeq) return;
      setState((s) => ({ ...s, vehicles: failed(s.vehicles, error) }));
    }
  }

  async function loadEntries(vehicleId: string): Promise<void> {
    const seq = nextEntriesSeq(vehicleId);
    staleEntries.delete(vehicleId);
    setEntries(vehicleId, begin(state.entries[vehicleId] ?? IDLE_RESOURCE));
    try {
      await ensureDb();
      const data = await deps.getFuelEntriesByVehicle(vehicleId);
      if (seq !== entriesSeq.get(vehicleId)) return;
      setEntries(vehicleId, ready(data));
    } catch (error) {
      console.error(`Failed to load fuel entries for vehicle ${vehicleId}`, error);
      if (seq !== entriesSeq.get(vehicleId)) return;
      setEntries(vehicleId, failed(state.entries[vehicleId] ?? IDLE_RESOURCE, error));
    }
  }

  // --- Subscribers & invalidation ------------------------------------------
  // Hooks retain a slice while mounted. Invalidating a slice nobody holds only
  // marks it stale; the next retain refetches it. Slices with live subscribers
  // refetch immediately.

  let vehicleRefs = 0;
  let staleVehicles = false;
  const entryRefs = new Map<string, number>();
  const staleEntries = new Set<string>();

  function needsLoad(resource: Resource<unknown>, stale: boolean): boolean {
    return stale || resource.status === 'idle' || resource.error !== null;
  }

  function retainVehicles(): () => void {
    vehicleRefs += 1;
    if (needsLoad(state.vehicles, staleVehicles)) void loadVehicles();
    return () => {
      vehicleRefs = Math.max(0, vehicleRefs - 1);
    };
  }

  function retainEntries(vehicleId: string): () => void {
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

  // --- Actions ---------------------------------------------------------------

  function retryVehicles(): Promise<void> {
    return loadVehicles();
  }

  function retryEntries(vehicleId: string): Promise<void> {
    return loadEntries(vehicleId);
  }

  function setSelectedVehicleId(id: string | null): void {
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

  function createVehicle(data: NewVehicle): Promise<Vehicle> {
    return enqueue(async () => {
      try {
        await ensureDb();
        const existing = await deps.getVehicles();
        const vehicle = await deps.addVehicle(data);
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

  function updateVehicle(id: string, data: VehicleUpdate): Promise<Vehicle | null> {
    return enqueue(async () => {
      try {
        await ensureDb();
        const updated = await deps.updateVehicle(id, data);
        await invalidateVehicles();
        return updated;
      } catch (error) {
        await invalidateVehicles();
        throw error;
      }
    });
  }

  function removeVehicle(id: string): Promise<void> {
    return enqueue(async () => {
      let remaining: Vehicle[];
      try {
        await ensureDb();
        await deps.deleteVehicle(id);
        remaining = await deps.getVehicles();
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

  function addEntry(data: NewFuelEntry): Promise<FuelEntry> {
    return enqueue(async () => {
      try {
        await ensureDb();
        const entry = await deps.addFuelEntry(data);
        await invalidateEntries(data.vehicleId);
        return entry;
      } catch (error) {
        if (!deps.isOdometerValidationError(error)) {
          await invalidateEntries(data.vehicleId);
        }
        throw error;
      }
    });
  }

  function removeEntry(vehicleId: string, id: string): Promise<void> {
    return enqueue(async () => {
      try {
        await ensureDb();
        await deps.deleteFuelEntry(id);
        await invalidateEntries(vehicleId);
      } catch (error) {
        await invalidateEntries(vehicleId);
        throw error;
      }
    });
  }

  function resetAll(): Promise<void> {
    return enqueue(async () => {
      try {
        await ensureDb();
        await deps.resetAllData();
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

  return {
    getState,
    subscribe,
    retainVehicles,
    retainEntries,
    retryVehicles,
    retryEntries,
    setSelectedVehicleId,
    createVehicle,
    updateVehicle,
    removeVehicle,
    addEntry,
    removeEntry,
    resetAll,
  };
}
