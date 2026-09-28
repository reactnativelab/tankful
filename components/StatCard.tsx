import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Space, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';
import { useElevation } from '@/hooks/useThemeColors';
import { formatPercent } from '@/utils/format';
import type { Trend } from '@/utils/fuelAnalytics';

interface StatCardProps {
  label: string;
  value: string;
  colors: ThemeColors;
  /** Overrides the value text color, e.g. colors.mileageGood/mileageBad. */
  valueColor?: string;
  /** Small up/down + percent indicator shown next to the value, e.g. month-over-month spend change. */
  trend?: Trend | null;
  /** Read instead of the raw label/value pair; defaults to "<label>: <value>" plus the trend. */
  accessibilityLabel?: string;
  /** How to color an 'up' trend -- spend going up is bad, so callers using this for spend should pass 'bad'. */
  trendUpMeaning?: 'good' | 'bad';
}

export function StatCard({
  label,
  value,
  colors,
  valueColor,
  trend,
  trendUpMeaning = 'bad',
  accessibilityLabel,
}: StatCardProps) {
  const elevation = useElevation('level1');

  // Announced as one phrase: an arrow glyph and a bare percentage read as
  // gibberish when the label lands three swipes away from the value.
  const trendSpoken = trend
    ? trend.direction === 'flat'
      ? ', unchanged'
      : `, ${trend.direction === 'up' ? 'up' : 'down'} ${formatPercent(trend.percent)}`
    : '';

  const trendColor =
    trend && trend.direction !== 'flat'
      ? (trend.direction === 'up') === (trendUpMeaning === 'good')
        ? colors.mileageGood
        : colors.mileageBad
      : colors.textMuted;

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? `${label}: ${value}${trendSpoken}`}
      style={[
        styles.card,
        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
        elevation,
      ]}
    >
      <View style={styles.valueRow}>
        <Text
          style={[styles.value, { color: valueColor ?? colors.text }]}
          numberOfLines={1}
        >
          {value}
        </Text>
        {trend && (
          <View style={styles.trend}>
            <Ionicons
              name={
                trend.direction === 'flat'
                  ? 'remove'
                  : trend.direction === 'up'
                    ? 'arrow-up'
                    : 'arrow-down'
              }
              size={11}
              color={trendColor}
            />
            <Text style={[styles.trendLabel, { color: trendColor }]}>
              {formatPercent(trend.percent)}
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Space.md,
    paddingHorizontal: Space.sm,
    gap: Space.xs,
  },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: Space.xs },
  value: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    fontVariant: ['tabular-nums'],
  },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  trendLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 12,
    fontFamily: Fonts.regular,
  },
});
