import { strict as assert } from 'node:assert';
import test from 'node:test';
import { budgetBarFraction, calculateBudgetStatus } from '../fuelBudget';

test('no budget configured means no budget status, not a 0% one', () => {
  assert.equal(calculateBudgetStatus(500, null), null);
});

test('a disabled budget is not applied even when an amount is stored', () => {
  assert.equal(calculateBudgetStatus(500, { amount: 8000, enabled: false }), null);
});

test('a zero or negative budget is treated as not set', () => {
  assert.equal(calculateBudgetStatus(500, { amount: 0, enabled: true }), null);
  assert.equal(calculateBudgetStatus(500, { amount: -100, enabled: true }), null);
});

test('a non-finite budget is rejected rather than rendered as NaN', () => {
  assert.equal(calculateBudgetStatus(500, { amount: Number.NaN, enabled: true }), null);
  assert.equal(
    calculateBudgetStatus(500, { amount: Number.POSITIVE_INFINITY, enabled: true }),
    null
  );
});

test('under budget stays calm', () => {
  const status = calculateBudgetStatus(5420, { amount: 8000, enabled: true });
  assert.ok(status);
  assert.equal(status.percentUsed, 67.8);
  assert.equal(status.remaining, 2580);
  assert.equal(status.overBy, 0);
  assert.equal(status.level, 'normal');
  assert.equal(status.label, 'On track');
});

test('the bands step at 70, 90 and 100 percent', () => {
  const at = (spent: number) => calculateBudgetStatus(spent, { amount: 100, enabled: true })?.level;
  assert.equal(at(69.9), 'normal');
  assert.equal(at(70), 'approaching');
  assert.equal(at(89.9), 'approaching');
  assert.equal(at(90), 'high');
  assert.equal(at(99.9), 'high');
  assert.equal(at(100), 'exceeded');
});

test('spending exactly the budget counts as exceeded, with nothing left', () => {
  const status = calculateBudgetStatus(8000, { amount: 8000, enabled: true });
  assert.ok(status);
  assert.equal(status.percentUsed, 100);
  assert.equal(status.remaining, 0);
  assert.equal(status.overBy, 0);
  assert.equal(status.label, 'Over budget');
});

test('over budget reports how far over, and the bar stops at full', () => {
  const status = calculateBudgetStatus(8640, { amount: 8000, enabled: true });
  assert.ok(status);
  assert.equal(status.overBy, 640);
  assert.equal(status.remaining, -640);
  assert.equal(status.level, 'exceeded');
  assert.equal(budgetBarFraction(status), 1);
});

test('a very large budget still produces a sane percentage', () => {
  const status = calculateBudgetStatus(5000, { amount: 100_000_000, enabled: true });
  assert.ok(status);
  assert.equal(status.percentUsed, 0);
  assert.equal(status.level, 'normal');
  assert.equal(budgetBarFraction(status), 0);
});

test('nonsense spending is floored at zero rather than propagated', () => {
  const status = calculateBudgetStatus(Number.NaN, { amount: 8000, enabled: true });
  assert.ok(status);
  assert.equal(status.spent, 0);
  assert.equal(status.percentUsed, 0);
  assert.equal(status.remaining, 8000);
});
