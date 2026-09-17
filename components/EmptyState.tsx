import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Space, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  message: string;
  buttonLabel: string;
  onPress: () => void;
  colors: ThemeColors;
}

export function EmptyState({
  icon,
  message,
  buttonLabel,
  onPress,
  colors,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color={colors.textMuted} />
      <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
      <Pressable
        onPress={onPress}
        style={[styles.button, { backgroundColor: colors.tint }]}
      >
        <Text style={[styles.buttonLabel, { color: colors.onTint }]}>
          {buttonLabel}
        </Text>
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
