import type { AppSettings, DistanceUnit, ThemeOverride, VehicleBudget } from '@/types';

/**
 * Validation for the persisted settings blob.
 *
 * Settings come back off the device as untyped JSON that an older (or newer,
 * or interrupted) build wrote, so nothing in it can be trusted: the provider
 * used to spread it straight over the defaults, which would happily install
 * `distanceUnit: 42` or a budget of NaN into live state. Everything here is
 * pure so the upgrade/downgrade/corruption cases are unit-testable.
 */

export const DEFAULT_SETTINGS: AppSettings = {
  currencySymbol: '₹',
  distanceUnit: 'km',
  fuelUnit: 'L',
  themeOverride: 'system',
  hasSeenOnboarding: false,
  vehicleBudgets: {},
  budgetPromptDismissed: false,
  insightsEnabled: true,
};

/** Matches the Settings screen's input cap; also stops a pasted essay reaching the UI. */
export const MAX_CURRENCY_SYMBOL_LENGTH = 6;

/**
 * Upper bound for a monthly budget. Not a product limit so much as a sanity
 * one: past this, a typo stops being a budget and starts being a layout
 * problem, and every percentage against it rounds to 0%.
 */
export const MAX_BUDGET_AMOUNT = 100_000_000;

const DISTANCE_UNITS: DistanceUnit[] = ['km', 'mi'];
const THEME_OVERRIDES: ThemeOverride[] = ['system', 'light', 'dark'];

const KNOWN_KEYS: (keyof AppSettings)[] = [
  'currencySymbol',
  'distanceUnit',
  'fuelUnit',
  'themeOverride',
  'hasSeenOnboarding',
  'vehicleBudgets',
  'budgetPromptDismissed',
  'insightsEnabled',
];

/** Control characters: they would break the share text and the CSV export. */
const CONTROL_CHARACTERS = /[\p{Cc}]/gu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function pickCurrencySymbol(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_SETTINGS.currencySymbol;
  const cleaned = value.replace(CONTROL_CHARACTERS, '').trim();
  if (cleaned === '') return DEFAULT_SETTINGS.currencySymbol;
  return cleaned.slice(0, MAX_CURRENCY_SYMBOL_LENGTH);
}

/** Clamps to [0, MAX_BUDGET_AMOUNT]; anything non-finite or negative is not a budget. */
export function sanitizeBudgetAmount(value: unknown): number | null {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.min(amount, MAX_BUDGET_AMOUNT);
}

function pickVehicleBudgets(value: unknown): Record<string, VehicleBudget> {
  if (!isRecord(value)) return {};
  const budgets: Record<string, VehicleBudget> = {};
  for (const [vehicleId, raw] of Object.entries(value)) {
    if (vehicleId === '' || !isRecord(raw)) continue;
    const amount = sanitizeBudgetAmount(raw.amount);
    if (amount === null) continue;
    budgets[vehicleId] = { amount, enabled: pickBoolean(raw.enabled, amount > 0) };
  }
  return budgets;
}

export interface NormalizedSettings {
  settings: AppSettings;
  /**
   * Keys the running build doesn't know about, kept verbatim. A newer build's
   * settings survive a downgrade-and-run instead of being silently erased the
   * first time this one saves.
   */
  unknown: Record<string, unknown>;
}

/** Accepts anything (a parsed blob, undefined, a string, junk) and returns usable settings. */
export function normalizeSettings(raw: unknown): NormalizedSettings {
  if (!isRecord(raw)) {
    return { settings: { ...DEFAULT_SETTINGS }, unknown: {} };
  }

  const distanceUnit = DISTANCE_UNITS.find((unit) => unit === raw.distanceUnit);
  const themeOverride = THEME_OVERRIDES.find((option) => option === raw.themeOverride);

  const settings: AppSettings = {
    currencySymbol: pickCurrencySymbol(raw.currencySymbol),
    distanceUnit: distanceUnit ?? DEFAULT_SETTINGS.distanceUnit,
    // Litres is the only fuel unit Tankful stores in; the field exists for
    // forward compatibility, so anything else falls back rather than sticking.
    fuelUnit: raw.fuelUnit === 'L' ? 'L' : DEFAULT_SETTINGS.fuelUnit,
    themeOverride: themeOverride ?? DEFAULT_SETTINGS.themeOverride,
    hasSeenOnboarding: pickBoolean(raw.hasSeenOnboarding, DEFAULT_SETTINGS.hasSeenOnboarding),
    vehicleBudgets: pickVehicleBudgets(raw.vehicleBudgets),
    budgetPromptDismissed: pickBoolean(
      raw.budgetPromptDismissed,
      DEFAULT_SETTINGS.budgetPromptDismissed
    ),
    insightsEnabled: pickBoolean(raw.insightsEnabled, DEFAULT_SETTINGS.insightsEnabled),
  };

  const unknown: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!(KNOWN_KEYS as string[]).includes(key)) unknown[key] = value;
  }

  return { settings, unknown };
}

/** Parses the stored string form. A corrupt blob normalizes to defaults rather than throwing. */
export function parseStoredSettings(raw: string | null): NormalizedSettings {
  if (raw === null) return { settings: { ...DEFAULT_SETTINGS }, unknown: {} };
  try {
    return normalizeSettings(JSON.parse(raw) as unknown);
  } catch {
    return { settings: { ...DEFAULT_SETTINGS }, unknown: {} };
  }
}

export function serializeSettings(settings: AppSettings, unknown: Record<string, unknown>): string {
  return JSON.stringify({ ...unknown, ...settings });
}

/** The budget for one vehicle, or null when it has none / it is switched off / it is zero. */
export function getVehicleBudget(
  budgets: Record<string, VehicleBudget>,
  vehicleId: string | null
): VehicleBudget | null {
  if (!vehicleId) return null;
  const budget = budgets[vehicleId];
  if (!budget || !budget.enabled || budget.amount <= 0) return null;
  return budget;
}
