import { useEffect } from 'react';
import { useDataStore } from '@/hooks/useDataStore';
import { retainVehicles, retryVehicles } from '@/store/dataStore';
import type { Vehicle } from '@/types';

const NO_VEHICLES: Vehicle[] = [];

/**
 * Vehicle list from the shared store. The store refetches it after every
 * vehicle mutation while any screen is mounted, so there is no focus refetch.
 * `error` is set when the read failed -- screens must show it instead of the
 * "no vehicles" empty state, which would otherwise be a lie.
 */
export function useVehicles() {
  useEffect(() => retainVehicles(), []);
  const resource = useDataStore((s) => s.vehicles);

  return {
    vehicles: resource.data ?? NO_VEHICLES,
    loading: resource.status === 'idle' || resource.status === 'loading',
    error: resource.error,
    retry: retryVehicles,
  };
}
