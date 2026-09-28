import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Space, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';
import { useElevation } from '@/hooks/useThemeColors';
import type { Insight, InsightIcon, InsightTone } from '@/utils/fuelInsights';

const ICONS: Record<InsightIcon, keyof typeof Ionicons.glyphMap> = {
  'trending-up': 'trending-up',
  'trending-down': 'trending-down',
  wallet: 'wallet-outline',
  alert: 'alert-circle-outline',
  trophy: 'trophy-outline',
  forecast: 'analytics-outline',
  info: 'information-circle-outline',
};

interface InsightCardProps {
  insight: Insight;
  colors: ThemeColors;
  /** Hides the footnote on space-constrained surfaces such as Home. */
  compact?: boolean;
}

function toneColor(tone: InsightTone, colors: ThemeColors): string {
  if (tone === 'positive') return colors.mileageGood;
  // Amber for things worth a second look: it reads as Tankful's own voice
  // rather than as an error, which is the right register for an observation
  // about fuel. Rose is reserved for genuinely bad readings.
  if (tone === 'attention') return colors.tint;
  return colors.textMuted;
}

/**
 * One generated observation. The engine owns the words (utils/fuelInsights);
 * this only decides how they look, so no sentence is assembled in JSX.
 */
export function InsightCard({ insight, colors, compact = false }: InsightCardProps) {
  const elevation = useElevation('level1');
  const accent = toneColor(insight.tone, colors);

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={[
        insight.title,
        insight.description,
        insight.estimated ? 'This figure is an estimate.' : null,
        compact ? null : insight.footnote,
      ]
        .filter(Boolean)
        .join(' ')}
      style={[
        styles.card,
        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
        elevation,
      ]}
    >
      <View style={[styles.iconChip, { backgroundColor: colors.background }]}>
        <Ionicons name={ICONS[insight.icon]} size={18} color={accent} />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text }]}>{insight.title}</Text>
          {insight.estimated && (
            <View style={[styles.estimateChip, { borderColor: colors.border }]}>
              <Text style={[styles.estimateLabel, { color: colors.textMuted }]}>Estimate</Text>
            </View>
          )}
        </View>
        <Text style={[styles.description, { color: colors.textMuted }]}>
          {insight.description}
        </Text>
        {!compact && insight.footnote && (
          <Text style={[styles.footnote, { color: colors.textMuted }]}>{insight.footnote}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: Space.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Space.lg,
  },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: Space.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  title: { flex: 1, fontSize: 15, fontFamily: Fonts.bold },
  description: { fontSize: 13, lineHeight: 19, fontFamily: Fonts.regular },
  footnote: { fontSize: 12, lineHeight: 17, fontFamily: Fonts.regular, opacity: 0.9 },
  estimateChip: {
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 2,
    paddingHorizontal: Space.sm,
  },
  estimateLabel: {
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontFamily: Fonts.semiBold,
  },
});
