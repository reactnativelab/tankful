import { strict as assert } from 'node:assert';
import test from 'node:test';
import { analyzeFuelData } from '../fuelAnalytics';
import { describeForecastGap, forecastMonthSpend } from '../fuelForecast';
import { at, entries, round, type EntryInput } from './helpers';

/** Two earlier months at 6,000 each, so the rolling average is a round number. */
const HISTORY: EntryInput[] = [
  { on: [2026, 6, 10], odometer: 1000, litres: 60 },
  { on: [2026, 7, 10], odometer: 1600, litres: 60 },
];

function analyse(rows: EntryInput[], reference: Date) {
  return analyzeFuelData(entries(...rows), { referenceDate: reference });
}

test('no forecast before anything is logged in the month', () => {
  const analysis = analyse(HISTORY, at(2026, 8, 12));
  assert.equal(forecastMonthSpend(analysis), null);
  assert.match(describeForecastGap(analysis) ?? '', /first fill-up/);
});

test('no forecast in the first hours of a month, even with history', () => {
  const analysis = analyse(
    [...HISTORY, { on: [2026, 8, 1, 2], odometer: 2200, litres: 30 }],
    at(2026, 8, 1, 3)
  );
  assert.equal(forecastMonthSpend(analysis), null);
  assert.match(describeForecastGap(analysis) ?? '', /early in the month/);
});

test('without history, one fill-up early in the month is not extrapolated', () => {
  const analysis = analyse([{ on: [2026, 8, 2], odometer: 1000, litres: 60 }], at(2026, 8, 3));
  assert.equal(forecastMonthSpend(analysis), null);
  assert.match(describeForecastGap(analysis) ?? '', /couple more fill-ups/);
});

test('without history, the pace alone is used once the month is a quarter through', () => {
  const analysis = analyse(
    [
      { on: [2026, 8, 2], odometer: 1000, litres: 20 },
      { on: [2026, 8, 8], odometer: 1200, litres: 20 },
    ],
    at(2026, 8, 16, 0) // exactly half of a 30-day September
  );
  const forecast = forecastMonthSpend(analysis);
  assert.ok(forecast);
  assert.equal(forecast.basis, 'pace');
  assert.equal(forecast.actual, 4000);
  assert.equal(round(forecast.projected), 8000);
});

test('with history, an early projection leans on the usual month, not the pace', () => {
  const analysis = analyse(
    [...HISTORY, { on: [2026, 8, 3], odometer: 2200, litres: 10 }],
    at(2026, 8, 4, 0) // exactly 10% of the month gone
  );
  const forecast = forecastMonthSpend(analysis);
  assert.ok(forecast);
  assert.equal(forecast.basis, 'pace-and-history');
  assert.equal(forecast.actual, 1000);
  // 0.1 * (1000 / 0.1) + 0.9 * 6000 = 6400: the pace contributes a tenth.
  assert.equal(round(forecast.projected), 6400);
  assert.equal(forecast.confidence, 'low');
});

test('late in the month the actual pace dominates the projection', () => {
  const analysis = analyse(
    [...HISTORY, { on: [2026, 8, 5], odometer: 2200, litres: 90 }],
    at(2026, 8, 25, 0) // exactly 80% through
  );
  const forecast = forecastMonthSpend(analysis);
  assert.ok(forecast);
  // 0.8 * (9000 / 0.8) + 0.2 * 6000 = 10200.
  assert.equal(round(forecast.projected), 10200);
  assert.equal(forecast.confidence, 'high');
});

test('one unusually large early fill projects high, but never below what is spent', () => {
  const analysis = analyse(
    [...HISTORY, { on: [2026, 8, 2], odometer: 2200, litres: 200 }],
    at(2026, 8, 4, 0)
  );
  const forecast = forecastMonthSpend(analysis);
  assert.ok(forecast);
  // 0.1 * (20000 / 0.1) + 0.9 * 6000 = 25400 -- the blend damps the pace, and
  // the floor guarantees the result can never undercut the actual spend.
  assert.equal(round(forecast.projected), 25400);
  assert.ok(forecast.projected >= forecast.actual);
  assert.equal(forecast.confidence, 'low');
});

test('zero spending this month projects zero, not a share of history', () => {
  const analysis = analyse(
    [...HISTORY, { on: [2026, 8, 3], odometer: 2200, litres: 10, totalCost: 0 }],
    at(2026, 8, 16, 0)
  );
  const forecast = forecastMonthSpend(analysis);
  assert.ok(forecast);
  assert.equal(forecast.actual, 0);
  assert.equal(round(forecast.projected), 3000);
});

test('a new month starts from nothing again, whatever last month did', () => {
  const analysis = analyse(
    [...HISTORY, { on: [2026, 8, 3], odometer: 2200, litres: 10 }],
    at(2026, 9, 2)
  );
  assert.equal(analysis.currentMonth.fillCount, 0);
  assert.equal(forecastMonthSpend(analysis), null);
  assert.match(describeForecastGap(analysis) ?? '', /first fill-up/);
});

test('the gap message disappears once a forecast is available', () => {
  const analysis = analyse(
    [...HISTORY, { on: [2026, 8, 3], odometer: 2200, litres: 10 }],
    at(2026, 8, 16, 0)
  );
  assert.ok(forecastMonthSpend(analysis));
  assert.equal(describeForecastGap(analysis), null);
});
