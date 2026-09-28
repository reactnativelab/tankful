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
import { createDataStore } from './createDataStore';

export type {
  DataStore,
  DataStoreDeps,
  DbState,
  Resource,
  ResourceStatus,
  StoreState,
} from './createDataStore';
export { IDLE_RESOURCE } from './createDataStore';

/**
 * The app's one store instance, wired to the real @/db modules. The store's
 * own logic (createDataStore) knows nothing about SQLite; this is the only
 * file that connects the two. Tests build their own instance directly from
 * createDataStore with stub deps instead of importing this module.
 */
const store = createDataStore({
  initDatabase,
  resetAllData,
  getVehicles,
  addVehicle,
  updateVehicle: updateVehicleRow,
  deleteVehicle,
  getFuelEntriesByVehicle,
  addFuelEntry,
  deleteFuelEntry,
  isOdometerValidationError: (error) => error instanceof OdometerValidationError,
});

export const getState = store.getState;
export const subscribe = store.subscribe;
export const retainVehicles = store.retainVehicles;
export const retainEntries = store.retainEntries;
export const retryVehicles = store.retryVehicles;
export const retryEntries = store.retryEntries;
export const setSelectedVehicleId = store.setSelectedVehicleId;
export const createVehicle = store.createVehicle;
export const updateVehicle = store.updateVehicle;
export const removeVehicle = store.removeVehicle;
export const addEntry = store.addEntry;
export const removeEntry = store.removeEntry;
export const resetAll = store.resetAll;
