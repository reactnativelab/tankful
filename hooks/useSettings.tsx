import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DistanceUnit = 'km' | 'mi';
export type ThemeOverride = 'system' | 'light' | 'dark';

interface StoredSettings {
  currencySymbol: string;
  distanceUnit: DistanceUnit;
  fuelUnit: 'L';
  themeOverride: ThemeOverride;
  hasSeenOnboarding: boolean;
}

interface SettingsContextValue extends StoredSettings {
  /** False until the AsyncStorage-persisted settings have loaded (or a first-launch read has resolved to defaults). */
  settingsLoaded: boolean;
  setCurrencySymbol: (symbol: string) => void;
  setDistanceUnit: (unit: DistanceUnit) => void;
  setThemeOverride: (override: ThemeOverride) => void;
  setHasSeenOnboarding: (seen: boolean) => void;
}

const STORAGE_KEY = 'tankful:settings';

const DEFAULT_SETTINGS: StoredSettings = {
  currencySymbol: '₹',
  distanceUnit: 'km',
  fuelUnit: 'L',
  themeOverride: 'system',
  hasSeenOnboarding: false,
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * Same shape as SelectedVehicleProvider: renders with hardcoded defaults
 * immediately, then swaps in the AsyncStorage-persisted values once the
 * async load resolves (a one-frame flash is an acceptable tradeoff here).
 * `settingsLoaded` lets callers that need the real hasSeenOnboarding/theme
 * value (onboarding routing, theme resolution) wait for that swap instead
 * of briefly acting on defaults.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<StoredSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          setSettings((prev) => ({ ...prev, ...JSON.parse(raw) }));
        }
      })
      .catch((error) => {
        console.error('Failed to load settings', error);
      })
      .finally(() => {
        setSettingsLoaded(true);
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

  const setThemeOverride = useCallback(
    (themeOverride: ThemeOverride) => {
      setSettings((prev) => {
        const next = { ...prev, themeOverride };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const setHasSeenOnboarding = useCallback(
    (hasSeenOnboarding: boolean) => {
      setSettings((prev) => {
        const next = { ...prev, hasSeenOnboarding };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return (
    <SettingsContext.Provider
      value={{
        ...settings,
        settingsLoaded,
        setCurrencySymbol,
        setDistanceUnit,
        setThemeOverride,
        setHasSeenOnboarding,
      }}
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
