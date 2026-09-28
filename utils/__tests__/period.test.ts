import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  addMonths,
  clampDayToMonth,
  compareMonths,
  daysInMonth,
  isInMonth,
  isSameMonth,
  monthKey,
  monthProgress,
  monthRefOf,
  monthsBetween,
  startOfMonth,
  startOfNextMonth,
} from '../period';
import { at } from './helpers';

test('December rolls forward into January of the next year', () => {
  assert.deepEqual(addMonths({ year: 2026, month: 11 }, 1), { year: 2027, month: 0 });
});

test('January rolls back into December of the previous year', () => {
  assert.deepEqual(addMonths({ year: 2026, month: 0 }, -1), { year: 2025, month: 11 });
});

test('month lengths cover 28, 29, 30 and 31 days', () => {
  assert.equal(daysInMonth({ year: 2026, month: 1 }), 28);
  assert.equal(daysInMonth({ year: 2024, month: 1 }), 29);
  assert.equal(daysInMonth({ year: 2026, month: 3 }), 30);
  assert.equal(daysInMonth({ year: 2026, month: 0 }), 31);
});

test('month boundaries are local midnight to local midnight', () => {
  const ref = { year: 2026, month: 8 };
  assert.equal(startOfMonth(ref).getDate(), 1);
  assert.equal(startOfMonth(ref).getHours(), 0);
  assert.equal(startOfNextMonth(ref).getMonth(), 9);
  assert.equal(startOfNextMonth(ref).getDate(), 1);
});

test('membership follows the local calendar month', () => {
  const september = { year: 2026, month: 8 };
  assert.equal(isInMonth(at(2026, 8, 1, 0).getTime(), september), true);
  assert.equal(isInMonth(at(2026, 8, 30, 23).getTime(), september), true);
  assert.equal(isInMonth(at(2026, 9, 1, 0).getTime(), september), false);
  assert.equal(isInMonth(at(2025, 8, 15).getTime(), september), false);
});

test('month keys sort chronologically and compare across years', () => {
  assert.equal(monthKey({ year: 2026, month: 0 }), '2026-01');
  assert.equal(monthKey({ year: 2026, month: 11 }), '2026-12');
  assert.ok(compareMonths({ year: 2025, month: 11 }, { year: 2026, month: 0 }) < 0);
  assert.ok(isSameMonth({ year: 2026, month: 8 }, monthRefOf(at(2026, 8, 20))));
  assert.equal(monthsBetween({ year: 2025, month: 11 }, { year: 2026, month: 2 }), 3);
});

test('progress is 0 at the first instant and approaches 1 at the last', () => {
  const ref = { year: 2026, month: 8 }; // 30 days
  assert.equal(monthProgress(ref, at(2026, 8, 1, 0)), 0);
  assert.equal(monthProgress(ref, at(2026, 8, 16, 0)), 0.5);
  assert.ok(monthProgress(ref, at(2026, 8, 30, 23)) > 0.99);
});

test('progress saturates outside the month it describes', () => {
  const ref = { year: 2026, month: 8 };
  assert.equal(monthProgress(ref, at(2026, 9, 5)), 1);
  assert.equal(monthProgress(ref, at(2026, 7, 20)), 0);
});

test('a 31st clamps to the last day of a shorter month', () => {
  assert.equal(clampDayToMonth({ year: 2026, month: 1 }, 31), 28);
  assert.equal(clampDayToMonth({ year: 2024, month: 1 }, 31), 29);
  assert.equal(clampDayToMonth({ year: 2026, month: 8 }, 31), 30);
  assert.equal(clampDayToMonth({ year: 2026, month: 8 }, 0), 1);
});
