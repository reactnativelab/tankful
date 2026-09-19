import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Space, type ElevationStyle, type ThemeColors } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SIZE = 56;

interface FabProps {
  icon: keyof typeof Ionicons.glyphMap;
  /** Not shown visually (the FAB is icon-only) -- read by screen readers instead. */
  accessibilityLabel: string;
  onPress: () => void;
  bottom: number;
  colors: ThemeColors;
  elevation: ElevationStyle;
}

/**
 * Shared by the Home and Vehicle Manager FABs. Icon-only circular button --
 * each call site passes an icon unambiguous enough to stand alone (a fuel
 * droplet for logging a fill-up, a plus for adding a vehicle), with the
 * former label preserved as accessibilityLabel. Haptics stay owned by each
 * call site's onPress (already wired in Tier 1) -- this only adds the
 * press-in/press-out scale so the two don't fire twice.
 */
export function Fab({ icon, accessibilityLabel, onPress, bottom, colors, elevation }: FabProps) {
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
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.fab, { backgroundColor: colors.tint, bottom }, elevation, animatedStyle]}
    >
      <Ionicons name={icon} size={24} color={colors.onTint} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Space.lg,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
