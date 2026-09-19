import { ReactNode } from 'react';
import { useDataStore } from '@/hooks/useDataStore';
import { setSelectedVehicleId } from '@/store/dataStore';

interface SelectedVehicleValue {
  selectedVehicleId: string | null;
  setSelectedVehicleId: (id: string | null) => void;
}

/**
 * The selected vehicle id (set via VehicleSelector) lives in the data store so
 * the store's own actions can repoint it -- e.g. when the selected vehicle is
 * deleted. Dashboard, History and any other tab still share it.
 */
export function useSelectedVehicle(): SelectedVehicleValue {
  const selectedVehicleId = useDataStore((s) => s.selectedVehicleId);
  return { selectedVehicleId, setSelectedVehicleId };
}

/**
 * No-op now that selection lives in the store. Kept so app/_layout.tsx doesn't
 * change in this commit (it's BOOT-001's file); drop it there.
 */
export function SelectedVehicleProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
