import { useEffect, useMemo, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BudgetMeter } from '@/components/BudgetMeter';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { InsightCard } from '@/components/InsightCard';
import { MetricGrid, type Metric } from '@/components/MetricGrid';
import { PersonalRecordList } from '@/components/PersonalRecordList';
import { RefreshNotice } from '@/components/RefreshNotice';
import { SectionCard } from '@/components/SectionCard';
import { SkeletonBox } from '@/components/Skeleton';
import { VehicleSelector } from '@/components/VehicleSelector';
import { Radius, Space, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';
import { useElevation, useThemeColors } from '@/hooks/useThemeColors';
import { useSelectedVehicle } from '@/hooks/useSelectedVehicle';
import { useSettings } from '@/hooks/useSettings';
import { useVehicles } from '@/hooks/useVehicles';
import { useVehicleStats } from '@/hooks/useVehicleStats';
import { describeForecastGap } from '@/utils/fuelForecast';
import { describeMileageAvailability } from '@/utils/fuelInsights';
import {
  EMPTY_VALUE,
  formatCurrency,
  formatDistance,
  formatLitres,
  formatMileage,
  formatPercent,
} from '@/utils/format';

const SCREEN_PADDING = Space.lg;
const CARD_PADDING = Space.lg;

/** Most recent readings shown on the mileage chart -- older points stay in History. */
const MILEAGE_CHART_POINTS = 12;

export default function StatsScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const cardElevation = useElevation('level1');
  const { currencySymbol, distanceUnit } = useSettings();
  const { width } = useWindowDimensions();
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

  const stats = useVehicleStats(activeVehicle?.id ?? null);
  const { analysis, report, insights, insightsEnabled, records, budget } = stats;

  const chartWidth = width - SCREEN_PADDING * 2 - CARD_PADDING * 2;

  // Same first-reveal gating as Home: the stagger should only play the first
  // time a vehicle's stats actually appear. The store no longer flips
  // stats.loading on refetch, so this is now belt-and-braces (ANIM-001).
  const revealedVehicleIds = useRef<Set<string>>(new Set());
  const isFirstReveal = !!activeVehicle && !revealedVehicleIds.current.has(activeVehicle.id);

  useEffect(() => {
    // An error screen isn't a reveal: the stagger should still play once a
    // retry brings the data in.
    if (!stats.loading && !stats.error && activeVehicle) {
      revealedVehicleIds.current.add(activeVehicle.id);
    }
  }, [stats.loading, stats.error, activeVehicle]);

  const efficiencyMetrics = useMemo<Metric[]>(
    () => [
      {
        key: 'average',
        label: 'Average',
        value: formatMileage(stats.averageMileage, distanceUnit),
        caption: `${analysis.observations.length} full-tank ${analysis.observations.length === 1 ? 'reading' : 'readings'}`,
      },
      {
        key: 'latest',
        label: 'Latest',
        value: formatMileage(stats.latestMileage, distanceUnit),
      },
      {
        key: 'best',
        label: 'Best',
        value: formatMileage(stats.bestMileage, distanceUnit),
      },
      {
        key: 'worst',
        label: 'Worst',
        value: formatMileage(stats.worstMileage, distanceUnit),
      },
    ],
    [stats.averageMileage, stats.latestMileage, stats.bestMileage, stats.worstMileage, analysis.observations.length, distanceUnit]
  );

  const spendingMetrics = useMemo<Metric[]>(
    () => [
      {
        key: 'this-month',
        label: 'This month',
        value: formatCurrency(analysis.currentMonth.spend, currencySymbol),
        trend: analysis.spendComparison,
        trendUpMeaning: 'bad',
        caption:
          analysis.spendComparison?.basis === 'month-to-date'
            ? 'vs same days last month'
            : undefined,
      },
      {
        key: 'last-month',
        label: 'Last month',
        value:
          analysis.previousMonth.fillCount > 0
            ? formatCurrency(analysis.previousMonth.spend, currencySymbol)
            : EMPTY_VALUE,
      },
      {
        key: 'usual',
        label: 'Usual month',
        value: analysis.rollingMonthlySpend
          ? formatCurrency(analysis.rollingMonthlySpend.value, currencySymbol)
          : EMPTY_VALUE,
        caption: analysis.rollingMonthlySpend
          ? `${analysis.rollingMonthlySpend.monthsCounted} months with fill-ups`
          : 'needs 2 past months',
      },
      {
        key: 'projected',
        label: 'Month-end',
        value: report.forecast
          ? formatCurrency(report.forecast.projected, currencySymbol)
          : EMPTY_VALUE,
        estimated: report.forecast !== null,
      },
    ],
    [analysis, report.forecast, currencySymbol]
  );

  const usageMetrics = useMemo<Metric[]>(
    () => [
      { key: 'fuel', label: 'Fuel bought', value: formatLitres(stats.totalLitres) },
      {
        key: 'distance',
        label: 'Distance',
        value:
          stats.totalDistance > 0
            ? formatDistance(stats.totalDistance, distanceUnit)
            : EMPTY_VALUE,
        caption: 'between fill-ups',
      },
      { key: 'spend', label: 'Total spend', value: formatCurrency(stats.totalSpend, currencySymbol) },
      {
        key: 'cost',
        label: `Cost / ${distanceUnit}`,
        value:
          stats.costPerDistance !== null
            ? formatCurrency(stats.costPerDistance, currencySymbol)
            : EMPTY_VALUE,
        caption: 'all time',
      },
    ],
    [stats.totalLitres, stats.totalDistance, stats.totalSpend, stats.costPerDistance, currencySymbol, distanceUnit]
  );

  const mileageChartData = useMemo(
    () => stats.mileageSeries.slice(-MILEAGE_CHART_POINTS),
    [stats.mileageSeries]
  );

  // Six bars have to fit the card without the last one being clipped, so the
  // bar width follows the measured chart width rather than a fixed constant.
  const spendBarSpacing = Space.md;
  const spendBarWidth = Math.max(
    12,
    Math.min(36, Math.floor((chartWidth - 56) / stats.monthlySpendSeries.length) - spendBarSpacing)
  );

  const forecastGap = insightsEnabled ? describeForecastGap(analysis) : null;

  if (vehiclesLoading) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}
      >
        <View style={styles.scrollContent}>
          <StatsSkeleton colors={colors} />
        </View>
      </View>
    );
  }

  if (vehiclesError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <ErrorState what="vehicles" onRetry={retryVehicles} colors={colors} />
      </View>
    );
  }

  if (vehicles.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <EmptyState
          icon="car-outline"
          message={"Add a vehicle to start logging fill-ups."}
          buttonLabel="Add Vehicle"
          onPress={() => router.push('/modals/add-edit-vehicle')}
          colors={colors}
        />
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}
    >
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

        {stats.loading ? (
          <StatsSkeleton colors={colors} />
        ) : stats.error ? (
          <ErrorState what="fill-ups" onRetry={stats.retry} colors={colors} />
        ) : !stats.hasAnyEntries ? (
          <EmptyState
            icon="stats-chart-outline"
            message="Log a fill-up and your fuel stats will build from there."
            buttonLabel="Log Fill-up"
            onPress={() =>
              router.push({
                pathname: '/modals/log-fillup',
                params: activeVehicle ? { vehicleId: activeVehicle.id } : undefined,
              })
            }
            colors={colors}
          />
        ) : (
          <>
            {stats.refreshError && (
              <RefreshNotice what="fill-ups" onRetry={stats.retry} colors={colors} />
            )}

            {stats.intelligenceError && (
              <View
                accessible
                accessibilityRole="alert"
                style={[
                  styles.notice,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Ionicons name="alert-circle-outline" size={18} color={colors.textMuted} />
                <Text style={[styles.note, { color: colors.textMuted }]}>
                  Some of these figures could not be worked out just now. Your fill-up history is
                  unaffected.
                </Text>
              </View>
            )}

            <Animated.View
              entering={isFirstReveal ? FadeInDown.delay(0).springify().damping(16) : undefined}
            >
              <SectionCard
                title="Efficiency"
                caption="Measured between consecutive full-tank fill-ups"
                colors={colors}
              >
                {stats.hasEnoughData && analysis.observations.length > 0 ? (
                  <>
                    <MetricGrid metrics={efficiencyMetrics} colors={colors} />
                    {stats.mileageTrend && stats.mileageTrend.direction !== 'flat' && (
                      <Text style={[styles.note, { color: colors.textMuted }]}>
                        Your last {stats.mileageTrend.recentCount} full tanks averaged{' '}
                        {formatMileage(stats.mileageTrend.recent, distanceUnit)},{' '}
                        {stats.mileageTrend.direction === 'up' ? 'up' : 'down'}{' '}
                        {formatPercent(stats.mileageTrend.percent)} on the{' '}
                        {stats.mileageTrend.baselineCount} before them.
                      </Text>
                    )}
                  </>
                ) : (
                  <Text style={[styles.note, { color: colors.textMuted }]}>
                    Mileage needs two full-tank fill-ups in a row.{' '}
                    {describeMileageAvailability(analysis)}
                  </Text>
                )}
              </SectionCard>
            </Animated.View>

            <Animated.View
              entering={isFirstReveal ? FadeInDown.delay(80).springify().damping(16) : undefined}
            >
              <SectionCard
                title="Spending"
                caption="Calendar months, not rolling 30-day windows"
                colors={colors}
              >
                <MetricGrid metrics={spendingMetrics} colors={colors} />
                {!report.forecast && forecastGap && (
                  <Text style={[styles.note, { color: colors.textMuted }]}>{forecastGap}</Text>
                )}
                {budget && (
                  <View style={[styles.budgetBlock, { borderTopColor: colors.border }]}>
                    <BudgetMeter
                      status={budget}
                      currencySymbol={currencySymbol}
                      monthLabel={report.label}
                      colors={colors}
                    />
                  </View>
                )}
              </SectionCard>
            </Animated.View>

            <Animated.View
              entering={isFirstReveal ? FadeInDown.delay(160).springify().damping(16) : undefined}
            >
              <SectionCard title="Usage" colors={colors}>
                <MetricGrid metrics={usageMetrics} colors={colors} />
              </SectionCard>
            </Animated.View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Mileage Over Time
              </Text>
              <Text style={[styles.sectionCaption, { color: colors.textMuted }]}>
                {mileageChartData.length >= MILEAGE_CHART_POINTS
                  ? `Last ${MILEAGE_CHART_POINTS} full-tank readings`
                  : 'Calculated between consecutive full-tank fill-ups'}
              </Text>
              <View
                accessible
                accessibilityLabel={stats.mileageSeriesSummary}
                style={[
                  styles.chartCard,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  cardElevation,
                ]}
              >
                {mileageChartData.length === 0 ? (
                  <Text style={[styles.chartEmptyText, { color: colors.textMuted }]}>
                    Not enough consecutive full-tank fill-ups yet.
                  </Text>
                ) : (
                  <LineChart
                    data={mileageChartData}
                    width={chartWidth}
                    height={180}
                    color={colors.tint}
                    thickness={2}
                    dataPointsColor={colors.tint}
                    startFillColor={colors.tint}
                    endFillColor={colors.tint}
                    startOpacity={0.35}
                    endOpacity={0}
                    areaChart
                    isAnimated
                    animationDuration={800}
                    yAxisColor={colors.border}
                    xAxisColor={colors.border}
                    rulesColor={colors.border}
                    yAxisTextStyle={{ color: colors.textMuted, fontFamily: Fonts.regular }}
                    xAxisLabelTextStyle={{
                      color: colors.textMuted,
                      fontSize: 10,
                      fontFamily: Fonts.regular,
                    }}
                    backgroundColor="transparent"
                    initialSpacing={16}
                    noOfSections={4}
                  />
                )}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Monthly Spend (Last 6 Months)
              </Text>
              <View
                accessible
                accessibilityLabel={stats.spendSeriesSummary}
                style={[
                  styles.chartCard,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  cardElevation,
                ]}
              >
                <BarChart
                  data={stats.monthlySpendSeries.map((month) => ({
                    value: month.total,
                    label: month.label,
                    frontColor: month.isCurrent ? colors.tint : colors.tabIconDefault,
                  }))}
                  width={chartWidth}
                  height={180}
                  frontColor={colors.tint}
                  barWidth={spendBarWidth}
                  barBorderRadius={4}
                  isAnimated
                  animationDuration={800}
                  yAxisColor={colors.border}
                  xAxisColor={colors.border}
                  rulesColor={colors.border}
                  yAxisTextStyle={{ color: colors.textMuted, fontFamily: Fonts.regular }}
                  xAxisLabelTextStyle={{
                    color: colors.textMuted,
                    fontSize: 11,
                    fontFamily: Fonts.regular,
                  }}
                  noOfSections={4}
                  initialSpacing={16}
                  spacing={spendBarSpacing}
                />
              </View>
              <Text style={[styles.sectionCaption, { color: colors.textMuted }]}>
                The highlighted bar is this month so far.
              </Text>
            </View>

            <SectionCard
              title="Personal Records"
              caption="Your own best results for this vehicle"
              colors={colors}
            >
              {records.length > 0 ? (
                <PersonalRecordList
                  records={records}
                  colors={colors}
                  currencySymbol={currencySymbol}
                  distanceUnit={distanceUnit}
                />
              ) : (
                <Text style={[styles.note, { color: colors.textMuted }]}>
                  {insightsEnabled
                    ? 'Records appear once you have a full-tank reading to hold them up against.'
                    : 'Turn fuel insights back on in Settings to see your records.'}
                </Text>
              )}
            </SectionCard>

            {insightsEnabled && insights.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Fuel Insights</Text>
                <View style={styles.insightList}>
                  {insights.map((insight) => (
                    <InsightCard key={insight.id} insight={insight} colors={colors} />
                  ))}
                </View>
              </View>
            )}

            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/monthly-report',
                  params: activeVehicle ? { vehicleId: activeVehicle.id } : undefined,
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`Open the monthly report for ${report.label}`}
              style={[styles.reportLink, { borderColor: colors.border }]}
            >
              <Ionicons name="document-text-outline" size={16} color={colors.tint} />
              <Text style={[styles.reportLinkLabel, { color: colors.tint }]}>
                View {report.label} report
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatsSkeleton({ colors }: { colors: ThemeColors }) {
  return (
    <View style={styles.skeletonGroup}>
      <SkeletonBox colors={colors} height={150} radius={Radius.lg} />
      <SkeletonBox colors={colors} height={150} radius={Radius.lg} />
      <SkeletonBox colors={colors} height={228} radius={Radius.lg} />
      <SkeletonBox colors={colors} height={228} radius={Radius.lg} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: SCREEN_PADDING, gap: Space.lg, paddingBottom: 48 },
  skeletonGroup: { gap: Space.lg },
  section: { gap: Space.sm },
  sectionTitle: { fontSize: 16, fontFamily: Fonts.bold },
  sectionCaption: { fontSize: 12, fontFamily: Fonts.regular },
  note: { fontSize: 13, fontFamily: Fonts.regular, lineHeight: 19 },
  budgetBlock: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Space.lg },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
  },
  insightList: { gap: Space.md },
  chartCard: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: CARD_PADDING,
    alignItems: 'center',
  },
  chartEmptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: Space.xl,
    fontFamily: Fonts.regular,
  },
  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Space.md,
  },
  reportLinkLabel: { fontSize: 14, fontFamily: Fonts.semiBold },
});

// Opts this route into expo-router's crash boundary (it wraps a route in
// `Try` only when the route exports `ErrorBoundary`) -- a render throw here
// is caught without taking the tab bar or the other tabs down with it.
export { AppErrorBoundary as ErrorBoundary } from '@/components/AppErrorBoundary';
