import { useEffect } from 'react';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Radius, type ThemeColors } from '@/constants/theme';

interface SkeletonBoxProps {
  colors: ThemeColors;
  height: number;
  width?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * An opacity-pulse placeholder, not a gradient sweep -- a sweep needs a
 * mask (no masked-view dependency here) or several overlapping animated
 * views per box. A pulse needs only Reanimated + View, still reads clearly
 * as "loading", and is cheap to repeat across a whole screen of boxes.
 */
export function SkeletonBox({ colors, height, width = '100%', radius = Radius.sm, style }: SkeletonBoxProps) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.border },
        animatedStyle,
        style,
      ]}
    />
  );
}
