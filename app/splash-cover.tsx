import { useCallback } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Space, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';
import { useThemeColors } from '@/hooks/useThemeColors';

/**
 * One-time illustrated cover shown before onboarding on true first launch --
 * "page 0" of the first-run flow, reached only via the same hasSeenOnboarding
 * gate/timing that used to redirect straight to /onboarding (see
 * app/_layout.tsx). Distinct from the native OS splash (expo-splash-screen,
 * configured in app.json), which shows on every launch, not just the first.
 * No generated/photographic art -- a gradient wash plus a few flat SVG
 * shapes, same spirit as the app icon's hand-authored arc-and-needle mark.
 */
export default function SplashCoverScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const advance = useCallback(() => {
    router.replace('/onboarding');
  }, []);

  return (
    <Pressable
      style={[styles.container, { backgroundColor: colors.background }]}
      onPress={advance}
    >
      <LinearGradient
        colors={[colors.background, `${colors.tint}33`, colors.background]}
        locations={[0, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />

      <MountainSilhouette colors={colors} />

      <View style={styles.content}>
        <Image
          source={require('../assets/images/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.wordmark, { color: colors.text }]}>Tankful</Text>
        <Text style={[styles.tagline, { color: colors.textMuted }]}>
          Better mileage. Lower costs. More freedom.
        </Text>
      </View>

      <View style={[styles.hint, { bottom: insets.bottom + Space.xl }]}>
        <Text style={[styles.hintLabel, { color: colors.textMuted }]}>Tap to continue</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

/** Three layered ridgelines + a road wedge, darkest nearest the viewer. */
function MountainSilhouette({ colors }: { colors: ThemeColors }) {
  return (
    <Svg
      width="100%"
      height="40%"
      viewBox="0 0 400 200"
      style={styles.mountains}
      preserveAspectRatio="none"
    >
      <Path
        d="M0,150 L55,85 L115,145 L175,65 L235,135 L295,95 L355,145 L400,115 L400,200 L0,200 Z"
        fill={`${colors.tint}22`}
      />
      <Path
        d="M0,175 L80,115 L150,165 L220,105 L300,170 L400,135 L400,200 L0,200 Z"
        fill={`${colors.tint}55`}
      />
      <Path d="M170,200 L185,120 L215,120 L230,200 Z" fill={colors.background} opacity={0.9} />
      <Path
        d="M0,200 L100,178 L200,196 L300,168 L400,190 L400,200 Z"
        fill={colors.tint}
        opacity={0.85}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mountains: { position: 'absolute', bottom: 0, left: 0 },
  content: { alignItems: 'center', gap: Space.md, paddingHorizontal: Space.xxl },
  logo: { width: 72, height: 72 },
  wordmark: { fontSize: 32, fontFamily: Fonts.extraBold },
  tagline: { fontSize: 15, fontFamily: Fonts.regular, textAlign: 'center', lineHeight: 22 },
  hint: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hintLabel: { fontSize: 13, fontFamily: Fonts.semiBold },
});
