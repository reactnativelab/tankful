import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppSettings, DistanceUnit, ThemeOverride, VehicleBudget } from '@/types';
import {
  DEFAULT_SETTINGS,
  parseStoredSettings,
  sanitizeBudgetAmount,
  serializeSettings,
} from '@/utils/settingsSchema';

// The settings types live in @/types (one canonical definition, usable from
// the pure domain layer); re-exported here because screens and components
// already import them from this module.
export type { DistanceUnit, ThemeOverride, VehicleBudget } from '@/types';

interface SettingsContextValue extends AppSettings {
  /** False until the AsyncStorage-persisted settings have loaded (or a first-launch read has resolved to defaults). */
  settingsLoaded: boolean;
  setCurrencySymbol: (symbol: string) => void;
  setDistanceUnit: (unit: DistanceUnit) => void;
  setThemeOverride: (override: ThemeOverride) => void;
  setHasSeenOnboarding: (seen: boolean) => void;
  /** Passing null clears the vehicle's budget entirely. */
  setVehicleBudget: (vehicleId: string, budget: VehicleBudget | null) => void;
  /** Drops every vehicle's budget in one write -- Delete All's counterpart to wiping the vehicles themselves. */
  clearAllVehicleBudgets: () => void;
  setInsightsEnabled: (enabled: boolean) => void;
  dismissBudgetPrompt: () => void;
}

const STORAGE_KEY = 'tankful:settings';

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * Renders with hardcoded defaults immediately, then swaps in the
 * AsyncStorage-persisted values once the async load resolves (a one-frame
 * flash is an acceptable tradeoff here). `settingsLoaded` lets callers that
 * need the real hasSeenOnboarding/theme value (onboarding routing, theme
 * resolution) wait for that swap instead of briefly acting on defaults.
 *
 * Everything read back off the device goes through utils/settingsSchema
 * first: the stored blob was written by some build of the app, not
 * necessarily this one, and a bad value in it would otherwise land straight
 * in live state.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  /** Keys written by another build, carried through every save untouched. */
  const unknownKeys = useRef<Record<string, unknown>>({});

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        const { settings: stored, unknown } = parseStoredSettings(raw);
        unknownKeys.current = unknown;
        setSettings(stored);
      })
      .catch((error) => {
        // A failed read leaves the defaults in place: the app stays usable,
        // and nothing is written back over whatever is on disk.
        console.error('Failed to load settings', error);
      })
      .finally(() => {
        if (!cancelled) setSettingsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, serializeSettings(next, unknownKeys.current)).catch(
        (error) => {
          console.error('Failed to save settings', error);
        }
      );
      return next;
    });
  }, []);

  const setCurrencySymbol = useCallback(
    (currencySymbol: string) => update({ currencySymbol }),
    [update]
  );
  const setDistanceUnit = useCallback(
    (distanceUnit: DistanceUnit) => update({ distanceUnit }),
    [update]
  );
  const setThemeOverride = useCallback(
    (themeOverride: ThemeOverride) => update({ themeOverride }),
    [update]
  );
  const setHasSeenOnboarding = useCallback(
    (hasSeenOnboarding: boolean) => update({ hasSeenOnboarding }),
    [update]
  );
  const setInsightsEnabled = useCallback(
    (insightsEnabled: boolean) => update({ insightsEnabled }),
    [update]
  );
  const dismissBudgetPrompt = useCallback(
    () => update({ budgetPromptDismissed: true }),
    [update]
  );
  const clearAllVehicleBudgets = useCallback(() => update({ vehicleBudgets: {} }), [update]);

  const setVehicleBudget = useCallback(
    (vehicleId: string, budget: VehicleBudget | null) => {
      setSettings((prev) => {
        const vehicleBudgets = { ...prev.vehicleBudgets };
        const amount = budget ? sanitizeBudgetAmount(budget.amount) : null;
        if (!budget || amount === null) {
          delete vehicleBudgets[vehicleId];
        } else {
          vehicleBudgets[vehicleId] = { amount, enabled: budget.enabled };
        }
        const next = { ...prev, vehicleBudgets };
        AsyncStorage.setItem(STORAGE_KEY, serializeSettings(next, unknownKeys.current)).catch(
          (error) => {
            console.error('Failed to save settings', error);
          }
        );
        return next;
      });
    },
    []
  );

  const value = useMemo<SettingsContextValue>(
    () => ({
      ...settings,
      settingsLoaded,
      setCurrencySymbol,
      setDistanceUnit,
      setThemeOverride,
      setHasSeenOnboarding,
      setVehicleBudget,
      clearAllVehicleBudgets,
      setInsightsEnabled,
      dismissBudgetPrompt,
    }),
    [
      settings,
      settingsLoaded,
      setCurrencySymbol,
      setDistanceUnit,
      setThemeOverride,
      setHasSeenOnboarding,
      setVehicleBudget,
      clearAllVehicleBudgets,
      setInsightsEnabled,
      dismissBudgetPrompt,
    ]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return ctx;
}
