import { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import { VehicleSelector } from '@/components/VehicleSelector';
import { useSelectedVehicle } from '@/hooks/useSelectedVehicle';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useVehicles } from '@/hooks/useVehicles';
import { useVehicleStats } from '@/hooks/useVehicleStats';
import { formatCurrency, formatMileage, formatNumber } from '@/utils/format';

const SCREEN_PADDING = 16;
const CARD_PADDING = 16;

export default function StatsScreen() {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const { vehicles, loading: vehiclesLoading } = useVehicles();
  const { selectedVehicleId, setSelectedVehicleId } = useSelectedVehicle();

  const activeVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0] ?? null,
    [vehicles, selectedVehicleId]
  );

  const stats = useVehicleStats(activeVehicle?.id ?? null);

  const chartWidth = width - SCREEN_PADDING * 2 - CARD_PADDING * 2;

  if (vehiclesLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
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
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
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
                <StatCard
                  label="Best Mileage"
                  value={formatMileage(stats.bestMileage, 'km')}
                  colors={colors}
                />
                <StatCard
                  label="Worst Mileage"
                  value={formatMileage(stats.worstMileage, 'km')}
                  colors={colors}
                />
              </View>
              <View style={styles.statRow}>
                <StatCard
                  label="Total Litres"
                  value={`${formatNumber(stats.totalLitres, 1)} L`}
                  colors={colors}
                />
                <StatCard
                  label="Total Spend"
                  value={formatCurrency(stats.totalSpend)}
                  colors={colors}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Mileage Over Time
              </Text>
              <View
                style={[
                  styles.chartCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
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
                    startOpacity={0.15}
                    endOpacity={0}
                    areaChart
                    yAxisColor={colors.border}
                    xAxisColor={colors.border}
                    rulesColor={colors.border}
                    yAxisTextStyle={{ color: colors.textMuted }}
                    xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 10 }}
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
                  { backgroundColor: colors.surface, borderColor: colors.border },
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
                  yAxisColor={colors.border}
                  xAxisColor={colors.border}
                  rulesColor={colors.border}
                  yAxisTextStyle={{ color: colors.textMuted }}
                  xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 11 }}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  scrollContent: { padding: SCREEN_PADDING, gap: 16, paddingBottom: 48 },
  statGrid: { gap: 10 },
  statRow: { flexDirection: 'row', gap: 10 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  chartCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: CARD_PADDING,
    alignItems: 'center',
  },
  chartEmptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
