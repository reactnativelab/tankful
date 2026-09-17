import { useCallback } from 'react';
import { addVehicle, deleteVehicle, getVehicles } from '@/db/vehicles';
import { useSelectedVehicle } from '@/hooks/useSelectedVehicle';
import type { NewVehicle, Vehicle } from '@/types';

/**
 * Wraps the two vehicle mutations that can invalidate the shared selected
 * vehicle (add-the-first-one, delete-the-selected-one) so that fix-up lives
 * in one place instead of being re-implemented in every screen that calls
 * addVehicle/deleteVehicle.
 */
export function useVehicleActions() {
  const { selectedVehicleId, setSelectedVehicleId } = useSelectedVehicle();

  const createVehicle = useCallback(
    async (data: NewVehicle): Promise<Vehicle> => {
      const existing = await getVehicles();
      const vehicle = await addVehicle(data);
      if (existing.length === 0) {
        setSelectedVehicleId(vehicle.id);
      }
      return vehicle;
    },
    [setSelectedVehicleId]
  );

  const removeVehicle = useCallback(
    async (id: string): Promise<void> => {
      await deleteVehicle(id);
      if (selectedVehicleId === id) {
        const remaining = await getVehicles();
        setSelectedVehicleId(remaining[0]?.id ?? null);
      }
    },
    [selectedVehicleId, setSelectedVehicleId]
  );

  return { createVehicle, removeVehicle };
}
