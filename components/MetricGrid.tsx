import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Space, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';
import type { Trend } from '@/utils/fuelAnalytics';
import { formatPercent } from '@/utils/format';

export interface Metric {
  key: string;
  label: string;
  value: string;
  /** Small note under the value, e.g. what the figure is measured between. */
  caption?: string;
  /** Marks a projected figure so it can never be read as something that happened. */
  estimated?: boolean;
  trend?: Trend | null;
  /** Whether an upward trend is good news for this metric. Spending: no. Mileage: yes. */
  trendUpMeaning?: 'good' | 'bad';
}

interface MetricGridProps {
  metrics: Metric[];
  colors: ThemeColors;
  /** Metrics per row. Two fits a phone comfortably at larger text sizes. */
  columns?: 2 | 3;
}

/**
 * A plain label/value grid for figures that belong together (a month's
 * spending, fuel, distance and cost). It carries no card of its own so the
 * calling surface decides the container.
 */
export function MetricGrid({ metrics, colors, columns = 2 }: MetricGridProps) {
  const basis = columns === 3 ? '30%' : '45%';

  return (
    <View style={styles.grid}>
      {metrics.map((metric) => {
        const trendColor =
          metric.trend && metric.trend.direction !== 'flat'
            ? (metric.trend.direction === 'up') === (metric.trendUpMeaning === 'good')
              ? colors.mileageGood
              : colors.mileageBad
            : colors.textMuted;

        const spokenTrend =
          metric.trend && metric.trend.direction !== 'flat'
            ? `, ${metric.trend.direction === 'up' ? 'up' : 'down'} ${formatPercent(metric.trend.percent)}`
            : '';

        return (
          <View
            key={metric.key}
            accessible
            accessibilityLabel={`${metric.label}: ${metric.estimated ? 'estimated ' : ''}${metric.value}${spokenTrend}${metric.caption ? `. ${metric.caption}` : ''}`}
            style={[styles.cell, { flexBasis: basis }]}
          >
            <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={1}>
              {metric.label}
            </Text>
            <View style={styles.valueRow}>
              <Text style={[styles.value, { color: colors.text }]} numberOfLines={1}>
                {metric.value}
              </Text>
              {metric.trend && (
                <View style={styles.trend}>
                  <Ionicons
                    name={
                      metric.trend.direction === 'flat'
                        ? 'remove'
                        : metric.trend.direction === 'up'
                          ? 'arrow-up'
                          : 'arrow-down'
                    }
                    size={11}
                    color={trendColor}
                  />
                  <Text style={[styles.trendLabel, { color: trendColor }]}>
                    {formatPercent(metric.trend.percent)}
                  </Text>
                </View>
              )}
            </View>
            {(metric.caption || metric.estimated) && (
              <Text style={[styles.caption, { color: colors.textMuted }]} numberOfLines={2}>
                {metric.estimated ? 'Estimated' : ''}
                {metric.estimated && metric.caption ? ' · ' : ''}
                {metric.caption ?? ''}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Space.lg, columnGap: Space.md },
  cell: { flexGrow: 1, gap: 2 },
  label: { fontSize: 12, fontFamily: Fonts.regular },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: Space.xs },
  value: { fontSize: 18, fontFamily: Fonts.bold, fontVariant: ['tabular-nums'] },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  trendLabel: { fontSize: 11, fontFamily: Fonts.semiBold, fontVariant: ['tabular-nums'] },
  caption: { fontSize: 11, fontFamily: Fonts.regular },
});
