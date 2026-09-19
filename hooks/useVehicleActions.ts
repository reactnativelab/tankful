import {
  createVehicle,
  removeVehicle,
  resetAll,
  updateVehicle,
} from '@/store/dataStore';

/**
 * The vehicle mutations, as a hook for call-site compatibility. They live in
 * the store, which serializes them and keeps the shared vehicle list,
 * entries and selected vehicle consistent (add-the-first-one,
 * delete-the-selected-one, delete-everything).
 */
export function useVehicleActions() {
  return { createVehicle, updateVehicle, removeVehicle, resetAll };
}
