import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Space, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';

interface RefreshNoticeProps {
  /** What failed to refresh, e.g. "vehicles" or "fill-ups". */
  what: string;
  onRetry: () => void;
  colors: ThemeColors;
}

/**
 * A background refetch failed over data that is already on screen. This
 * stays out of the way -- it never replaces the content, only sits alongside
 * it -- and taps through to a retry. The full-screen ErrorState is reserved
 * for "nothing loaded yet"; this is for "what you're looking at might be out
 * of date".
 */
export function RefreshNotice({ what, onRetry, colors }: RefreshNoticeProps) {
  return (
    <Pressable
      onPress={onRetry}
      accessibilityRole="button"
      accessibilityLabel={`Couldn't refresh ${what}. Tap to retry.`}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Ionicons name="cloud-offline-outline" size={18} color={colors.textMuted} />
      <View style={styles.main}>
        <Text style={[styles.title, { color: colors.text }]}>{`Couldn't refresh ${what}`}</Text>
        <Text style={[styles.caption, { color: colors.textMuted }]}>
          Showing the last data that loaded. Tap to try again.
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
  },
  main: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontFamily: Fonts.semiBold },
  caption: { fontSize: 12, fontFamily: Fonts.regular },
});
