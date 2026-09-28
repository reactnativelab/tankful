import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  calculateAverageMileage,
  calculateBestMileage,
  calculateCostPerDistance,
  calculateDistanceForEntry,
  calculateMileageForEntry,
  calculateTotalLitres,
  calculateTotalSpend,
  calculateTravelledDistance,
  calculateWorstMileage,
  sortEntriesOldestFirst,
} from '../mileage';
import { entries, newestFirst, round } from './helpers';

// Characterisation tests for the mileage rules. These encode the behaviour the
// rest of the app is built on: a change here is a product decision, not a
// refactor.

test('full tank to full tank yields distance / litres of the closing fill', () => {
  const series = entries(
    { on: [2026, 8, 1], odometer: 1000, litres: 20 },
    { on: [2026, 8, 10], odometer: 1200, litres: 10 }
  );
  assert.equal(calculateMileageForEntry(series, 1), 20);
});

test('the first entry never has a mileage', () => {
  const series = entries({ on: [2026, 8, 1], odometer: 1000, litres: 20 });
  assert.equal(calculateMileageForEntry(series, 0), null);
});

test('full then partial: the partial fill gets no mileage', () => {
  const series = entries(
    { on: [2026, 8, 1], odometer: 1000, litres: 20 },
    { on: [2026, 8, 10], odometer: 1200, litres: 10, full: false }
  );
  assert.equal(calculateMileageForEntry(series, 1), null);
});

test('partial then full: the full fill gets no mileage either', () => {
  const series = entries(
    { on: [2026, 8, 1], odometer: 1000, litres: 20, full: false },
    { on: [2026, 8, 10], odometer: 1200, litres: 10 }
  );
  assert.equal(calculateMileageForEntry(series, 1), null);
});

test('full, partial, full: only the pair broken by the partial is skipped', () => {
  const series = entries(
    { on: [2026, 8, 1], odometer: 1000, litres: 20 },
    { on: [2026, 8, 5], odometer: 1100, litres: 5, full: false },
    { on: [2026, 8, 10], odometer: 1300, litres: 15 }
  );
  assert.equal(calculateMileageForEntry(series, 1), null);
  assert.equal(calculateMileageForEntry(series, 2), null);
  assert.equal(calculateAverageMileage(series), null);
});

test('three consecutive full tanks produce two observations and their mean', () => {
  const series = entries(
    { on: [2026, 8, 1], odometer: 1000, litres: 20 },
    { on: [2026, 8, 10], odometer: 1200, litres: 10 },
    { on: [2026, 8, 20], odometer: 1400, litres: 20 }
  );
  assert.equal(calculateMileageForEntry(series, 1), 20);
  assert.equal(calculateMileageForEntry(series, 2), 10);
  assert.equal(calculateAverageMileage(series), 15);
});

test('zero litres cannot divide, so there is no mileage', () => {
  const series = entries(
    { on: [2026, 8, 1], odometer: 1000, litres: 20 },
    { on: [2026, 8, 10], odometer: 1200, litres: 0 }
  );
  assert.equal(calculateMileageForEntry(series, 1), null);
});

test('an unchanged odometer yields no distance and no mileage', () => {
  const series = entries(
    { on: [2026, 8, 1], odometer: 1000, litres: 20 },
    { on: [2026, 8, 10], odometer: 1000, litres: 10 }
  );
  assert.equal(calculateDistanceForEntry(series, 1), null);
  assert.equal(calculateMileageForEntry(series, 1), null);
});

test('a decreasing odometer is skipped rather than producing a negative result', () => {
  const series = entries(
    { on: [2026, 8, 1], odometer: 1200, litres: 20 },
    { on: [2026, 8, 10], odometer: 1000, litres: 10 }
  );
  assert.equal(calculateMileageForEntry(series, 1), null);
  assert.equal(calculateTravelledDistance(series), 0);
});

test('entries are sorted by date, then by insertion order for same-day fill-ups', () => {
  const [second, first] = entries(
    { on: [2026, 8, 10], odometer: 1200, litres: 10, createdAt: 2 },
    { on: [2026, 8, 10], odometer: 1100, litres: 5, createdAt: 1 }
  );
  const sorted = sortEntriesOldestFirst([second, first]);
  assert.deepEqual(
    sorted.map((e) => e.odometer),
    [1100, 1200]
  );
});

test('best and worst come from the observation values, not the entries', () => {
  const series = entries(
    { on: [2026, 8, 1], odometer: 1000, litres: 20 },
    { on: [2026, 8, 10], odometer: 1200, litres: 10 },
    { on: [2026, 8, 20], odometer: 1400, litres: 20 }
  );
  const values = [1, 2]
    .map((index) => calculateMileageForEntry(series, index))
    .filter((value): value is number => value !== null);
  assert.equal(calculateBestMileage(values), 20);
  assert.equal(calculateWorstMileage(values), 10);
  assert.equal(calculateBestMileage([]), null);
  assert.equal(calculateWorstMileage([]), null);
});

test('totals cover every fill-up, partial ones included', () => {
  const series = entries(
    { on: [2026, 8, 1], odometer: 1000, litres: 20 },
    { on: [2026, 8, 10], odometer: 1200, litres: 10, full: false }
  );
  assert.equal(calculateTotalLitres(series), 30);
  assert.equal(calculateTotalSpend(series), 3000);
});

test('cost per distance excludes the first fill, which paid for fuel already in the tank', () => {
  const series = entries(
    { on: [2026, 8, 1], odometer: 1000, litres: 20 },
    { on: [2026, 8, 10], odometer: 1200, litres: 10 }
  );
  // 200 km covered, paid for by the second fill-up's 1000.
  assert.equal(calculateCostPerDistance(series), 5);
});

test('cost per distance needs two entries and a positive distance', () => {
  assert.equal(calculateCostPerDistance(entries({ on: [2026, 8, 1], odometer: 1000, litres: 20 })), null);
  assert.equal(
    calculateCostPerDistance(
      entries(
        { on: [2026, 8, 1], odometer: 1000, litres: 20 },
        { on: [2026, 8, 5], odometer: 1000, litres: 10 }
      )
    ),
    null
  );
});

test('input order does not matter: newest-first rows give the same answers', () => {
  const series = entries(
    { on: [2026, 8, 1], odometer: 1000, litres: 20 },
    { on: [2026, 8, 10], odometer: 1200, litres: 10 },
    { on: [2026, 8, 20], odometer: 1400, litres: 20 }
  );
  const reversed = newestFirst(series);
  assert.equal(round(calculateTravelledDistance(reversed)), 400);
  assert.equal(calculateCostPerDistance(reversed), calculateCostPerDistance(series));
  assert.equal(
    calculateAverageMileage(sortEntriesOldestFirst(reversed)),
    calculateAverageMileage(series)
  );
});
