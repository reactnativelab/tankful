export function formatCurrency(amount: number, symbol = '₹'): string {
  return `${symbol}${amount.toFixed(2)}`;
}

export function formatNumber(value: number, decimals = 1): string {
  return value.toFixed(decimals);
}

export function formatMileage(
  value: number | null,
  unit: 'km' | 'mi',
  decimals = 1
): string {
  if (value === null) return '—';
  const unitLabel = unit === 'km' ? 'km/l' : 'mi/gal';
  return `${formatNumber(value, decimals)} ${unitLabel}`;
}

export function formatOdometer(value: number, unit: 'km' | 'mi'): string {
  return `${formatNumber(value, 0)} ${unit}`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
