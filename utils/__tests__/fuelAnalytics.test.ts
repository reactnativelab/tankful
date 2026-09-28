import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  analyzeFuelData,
  compareMonthSpend,
  getFuelAnalysis,
  getMonthlySpendSeries,
  percentChange,
} from '../fuelAnalytics';
import { at, entries, newestFirst, round } from './helpers';

test('an empty history produces a usable, all-null analysis', () => {
  const analysis = analyzeFuelData([], { referenceDate: at(2026, 8, 15) });
  assert.equal(analysis.entryCount, 0);
  assert.equal(analysis.averageMileage, null);
  assert.equal(analysis.costPerDistance, null);
  assert.equal(analysis.currentMonth.spend, 0);
  assert.equal(analysis.currentMonth.fillCount, 0);
  assert.equal(analysis.spendComparison, null);
  assert.equal(analysis.rollingMonthlySpend, null);
  assert.deepEqual(analysis.months, []);
});

test('spending buckets by local calendar month, not by a rolling window', () => {
  const analysis = analyzeFuelData(
    entries(
      { on: [2026, 7, 31, 23], odometer: 1000, litres: 10 },
      { on: [2026, 8, 1, 0], odometer: 1100, litres: 10 },
      { on: [2026, 8, 30, 23], odometer: 1300, litres: 20 }
    ),
    { referenceDate: at(2026, 8, 30) }
  );
  assert.equal(analysis.previousMonth.spend, 1000);
  assert.equal(analysis.currentMonth.spend, 3000);
  assert.equal(analysis.currentMonth.fillCount, 2);
});

test('a December to January boundary keeps the two months apart', () => {
  const analysis = analyzeFuelData(
    entries(
      { on: [2025, 11, 28], odometer: 1000, litres: 10 },
      { on: [2026, 0, 3], odometer: 1200, litres: 20 }
    ),
    { referenceDate: at(2026, 0, 15) }
  );
  assert.equal(analysis.previousMonth.key, '2025-12');
  assert.equal(analysis.previousMonth.spend, 1000);
  assert.equal(analysis.currentMonth.key, '2026-01');
  assert.equal(analysis.currentMonth.spend, 2000);
});

test('a month with fill-ups but no spending is still a month with data', () => {
  const analysis = analyzeFuelData(
    entries({ on: [2026, 8, 4], odometer: 1000, litres: 10, totalCost: 0 }),
    { referenceDate: at(2026, 8, 20) }
  );
  assert.equal(analysis.currentMonth.spend, 0);
  assert.equal(analysis.currentMonth.fillCount, 1);
});

test('month distance sums the odometer gaps closed inside it', () => {
  const analysis = analyzeFuelData(
    entries(
      { on: [2026, 7, 25], odometer: 1000, litres: 10 },
      { on: [2026, 8, 5], odometer: 1200, litres: 10 },
      { on: [2026, 8, 20], odometer: 1500, litres: 15 }
    ),
    { referenceDate: at(2026, 8, 25) }
  );
  // 200 into the first September fill + 300 into the second.
  assert.equal(analysis.currentMonth.distance, 500);
  assert.equal(analysis.currentMonth.pairedSpend, 2500);
  assert.equal(analysis.currentMonth.costPerDistance, 5);
});

test('partial fills count towards spending and litres but not mileage', () => {
  const analysis = analyzeFuelData(
    entries(
      { on: [2026, 8, 1], odometer: 1000, litres: 20 },
      { on: [2026, 8, 10], odometer: 1200, litres: 10, full: false },
      { on: [2026, 8, 20], odometer: 1400, litres: 10 }
    ),
    { referenceDate: at(2026, 8, 25) }
  );
  assert.equal(analysis.currentMonth.litres, 40);
  assert.equal(analysis.currentMonth.partialCount, 1);
  assert.equal(analysis.currentMonth.fullTankCount, 2);
  assert.equal(analysis.observations.length, 0);
  assert.equal(analysis.currentMonth.averageMileage, null);
  // Distance still accrues: the odometer moved regardless of tank state.
  assert.equal(analysis.currentMonth.distance, 400);
});

test('spending is compared month-to-date against the same days of last month', () => {
  const analysis = analyzeFuelData(
    entries(
      { on: [2026, 7, 2], odometer: 1000, litres: 10 },
      { on: [2026, 7, 20], odometer: 1200, litres: 30 },
      { on: [2026, 8, 3], odometer: 1400, litres: 12 }
    ),
    { referenceDate: at(2026, 8, 5) }
  );
  const comparison = analysis.spendComparison;
  assert.ok(comparison);
  assert.equal(comparison.basis, 'month-to-date');
  assert.equal(comparison.throughDay, 5);
  assert.equal(comparison.current, 1200);
  // Only the 2nd of August is inside the same 1st-to-5th window.
  assert.equal(comparison.previous, 1000);
  assert.equal(comparison.direction, 'up');
  assert.equal(round(comparison.percent), 20);
});

test('a finished month compares whole month against whole month', () => {
  const analysis = analyzeFuelData(
    entries(
      { on: [2026, 7, 2], odometer: 1000, litres: 10 },
      { on: [2026, 7, 20], odometer: 1200, litres: 30 },
      { on: [2026, 8, 3], odometer: 1400, litres: 12 }
    ),
    { referenceDate: at(2026, 9, 10) }
  );
  const comparison = compareMonthSpend(analysis, { year: 2026, month: 8 });
  assert.ok(comparison);
  assert.equal(comparison.basis, 'full-month');
  assert.equal(comparison.current, 1200);
  assert.equal(comparison.previous, 4000);
  assert.equal(comparison.direction, 'down');
});

test('comparing on the 31st against a 30-day month uses that whole month', () => {
  const analysis = analyzeFuelData(
    entries(
      { on: [2026, 8, 29], odometer: 1000, litres: 10 },
      { on: [2026, 9, 15], odometer: 1200, litres: 10 }
    ),
    { referenceDate: at(2026, 9, 31) }
  );
  const comparison = analysis.spendComparison;
  assert.ok(comparison);
  assert.equal(comparison.throughDay, 31);
  assert.equal(comparison.previous, 1000);
});

test('no comparison when either month has nothing logged', () => {
  const analysis = analyzeFuelData(
    entries({ on: [2026, 8, 3], odometer: 1000, litres: 10 }),
    { referenceDate: at(2026, 8, 10) }
  );
  assert.equal(analysis.spendComparison, null);
});

test('the rolling average skips empty months and needs two with data', () => {
  const reference = at(2026, 8, 15);
  const oneMonth = analyzeFuelData(
    entries({ on: [2026, 7, 5], odometer: 1000, litres: 10 }),
    { referenceDate: reference }
  );
  assert.equal(oneMonth.rollingMonthlySpend, null);

  const twoMonths = analyzeFuelData(
    entries(
      { on: [2026, 5, 5], odometer: 900, litres: 10 },
      { on: [2026, 7, 5], odometer: 1000, litres: 30 }
    ),
    { referenceDate: reference }
  );
  assert.ok(twoMonths.rollingMonthlySpend);
  // June (1000) and August (3000) count; July, with nothing logged, does not.
  assert.equal(twoMonths.rollingMonthlySpend.value, 2000);
  assert.equal(twoMonths.rollingMonthlySpend.monthsCounted, 2);
});

test('the rolling average never includes the month in progress', () => {
  const analysis = analyzeFuelData(
    entries(
      { on: [2026, 6, 5], odometer: 900, litres: 10 },
      { on: [2026, 7, 5], odometer: 1000, litres: 10 },
      { on: [2026, 8, 5], odometer: 1100, litres: 100 }
    ),
    { referenceDate: at(2026, 8, 6) }
  );
  assert.ok(analysis.rollingMonthlySpend);
  assert.equal(analysis.rollingMonthlySpend.value, 1000);
});

test('the mileage trend needs three recent and three baseline observations', () => {
  const build = (count: number) => {
    const rows = [{ on: [2026, 1, 1] as [number, number, number], odometer: 1000, litres: 10 }];
    for (let i = 1; i <= count; i++) {
      rows.push({ on: [2026, 1, 1 + i], odometer: 1000 + i * 200, litres: 10 });
    }
    return analyzeFuelData(entries(...rows), { referenceDate: at(2026, 2, 1) });
  };
  assert.equal(build(5).mileageTrend, null);
  const trend = build(6).mileageTrend;
  assert.ok(trend);
  assert.equal(trend.recentCount, 3);
  assert.equal(trend.baselineCount, 3);
});

test('the mileage trend measures the last three against the ones before', () => {
  const analysis = analyzeFuelData(
    entries(
      { on: [2026, 1, 1], odometer: 0, litres: 10 },
      { on: [2026, 1, 2], odometer: 100, litres: 10 },
      { on: [2026, 1, 3], odometer: 200, litres: 10 },
      { on: [2026, 1, 4], odometer: 300, litres: 10 },
      { on: [2026, 1, 5], odometer: 420, litres: 10 },
      { on: [2026, 1, 6], odometer: 540, litres: 10 },
      { on: [2026, 1, 7], odometer: 660, litres: 10 }
    ),
    { referenceDate: at(2026, 2, 1) }
  );
  const trend = analysis.mileageTrend;
  assert.ok(trend);
  assert.equal(trend.baseline, 10);
  assert.equal(trend.recent, 12);
  assert.equal(trend.direction, 'up');
  assert.equal(round(trend.percent), 20);
});

test('the spend series always spans six months, gaps included', () => {
  const analysis = analyzeFuelData(
    entries(
      { on: [2026, 5, 5], odometer: 900, litres: 10 },
      { on: [2026, 8, 5], odometer: 1000, litres: 20 }
    ),
    { referenceDate: at(2026, 8, 20) }
  );
  const series = getMonthlySpendSeries(analysis);
  assert.equal(series.length, 6);
  assert.deepEqual(
    series.map((point) => point.total),
    // April, May, June (1000), July, August, September (2000)
    [0, 0, 1000, 0, 0, 2000]
  );
  assert.equal(series[5].isCurrent, true);
  assert.equal(series[0].isCurrent, false);
});

test('newest-first input from the store analyses identically', () => {
  const rows = entries(
    { on: [2026, 8, 1], odometer: 1000, litres: 20 },
    { on: [2026, 8, 10], odometer: 1200, litres: 10 },
    { on: [2026, 8, 20], odometer: 1500, litres: 15 }
  );
  const reference = at(2026, 8, 25);
  const forwards = analyzeFuelData(rows, { referenceDate: reference });
  const backwards = analyzeFuelData(newestFirst(rows), { referenceDate: reference });
  assert.equal(backwards.averageMileage, forwards.averageMileage);
  assert.equal(backwards.currentMonth.distance, forwards.currentMonth.distance);
  assert.deepEqual(
    backwards.observations.map((o) => o.entryId),
    forwards.observations.map((o) => o.entryId)
  );
});

test('a backdated fill-up re-sequences the mileage around it', () => {
  const before = analyzeFuelData(
    entries(
      { on: [2026, 8, 1], odometer: 1000, litres: 10 },
      { on: [2026, 8, 20], odometer: 1400, litres: 20 }
    ),
    { referenceDate: at(2026, 8, 25) }
  );
  assert.equal(before.observations.length, 1);
  assert.equal(before.observations[0].mileage, 20);

  const after = analyzeFuelData(
    entries(
      { on: [2026, 8, 1], odometer: 1000, litres: 10 },
      { on: [2026, 8, 20], odometer: 1400, litres: 20 },
      { on: [2026, 8, 10], odometer: 1200, litres: 10 }
    ),
    { referenceDate: at(2026, 8, 25) }
  );
  assert.equal(after.observations.length, 2);
  assert.deepEqual(
    after.observations.map((o) => o.mileage),
    [20, 10]
  );
});

test('only the vehicle whose entries are passed in is analysed', () => {
  const mixed = entries(
    { vehicleId: 'a', on: [2026, 8, 1], odometer: 1000, litres: 10 },
    { vehicleId: 'b', on: [2026, 8, 2], odometer: 50000, litres: 40 },
    { vehicleId: 'a', on: [2026, 8, 10], odometer: 1200, litres: 10 }
  );
  const analysis = analyzeFuelData(
    mixed.filter((row) => row.vehicleId === 'a'),
    { referenceDate: at(2026, 8, 20) }
  );
  assert.equal(analysis.entryCount, 2);
  assert.equal(analysis.currentMonth.spend, 2000);
  assert.equal(analysis.observations[0].mileage, 20);
});

test('percentChange refuses to divide by zero or by nonsense', () => {
  assert.equal(percentChange(10, 0), null);
  assert.equal(percentChange(Number.NaN, 5), null);
  assert.equal(percentChange(10, Number.POSITIVE_INFINITY), null);
  assert.equal(percentChange(15, 10), 50);
});

test('the shared analysis is reused for the same entries array on the same day', () => {
  const rows = entries({ on: [2026, 8, 1], odometer: 1000, litres: 10 });
  const reference = at(2026, 8, 20);
  const first = getFuelAnalysis(rows, reference);
  assert.equal(getFuelAnalysis(rows, reference), first);
  // A different day re-derives it, so month windows move on.
  assert.notEqual(getFuelAnalysis(rows, at(2026, 8, 21)), first);
  // A different array (the store's next read) re-derives it too.
  assert.notEqual(getFuelAnalysis([...rows], reference), first);
});
