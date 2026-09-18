import { useEffect, useMemo, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonBox } from '@/components/Skeleton';
import { StatCard } from '@/components/StatCard';
import { VehicleSelector } from '@/components/VehicleSelector';
import { Radius, Space, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';
import { useElevation, useThemeColors } from '@/hooks/useThemeColors';
import { useSelectedVehicle } from '@/hooks/useSelectedVehicle';
import { useSettings } from '@/hooks/useSettings';
import { useVehicles } from '@/hooks/useVehicles';
import { useVehicleStats } from '@/hooks/useVehicleStats';
import { formatCurrency, formatMileage, formatNumber } from '@/utils/format';

const SCREEN_PADDING = Space.lg;
const CARD_PADDING = Space.lg;

export default function StatsScreen() {
  const colors = useThemeColors();
  const cardElevation = useElevation('level1');
  const { currencySymbol, distanceUnit } = useSettings();
  const { width } = useWindowDimensions();
  const { vehicles, loading: vehiclesLoading } = useVehicles();
  const { selectedVehicleId, setSelectedVehicleId } = useSelectedVehicle();

  const activeVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0] ?? null,
    [vehicles, selectedVehicleId]
  );

  const stats = useVehicleStats(activeVehicle?.id ?? null);

  const chartWidth = width - SCREEN_PADDING * 2 - CARD_PADDING * 2;

  // Same first-reveal gating as Home: stats.loading flips on every focus
  // refetch, so the stagger should only play the first time a vehicle's
  // stats actually appear.
  const revealedVehicleIds = useRef<Set<string>>(new Set());
  const isFirstReveal = !!activeVehicle && !revealedVehicleIds.current.has(activeVehicle.id);

  useEffect(() => {
    if (!stats.loading && activeVehicle) {
      revealedVehicleIds.current.add(activeVehicle.id);
    }
  }, [stats.loading, activeVehicle]);

  if (vehiclesLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.scrollContent}>
          <StatsSkeleton colors={colors} />
        </View>
      </View>
    );
  }

  if (vehicles.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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

        {stats.loading ? (
          <StatsSkeleton colors={colors} />
        ) : !stats.hasEnoughData ? (
          <EmptyState
            icon="stats-chart-outline"
            message="Add at least 2 full-tank fill-ups to see mileage."
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
            <View style={styles.statGrid}>
              <View style={styles.statRow}>
                <Animated.View
                  style={styles.statCardWrap}
                  entering={isFirstReveal ? FadeInDown.delay(0).springify().damping(16) : undefined}
                >
                  <StatCard
                    label="Best Mileage"
                    value={formatMileage(stats.bestMileage, distanceUnit)}
                    colors={colors}
                    valueColor={colors.mileageGood}
                  />
                </Animated.View>
                <Animated.View
                  style={styles.statCardWrap}
                  entering={isFirstReveal ? FadeInDown.delay(80).springify().damping(16) : undefined}
                >
                  <StatCard
                    label="Worst Mileage"
                    value={formatMileage(stats.worstMileage, distanceUnit)}
                    colors={colors}
                    valueColor={colors.mileageBad}
                  />
                </Animated.View>
              </View>
              <View style={styles.statRow}>
                <Animated.View
                  style={styles.statCardWrap}
                  entering={isFirstReveal ? FadeInDown.delay(160).springify().damping(16) : undefined}
                >
                  <StatCard
                    label="Total Litres"
                    value={`${formatNumber(stats.totalLitres, 1)} L`}
                    colors={colors}
                  />
                </Animated.View>
                <Animated.View
                  style={styles.statCardWrap}
                  entering={isFirstReveal ? FadeInDown.delay(240).springify().damping(16) : undefined}
                >
                  <StatCard
                    label="Total Spend"
                    value={formatCurrency(stats.totalSpend, currencySymbol)}
                    colors={colors}
                  />
                </Animated.View>
              </View>
              <View style={styles.statRow}>
                <Animated.View
                  style={styles.statCardWrap}
                  entering={isFirstReveal ? FadeInDown.delay(320).springify().damping(16) : undefined}
                >
                  <StatCard
                    label={`Cost / ${distanceUnit}`}
                    value={
                      stats.costPerDistance !== null
                        ? `${formatCurrency(stats.costPerDistance, currencySymbol)}`
                        : '—'
                    }
                    colors={colors}
                  />
                </Animated.View>
                <View style={styles.statCardWrap} />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Mileage Over Time
              </Text>
              <Text style={[styles.sectionCaption, { color: colors.textMuted }]}>
                Calculated between consecutive full-tank fill-ups
              </Text>
              <View
                style={[
                  styles.chartCard,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  cardElevation,
                ]}
              >
                {stats.mileageSeries.length === 0 ? (
                  <Text style={[styles.chartEmptyText, { color: colors.textMuted }]}>
                    Not enough consecutive full-tank fill-ups yet.
                  </Text>
                ) : (
                  <LineChart
                    data={stats.mileageSeries}
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
                  }))}
                  width={chartWidth}
                  height={180}
                  frontColor={colors.tint}
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
                  spacing={24}
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatsSkeleton({ colors }: { colors: ThemeColors }) {
  return (
    <View style={styles.skeletonGroup}>
      <View style={styles.statRow}>
        <SkeletonBox colors={colors} height={70} radius={Radius.md} style={styles.statCardWrap} />
        <SkeletonBox colors={colors} height={70} radius={Radius.md} style={styles.statCardWrap} />
      </View>
      <View style={styles.statRow}>
        <SkeletonBox colors={colors} height={70} radius={Radius.md} style={styles.statCardWrap} />
        <SkeletonBox colors={colors} height={70} radius={Radius.md} style={styles.statCardWrap} />
      </View>
      <SkeletonBox colors={colors} height={228} radius={Radius.lg} />
      <SkeletonBox colors={colors} height={228} radius={Radius.lg} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: SCREEN_PADDING, gap: Space.lg, paddingBottom: 48 },
  skeletonGroup: { gap: Space.lg },
  statGrid: { gap: Space.md },
  statRow: { flexDirection: 'row', gap: Space.md },
  statCardWrap: { flex: 1 },
  section: { gap: Space.sm },
  sectionTitle: { fontSize: 16, fontFamily: Fonts.bold },
  sectionCaption: { fontSize: 12, fontFamily: Fonts.regular, marginTop: -Space.xs },
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
});
