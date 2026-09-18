import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Space, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';
import { useElevation } from '@/hooks/useThemeColors';
import type { SpendTrend } from '@/utils/mileage';

interface StatCardProps {
  label: string;
  value: string;
  colors: ThemeColors;
  /** Overrides the value text color, e.g. colors.mileageGood/mileageBad. */
  valueColor?: string;
  /** Small ↑/↓ + percent indicator shown next to the value, e.g. month-over-month spend change. */
  trend?: SpendTrend | null;
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
}: StatCardProps) {
  const elevation = useElevation('level1');

  const trendColor =
    trend && trend.direction !== 'flat'
      ? (trend.direction === 'up') === (trendUpMeaning === 'good')
        ? colors.mileageGood
        : colors.mileageBad
      : colors.textMuted;

  return (
    <View
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
              {trend.percent.toFixed(0)}%
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
