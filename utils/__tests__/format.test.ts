import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  EMPTY_VALUE,
  formatCurrency,
  formatDistance,
  formatLitres,
  formatMileage,
  formatNumber,
  formatOdometer,
  formatPercent,
  mileageUnitLabel,
} from '../format';

test('money is grouped and fixed to two decimals', () => {
  assert.equal(formatCurrency(5420, '₹'), '₹5,420.00');
  assert.equal(formatCurrency(9999999, '₹'), '₹9,999,999.00');
  assert.equal(formatCurrency(0.5, '$'), '$0.50');
  assert.equal(formatCurrency(0, '$'), '$0.00');
});

test('a negative amount keeps its sign outside the symbol', () => {
  assert.equal(formatCurrency(-640, '₹'), '-₹640.00');
});

test('custom currency symbols pass through untouched', () => {
  assert.equal(formatCurrency(100, 'Rs.'), 'Rs.100.00');
  assert.equal(formatCurrency(100, '₿'), '₿100.00');
  assert.equal(formatCurrency(100, 'kr'), 'kr100.00');
});

test('nothing non-finite ever reaches the screen', () => {
  assert.equal(formatCurrency(Number.NaN), EMPTY_VALUE);
  assert.equal(formatCurrency(Number.POSITIVE_INFINITY), EMPTY_VALUE);
  assert.equal(formatNumber(Number.NaN), EMPTY_VALUE);
  assert.equal(formatPercent(Number.NaN), EMPTY_VALUE);
  assert.equal(formatMileage(Number.NaN, 'km'), EMPTY_VALUE);
  assert.equal(formatMileage(null, 'km'), EMPTY_VALUE);
  assert.equal(formatDistance(null, 'km'), EMPTY_VALUE);
  assert.equal(formatLitres(null), EMPTY_VALUE);
});

test('mileage is labelled per litre, in the chosen distance unit', () => {
  assert.equal(mileageUnitLabel('km'), 'km/l');
  // Tankful only stores litres, so miles are per litre -- never MPG.
  assert.equal(mileageUnitLabel('mi'), 'mi/L');
  assert.equal(formatMileage(17.834, 'km'), '17.8 km/l');
  assert.equal(formatMileage(17.834, 'mi'), '17.8 mi/L');
  assert.equal(formatMileage(17.834, 'km', 2), '17.83 km/l');
});

test('distances and odometer readings are whole units, grouped', () => {
  assert.equal(formatDistance(1820, 'km'), '1,820 km');
  assert.equal(formatDistance(1820.6, 'mi'), '1,821 mi');
  assert.equal(formatOdometer(123456, 'km'), '123,456 km');
});

test('percentages default to whole numbers', () => {
  assert.equal(formatPercent(67.75), '68%');
  assert.equal(formatPercent(67.75, 1), '67.8%');
  assert.equal(formatPercent(0), '0%');
});

test('volumes read to one decimal', () => {
  assert.equal(formatLitres(40), '40.0 L');
  assert.equal(formatLitres(1234.56), '1,234.6 L');
});
