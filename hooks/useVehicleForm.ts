import { useCallback, useEffect, useState } from 'react';
import { getVehicleById, updateVehicle } from '@/db/vehicles';
import { useVehicleActions } from '@/hooks/useVehicleActions';
import type { FuelType, VehicleType } from '@/types';

export interface VehicleFieldErrors {
  name: string | null;
}

const NO_FIELD_ERRORS: VehicleFieldErrors = { name: null };

/**
 * Form state + validation for the Add/Edit Vehicle modal. With a vehicleId
 * it loads and pre-fills that vehicle and saves via updateVehicle; without
 * one it's create mode and saves via useVehicleActions.createVehicle, which
 * also keeps the shared selected vehicle in sync.
 */
export function useVehicleForm(vehicleId: string | null) {
  const { createVehicle } = useVehicleActions();

  const [name, setName] = useState('');
  const [type, setType] = useState<VehicleType>('car');
  const [fuelType, setFuelType] = useState<FuelType>('petrol');
  const [plate, setPlate] = useState('');

  const [loading, setLoading] = useState(vehicleId !== null);
  const [fieldErrors, setFieldErrors] = useState<VehicleFieldErrors>(NO_FIELD_ERRORS);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!vehicleId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    getVehicleById(vehicleId)
      .then((vehicle) => {
        if (cancelled || !vehicle) return;
        setName(vehicle.name);
        setType(vehicle.type);
        setFuelType(vehicle.fuelType);
        setPlate(vehicle.plate ?? '');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  const submit = useCallback(async (): Promise<boolean> => {
    setSubmitError(null);

    const trimmedName = name.trim();
    setFieldErrors({ name: trimmedName === '' ? 'Enter a vehicle name' : null });
    if (trimmedName === '') return false;

    const trimmedPlate = plate.trim();

    setSubmitting(true);
    try {
      if (vehicleId) {
        await updateVehicle(vehicleId, {
          name: trimmedName,
          type,
          fuelType,
          plate: trimmedPlate === '' ? null : trimmedPlate,
        });
      } else {
        await createVehicle({
          name: trimmedName,
          type,
          fuelType,
          plate: trimmedPlate === '' ? null : trimmedPlate,
        });
      }
      return true;
    } catch {
      setSubmitError('Something went wrong saving this vehicle. Please try again.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [vehicleId, name, type, fuelType, plate, createVehicle]);

  return {
    loading,
    name,
    setName,
    type,
    setType,
    fuelType,
    setFuelType,
    plate,
    setPlate,
    fieldErrors,
    submitError,
    submitting,
    submit,
  };
}
