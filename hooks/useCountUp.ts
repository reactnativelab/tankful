import { useEffect, useRef, useState } from 'react';
import { Easing, runOnJS, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';

/**
 * Tweens from the previous value to `value` whenever it changes, rather
 * than from 0 -- a fill-up updating mileage from 42 to 44 should read as
 * "the number moved", not "it reset and re-counted". The very first reveal
 * has no meaningful previous value, so it snaps instead of animating.
 */
export function useCountUp(value: number | null, duration = 600): number | null {
  const [display, setDisplay] = useState(value);
  const shared = useSharedValue(value ?? 0);
  const hasRevealed = useRef(false);

  useEffect(() => {
    if (value === null) {
      setDisplay(null);
      return;
    }
    if (!hasRevealed.current) {
      hasRevealed.current = true;
      shared.value = value;
      setDisplay(value);
      return;
    }
    shared.value = withTiming(value, { duration, easing: Easing.out(Easing.cubic) });
  }, [value, duration, shared]);

  useAnimatedReaction(
    () => shared.value,
    (current) => {
      runOnJS(setDisplay)(current);
    }
  );

  return display;
}
