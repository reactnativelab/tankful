import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  DEFAULT_SETTINGS,
  MAX_BUDGET_AMOUNT,
  getVehicleBudget,
  normalizeSettings,
  parseStoredSettings,
  sanitizeBudgetAmount,
  serializeSettings,
} from '../settingsSchema';

test('a fresh install gets the defaults', () => {
  const { settings, unknown } = parseStoredSettings(null);
  assert.deepEqual(settings, DEFAULT_SETTINGS);
  assert.deepEqual(unknown, {});
});

test('an existing install without the new fields keeps its old choices', () => {
  const stored = JSON.stringify({
    currencySymbol: '$',
    distanceUnit: 'mi',
    fuelUnit: 'L',
    themeOverride: 'dark',
    hasSeenOnboarding: true,
  });
  const { settings } = parseStoredSettings(stored);
  assert.equal(settings.currencySymbol, '$');
  assert.equal(settings.distanceUnit, 'mi');
  assert.equal(settings.themeOverride, 'dark');
  assert.equal(settings.hasSeenOnboarding, true);
  // New fields fall back to their defaults rather than being undefined.
  assert.deepEqual(settings.vehicleBudgets, {});
  assert.equal(settings.budgetPromptDismissed, false);
  assert.equal(settings.insightsEnabled, true);
});

test('malformed JSON falls back to defaults instead of throwing', () => {
  assert.deepEqual(parseStoredSettings('{not json').settings, DEFAULT_SETTINGS);
  assert.deepEqual(parseStoredSettings('null').settings, DEFAULT_SETTINGS);
  assert.deepEqual(parseStoredSettings('"a string"').settings, DEFAULT_SETTINGS);
  assert.deepEqual(parseStoredSettings('[1,2,3]').settings, DEFAULT_SETTINGS);
});

test('values of the wrong type never reach live state', () => {
  const { settings } = normalizeSettings({
    currencySymbol: 42,
    distanceUnit: 'parsecs',
    fuelUnit: 'gal',
    themeOverride: true,
    hasSeenOnboarding: 'yes',
    insightsEnabled: 0,
    vehicleBudgets: 'none',
  });
  assert.deepEqual(settings, DEFAULT_SETTINGS);
});

test('a currency symbol is trimmed, stripped of control characters and capped', () => {
  assert.equal(normalizeSettings({ currencySymbol: '  Rs.  ' }).settings.currencySymbol, 'Rs.');
  assert.equal(normalizeSettings({ currencySymbol: '\n\t' }).settings.currencySymbol, '₹');
  assert.equal(normalizeSettings({ currencySymbol: '' }).settings.currencySymbol, '₹');
  assert.equal(
    normalizeSettings({ currencySymbol: 'ABCDEFGHIJK' }).settings.currencySymbol,
    'ABCDEF'
  );
  // Multi-character and non-Latin symbols are kept as they are.
  assert.equal(normalizeSettings({ currencySymbol: '₿' }).settings.currencySymbol, '₿');
});

test('budgets are validated per vehicle and bad ones are dropped', () => {
  const { settings } = normalizeSettings({
    vehicleBudgets: {
      good: { amount: 8000, enabled: true },
      offButKept: { amount: 4000, enabled: false },
      negative: { amount: -5, enabled: true },
      notANumber: { amount: 'lots', enabled: true },
      infinite: { amount: Number.POSITIVE_INFINITY, enabled: true },
      notAnObject: 5,
      '': { amount: 100, enabled: true },
    },
  });
  assert.deepEqual(settings.vehicleBudgets, {
    good: { amount: 8000, enabled: true },
    offButKept: { amount: 4000, enabled: false },
  });
});

test('a budget without an enabled flag is on when it has an amount', () => {
  const { settings } = normalizeSettings({ vehicleBudgets: { a: { amount: 500 } } });
  assert.deepEqual(settings.vehicleBudgets.a, { amount: 500, enabled: true });
});

test('budget amounts are clamped to the sane maximum', () => {
  assert.equal(sanitizeBudgetAmount(MAX_BUDGET_AMOUNT * 10), MAX_BUDGET_AMOUNT);
  assert.equal(sanitizeBudgetAmount('2500'), 2500);
  assert.equal(sanitizeBudgetAmount('abc'), null);
  assert.equal(sanitizeBudgetAmount(-1), null);
  assert.equal(sanitizeBudgetAmount(Number.NaN), null);
  assert.equal(sanitizeBudgetAmount(0), 0);
});

test('unknown keys from another build survive a save', () => {
  const stored = JSON.stringify({ currencySymbol: '$', futureFeature: { on: true } });
  const { settings, unknown } = parseStoredSettings(stored);
  assert.deepEqual(unknown, { futureFeature: { on: true } });

  const written = JSON.parse(serializeSettings(settings, unknown));
  assert.deepEqual(written.futureFeature, { on: true });
  assert.equal(written.currencySymbol, '$');
});

test('a round trip through storage is stable', () => {
  const first = parseStoredSettings(null);
  const written = serializeSettings(
    { ...first.settings, vehicleBudgets: { a: { amount: 8000, enabled: true } } },
    first.unknown
  );
  const second = parseStoredSettings(written);
  assert.deepEqual(second.settings.vehicleBudgets, { a: { amount: 8000, enabled: true } });
});

test('a vehicle budget resolves only when it is set, on and above zero', () => {
  const budgets = {
    on: { amount: 8000, enabled: true },
    off: { amount: 8000, enabled: false },
    zero: { amount: 0, enabled: true },
  };
  assert.deepEqual(getVehicleBudget(budgets, 'on'), { amount: 8000, enabled: true });
  assert.equal(getVehicleBudget(budgets, 'off'), null);
  assert.equal(getVehicleBudget(budgets, 'zero'), null);
  assert.equal(getVehicleBudget(budgets, 'missing'), null);
  assert.equal(getVehicleBudget(budgets, null), null);
});
