export type VehicleType = 'bike' | 'car' | 'other';

export type FuelType = 'petrol' | 'diesel' | 'cng';

export interface Vehicle {
  id: string;
  name: string;
  type: VehicleType;
  fuelType: FuelType;
  plate: string | null;
  createdAt: number;
}

export type NewVehicle = Omit<Vehicle, 'id' | 'createdAt'>;

export type VehicleUpdate = Partial<NewVehicle>;

export interface FuelEntry {
  id: string;
  vehicleId: string;
  date: number;
  odometer: number;
  litresFilled: number;
  pricePerLitre: number;
  totalCost: number;
  isTankFull: boolean;
  notes: string | null;
  createdAt: number;
}

export type NewFuelEntry = Omit<FuelEntry, 'id' | 'createdAt' | 'totalCost'> & {
  totalCost?: number;
};

export type FuelEntryUpdate = Partial<Omit<FuelEntry, 'id' | 'createdAt'>>;

export type DistanceUnit = 'km' | 'mi';

export type FuelUnit = 'L';

export type ThemeOverride = 'system' | 'light' | 'dark';

/**
 * A vehicle's monthly fuel budget. `enabled` is kept separate from `amount`
 * so turning the budget off doesn't lose the figure the user set.
 */
export interface VehicleBudget {
  amount: number;
  enabled: boolean;
}

/**
 * Everything persisted under the single AsyncStorage settings key. This is the
 * canonical shape -- SettingsProvider stores exactly this, and
 * utils/settingsSchema validates anything read back off the device against it.
 */
export interface AppSettings {
  currencySymbol: string;
  distanceUnit: DistanceUnit;
  fuelUnit: FuelUnit;
  themeOverride: ThemeOverride;
  hasSeenOnboarding: boolean;
  /**
   * Monthly fuel budgets keyed by vehicle id. Budgets are per vehicle, not
   * global, because every figure they are shown next to (this month's spend,
   * the forecast, the report) is scoped to the selected vehicle -- a global
   * budget beside one vehicle's spend would read as a false "remaining".
   */
  vehicleBudgets: Record<string, VehicleBudget>;
  /** Home's "set a monthly budget" nudge stays dismissed once dismissed. */
  budgetPromptDismissed: boolean;
  /** Master switch for the derived intelligence surfaces (insights, forecast, records). */
  insightsEnabled: boolean;
}
