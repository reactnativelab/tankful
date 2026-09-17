import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DistanceUnit = 'km' | 'mi';

interface StoredSettings {
  currencySymbol: string;
  distanceUnit: DistanceUnit;
  fuelUnit: 'L';
}

interface SettingsContextValue extends StoredSettings {
  setCurrencySymbol: (symbol: string) => void;
  setDistanceUnit: (unit: DistanceUnit) => void;
}

const STORAGE_KEY = 'tankful:settings';

const DEFAULT_SETTINGS: StoredSettings = {
  currencySymbol: '₹',
  distanceUnit: 'km',
  fuelUnit: 'L',
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * Same shape as SelectedVehicleProvider: renders with hardcoded defaults
 * immediately, then swaps in the AsyncStorage-persisted values once the
 * async load resolves (a one-frame flash is an acceptable tradeoff here).
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<StoredSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        setSettings((prev) => ({ ...prev, ...JSON.parse(raw) }));
      })
      .catch((error) => {
        console.error('Failed to load settings', error);
      });
  }, []);

  const persist = useCallback((next: StoredSettings) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((error) => {
      console.error('Failed to save settings', error);
    });
  }, []);

  const setCurrencySymbol = useCallback(
    (currencySymbol: string) => {
      setSettings((prev) => {
        const next = { ...prev, currencySymbol };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const setDistanceUnit = useCallback(
    (distanceUnit: DistanceUnit) => {
      setSettings((prev) => {
        const next = { ...prev, distanceUnit };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return (
    <SettingsContext.Provider
      value={{ ...settings, setCurrencySymbol, setDistanceUnit }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return ctx;
}
