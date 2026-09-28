import { strict as assert } from 'node:assert';
import test from 'node:test';
import { analyzeFuelData } from '../fuelAnalytics';
import { detectMileageAnomaly } from '../mileageAnomaly';
import { at, entries, round, type EntryInput } from './helpers';

/**
 * Each fill-up is 10 litres, so the odometer gap alone sets the mileage:
 * a gap of 180 is 18 km/l. That keeps the fixtures readable.
 */
function runOfMileages(mileages: number[]): EntryInput[] {
  let odometer = 1000;
  const rows: EntryInput[] = [{ on: [2026, 1, 1], odometer, litres: 10 }];
  mileages.forEach((mileage, index) => {
    odometer += mileage * 10;
    rows.push({ on: [2026, 1, 2 + index], odometer, litres: 10 });
  });
  return rows;
}

function anomalyFor(mileages: number[]) {
  const analysis = analyzeFuelData(entries(...runOfMileages(mileages)), {
    referenceDate: at(2026, 2, 1),
  });
  assert.equal(analysis.observations.length, mileages.length);
  return detectMileageAnomaly(analysis);
}

test('no anomaly without a baseline of at least three earlier readings', () => {
  assert.equal(anomalyFor([18]), null);
  assert.equal(anomalyFor([18, 18, 12]), null);
});

test('four readings are enough to judge the newest one', () => {
  const anomaly = anomalyFor([18, 18, 18, 12]);
  assert.ok(anomaly);
  assert.equal(anomaly.direction, 'below');
  assert.equal(anomaly.sampleSize, 3);
  assert.equal(anomaly.baseline, 18);
  assert.equal(anomaly.latest, 12);
  assert.equal(round(anomaly.percent, 1), 33.3);
});

test('ordinary variation is not an anomaly', () => {
  assert.equal(anomalyFor([18, 17.5, 18.2, 17.8]), null);
  // A 10% dip is below the 15% threshold.
  assert.equal(anomalyFor([18, 18, 18, 16.2]), null);
});

test('a big jump upwards is reported as being above the usual range', () => {
  const anomaly = anomalyFor([18, 18, 18, 24]);
  assert.ok(anomaly);
  assert.equal(anomaly.direction, 'above');
  assert.equal(round(anomaly.percent, 1), 33.3);
});

test('a naturally swingy vehicle needs a bigger move before anything is said', () => {
  // Baseline 12/18/24 (mean 18, mean absolute deviation 4): a drop to 15 is
  // a 16.7% move, past the percentage threshold, but well inside this
  // vehicle's normal swing -- so the spread check keeps it quiet.
  assert.equal(anomalyFor([12, 18, 24, 15]), null);
  // The same drop against a steady baseline does trigger.
  const steady = anomalyFor([18, 18, 18, 15]);
  assert.ok(steady);
  assert.equal(steady.direction, 'below');
});

test('only the last six readings form the baseline', () => {
  // The three ancient 40s are outside the window, so the baseline is 18.
  const anomaly = anomalyFor([40, 40, 40, 18, 18, 18, 18, 18, 18, 12]);
  assert.ok(anomaly);
  assert.equal(anomaly.baseline, 18);
  assert.equal(anomaly.sampleSize, 6);
});

test('the anomaly points at the entry it was measured on', () => {
  const rows = runOfMileages([18, 18, 18, 12]);
  const analysis = analyzeFuelData(entries(...rows), { referenceDate: at(2026, 2, 1) });
  const anomaly = detectMileageAnomaly(analysis);
  assert.ok(anomaly);
  assert.equal(anomaly.observation.entryId, analysis.entriesOldestFirst[4].id);
});

test('partial fills in between do not become baseline readings', () => {
  const analysis = analyzeFuelData(
    entries(
      { on: [2026, 1, 1], odometer: 1000, litres: 10 },
      { on: [2026, 1, 2], odometer: 1180, litres: 10 },
      { on: [2026, 1, 3], odometer: 1360, litres: 10 },
      { on: [2026, 1, 4], odometer: 1540, litres: 10 },
      { on: [2026, 1, 5], odometer: 1600, litres: 5, full: false },
      { on: [2026, 1, 6], odometer: 1720, litres: 10 }
    ),
    { referenceDate: at(2026, 2, 1) }
  );
  // Three observations only: the partial fill breaks both of its pairs.
  assert.equal(analysis.observations.length, 3);
  assert.equal(detectMileageAnomaly(analysis), null);
});

test('an empty history has nothing to detect', () => {
  assert.equal(detectMileageAnomaly(analyzeFuelData([], { referenceDate: at(2026, 2, 1) })), null);
});
