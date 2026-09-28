import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Space, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';
import { useElevation } from '@/hooks/useThemeColors';

interface SectionCardProps {
  title: string;
  /** One line under the title explaining what the figures mean. */
  caption?: string;
  /** Small right-aligned label, e.g. the month a card covers. */
  trailingLabel?: string;
  /** Turns the whole header into a button (chevron included). */
  onPress?: () => void;
  accessibilityHint?: string;
  colors: ThemeColors;
  children: ReactNode;
}

/**
 * The shared container for the intelligence surfaces: same radius, border,
 * elevation and header rhythm as the rest of Tankful's cards, so Home, Stats
 * and the monthly report read as one app rather than three.
 */
export function SectionCard({
  title,
  caption,
  trailingLabel,
  onPress,
  accessibilityHint,
  colors,
  children,
}: SectionCardProps) {
  const elevation = useElevation('level1');

  const header = (
    <View style={styles.headerRow}>
      <View style={styles.headerMain}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {caption && (
          <Text style={[styles.caption, { color: colors.textMuted }]}>{caption}</Text>
        )}
      </View>
      {trailingLabel && (
        <Text style={[styles.trailingLabel, { color: colors.textMuted }]}>{trailingLabel}</Text>
      )}
      {onPress && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
    </View>
  );

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
        elevation,
      ]}
    >
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${title}${trailingLabel ? `, ${trailingLabel}` : ''}`}
          accessibilityHint={accessibilityHint}
          hitSlop={4}
          style={styles.headerPressable}
        >
          {header}
        </Pressable>
      ) : (
        header
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Space.lg,
    gap: Space.lg,
  },
  // 44dp minimum target for the header when it navigates somewhere.
  headerPressable: { minHeight: 44, justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  headerMain: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontFamily: Fonts.bold },
  caption: { fontSize: 12, fontFamily: Fonts.regular, lineHeight: 17 },
  trailingLabel: { fontSize: 12, fontFamily: Fonts.semiBold },
});
