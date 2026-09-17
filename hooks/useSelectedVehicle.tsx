import { createContext, ReactNode, useContext, useState } from 'react';

interface SelectedVehicleContextValue {
  selectedVehicleId: string | null;
  setSelectedVehicleId: (id: string | null) => void;
}

const SelectedVehicleContext = createContext<SelectedVehicleContextValue | null>(
  null
);

/**
 * Holds the vehicle id selected via VehicleSelector so Dashboard and History
 * (and any other tab) stay in sync instead of tracking selection independently.
 */
export function SelectedVehicleProvider({ children }: { children: ReactNode }) {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  return (
    <SelectedVehicleContext.Provider
      value={{ selectedVehicleId, setSelectedVehicleId }}
    >
      {children}
    </SelectedVehicleContext.Provider>
  );
}

export function useSelectedVehicle(): SelectedVehicleContextValue {
  const ctx = useContext(SelectedVehicleContext);
  if (!ctx) {
    throw new Error(
      'useSelectedVehicle must be used within a SelectedVehicleProvider'
    );
  }
  return ctx;
}
