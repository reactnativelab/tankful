import { strict as assert } from 'node:assert';
import test from 'node:test';
import type { Vehicle } from '@/types';
import { analyzeFuelData } from '../fuelAnalytics';
import { calculateBudgetStatus } from '../fuelBudget';
import { forecastMonthSpend } from '../fuelForecast';
import { generateInsights } from '../fuelInsights';
import { detectMileageAnomaly } from '../mileageAnomaly';
import {
  buildMonthlyReport,
  buildMonthlyReportShareText,
  getReportableMonths,
} from '../monthlyReport';
import { formatDate } from '../format';
import { at, entries, round, type EntryInput } from './helpers';

const VEHICLE: Vehicle = {
  id: 'vehicle-a',
  name: 'Honda City',
  type: 'car',
  fuelType: 'petrol',
  plate: null,
  createdAt: 0,
};

const SETTINGS = { currencySymbol: '₹', distanceUnit: 'km' as const };

const HISTORY: EntryInput[] = [
  { on: [2026, 7, 2], odometer: 1000, litres: 20 },
  { on: [2026, 7, 18], odometer: 1400, litres: 20 },
  { on: [2026, 8, 4], odometer: 1800, litres: 20 },
  { on: [2026, 8, 18], odometer: 2260, litres: 20 },
];

function analyse(rows: EntryInput[], reference: Date) {
  return analyzeFuelData(entries(...rows), { referenceDate: reference });
}

test('the report separates what happened from what is projected', () => {
  const analysis = analyse(HISTORY, at(2026, 8, 20, 0));
  const report = buildMonthlyReport(analysis, { budget: { amount: 5000, enabled: true } });

  assert.equal(report.label, 'September 2026');
  assert.equal(report.isCurrentMonth, true);
  assert.equal(report.isComplete, false);
  assert.equal(report.actual.spend, 4000);
  assert.equal(report.actual.litres, 40);
  assert.equal(report.actual.fillCount, 2);
  assert.equal(report.actual.distance, 860);
  // Two readings this month: 400/20 into the 4th, 460/20 into the 18th.
  assert.equal(report.actual.averageMileage, 21.5);
  assert.equal(round(report.actual.costPerDistance ?? 0, 4), round(4000 / 860, 4));
  // Projection lives apart from `actual` so the two can never be confused.
  assert.ok(report.forecast);
  assert.ok(report.forecast.projected >= report.actual.spend);
});

test('a past month is final: no budget and no projection', () => {
  const analysis = analyse(HISTORY, at(2026, 8, 20));
  const report = buildMonthlyReport(analysis, {
    ref: { year: 2026, month: 7 },
    budget: { amount: 5000, enabled: true },
  });
  assert.equal(report.isComplete, true);
  assert.equal(report.budget, null);
  assert.equal(report.forecast, null);
});

test('the current month carries the live insight, a past month a factual recap', () => {
  const analysis = analyse(HISTORY, at(2026, 8, 20, 0));
  const insight = generateInsights({
    analysis,
    budget: calculateBudgetStatus(analysis.currentMonth.spend, null),
    forecast: forecastMonthSpend(analysis),
    anomaly: detectMileageAnomaly(analysis),
    presentation: SETTINGS,
  })[0];

  const current = buildMonthlyReport(analysis, { insight });
  assert.equal(current.notable, insight.description);

  const past = buildMonthlyReport(analysis, { ref: { year: 2026, month: 7 }, insight });
  assert.notEqual(past.notable, insight.description);
});

test('comparisons line up against the previous month', () => {
  const analysis = analyse(HISTORY, at(2026, 8, 20, 0));
  const report = buildMonthlyReport(analysis);
  assert.equal(report.previousLabel, 'August 2026');
  assert.ok(report.mileageComparison);
  assert.equal(report.mileageComparison.previous, 20);
  assert.equal(report.mileageComparison.current, 21.5);
  assert.equal(report.mileageComparison.direction, 'up');
  assert.equal(round(report.mileageComparison.percent), 7.5);
});

test('a month with nothing logged says so instead of showing zeros as results', () => {
  const analysis = analyse(HISTORY, at(2026, 10, 5));
  const report = buildMonthlyReport(analysis);
  assert.equal(report.actual.fillCount, 0);
  assert.deepEqual(report.dataNotes, ['No fill-ups logged this month yet.']);
});

test('data notes explain why mileage is missing and what partial fills do', () => {
  const analysis = analyse(
    [
      { on: [2026, 8, 2], odometer: 1000, litres: 20 },
      { on: [2026, 8, 9], odometer: 1200, litres: 10, full: false },
    ],
    at(2026, 8, 20)
  );
  const report = buildMonthlyReport(analysis);
  assert.ok(report.dataNotes.some((note) => /two full-tank fill-ups in a row/.test(note)));
});

test('a partial fill is called out once mileage exists alongside it', () => {
  const analysis = analyse(
    [
      { on: [2026, 8, 2], odometer: 1000, litres: 20 },
      { on: [2026, 8, 9], odometer: 1200, litres: 10 },
      { on: [2026, 8, 14], odometer: 1300, litres: 5, full: false },
    ],
    at(2026, 8, 20)
  );
  const report = buildMonthlyReport(analysis);
  assert.ok(report.dataNotes.some((note) => /1 partial fill-up is included in spending/.test(note)));
});

test('the share text reports the selected month, marked estimates and all', () => {
  const analysis = analyse(HISTORY, at(2026, 8, 20, 0));
  const report = buildMonthlyReport(analysis, { budget: { amount: 5000, enabled: true } });
  const text = buildMonthlyReportShareText(report, VEHICLE, SETTINGS);

  assert.match(text, /Honda City — September 2026/);
  assert.match(text, /Spent: ₹4,000\.00/);
  assert.match(text, /Fuel: 40\.0 L/);
  assert.match(text, /Distance: 860 km/);
  assert.match(text, /Average mileage: 21\.5 km\/l/);
  assert.match(text, /Fill-ups: 2 \(2 full tanks\)/);
  assert.match(text, new RegExp(`Last fill-up: ${formatDate(at(2026, 8, 18).getTime())}`));
  assert.match(text, /vs August 2026 \(same days\)/);
  assert.match(text, /Budget: ₹4,000\.00 of ₹5,000\.00 \(80% used\)/);
  assert.match(text, /Estimated month-end: .* \(estimate, not final\)/);
  assert.match(text, /Shared from Tankful/);
});

test('the share text respects the chosen currency and distance unit', () => {
  const analysis = analyse(HISTORY, at(2026, 8, 20, 0));
  const report = buildMonthlyReport(analysis);
  const text = buildMonthlyReportShareText(report, VEHICLE, {
    currencySymbol: '$',
    distanceUnit: 'mi',
  });
  assert.match(text, /Spent: \$4,000\.00/);
  assert.match(text, /Distance: 860 mi/);
  assert.match(text, /Average mileage: 21\.5 mi\/L/);
  assert.match(text, /Cost per mi: \$4\.65/);
  assert.doesNotMatch(text, /₹/);
});

test('sharing an empty month claims nothing', () => {
  const analysis = analyse(HISTORY, at(2026, 10, 5));
  const report = buildMonthlyReport(analysis);
  const text = buildMonthlyReportShareText(report, VEHICLE, SETTINGS);
  assert.match(text, /No fill-ups logged yet this month\./);
  assert.doesNotMatch(text, /Spent:/);
  assert.doesNotMatch(text, /Last fill-up/);
});

test('reportable months are the months with data plus the current one', () => {
  const analysis = analyse(HISTORY, at(2026, 10, 5));
  const months = getReportableMonths(analysis);
  assert.deepEqual(months, [
    { year: 2026, month: 7 },
    { year: 2026, month: 8 },
    { year: 2026, month: 10 },
  ]);
});

test('the current month appears once, even when it has data', () => {
  const analysis = analyse(HISTORY, at(2026, 8, 20));
  const months = getReportableMonths(analysis);
  assert.deepEqual(months, [
    { year: 2026, month: 7 },
    { year: 2026, month: 8 },
  ]);
});

/**
 * The 8 scenarios audited in Pass 3 (Section 3) against the retired
 * buildMonthlySummary, re-run here against buildMonthlyReportShareText so the
 * replacement can never silently drift from what was verified correct.
 * Reference date throughout: 18 September 2026.
 */
test('monthly summary equivalence: the 8 audited scenarios', () => {
  const REF = at(2026, 8, 18);

  const cases: {
    name: string;
    rows: EntryInput[];
    ref?: Date;
    expectMileage: string | null;
    expectLastFillup: Date | null;
  }[] = [
    {
      name: 'no entries at all',
      rows: [],
      expectMileage: null,
      expectLastFillup: null,
    },
    {
      name: 'entries only in the prior month',
      rows: [{ on: [2026, 7, 20], odometer: 1000, litres: 40 }],
      expectMileage: null,
      expectLastFillup: null,
    },
    {
      name: 'one fill, first ever',
      rows: [{ on: [2026, 8, 10], odometer: 1000, litres: 40 }],
      expectMileage: null,
      expectLastFillup: at(2026, 8, 10),
    },
    {
      name: 'one fill, full predecessor in prior month',
      rows: [
        { on: [2026, 7, 20], odometer: 1000, litres: 40 },
        { on: [2026, 8, 10], odometer: 3000, litres: 40 },
      ],
      expectMileage: '50.0 km/l',
      expectLastFillup: at(2026, 8, 10),
    },
    {
      name: 'one fill, partial predecessor',
      rows: [
        { on: [2026, 7, 20], odometer: 1000, litres: 40, full: false },
        { on: [2026, 8, 10], odometer: 3000, litres: 40 },
      ],
      expectMileage: null,
      expectLastFillup: at(2026, 8, 10),
    },
    {
      name: 'partial-only month',
      rows: [
        { on: [2026, 8, 5], odometer: 1000, litres: 10, full: false },
        { on: [2026, 8, 12], odometer: 1300, litres: 10, full: false },
      ],
      expectMileage: null,
      expectLastFillup: at(2026, 8, 12),
    },
    {
      name: 'full -> partial -> full within the month',
      rows: [
        { on: [2026, 8, 2], odometer: 1000, litres: 40 },
        { on: [2026, 8, 8], odometer: 1300, litres: 20, full: false },
        { on: [2026, 8, 15], odometer: 1800, litres: 35 },
      ],
      expectMileage: null,
      expectLastFillup: at(2026, 8, 15),
    },
    {
      name: 'regressed odometer (corrupt order)',
      rows: [
        { on: [2026, 8, 2], odometer: 5000, litres: 40 },
        { on: [2026, 8, 10], odometer: 4000, litres: 40 },
      ],
      expectMileage: null,
      expectLastFillup: at(2026, 8, 10),
    },
    {
      name: 'month boundary: 31 Aug 23:00 + 1 Sept 00:00, reference 1 Sept',
      rows: [
        { on: [2026, 7, 31, 23], odometer: 1000, litres: 40 },
        { on: [2026, 8, 1, 0], odometer: 2600, litres: 40 },
      ],
      ref: at(2026, 8, 1),
      expectMileage: '40.0 km/l',
      expectLastFillup: at(2026, 8, 1, 0),
    },
  ];

  for (const testCase of cases) {
    const analysis = analyse(testCase.rows, testCase.ref ?? REF);
    const report = buildMonthlyReport(analysis);
    const text = buildMonthlyReportShareText(report, VEHICLE, SETTINGS);

    if (testCase.expectMileage === null) {
      assert.doesNotMatch(text, /Average mileage/, `${testCase.name}: unexpected mileage line`);
    } else {
      assert.match(
        text,
        new RegExp(`Average mileage: ${testCase.expectMileage.replace('/', '\\/')}`),
        `${testCase.name}: wrong or missing mileage`
      );
    }

    if (testCase.expectLastFillup === null) {
      assert.doesNotMatch(text, /Last fill-up/, `${testCase.name}: unexpected Last fill-up line`);
    } else {
      assert.match(
        text,
        new RegExp(`Last fill-up: ${formatDate(testCase.expectLastFillup.getTime())}`),
        `${testCase.name}: wrong or missing Last fill-up date`
      );
    }
  }
});
