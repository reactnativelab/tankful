import { StyleSheet, Text, View } from 'react-native';
import { Radius, Space, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';
import { budgetBarFraction, type BudgetLevel, type BudgetStatus } from '@/utils/fuelBudget';
import { formatCurrency, formatPercent } from '@/utils/format';

interface BudgetMeterProps {
  status: BudgetStatus;
  currencySymbol: string;
  monthLabel: string;
  colors: ThemeColors;
}

/**
 * Colour is the last signal here, never the only one: the same state is
 * spelled out in the status text ("Approaching your budget"), in the
 * percentage and in the accessibility label, so the meter still works in
 * greyscale and under a screen reader.
 */
function levelColor(level: BudgetLevel, colors: ThemeColors): string {
  switch (level) {
    case 'exceeded':
      return colors.mileageBad;
    case 'high':
      return colors.tint;
    case 'approaching':
      return colors.tint;
    default:
      return colors.mileageGood;
  }
}

export function BudgetMeter({ status, currencySymbol, monthLabel, colors }: BudgetMeterProps) {
  const accent = levelColor(status.level, colors);
  const fraction = budgetBarFraction(status);
  const spent = formatCurrency(status.spent, currencySymbol);
  const amount = formatCurrency(status.amount, currencySymbol);

  const remainderLine =
    status.overBy > 0
      ? `${formatCurrency(status.overBy, currencySymbol)} over`
      : `${formatCurrency(status.remaining, currencySymbol)} left`;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(status.percentUsed) }}
      accessibilityLabel={`Fuel budget for ${monthLabel}: ${spent} of ${amount} used, ${formatPercent(status.percentUsed)}. ${remainderLine}. ${status.label}.`}
      style={styles.container}
    >
      <View style={styles.headline}>
        <Text style={[styles.spent, { color: colors.text }]}>{spent}</Text>
        <Text style={[styles.amount, { color: colors.textMuted }]}>of {amount}</Text>
      </View>

      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.track, { backgroundColor: colors.border }]}
      >
        <View
          style={[
            styles.fill,
            { backgroundColor: accent, width: `${Math.round(fraction * 100)}%` },
          ]}
        />
      </View>

      <View style={styles.footRow}>
        <Text style={[styles.status, { color: accent }]}>{status.label}</Text>
        <Text style={[styles.remainder, { color: colors.textMuted }]}>
          {formatPercent(status.percentUsed)} used · {remainderLine}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Space.sm },
  headline: { flexDirection: 'row', alignItems: 'baseline', gap: Space.sm, flexWrap: 'wrap' },
  spent: { fontSize: 24, fontFamily: Fonts.extraBold, fontVariant: ['tabular-nums'] },
  amount: { fontSize: 14, fontFamily: Fonts.medium, fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  footRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.sm,
    flexWrap: 'wrap',
  },
  status: { fontSize: 13, fontFamily: Fonts.semiBold },
  remainder: { fontSize: 12, fontFamily: Fonts.regular, fontVariant: ['tabular-nums'] },
});
