import { strict as assert } from 'node:assert';
import test from 'node:test';
import type { FuelEntry, NewVehicle, Vehicle } from '@/types';
import { createDataStore, type DataStoreDeps } from '../../store/createDataStore';

/**
 * Store tests build their own createDataStore(deps) instance per test, wired
 * to an in-memory stub -- never the real @/db modules (store/dataStore.ts is
 * deliberately left out of the test build; see tsconfig.test.json). Each
 * test gets a fresh instance, so nothing leaks between them.
 */

function vehicleFixture(id: string, overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id,
    name: `Vehicle ${id}`,
    type: 'car',
    fuelType: 'petrol',
    plate: null,
    createdAt: 0,
    ...overrides,
  };
}

const NEW_VEHICLE: NewVehicle = { name: 'New', type: 'car', fuelType: 'petrol', plate: null };

/** Lets a pending microtask chain (an in-flight `retain*` fetch) settle. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

interface StubDeps {
  deps: DataStoreDeps;
  callLog: string[];
  setVehicles: (vehicles: Vehicle[]) => void;
  setEntries: (vehicleId: string, entries: FuelEntry[]) => void;
  setFailVehicles: (fail: boolean) => void;
  setFailEntries: (vehicleId: string, fail: boolean) => void;
}

/**
 * An in-memory stand-in for @/db: immediate resolution, no timing control.
 * Tests that need to control *when* a read resolves (the race-condition
 * tests) replace individual functions of `.deps` with their own promises.
 */
function createStubDeps(
  initial: { vehicles?: Vehicle[]; entries?: Record<string, FuelEntry[]> } = {}
): StubDeps {
  let vehicles = initial.vehicles ?? [];
  let entries: Record<string, FuelEntry[]> = { ...(initial.entries ?? {}) };
  let failVehicles = false;
  const failEntries = new Set<string>();
  let nextId = 0;
  const callLog: string[] = [];

  const deps: DataStoreDeps = {
    initDatabase: async () => {
      callLog.push('initDatabase');
    },
    resetAllData: async () => {
      callLog.push('resetAllData');
      vehicles = [];
      entries = {};
    },
    getVehicles: async () => {
      callLog.push('getVehicles');
      if (failVehicles) throw new Error('vehicles read failed');
      return vehicles;
    },
    addVehicle: async (data) => {
      callLog.push('addVehicle');
      nextId += 1;
      const vehicle: Vehicle = { id: `v${nextId}`, createdAt: 0, ...data };
      vehicles = [...vehicles, vehicle];
      return vehicle;
    },
    updateVehicle: async (id, data) => {
      callLog.push('updateVehicle');
      const index = vehicles.findIndex((v) => v.id === id);
      if (index === -1) return null;
      vehicles = vehicles.map((v, i) => (i === index ? { ...v, ...data } : v));
      return vehicles[index];
    },
    deleteVehicle: async (id) => {
      callLog.push('deleteVehicle');
      vehicles = vehicles.filter((v) => v.id !== id);
    },
    getFuelEntriesByVehicle: async (vehicleId) => {
      callLog.push(`getFuelEntriesByVehicle:${vehicleId}`);
      if (failEntries.has(vehicleId)) throw new Error(`entries read failed: ${vehicleId}`);
      return entries[vehicleId] ?? [];
    },
    addFuelEntry: async (data) => {
      callLog.push('addFuelEntry');
      nextId += 1;
      const entry: FuelEntry = { id: `e${nextId}`, createdAt: 0, totalCost: 0, ...data };
      entries[data.vehicleId] = [entry, ...(entries[data.vehicleId] ?? [])];
      return entry;
    },
    deleteFuelEntry: async (id) => {
      callLog.push('deleteFuelEntry');
      for (const vehicleId of Object.keys(entries)) {
        entries[vehicleId] = entries[vehicleId].filter((e) => e.id !== id);
      }
    },
    isOdometerValidationError: () => false,
  };

  return {
    deps,
    callLog,
    setVehicles: (v) => {
      vehicles = v;
    },
    setEntries: (vehicleId, e) => {
      entries[vehicleId] = e;
    },
    setFailVehicles: (fail) => {
      failVehicles = fail;
    },
    setFailEntries: (vehicleId, fail) => {
      if (fail) failEntries.add(vehicleId);
      else failEntries.delete(vehicleId);
    },
  };
}

test('a failed first load leaves status error with no data', async () => {
  const stub = createStubDeps();
  stub.setFailVehicles(true);
  const store = createDataStore(stub.deps);

  await store.retryVehicles();

  const { vehicles } = store.getState();
  assert.equal(vehicles.status, 'error');
  assert.equal(vehicles.data, null);
  assert.ok(vehicles.error);
});

test('a failed refresh over ready data keeps the data and rides the error alongside it', async () => {
  const v1 = vehicleFixture('v1');
  const stub = createStubDeps({ vehicles: [v1] });
  const store = createDataStore(stub.deps);

  await store.retryVehicles();
  assert.equal(store.getState().vehicles.status, 'ready');

  stub.setFailVehicles(true);
  await store.retryVehicles();

  const { vehicles } = store.getState();
  assert.equal(vehicles.status, 'ready');
  assert.deepEqual(vehicles.data, [v1]);
  assert.equal(vehicles.refreshing, false);
  assert.ok(vehicles.error);
});

test('reopening a slice that failed to refresh reloads it, and success clears the error', async () => {
  const v1 = vehicleFixture('v1');
  const stub = createStubDeps({ vehicles: [v1] });
  const store = createDataStore(stub.deps);

  await store.retryVehicles();
  stub.setFailVehicles(true);
  await store.retryVehicles();
  assert.ok(store.getState().vehicles.error);

  stub.setFailVehicles(false);
  const release = store.retainVehicles();
  await flush();

  const { vehicles } = store.getState();
  assert.equal(vehicles.status, 'ready');
  assert.equal(vehicles.error, null);
  assert.deepEqual(vehicles.data, [v1]);
  release();
});

test('removeVehicle repoints the selection: a bystander, the selected one, and the last one', async () => {
  const v1 = vehicleFixture('v1');
  const v2 = vehicleFixture('v2');
  const v3 = vehicleFixture('v3');
  const stub = createStubDeps({ vehicles: [v1, v2, v3] });
  const store = createDataStore(stub.deps);

  await store.retryVehicles();
  store.setSelectedVehicleId('v2');

  // Deleting a vehicle that isn't selected leaves the selection alone.
  await store.removeVehicle('v3');
  assert.equal(store.getState().selectedVehicleId, 'v2');
  assert.deepEqual(store.getState().vehicles.data?.map((v) => v.id), ['v1', 'v2']);

  // Deleting the selected vehicle repoints to the first of what remains.
  await store.removeVehicle('v2');
  assert.equal(store.getState().selectedVehicleId, 'v1');
  assert.deepEqual(store.getState().vehicles.data?.map((v) => v.id), ['v1']);

  // Deleting the last remaining (and selected) vehicle clears the selection.
  await store.removeVehicle('v1');
  assert.equal(store.getState().selectedVehicleId, null);
  assert.deepEqual(store.getState().vehicles.data, []);
});

test('deleting a vehicle drops its entries slice, and a fetch already in flight cannot recreate it', async () => {
  const v1 = vehicleFixture('v1');
  const stub = createStubDeps({ vehicles: [v1], entries: { v1: [] } });

  // A plain `let` reassigned inside the executor below loses its narrowed,
  // non-null type across the `await`s that follow (a known TS CFA limit for
  // closure-captured variables); a holder object sidesteps it.
  const entriesFetch: { release: ((entries: FuelEntry[]) => void) | null } = { release: null };
  const deps: DataStoreDeps = {
    ...stub.deps,
    getFuelEntriesByVehicle: () =>
      new Promise<FuelEntry[]>((resolve) => {
        entriesFetch.release = resolve;
      }),
  };
  const store = createDataStore(deps);

  await store.retryVehicles();
  const release = store.retainEntries('v1');
  await flush();
  assert.ok(entriesFetch.release, 'expected the entries fetch to be in flight');

  await store.removeVehicle('v1');
  assert.equal(store.getState().entries.v1, undefined, 'the slice should be dropped immediately');

  // The fetch that started before the delete resolves late -- too late to matter.
  entriesFetch.release([
    {
      id: 'stale',
      vehicleId: 'v1',
      date: 0,
      odometer: 0,
      litresFilled: 0,
      pricePerLitre: 0,
      totalCost: 0,
      isTankFull: true,
      notes: null,
      createdAt: 0,
    },
  ]);
  await flush();
  assert.equal(
    store.getState().entries.v1,
    undefined,
    'a stale in-flight fetch must not recreate the dropped slice'
  );

  release();
});

test('a stale response cannot overwrite what a later request already committed', async () => {
  const stub = createStubDeps({ vehicles: [] });
  const resolvers: Array<(vehicles: Vehicle[]) => void> = [];
  const deps: DataStoreDeps = {
    ...stub.deps,
    getVehicles: () =>
      new Promise((resolve) => {
        resolvers.push(resolve);
      }),
  };
  const store = createDataStore(deps);

  const first = store.retryVehicles();
  await flush();
  const second = store.retryVehicles();
  await flush();
  assert.equal(resolvers.length, 2, 'both requests should be in flight');

  // The second (later) request resolves first; the first (now stale) request
  // resolves after it -- its result must be discarded.
  resolvers[1]([vehicleFixture('current')]);
  await second;
  resolvers[0]([vehicleFixture('stale')]);
  await first;

  assert.deepEqual(store.getState().vehicles.data?.map((v) => v.id), ['current']);
});

test('mutations run one at a time, in the order they were called', async () => {
  const stub = createStubDeps({ vehicles: [] });
  let addCalls = 0;
  const firstAdd: { release: (() => void) | null } = { release: null };
  const deps: DataStoreDeps = {
    ...stub.deps,
    addVehicle: async (data) => {
      addCalls += 1;
      if (addCalls === 1) {
        await new Promise<void>((resolve) => {
          firstAdd.release = resolve;
        });
      }
      return stub.deps.addVehicle(data);
    },
  };
  const store = createDataStore(deps);
  // Invalidation only reloads a slice that has a live subscriber; retain it
  // so the two mutations' effects actually land in `vehicles.data` below.
  const release = store.retainVehicles();
  await flush();

  const first = store.createVehicle({ ...NEW_VEHICLE, name: 'A' });
  await flush();
  assert.equal(addCalls, 1, 'the first mutation should have started');

  const second = store.createVehicle({ ...NEW_VEHICLE, name: 'B' });
  await flush();
  assert.equal(
    addCalls,
    1,
    "the second mutation must wait for the first to finish, not run alongside it"
  );

  assert.ok(firstAdd.release, 'expected the first mutation to be in flight');
  firstAdd.release();
  await first;
  await flush();
  assert.equal(addCalls, 2, 'the second mutation starts only once the first has fully resolved');
  await second;

  assert.deepEqual(store.getState().vehicles.data?.map((v) => v.name), ['A', 'B']);
  release();
});

test('retryInit: init failure gives db.status error', async () => {
  const stub = createStubDeps();
  const deps: DataStoreDeps = {
    ...stub.deps,
    initDatabase: async () => {
      throw new Error('open failed');
    },
  };
  const store = createDataStore(deps);

  await store.retryInit();

  const { db } = store.getState();
  assert.equal(db.status, 'error');
  assert.ok(db.error);
});

test('retryInit: success gives ready and refetches live slices that were in error', async () => {
  const v1 = vehicleFixture('v1');
  const stub = createStubDeps({ vehicles: [v1], entries: { v1: [] } });
  let failInit = true;
  const deps: DataStoreDeps = {
    ...stub.deps,
    initDatabase: async () => {
      if (failInit) throw new Error('open failed');
    },
  };
  const store = createDataStore(deps);

  // Fail first, with live subscribers on both slices, so both land in 'error'.
  const releaseVehicles = store.retainVehicles();
  const releaseEntries = store.retainEntries('v1');
  await flush();
  assert.equal(store.getState().db.status, 'error');
  assert.equal(store.getState().vehicles.status, 'error');
  assert.equal(store.getState().entries.v1?.status, 'error');

  failInit = false;
  await store.retryInit();

  const state = store.getState();
  assert.equal(state.db.status, 'ready');
  assert.equal(state.vehicles.status, 'ready');
  assert.deepEqual(state.vehicles.data, [v1]);
  assert.equal(state.entries.v1?.status, 'ready');

  releaseVehicles();
  releaseEntries();
});

test('retryInit: a retry that fails again stays error', async () => {
  const stub = createStubDeps();
  const deps: DataStoreDeps = {
    ...stub.deps,
    initDatabase: async () => {
      throw new Error('still broken');
    },
  };
  const store = createDataStore(deps);

  await store.retryInit();
  assert.equal(store.getState().db.status, 'error');

  await store.retryInit();
  assert.equal(store.getState().db.status, 'error');
});

test('retryInit: a double retry while initializing runs init once', async () => {
  const stub = createStubDeps();
  let initCalls = 0;
  const release: { fn: (() => void) | null } = { fn: null };
  const deps: DataStoreDeps = {
    ...stub.deps,
    initDatabase: () =>
      new Promise<void>((resolve) => {
        initCalls += 1;
        release.fn = resolve;
      }),
  };
  const store = createDataStore(deps);

  const first = store.retryInit();
  await flush();
  assert.equal(store.getState().db.status, 'initializing');

  const second = store.retryInit();
  assert.equal(initCalls, 1, 'the second retryInit call must not start a second init');

  assert.ok(release.fn, 'expected the first init to be in flight');
  release.fn();
  await first;
  await second;

  assert.equal(store.getState().db.status, 'ready');
  assert.equal(initCalls, 1);
});

test('resetAll clears every slice as soon as it resolves', async () => {
  const v1 = vehicleFixture('v1');
  const stub = createStubDeps({ vehicles: [v1], entries: { v1: [] } });
  const store = createDataStore(stub.deps);

  await store.retryVehicles();
  await store.retryEntries('v1');
  store.setSelectedVehicleId('v1');

  await store.resetAll();

  const state = store.getState();
  assert.equal(state.vehicles.status, 'ready');
  assert.deepEqual(state.vehicles.data, []);
  assert.deepEqual(state.entries, {});
  assert.equal(state.selectedVehicleId, null);
});
