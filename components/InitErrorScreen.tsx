import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Space, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';

interface InitErrorScreenProps {
  onRetry: () => void;
  colors: ThemeColors;
}

/**
 * Shown in place of app/_layout.tsx's whole tree when the store's db state is
 * 'error' -- the database itself never opened, so there is no screen under
 * this one that could render anything useful. Deliberately has no reset/wipe
 * action: a database that will not open cannot be reset.
 */
export function InitErrorScreen({ onRetry, colors }: InitErrorScreenProps) {
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
      <Text style={[styles.message, { color: colors.textMuted }]}>
        Tankful couldn&apos;t open its data. Your fill-ups haven&apos;t been deleted. Try
        again, and if it keeps happening, restart the app or free up some storage.
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Try Again"
        style={[styles.button, { backgroundColor: colors.tint }]}
      >
        <Text style={[styles.buttonLabel, { color: colors.onTint }]}>Try Again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.lg,
    padding: Space.xl,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    fontFamily: Fonts.regular,
  },
  button: {
    paddingVertical: Space.md,
    paddingHorizontal: Space.xl,
    borderRadius: Radius.pill,
  },
  buttonLabel: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
  },
});
