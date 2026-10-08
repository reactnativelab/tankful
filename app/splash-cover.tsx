import { useCallback } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Space } from '@/constants/theme';
import { Fonts } from '@/constants/typography';

/**
 * One-time illustrated cover shown before onboarding on true first launch --
 * "page 0" of the first-run flow, reached only via the same hasSeenOnboarding
 * gate/timing that used to redirect straight to /onboarding (see
 * app/_layout.tsx). Distinct from the native OS splash (expo-splash-screen,
 * configured in app.json), which shows on every launch, not just the first.
 *
 * The artwork is the screen. It already carries the mark, the wordmark and
 * both taglines, so the only thing layered over it is the tap hint -- and the
 * hint is the one place here that ignores the theme: it sits on the artwork's
 * near-black asphalt, which looks the same whichever theme the device is in.
 */
export default function SplashCoverScreen() {
  const insets = useSafeAreaInsets();

  const advance = useCallback(() => {
    router.replace('/onboarding');
  }, []);

  return (
    <Pressable style={styles.container} onPress={advance}>
      <Image
        source={require('../assets/images/splash-screen-tankful.png')}
        resizeMode="contain"
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.hint, { bottom: insets.bottom + Space.xl }]}>
        <Text style={styles.hintLabel}>Tap to continue</Text>
        <Ionicons name="chevron-forward" size={14} color={HINT_COLOR} />
      </View>
    </Pressable>
  );
}

/** White, like the artwork's own footer type, dimmed so the hint stays secondary. */
const HINT_COLOR = 'rgba(255,255,255,0.82)';

const styles = StyleSheet.create({
  // The artwork's own bottom edge, so the letterbox bars `contain` leaves on
  // an aspect ratio other than the 876x1796 it was drawn at read as part of
  // the image rather than a pale frame around it.
  container: { flex: 1, backgroundColor: '#0D1016' },
  hint: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  hintLabel: { fontSize: 13, fontFamily: Fonts.semiBold, color: HINT_COLOR },
});
