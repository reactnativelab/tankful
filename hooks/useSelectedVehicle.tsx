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
