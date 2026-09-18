import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Radius, Space, type ElevationStyle, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface FabProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  bottom: number;
  colors: ThemeColors;
  elevation: ElevationStyle;
}

/**
 * Shared by the Home and Vehicle Manager FABs. Haptics stay owned by each
 * call site's onPress (already wired in Tier 1) -- this only adds the
 * press-in/press-out scale so the two don't fire twice.
 */
export function Fab({ icon, label, onPress, bottom, colors, elevation }: FabProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.94, { duration: 80 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 220 });
      }}
      style={[styles.fab, { backgroundColor: colors.tint, bottom }, elevation, animatedStyle]}
    >
      <Ionicons name={icon} size={20} color={colors.onTint} />
      <Text style={[styles.label, { color: colors.onTint }]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    borderRadius: Radius.pill,
    paddingVertical: Space.md,
    paddingHorizontal: Space.xl,
  },
  label: { fontSize: 15, fontFamily: Fonts.bold },
});
