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
import { BudgetMeter } from '@/components/BudgetMeter';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Fab } from '@/components/Fab';
import { InsightCard } from '@/components/InsightCard';
import { MetricGrid, type Metric } from '@/components/MetricGrid';
import { RefreshNotice } from '@/components/RefreshNotice';
import { SectionCard } from '@/components/SectionCard';
import { SkeletonBox } from '@/components/Skeleton';
import { VehicleSelector } from '@/components/VehicleSelector';
import { Radius, Space, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';
import { useCountUp } from '@/hooks/useCountUp';
import { useElevation, useThemeColors } from '@/hooks/useThemeColors';
import { useSelectedVehicle } from '@/hooks/useSelectedVehicle';
import { useSettings } from '@/hooks/useSettings';
import { useVehicleDashboard } from '@/hooks/useVehicleDashboard';
import { useVehicles } from '@/hooks/useVehicles';
import { describeForecastGap } from '@/utils/fuelForecast';
import {
  formatCurrency,
  formatDate,
  formatDistance,
  formatLitres,
  formatMileage,
  formatNumber,
  EMPTY_VALUE,
} from '@/utils/format';
import { buildMonthlyReportShareText } from '@/utils/monthlyReport';
import { addMonths, formatMonthLabel } from '@/utils/period';

export default function HomeScreen() {
  const colors = useThemeColors();
  const heroElevation = useElevation('level2');
  const insets = useSafeAreaInsets();
  const { currencySymbol, distanceUnit, budgetPromptDismissed, dismissBudgetPrompt } =
    useSettings();
  const {
    vehicles,
    loading: vehiclesLoading,
    error: vehiclesError,
    refreshError: vehiclesRefreshError,
    retry: retryVehicles,
  } = useVehicles();
  const { selectedVehicleId, setSelectedVehicleId } = useSelectedVehicle();

  const activeVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0] ?? null,
    [vehicles, selectedVehicleId]
  );

  const dashboard = useVehicleDashboard(activeVehicle?.id ?? null);
  const animatedMileage = useCountUp(dashboard.currentMileage);
  const { report, insights, insightsEnabled, analysis } = dashboard;

  // Stat cards should only stagger in on a vehicle's genuine first reveal.
  // The store no longer flips `loading` on refetch, so this guard is now
  // belt-and-braces (revisit with the ANIM-001 cleanup). Keyed per vehicle id
  // so switching vehicles still gets its own first-reveal animation.
  const revealedVehicleIds = useRef<Set<string>>(new Set());
  const isFirstReveal = !!activeVehicle && !revealedVehicleIds.current.has(activeVehicle.id);

  useEffect(() => {
    // An error screen isn't a reveal: the stagger should still play once a
    // retry brings the data in.
    if (!dashboard.loading && !dashboard.error && activeVehicle) {
      revealedVehicleIds.current.add(activeVehicle.id);
    }
  }, [dashboard.loading, dashboard.error, activeVehicle]);

  const monthMetrics = useMemo<Metric[]>(() => {
    const { actual, spendComparison } = report;
    const previousShort = formatMonthLabel(addMonths(report.ref, -1), 'short');
    return [
      {
        key: 'spend',
        label: 'Fuel spend',
        value: formatCurrency(actual.spend, currencySymbol),
        trend: spendComparison,
        trendUpMeaning: 'bad',
        caption: spendComparison
          ? spendComparison.basis === 'month-to-date'
            ? `vs same days in ${previousShort}`
            : `vs ${previousShort}`
          : undefined,
      },
      {
        key: 'distance',
        label: 'Distance',
        value: actual.distance > 0 ? formatDistance(actual.distance, distanceUnit) : EMPTY_VALUE,
        caption: actual.distance > 0 ? 'between fill-ups' : undefined,
      },
      {
        key: 'fuel',
        label: 'Fuel',
        value: actual.fillCount > 0 ? formatLitres(actual.litres) : EMPTY_VALUE,
        caption: actual.fillCount > 0 ? `${actual.fillCount} fill-ups` : undefined,
      },
      {
        key: 'cost-per-distance',
        label: `Cost / ${distanceUnit}`,
        value:
          actual.costPerDistance !== null
            ? formatCurrency(actual.costPerDistance, currencySymbol)
            : EMPTY_VALUE,
      },
    ];
  }, [report, currencySymbol, distanceUnit]);

  const forecastGap = insightsEnabled ? describeForecastGap(analysis) : null;

  const openReport = useCallback(() => {
    if (!activeVehicle) return;
    router.push({
      pathname: '/monthly-report',
      params: { vehicleId: activeVehicle.id },
    });
  }, [activeVehicle]);

  // Guards a double tap: the share sheet is slow enough to open that a second
  // press lands before the first one has anything on screen.
  const sharing = useRef(false);
  const handleShareSummary = useCallback(async () => {
    if (!activeVehicle || sharing.current) return;
    sharing.current = true;
    try {
      await Share.share({
        message: buildMonthlyReportShareText(report, activeVehicle, {
          currencySymbol,
          distanceUnit,
        }),
      });
    } catch (error) {
      console.error('Failed to share monthly summary', error);
    } finally {
      sharing.current = false;
    }
  }, [activeVehicle, report, currencySymbol, distanceUnit]);

  const handleFabPress = useCallback(() => {
    if (!activeVehicle) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push({
      pathname: '/modals/log-fillup',
      params: { vehicleId: activeVehicle.id },
    });
  }, [activeVehicle]);

  const canShare = report.actual.fillCount > 0;
  const showBudgetPrompt =
    !dashboard.budget && !budgetPromptDismissed && report.actual.fillCount > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.headerRow, { paddingTop: insets.top + Space.md }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Tankful</Text>
        <Pressable
          onPress={() => router.push('/modals/vehicle-manager')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Manage vehicles"
        >
          <Ionicons name="car-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      {vehiclesLoading ? (
        <View style={styles.scrollContent}>
          <HomeSkeleton colors={colors} />
        </View>
      ) : vehiclesError ? (
        <ErrorState what="vehicles" onRetry={retryVehicles} colors={colors} />
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

          {vehiclesRefreshError && (
            <RefreshNotice what="vehicles" onRetry={retryVehicles} colors={colors} />
          )}

          {dashboard.loading ? (
            <HomeSkeleton colors={colors} />
          ) : dashboard.error ? (
            <ErrorState what="fill-ups" onRetry={dashboard.retry} colors={colors} />
          ) : (
            <>
              {dashboard.refreshError && (
                <RefreshNotice what="fill-ups" onRetry={dashboard.retry} colors={colors} />
              )}

              {dashboard.intelligenceError && (
                <View
                  accessible
                  accessibilityRole="alert"
                  style={[
                    styles.promptRow,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Ionicons name="alert-circle-outline" size={18} color={colors.textMuted} />
                  <View style={styles.promptMain}>
                    <Text style={[styles.promptTitle, { color: colors.text }]}>
                      Insights are unavailable right now
                    </Text>
                    <Text style={[styles.promptCaption, { color: colors.textMuted }]}>
                      Your fill-up history is unaffected and still being recorded.
                    </Text>
                  </View>
                </View>
              )}

              <View
                accessible
                accessibilityLabel={[
                  `Current mileage ${formatMileage(dashboard.currentMileage, distanceUnit)}`,
                  dashboard.averageMileage !== null
                    ? `Average ${formatMileage(dashboard.averageMileage, distanceUnit)}`
                    : null,
                  dashboard.mileageTrend && dashboard.mileageTrend.direction !== 'flat'
                    ? `${dashboard.mileageTrend.direction === 'up' ? 'Up' : 'Down'} ${formatNumber(dashboard.mileageTrend.percent, 0)} percent versus last month`
                    : null,
                ]
                  .filter(Boolean)
                  .join('. ')}
                style={[styles.heroCard, heroElevation]}
              >
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
                      {formatNumber(dashboard.mileageTrend.percent, 0)}% vs last month
                    </Text>
                  </View>
                )}
                <Text style={[styles.heroLabel, { color: colors.onTint }]}>
                  Current Mileage
                </Text>
                <Text style={[styles.heroValue, { color: colors.onTint }]}>
                  {formatMileage(animatedMileage, distanceUnit)}
                </Text>
                {dashboard.currentMileage === null ? (
                  <Text style={[styles.heroCaption, { color: colors.onTint }]}>
                    Log 2 full-tank fill-ups to see mileage.
                  </Text>
                ) : (
                  dashboard.averageMileage !== null && (
                    <Text style={[styles.heroCaption, { color: colors.onTint }]}>
                      {formatMileage(dashboard.averageMileage, distanceUnit)} average over{' '}
                      {analysis.observations.length}{' '}
                      {analysis.observations.length === 1 ? 'full tank' : 'full tanks'}
                    </Text>
                  )
                )}
              </View>

              <Animated.View
                entering={isFirstReveal ? FadeInDown.delay(0).springify().damping(16) : undefined}
              >
                <SectionCard
                  title="This Month"
                  trailingLabel={formatMonthLabel(report.ref, 'short')}
                  onPress={openReport}
                  accessibilityHint="Opens the full monthly report"
                  colors={colors}
                >
                  <MetricGrid metrics={monthMetrics} colors={colors} />

                  {report.forecast ? (
                    <View style={[styles.forecastRow, { borderTopColor: colors.border }]}>
                      <View style={styles.forecastMain}>
                        <Text style={[styles.forecastLabel, { color: colors.textMuted }]}>
                          Projected month-end
                        </Text>
                        <Text style={[styles.forecastCaption, { color: colors.textMuted }]}>
                          Estimated from your spending pace
                        </Text>
                      </View>
                      <Text style={[styles.forecastValue, { color: colors.text }]}>
                        {formatCurrency(report.forecast.projected, currencySymbol)}
                      </Text>
                    </View>
                  ) : (
                    forecastGap && (
                      <Text style={[styles.forecastCaption, { color: colors.textMuted }]}>
                        {forecastGap}
                      </Text>
                    )
                  )}
                </SectionCard>
              </Animated.View>

              {dashboard.budget && (
                <Animated.View
                  entering={
                    isFirstReveal ? FadeInDown.delay(80).springify().damping(16) : undefined
                  }
                >
                  <SectionCard title="Fuel Budget" trailingLabel={report.label} colors={colors}>
                    <BudgetMeter
                      status={dashboard.budget}
                      currencySymbol={currencySymbol}
                      monthLabel={report.label}
                      colors={colors}
                    />
                  </SectionCard>
                </Animated.View>
              )}

              {showBudgetPrompt && (
                <View
                  style={[
                    styles.promptRow,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Ionicons name="wallet-outline" size={18} color={colors.tint} />
                  <Pressable
                    onPress={() => router.push('/settings')}
                    style={styles.promptMain}
                    accessibilityRole="button"
                    accessibilityLabel="Set a monthly fuel budget"
                    accessibilityHint="Opens Settings, where budgets are configured"
                  >
                    <Text style={[styles.promptTitle, { color: colors.text }]}>
                      Set a monthly fuel budget
                    </Text>
                    <Text style={[styles.promptCaption, { color: colors.textMuted }]}>
                      Track this vehicle&apos;s spending against a target you choose.
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={dismissBudgetPrompt}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss budget suggestion"
                  >
                    <Ionicons name="close" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              )}

              {insightsEnabled && insights.length > 0 && (
                <Animated.View
                  entering={
                    isFirstReveal ? FadeInDown.delay(160).springify().damping(16) : undefined
                  }
                >
                  <InsightCard insight={insights[0]} colors={colors} compact />
                </Animated.View>
              )}

              <Pressable
                onPress={handleShareSummary}
                disabled={!canShare}
                accessibilityRole="button"
                accessibilityLabel="Share monthly summary"
                accessibilityState={{ disabled: !canShare }}
                style={[styles.shareButton, { borderColor: colors.border }]}
              >
                <Ionicons
                  name="share-social-outline"
                  size={16}
                  color={canShare ? colors.tint : colors.textMuted}
                />
                <Text
                  style={[
                    styles.shareButtonLabel,
                    { color: canShare ? colors.tint : colors.textMuted },
                  ]}
                >
                  Share Monthly Summary
                </Text>
              </Pressable>

              <Pressable
                onPress={() => router.push('/history')}
                accessibilityRole="button"
                accessibilityLabel="Recent fill-ups, open history"
              >
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
      <SkeletonBox colors={colors} height={150} radius={Radius.lg} />
      <SkeletonBox colors={colors} height={88} radius={Radius.lg} />
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
  forecastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Space.md,
  },
  forecastMain: { flex: 1, gap: 2 },
  forecastLabel: { fontSize: 13, fontFamily: Fonts.semiBold },
  forecastCaption: { fontSize: 12, fontFamily: Fonts.regular, lineHeight: 17 },
  forecastValue: { fontSize: 18, fontFamily: Fonts.bold, fontVariant: ['tabular-nums'] },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
  },
  promptMain: { flex: 1, gap: 2, minHeight: 44, justifyContent: 'center' },
  promptTitle: { fontSize: 14, fontFamily: Fonts.semiBold },
  promptCaption: { fontSize: 12, fontFamily: Fonts.regular, lineHeight: 16 },
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

// Opts this route into expo-router's crash boundary (it wraps a route in
// `Try` only when the route exports `ErrorBoundary`) -- a render throw here
// is caught without taking the tab bar or the other tabs down with it.
export { AppErrorBoundary as ErrorBoundary } from '@/components/AppErrorBoundary';
