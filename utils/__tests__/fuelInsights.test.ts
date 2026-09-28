import { strict as assert } from 'node:assert';
import test from 'node:test';
import { analyzeFuelData, type FuelAnalysis } from '../fuelAnalytics';
import { calculateBudgetStatus } from '../fuelBudget';
import { forecastMonthSpend } from '../fuelForecast';
import {
  describeMileageAvailability,
  describeMileageSeries,
  describeSpendSeries,
  generateInsights,
  type InsightPresentation,
} from '../fuelInsights';
import { detectMileageAnomaly } from '../mileageAnomaly';
import { at, entries, type EntryInput } from './helpers';
import type { VehicleBudget } from '@/types';

const RUPEES: InsightPresentation = { currencySymbol: '₹', distanceUnit: 'km' };
const DOLLARS_MILES: InsightPresentation = { currencySymbol: '$', distanceUnit: 'mi' };

function insightsFor(
  rows: EntryInput[],
  options: {
    reference?: Date;
    budget?: VehicleBudget | null;
    presentation?: InsightPresentation;
    limit?: number;
  } = {}
) {
  const reference = options.reference ?? at(2026, 8, 20, 0);
  const analysis: FuelAnalysis = analyzeFuelData(entries(...rows), { referenceDate: reference });
  const budget = calculateBudgetStatus(analysis.currentMonth.spend, options.budget ?? null);
  const forecast = forecastMonthSpend(analysis);
  const anomaly = detectMileageAnomaly(analysis);
  const list = generateInsights(
    { analysis, budget, forecast, anomaly, presentation: options.presentation ?? RUPEES },
    { limit: options.limit ?? 3 }
  );
  return { analysis, list, ids: list.map((insight) => insight.id) };
}

test('an empty history gets guidance, not a fabricated observation', () => {
  const { list, ids } = insightsFor([]);
  assert.deepEqual(ids, ['insufficient-data']);
  assert.match(list[0].description, /first fill-up/);
});

test('one full tank explains what the second one unlocks', () => {
  const { list, ids } = insightsFor([{ on: [2026, 8, 2], odometer: 1000, litres: 10 }]);
  assert.deepEqual(ids, ['insufficient-data']);
  assert.match(list[0].description, /two full-tank fill-ups in a row/);
});

test('partial-only history asks for full tanks rather than guessing', () => {
  const { list } = insightsFor([
    { on: [2026, 8, 2], odometer: 1000, litres: 10, full: false },
    { on: [2026, 8, 9], odometer: 1200, litres: 10, full: false },
  ]);
  assert.match(list[0].description, /full tanks/);
});

test('an exceeded budget outranks everything and silences the softer budget line', () => {
  const { ids, list } = insightsFor(
    [
      { on: [2026, 7, 5], odometer: 900, litres: 10 },
      { on: [2026, 8, 5], odometer: 1000, litres: 100 },
    ],
    { budget: { amount: 5000, enabled: true } }
  );
  assert.equal(ids[0], 'budget-exceeded');
  assert.ok(!ids.includes('budget-near-limit'));
  assert.ok(!ids.includes('forecast-above-usual'));
  assert.match(list[0].description, /₹10,000\.00 of your ₹5,000\.00 budget/);
  assert.match(list[0].description, /₹5,000\.00 over/);
});

test('a budget between 70 and 100 percent produces the calmer line', () => {
  const { ids, list } = insightsFor(
    [
      { on: [2026, 7, 5], odometer: 900, litres: 10 },
      { on: [2026, 8, 5], odometer: 1000, litres: 40 },
    ],
    { budget: { amount: 5000, enabled: true } }
  );
  assert.ok(ids.includes('budget-near-limit'));
  const budgetInsight = list.find((insight) => insight.id === 'budget-near-limit');
  assert.match(budgetInsight?.title ?? '', /80% of your budget used/);
});

test('a mileage anomaly is reported with possible factors, never a diagnosis', () => {
  const { ids, list } = insightsFor([
    { on: [2026, 8, 1], odometer: 1000, litres: 10 },
    { on: [2026, 8, 4], odometer: 1180, litres: 10 },
    { on: [2026, 8, 7], odometer: 1360, litres: 10 },
    { on: [2026, 8, 10], odometer: 1540, litres: 10 },
    { on: [2026, 8, 13], odometer: 1660, litres: 10 },
  ]);
  assert.ok(ids.includes('mileage-below-usual'));
  const anomaly = list.find((insight) => insight.id === 'mileage-below-usual');
  assert.match(anomaly?.description ?? '', /12\.0 km\/l/);
  assert.match(anomaly?.footnote ?? '', /can all move a result like this/);
  assert.doesNotMatch(anomaly?.footnote ?? '', /your tyre pressure is/i);
});

test('an anomaly suppresses the slower mileage-declining line', () => {
  const { ids } = insightsFor([
    { on: [2026, 8, 1], odometer: 1000, litres: 10 },
    { on: [2026, 8, 3], odometer: 1200, litres: 10 },
    { on: [2026, 8, 5], odometer: 1400, litres: 10 },
    { on: [2026, 8, 7], odometer: 1600, litres: 10 },
    { on: [2026, 8, 9], odometer: 1800, litres: 10 },
    { on: [2026, 8, 11], odometer: 1950, litres: 10 },
    { on: [2026, 8, 13], odometer: 2100, litres: 10 },
    { on: [2026, 8, 15], odometer: 2200, litres: 10 },
  ]);
  assert.ok(ids.includes('mileage-below-usual'));
  assert.ok(!ids.includes('mileage-declining'));
});

test('a real month-over-month rise outranks the forecast that would repeat it', () => {
  const { ids, list } = insightsFor([
    { on: [2026, 6, 5], odometer: 500, litres: 20 },
    { on: [2026, 7, 5], odometer: 900, litres: 20 },
    { on: [2026, 8, 5], odometer: 1000, litres: 60 },
  ]);
  assert.equal(ids[0], 'spending-up');
  assert.ok(!ids.includes('forecast-above-usual'));
  assert.match(list[0].description, /by this point in August 2026/);
});

test('spending changes under 10 percent are left unsaid', () => {
  const { ids } = insightsFor([
    { on: [2026, 7, 5], odometer: 900, litres: 20 },
    { on: [2026, 8, 5], odometer: 1000, litres: 21 },
  ]);
  assert.ok(!ids.includes('spending-up'));
  assert.ok(!ids.includes('spending-down'));
});

test('a personal best needs four observations and beats the previous best', () => {
  const rows: EntryInput[] = [
    { on: [2026, 8, 1], odometer: 1000, litres: 10 },
    { on: [2026, 8, 4], odometer: 1180, litres: 10 },
    { on: [2026, 8, 7], odometer: 1360, litres: 10 },
    { on: [2026, 8, 10], odometer: 1540, litres: 10 },
    { on: [2026, 8, 13], odometer: 1750, litres: 10 },
  ];
  const { ids, list } = insightsFor(rows);
  assert.ok(ids.includes('personal-best-mileage'));
  assert.match(
    list.find((insight) => insight.id === 'personal-best-mileage')?.description ?? '',
    /21\.0 km\/l/
  );

  // Matching the old best is not a new best.
  const tie = insightsFor([...rows.slice(0, 4), { on: [2026, 8, 13], odometer: 1720, litres: 10 }]);
  assert.ok(!tie.ids.includes('personal-best-mileage'));
});

test('an implausible jump is not celebrated as a personal best', () => {
  const { ids } = insightsFor([
    { on: [2026, 8, 1], odometer: 1000, litres: 10 },
    { on: [2026, 8, 4], odometer: 1180, litres: 10 },
    { on: [2026, 8, 7], odometer: 1360, litres: 10 },
    { on: [2026, 8, 10], odometer: 1540, litres: 10 },
    { on: [2026, 8, 13], odometer: 10540, litres: 10 },
  ]);
  assert.ok(!ids.includes('personal-best-mileage'));
});

test('insights are ranked by priority and capped at the requested limit', () => {
  const { list } = insightsFor(
    [
      { on: [2026, 7, 5], odometer: 900, litres: 10 },
      { on: [2026, 8, 5], odometer: 1000, litres: 100 },
    ],
    { budget: { amount: 5000, enabled: true }, limit: 1 }
  );
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'budget-exceeded');
});

test('currency and distance unit follow the user settings', () => {
  const { list } = insightsFor(
    [
      { on: [2026, 7, 5], odometer: 900, litres: 10 },
      { on: [2026, 8, 5], odometer: 1000, litres: 100 },
    ],
    { budget: { amount: 5000, enabled: true }, presentation: DOLLARS_MILES }
  );
  assert.match(list[0].description, /\$10,000\.00/);
  assert.doesNotMatch(list[0].description, /₹/);
});

test('the mileage chart has a spoken equivalent', () => {
  const { analysis } = insightsFor([
    { on: [2026, 8, 1], odometer: 1000, litres: 10 },
    { on: [2026, 8, 4], odometer: 1180, litres: 10 },
    { on: [2026, 8, 7], odometer: 1400, litres: 10 },
  ]);
  const spoken = describeMileageSeries(analysis, RUPEES);
  assert.match(spoken, /2 mileage readings/);
  assert.match(spoken, /latest 22\.0 km\/l/);
  assert.match(spoken, /Average 20\.0 km\/l/);

  const empty = describeMileageSeries(
    analyzeFuelData([], { referenceDate: at(2026, 8, 20) }),
    RUPEES
  );
  assert.match(empty, /No mileage readings yet/);
});

test('the spending chart has a spoken equivalent', () => {
  const spoken = describeSpendSeries(
    [
      { label: 'Aug', total: 4000, isCurrent: false },
      { label: 'Sep', total: 1500, isCurrent: true },
    ],
    RUPEES
  );
  assert.equal(spoken, 'Fuel spending by month: Aug ₹4,000.00, Sep ₹1,500.00 so far.');
});

test('the mileage-availability note names the actual obstacle', () => {
  const describe = (rows: EntryInput[]) =>
    describeMileageAvailability(analyzeFuelData(entries(...rows), { referenceDate: at(2026, 8, 20) }));

  assert.match(describe([]) ?? '', /Mark a fill-up as a full tank/);
  assert.match(
    describe([{ on: [2026, 8, 2], odometer: 1000, litres: 10, full: false }]) ?? '',
    /Mark a fill-up as a full tank/
  );
  assert.match(
    describe([{ on: [2026, 8, 2], odometer: 1000, litres: 10 }]) ?? '',
    /One full tank logged so far/
  );
  // Two full tanks, but a partial between them: no pair lines up.
  assert.match(
    describe([
      { on: [2026, 8, 2], odometer: 1000, litres: 10 },
      { on: [2026, 8, 6], odometer: 1100, litres: 5, full: false },
      { on: [2026, 8, 10], odometer: 1300, litres: 10 },
    ]) ?? '',
    /partial fills between them/
  );
  // Once a pair exists there is nothing to explain.
  assert.equal(
    describe([
      { on: [2026, 8, 2], odometer: 1000, litres: 10 },
      { on: [2026, 8, 10], odometer: 1200, litres: 10 },
    ]),
    null
  );
});
