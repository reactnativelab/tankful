import { useCallback, useEffect, useState } from 'react';
import { getVehicleById } from '@/db/vehicles';
import { useVehicleActions } from '@/hooks/useVehicleActions';
import type { FuelType, VehicleType } from '@/types';

export interface VehicleFieldErrors {
  name: string | null;
}

const NO_FIELD_ERRORS: VehicleFieldErrors = { name: null };

/**
 * Form state + validation for the Add/Edit Vehicle modal. With a vehicleId
 * it loads and pre-fills that vehicle and saves via useVehicleActions.updateVehicle;
 * without one it's create mode and saves via useVehicleActions.createVehicle,
 * which also keeps the shared selected vehicle in sync.
 */
export function useVehicleForm(vehicleId: string | null) {
  const { createVehicle, updateVehicle } = useVehicleActions();

  const [name, setName] = useState('');
  const [type, setType] = useState<VehicleType>('car');
  const [fuelType, setFuelType] = useState<FuelType>('petrol');
  const [plate, setPlate] = useState('');

  const [loading, setLoading] = useState(vehicleId !== null);
  // Edit mode only: true once getVehicleById has actually populated the form,
  // so Save can be disabled otherwise -- an unresolved or failed load would
  // otherwise let Save overwrite the vehicle's real name/type/fuel/plate with
  // the form's untouched defaults.
  const [loaded, setLoaded] = useState(vehicleId === null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
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
    setLoadError(null);
    getVehicleById(vehicleId)
      .then((vehicle) => {
        if (cancelled) return;
        if (!vehicle) {
          setLoadError("This vehicle couldn't be found.");
          return;
        }
        setName(vehicle.name);
        setType(vehicle.type);
        setFuelType(vehicle.fuelType);
        setPlate(vehicle.plate ?? '');
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't load this vehicle. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [vehicleId, loadAttempt]);

  const retryLoad = useCallback(() => setLoadAttempt((n) => n + 1), []);

  const submit = useCallback(async (): Promise<boolean> => {
    // Edit mode with a load that never succeeded: saving now would write the
    // form's untouched defaults over the vehicle's real fields.
    if (vehicleId && !loaded) return false;

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
  }, [vehicleId, loaded, name, type, fuelType, plate, createVehicle, updateVehicle]);

  return {
    loading,
    /** Edit mode only. True once the vehicle has actually loaded -- gate Save on this, not just !loading. */
    loaded,
    loadError,
    retryLoad,
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
