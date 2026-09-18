import { useCallback, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Space } from '@/constants/theme';
import { Fonts } from '@/constants/typography';
import { useSettings } from '@/hooks/useSettings';
import { useThemeColors } from '@/hooks/useThemeColors';

interface OnboardingPage {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}

const PAGES: OnboardingPage[] = [
  {
    icon: 'water-outline',
    title: 'Log every fill-up',
    body: 'Record the odometer, litres, and price each time you fuel up. It takes a few seconds.',
  },
  {
    icon: 'stats-chart-outline',
    title: 'See mileage & spend trends',
    body: 'Tankful works out your mileage between full tanks and tracks what you spend over time, automatically.',
  },
  {
    icon: 'car-outline',
    title: 'Track multiple vehicles',
    body: 'Add every bike or car you own and switch between them any time. Each one keeps its own history.',
  },
];

/**
 * Shown once on true first launch (gated on settings.hasSeenOnboarding in
 * app/_layout.tsx), never again after -- including after the user later
 * clears all data with Settings' "Delete All Data", which resets vehicles
 * and entries but deliberately leaves hasSeenOnboarding untouched.
 */
export default function OnboardingScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { setHasSeenOnboarding } = useSettings();
  const scrollRef = useRef<ScrollView>(null);
  const [pageIndex, setPageIndex] = useState(0);

  const finish = useCallback(() => {
    setHasSeenOnboarding(true);
    router.replace('/(tabs)');
  }, [setHasSeenOnboarding]);

  const handleGetStarted = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setHasSeenOnboarding(true);
    router.replace('/(tabs)');
    router.push('/modals/add-edit-vehicle');
  }, [setHasSeenOnboarding]);

  const handleNext = useCallback(() => {
    const next = Math.min(pageIndex + 1, PAGES.length - 1);
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setPageIndex(next);
  }, [pageIndex, width]);

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / width);
      setPageIndex(index);
    },
    [width]
  );

  const isLastPage = pageIndex === PAGES.length - 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Pressable
        onPress={finish}
        hitSlop={12}
        style={[styles.skip, { top: insets.top + Space.md }]}
      >
        <Text style={[styles.skipLabel, { color: colors.textMuted }]}>Skip</Text>
      </Pressable>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
      >
        {PAGES.map((page) => (
          <View key={page.title} style={[styles.page, { width }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name={page.icon} size={48} color={colors.tint} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{page.title}</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>{page.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Space.lg }]}>
        <View style={styles.dots}>
          {PAGES.map((page, i) => (
            <View
              key={page.title}
              style={[
                styles.dot,
                {
                  backgroundColor: i === pageIndex ? colors.tint : colors.border,
                  width: i === pageIndex ? 20 : 8,
                },
              ]}
            />
          ))}
        </View>

        <Pressable
          onPress={isLastPage ? handleGetStarted : handleNext}
          style={[styles.cta, { backgroundColor: colors.tint }]}
        >
          <Text style={[styles.ctaLabel, { color: colors.onTint }]}>
            {isLastPage ? 'Add Your Vehicle' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skip: { position: 'absolute', right: Space.lg, zIndex: 1 },
  skipLabel: { fontSize: 14, fontFamily: Fonts.semiBold },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.xxl,
    gap: Space.lg,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontFamily: Fonts.extraBold, textAlign: 'center' },
  body: { fontSize: 15, fontFamily: Fonts.regular, textAlign: 'center', lineHeight: 22 },
  footer: { gap: Space.xl, paddingHorizontal: Space.xl, paddingTop: Space.md },
  dots: { flexDirection: 'row', gap: Space.sm, justifyContent: 'center' },
  dot: { height: 8, borderRadius: Radius.pill },
  cta: {
    borderRadius: Radius.pill,
    paddingVertical: Space.lg,
    alignItems: 'center',
  },
  ctaLabel: { fontSize: 16, fontFamily: Fonts.bold },
});
