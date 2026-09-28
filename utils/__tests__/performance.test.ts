import { strict as assert } from 'node:assert';
import test from 'node:test';
import type { FuelEntry } from '@/types';
import { analyzeFuelData, getMonthlySpendSeries } from '../fuelAnalytics';
import { generateInsights } from '../fuelInsights';
import { calculateBudgetStatus } from '../fuelBudget';
import { forecastMonthSpend } from '../fuelForecast';
import { detectMileageAnomaly } from '../mileageAnomaly';
import { buildPersonalRecords } from '../personalRecords';
import { buildMonthlyReport } from '../monthlyReport';
import { at } from './helpers';

/**
 * A guard against the analysis quietly becoming quadratic. The budgets below
 * are loose -- they are not a benchmark, they are a tripwire: a nested scan
 * over the history would blow past them by orders of magnitude on a phone,
 * even though these numbers pass comfortably on any machine that can run the
 * test suite.
 */

const REFERENCE = at(2026, 8, 20);

/** A history of `count` fill-ups ending a few days before the reference date. */
function buildHistory(count: number): FuelEntry[] {
  const rows: FuelEntry[] = [];
  let odometer = 10000;
  for (let i = 0; i < count; i++) {
    const date = new Date(REFERENCE.getTime() - (count - i) * 36 * 60 * 60 * 1000);
    odometer += 300 + (i % 7) * 20;
    const litres = 18 + (i % 5);
    rows.push({
      id: `entry-${i}`,
      vehicleId: 'vehicle-a',
      date: date.getTime(),
      odometer,
      litresFilled: litres,
      pricePerLitre: 100,
      totalCost: litres * 100,
      // Every seventh fill is partial, so the mileage rules get exercised too.
      isTankFull: i % 7 !== 0,
      notes: null,
      createdAt: date.getTime(),
    });
  }
  // The store hands them over newest-first.
  return rows.reverse();
}

function timeFullDerivation(entries: FuelEntry[]): number {
  const started = performance.now();
  const analysis = analyzeFuelData(entries, { referenceDate: REFERENCE });
  const budget = calculateBudgetStatus(analysis.currentMonth.spend, {
    amount: 20000,
    enabled: true,
  });
  const forecast = forecastMonthSpend(analysis);
  const anomaly = detectMileageAnomaly(analysis);
  buildPersonalRecords(analysis);
  getMonthlySpendSeries(analysis);
  generateInsights({
    analysis,
    budget,
    forecast,
    anomaly,
    presentation: { currencySymbol: '₹', distanceUnit: 'km' },
  });
  buildMonthlyReport(analysis, { budget: { amount: 20000, enabled: true } });
  return performance.now() - started;
}

for (const size of [10, 100, 500, 1000, 5000, 10000]) {
  test(`deriving everything from ${size} fill-ups stays fast`, () => {
    const entries = buildHistory(size);
    const elapsed = timeFullDerivation(entries);
    // 10,000 fill-ups is about 27 years of weekly fuelling.
    const budgetMs = size <= 1000 ? 150 : 600;
    assert.ok(
      elapsed < budgetMs,
      `deriving from ${size} entries took ${elapsed.toFixed(1)}ms, over the ${budgetMs}ms budget`
    );
  });
}

test('a large history still produces correct totals', () => {
  const entries = buildHistory(1000);
  const analysis = analyzeFuelData(entries, { referenceDate: REFERENCE });
  assert.equal(analysis.entryCount, 1000);
  assert.equal(
    analysis.months.reduce((sum, month) => sum + month.fillCount, 0),
    1000
  );
  assert.equal(
    Math.round(analysis.months.reduce((sum, month) => sum + month.spend, 0)),
    Math.round(analysis.totalSpend)
  );
  assert.ok(analysis.observations.length > 0);
  assert.ok(analysis.observations.length < 1000);
});
