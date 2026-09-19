import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { EmptyState } from '@/components/EmptyState';
import { Fab } from '@/components/Fab';
import { SkeletonBox } from '@/components/Skeleton';
import { StatCard } from '@/components/StatCard';
import { VehicleSelector } from '@/components/VehicleSelector';
import { Radius, Space, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';
import { useCountUp } from '@/hooks/useCountUp';
import { useElevation, useThemeColors } from '@/hooks/useThemeColors';
import { useSelectedVehicle } from '@/hooks/useSelectedVehicle';
import { useSettings } from '@/hooks/useSettings';
import { useVehicleDashboard } from '@/hooks/useVehicleDashboard';
import { useVehicles } from '@/hooks/useVehicles';
import { buildMonthlySummary, countFillupsInMonth } from '@/utils/buildMonthlySummary';
import { formatCurrency, formatDate, formatMileage, formatNumber } from '@/utils/format';

export default function HomeScreen() {
  const colors = useThemeColors();
  const heroElevation = useElevation('level2');
  const insets = useSafeAreaInsets();
  const { currencySymbol, distanceUnit } = useSettings();
  const { vehicles, loading: vehiclesLoading } = useVehicles();
  const { selectedVehicleId, setSelectedVehicleId } = useSelectedVehicle();

  const activeVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0] ?? null,
    [vehicles, selectedVehicleId]
  );

  const dashboard = useVehicleDashboard(activeVehicle?.id ?? null);
  const animatedMileage = useCountUp(dashboard.currentMileage);

  // Stat cards should only stagger in on a vehicle's genuine first reveal,
  // not on every focus refetch (loading flips true/false each time this
  // screen regains focus). Keyed per vehicle id so switching vehicles still
  // gets its own first-reveal animation.
  const revealedVehicleIds = useRef<Set<string>>(new Set());
  const isFirstReveal = !!activeVehicle && !revealedVehicleIds.current.has(activeVehicle.id);

  useEffect(() => {
    if (!dashboard.loading && activeVehicle) {
      revealedVehicleIds.current.add(activeVehicle.id);
    }
  }, [dashboard.loading, activeVehicle]);

  const monthlyFillupCount = useMemo(
    () => countFillupsInMonth(dashboard.entries),
    [dashboard.entries]
  );

  const handleShareSummary = useCallback(() => {
    if (!activeVehicle) return;
    const message = buildMonthlySummary(dashboard.entries, activeVehicle, {
      currencySymbol,
      distanceUnit,
    });
    Share.share({ message });
  }, [activeVehicle, dashboard.entries, currencySymbol, distanceUnit]);

  const handleFabPress = useCallback(() => {
    if (!activeVehicle) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push({
      pathname: '/modals/log-fillup',
      params: { vehicleId: activeVehicle.id },
    });
  }, [activeVehicle]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.headerRow, { paddingTop: insets.top + Space.md }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Tankful</Text>
        <Pressable onPress={() => router.push('/modals/vehicle-manager')} hitSlop={8}>
          <Ionicons name="car-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      {vehiclesLoading ? (
        <View style={styles.scrollContent}>
          <HomeSkeleton colors={colors} />
        </View>
      ) : vehicles.length === 0 ? (
        <EmptyState
          icon="car-outline"
          message={"Add a vehicle to start logging fill-ups."}
          buttonLabel="Add Vehicle"
          onPress={() => router.push('/modals/add-edit-vehicle')}
          colors={colors}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <VehicleSelector
            vehicles={vehicles}
            selectedId={activeVehicle?.id ?? ''}
            onSelect={setSelectedVehicleId}
            colors={colors}
          />

          {dashboard.loading ? (
            <HomeSkeleton colors={colors} />
          ) : (
            <>
              <View style={[styles.heroCard, heroElevation]}>
                <LinearGradient
                  colors={colors.heroGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                {dashboard.mileageTrend && (
                  <View style={[styles.heroTrendBadge, { backgroundColor: colors.surfaceElevated }]}>
                    <Ionicons
                      name={
                        dashboard.mileageTrend.direction === 'flat'
                          ? 'remove'
                          : dashboard.mileageTrend.direction === 'up'
                            ? 'arrow-up'
                            : 'arrow-down'
                      }
                      size={11}
                      color={
                        dashboard.mileageTrend.direction === 'flat'
                          ? colors.textMuted
                          : dashboard.mileageTrend.direction === 'up'
                            ? colors.mileageGood
                            : colors.mileageBad
                      }
                    />
                    <Text
                      style={[
                        styles.heroTrendLabel,
                        {
                          color:
                            dashboard.mileageTrend.direction === 'flat'
                              ? colors.textMuted
                              : dashboard.mileageTrend.direction === 'up'
                                ? colors.mileageGood
                                : colors.mileageBad,
                        },
                      ]}
                    >
                      {dashboard.mileageTrend.percent.toFixed(0)}% vs last month
                    </Text>
                  </View>
                )}
                <Text style={[styles.heroLabel, { color: colors.onTint }]}>
                  Current Mileage
                </Text>
                <Text style={[styles.heroValue, { color: colors.onTint }]}>
                  {formatMileage(animatedMileage, distanceUnit)}
                </Text>
                {dashboard.currentMileage === null && (
                  <Text style={[styles.heroCaption, { color: colors.onTint }]}>
                    Log 2 full-tank fill-ups to see mileage.
                  </Text>
                )}
              </View>

              <View style={styles.statRow}>
                <Animated.View
                  style={styles.statCardWrap}
                  entering={isFirstReveal ? FadeInDown.delay(0).springify().damping(16) : undefined}
                >
                  <StatCard
                    label="This Month"
                    value={formatCurrency(dashboard.monthlySpend, currencySymbol)}
                    colors={colors}
                    trend={dashboard.spendTrend}
                  />
                </Animated.View>
                <Animated.View
                  style={styles.statCardWrap}
                  entering={isFirstReveal ? FadeInDown.delay(80).springify().damping(16) : undefined}
                >
                  <StatCard
                    label="Avg Mileage"
                    value={formatMileage(dashboard.averageMileage, distanceUnit)}
                    colors={colors}
                  />
                </Animated.View>
                <Animated.View
                  style={styles.statCardWrap}
                  entering={isFirstReveal ? FadeInDown.delay(160).springify().damping(16) : undefined}
                >
                  <StatCard
                    label="Last Fill-up"
                    value={
                      dashboard.lastEntry ? formatDate(dashboard.lastEntry.date) : '—'
                    }
                    colors={colors}
                  />
                </Animated.View>
              </View>

              <Pressable
                onPress={handleShareSummary}
                disabled={monthlyFillupCount === 0}
                style={[
                  styles.shareButton,
                  { borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name="share-social-outline"
                  size={16}
                  color={monthlyFillupCount === 0 ? colors.textMuted : colors.tint}
                />
                <Text
                  style={[
                    styles.shareButtonLabel,
                    { color: monthlyFillupCount === 0 ? colors.textMuted : colors.tint },
                  ]}
                >
                  Share Monthly Summary
                </Text>
              </Pressable>

              <Pressable onPress={() => router.push('/history')}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Recent Fill-ups
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </View>

                {dashboard.recentEntries.length === 0 ? (
                  <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                    No fill-ups logged yet.
                  </Text>
                ) : (
                  <View
                    style={[
                      styles.recentList,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    {dashboard.recentEntries.map((entry, i) => (
                      <View
                        key={entry.id}
                        style={[
                          styles.recentRow,
                          i > 0 && {
                            borderTopWidth: StyleSheet.hairlineWidth,
                            borderTopColor: colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.recentDate, { color: colors.text }]}>
                          {formatDate(entry.date)}
                        </Text>
                        <Text style={[styles.tabularText, { color: colors.textMuted }]}>
                          {formatNumber(entry.litresFilled, 2)} L
                        </Text>
                        <Text style={[styles.recentCost, { color: colors.text }]}>
                          {formatCurrency(entry.totalCost, currencySymbol)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </Pressable>
            </>
          )}
        </ScrollView>
      )}

      {activeVehicle && (
        <Fab
          icon="water"
          accessibilityLabel="Log Fill-up"
          onPress={handleFabPress}
          bottom={Space.lg + insets.bottom}
          colors={colors}
          elevation={heroElevation}
        />
      )}
    </View>
  );
}

function HomeSkeleton({ colors }: { colors: ThemeColors }) {
  return (
    <View style={styles.skeletonGroup}>
      <SkeletonBox colors={colors} height={140} radius={Radius.lg} />
      <View style={styles.statRow}>
        <SkeletonBox colors={colors} height={64} radius={Radius.md} style={styles.statCardWrap} />
        <SkeletonBox colors={colors} height={64} radius={Radius.md} style={styles.statCardWrap} />
        <SkeletonBox colors={colors} height={64} radius={Radius.md} style={styles.statCardWrap} />
      </View>
      <SkeletonBox colors={colors} height={20} width={160} radius={4} />
      <SkeletonBox colors={colors} height={140} radius={Radius.md} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.lg,
    paddingBottom: Space.xs,
  },
  headerTitle: { fontSize: 20, fontFamily: Fonts.extraBold },
  scrollContent: { padding: Space.lg, gap: Space.lg, paddingBottom: 96 },
  skeletonGroup: { gap: Space.lg },
  heroCard: {
    borderRadius: Radius.lg,
    padding: Space.xl,
    alignItems: 'center',
    gap: Space.sm,
    overflow: 'hidden',
  },
  heroLabel: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Fonts.semiBold,
  },
  heroValue: { fontSize: 40, fontFamily: Fonts.extraBold, fontVariant: ['tabular-nums'] },
  heroCaption: { fontSize: 13, textAlign: 'center', fontFamily: Fonts.regular },
  heroTrendBadge: {
    position: 'absolute',
    top: Space.md,
    right: Space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.pill,
    paddingVertical: 4,
    paddingHorizontal: Space.sm,
  },
  heroTrendLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    fontVariant: ['tabular-nums'],
  },
  statRow: { flexDirection: 'row', gap: Space.sm },
  statCardWrap: { flex: 1 },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Space.md,
  },
  shareButtonLabel: { fontSize: 14, fontFamily: Fonts.semiBold },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.sm,
  },
  sectionTitle: { fontSize: 16, fontFamily: Fonts.bold },
  emptyHint: { fontFamily: Fonts.regular },
  recentList: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
    gap: Space.sm,
  },
  recentDate: { fontSize: 14, fontFamily: Fonts.semiBold, flex: 1 },
  recentCost: { fontSize: 14, fontFamily: Fonts.semiBold, fontVariant: ['tabular-nums'] },
  tabularText: { fontFamily: Fonts.regular, fontVariant: ['tabular-nums'] },
});
