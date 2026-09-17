import { StyleSheet, Text, View } from 'react-native';
import { Radius, Space, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';
import { useElevation } from '@/hooks/useThemeColors';

interface StatCardProps {
  label: string;
  value: string;
  colors: ThemeColors;
  /** Overrides the value text color, e.g. colors.mileageGood/mileageBad. */
  valueColor?: string;
}

export function StatCard({ label, value, colors, valueColor }: StatCardProps) {
  const elevation = useElevation('level1');

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
        elevation,
      ]}
    >
      <Text
        style={[styles.value, { color: valueColor ?? colors.text }]}
        numberOfLines={1}
      >
        {value}
      </Text>
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
  value: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 12,
    fontFamily: Fonts.regular,
  },
});
