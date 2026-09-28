import { strict as assert } from 'node:assert';
import test from 'node:test';
import { analyzeFuelData } from '../fuelAnalytics';
import { buildPersonalRecords, type PersonalRecordId } from '../personalRecords';
import { at, entries, type EntryInput } from './helpers';

function recordsFor(rows: EntryInput[], reference = at(2026, 8, 20)) {
  const analysis = analyzeFuelData(entries(...rows), { referenceDate: reference });
  const records = buildPersonalRecords(analysis);
  return {
    records,
    ids: records.map((record) => record.id),
    find: (id: PersonalRecordId) => records.find((record) => record.id === id),
  };
}

test('nothing logged means no records at all', () => {
  assert.deepEqual(recordsFor([]).records, []);
});

test('a lone fill-up yields only the largest-fill record', () => {
  const { ids } = recordsFor([{ on: [2026, 8, 3], odometer: 1000, litres: 30 }]);
  assert.deepEqual(ids, ['largest-fill']);
});

test('one full-tank pair unlocks the mileage-based records', () => {
  const { ids, find } = recordsFor([
    { on: [2026, 8, 3], odometer: 1000, litres: 10 },
    { on: [2026, 8, 12], odometer: 1200, litres: 10 },
  ]);
  assert.deepEqual(ids, [
    'best-mileage',
    'lowest-cost-per-distance',
    'longest-distance',
    'largest-fill',
  ]);
  assert.equal(find('best-mileage')?.value, 20);
  assert.equal(find('longest-distance')?.value, 200);
  assert.equal(find('lowest-cost-per-distance')?.value, 5);
});

test('records pick the best of several observations and date them', () => {
  const rows: EntryInput[] = [
    { on: [2026, 8, 1], odometer: 1000, litres: 10 },
    { on: [2026, 8, 8], odometer: 1150, litres: 10 },
    { on: [2026, 8, 15], odometer: 1400, litres: 10 },
    { on: [2026, 8, 22], odometer: 1550, litres: 10 },
  ];
  const { find } = recordsFor(rows, at(2026, 8, 25));
  const best = find('best-mileage');
  assert.ok(best);
  assert.equal(best.value, 25);
  assert.equal(best.occurredAt.type, 'date');
  if (best.occurredAt.type === 'date') {
    assert.equal(new Date(best.occurredAt.timestamp).getDate(), 15);
  }
});

test('monthly records need two months with data', () => {
  const oneMonth = recordsFor([
    { on: [2026, 8, 3], odometer: 1000, litres: 10 },
    { on: [2026, 8, 12], odometer: 1200, litres: 10 },
  ]);
  assert.ok(!oneMonth.ids.includes('highest-monthly-spend'));

  const twoMonths = recordsFor([
    { on: [2026, 7, 3], odometer: 1000, litres: 10 },
    { on: [2026, 8, 12], odometer: 1200, litres: 40 },
  ]);
  assert.ok(twoMonths.ids.includes('highest-monthly-spend'));
  assert.equal(twoMonths.find('highest-monthly-spend')?.value, 4000);
  assert.equal(twoMonths.find('most-fuel-in-month')?.value, 40);
});

test('the lowest-spend record excludes the month still in progress', () => {
  // August 4,000 and July 3,000 are complete; September so far is only 500,
  // which must not win a month it has not finished.
  const { find } = recordsFor(
    [
      { on: [2026, 6, 3], odometer: 1000, litres: 30 },
      { on: [2026, 7, 3], odometer: 1200, litres: 40 },
      { on: [2026, 8, 3], odometer: 1400, litres: 5 },
    ],
    at(2026, 8, 10)
  );
  assert.equal(find('lowest-monthly-spend')?.value, 3000);
  // The highest may include the current month: that money is already spent.
  assert.equal(find('highest-monthly-spend')?.value, 4000);
});

test('deleting the middle fill-up re-derives the records around the gap', () => {
  const all: EntryInput[] = [
    { on: [2026, 8, 1], odometer: 1000, litres: 10 },
    { on: [2026, 8, 8], odometer: 1250, litres: 10 },
    { on: [2026, 8, 15], odometer: 1400, litres: 10 },
  ];
  assert.equal(recordsFor(all, at(2026, 8, 20)).find('best-mileage')?.value, 25);

  const withoutMiddle = [all[0], all[2]];
  const after = recordsFor(withoutMiddle, at(2026, 8, 20));
  // The surviving pair now spans the whole 400 on one 10 litre fill.
  assert.equal(after.find('best-mileage')?.value, 40);
  assert.equal(after.find('longest-distance')?.value, 400);
});

test('a wildly out-of-range best is kept but flagged rather than dropped', () => {
  const { find } = recordsFor(
    [
      { on: [2026, 8, 1], odometer: 1000, litres: 10 },
      { on: [2026, 8, 5], odometer: 1180, litres: 10 },
      { on: [2026, 8, 9], odometer: 1360, litres: 10 },
      { on: [2026, 8, 13], odometer: 1540, litres: 10 },
      // A mistyped odometer: 9,000 km on one tank.
      { on: [2026, 8, 17], odometer: 10540, litres: 10 },
    ],
    at(2026, 8, 20)
  );
  const best = find('best-mileage');
  assert.ok(best);
  assert.equal(best.value, 900);
  assert.equal(best.unusual, true);
});

test('a plausible best is not flagged', () => {
  const { find } = recordsFor(
    [
      { on: [2026, 8, 1], odometer: 1000, litres: 10 },
      { on: [2026, 8, 5], odometer: 1180, litres: 10 },
      { on: [2026, 8, 9], odometer: 1360, litres: 10 },
      { on: [2026, 8, 13], odometer: 1560, litres: 10 },
    ],
    at(2026, 8, 20)
  );
  assert.equal(find('best-mileage')?.unusual, false);
});

test('records belong to the vehicle whose entries were analysed', () => {
  const mixed = entries(
    { vehicleId: 'a', on: [2026, 8, 1], odometer: 1000, litres: 10 },
    { vehicleId: 'b', on: [2026, 8, 2], odometer: 50000, litres: 60 },
    { vehicleId: 'a', on: [2026, 8, 9], odometer: 1200, litres: 10 }
  );
  const analysis = analyzeFuelData(
    mixed.filter((row) => row.vehicleId === 'a'),
    { referenceDate: at(2026, 8, 20) }
  );
  const records = buildPersonalRecords(analysis);
  const largest = records.find((record) => record.id === 'largest-fill');
  assert.equal(largest?.value, 10);
});
