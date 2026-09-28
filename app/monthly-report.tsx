import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BudgetMeter } from '@/components/BudgetMeter';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { InsightCard } from '@/components/InsightCard';
import { MetricGrid, type Metric } from '@/components/MetricGrid';
import { SectionCard } from '@/components/SectionCard';
import { SkeletonBox } from '@/components/Skeleton';
import { Radius, Space, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';
import { useFuelIntelligence } from '@/hooks/useFuelIntelligence';
import { useSelectedVehicle } from '@/hooks/useSelectedVehicle';
import { useSettings } from '@/hooks/useSettings';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useVehicles } from '@/hooks/useVehicles';
import type { Trend } from '@/utils/fuelAnalytics';
import {
  EMPTY_VALUE,
  formatCurrency,
  formatDistance,
  formatLitres,
  formatMileage,
  formatNumber,
  formatPercent,
} from '@/utils/format';
import {
  buildMonthlyReport,
  buildMonthlyReportShareText,
  getReportableMonths,
} from '@/utils/monthlyReport';
import { formatMonthLabel, monthKey } from '@/utils/period';

/**
 * The monthly report: a read-only surface over the same derived model Home
 * and Stats use. Nothing here is stored -- every figure is recomputed from the
 * fill-up rows, so an edited or deleted entry changes the report immediately.
 *
 * It opens on the vehicle it was launched for (passed as a param, not read
 * live), so switching vehicles on a tab behind it cannot swap the report's
 * subject halfway through reading it.
 */
export default function MonthlyReportScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { currencySymbol, distanceUnit } = useSettings();
  const params = useLocalSearchParams<{ vehicleId?: string; month?: string }>();
  const { vehicles } = useVehicles();
  const { selectedVehicleId } = useSelectedVehicle();

  const vehicleId = params.vehicleId ?? selectedVehicleId ?? vehicles[0]?.id ?? null;
  const vehicle = useMemo(
    () => vehicles.find((candidate) => candidate.id === vehicleId) ?? null,
    [vehicles, vehicleId]
  );

  const intelligence = useFuelIntelligence(vehicleId);
  const { analysis, insights, insightsEnabled, vehicleBudget } = intelligence;

  const months = useMemo(() => getReportableMonths(analysis), [analysis]);
  const [selectedKey, setSelectedKey] = useState<string | null>(params.month ?? null);

  // Falls back to the newest month whenever the stored key no longer exists --
  // which happens if the fill-ups behind that month are deleted while the
  // report is open.
  const selectedIndex = useMemo(() => {
    const index = months.findIndex((ref) => monthKey(ref) === selectedKey);
    return index === -1 ? months.length - 1 : index;
  }, [months, selectedKey]);

  const report = useMemo(
    () =>
      buildMonthlyReport(analysis, {
        ref: months[selectedIndex],
        budget: vehicleBudget,
        insight: insightsEnabled ? (insights[0] ?? null) : null,
        includeForecast: insightsEnabled,
      }),
    [analysis, months, selectedIndex, vehicleBudget, insights, insightsEnabled]
  );

  const goToMonth = useCallback(
    (delta: number) => {
      const next = months[selectedIndex + delta];
      if (next) setSelectedKey(monthKey(next));
    },
    [months, selectedIndex]
  );

  const sharing = useRef(false);
  const handleShare = useCallback(async () => {
    if (!vehicle || sharing.current) return;
    sharing.current = true;
    try {
      await Share.share({
        message: buildMonthlyReportShareText(report, vehicle, { currencySymbol, distanceUnit }),
      });
    } catch (error) {
      console.error('Failed to share monthly report', error);
    } finally {
      sharing.current = false;
    }
  }, [vehicle, report, currencySymbol, distanceUnit]);

  const metrics = useMemo<Metric[]>(() => {
    const { actual } = report;
    return [
      {
        key: 'spend',
        label: 'Fuel spend',
        value: formatCurrency(actual.spend, currencySymbol),
      },
      { key: 'litres', label: 'Fuel', value: formatLitres(actual.litres) },
      {
        key: 'distance',
        label: 'Distance',
        value: actual.distance > 0 ? formatDistance(actual.distance, distanceUnit) : EMPTY_VALUE,
        caption: actual.distance > 0 ? 'between fill-ups' : undefined,
      },
      {
        key: 'mileage',
        label: 'Average mileage',
        value: formatMileage(actual.averageMileage, distanceUnit),
        caption:
          actual.observationCount > 0
            ? `${actual.observationCount} full-tank ${actual.observationCount === 1 ? 'reading' : 'readings'}`
            : undefined,
      },
      {
        key: 'cost',
        label: `Cost / ${distanceUnit}`,
        value:
          actual.costPerDistance !== null
            ? formatCurrency(actual.costPerDistance, currencySymbol)
            : EMPTY_VALUE,
      },
      {
        key: 'fills',
        label: 'Fill-ups',
        value: formatNumber(actual.fillCount, 0),
        caption:
          actual.partialCount > 0
            ? `${actual.fullTankCount} full, ${actual.partialCount} partial`
            : `${actual.fullTankCount} full`,
      },
    ];
  }, [report, currencySymbol, distanceUnit]);

  const hasComparisons =
    report.spendComparison !== null ||
    report.mileageComparison !== null ||
    report.distanceComparison !== null ||
    report.rollingSpend !== null;

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.headerButton}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Monthly Report</Text>
        <Pressable
          onPress={handleShare}
          hitSlop={12}
          disabled={!vehicle || report.actual.fillCount === 0}
          accessibilityRole="button"
          accessibilityLabel="Share this report"
          accessibilityState={{ disabled: !vehicle || report.actual.fillCount === 0 }}
          style={styles.headerButton}
        >
          <Ionicons
            name="share-social-outline"
            size={20}
            color={report.actual.fillCount === 0 ? colors.textMuted : colors.tint}
          />
        </Pressable>
      </View>

      {intelligence.loading ? (
        <View style={styles.content}>
          <SkeletonBox colors={colors} height={56} radius={Radius.md} />
          <SkeletonBox colors={colors} height={220} radius={Radius.lg} />
          <SkeletonBox colors={colors} height={160} radius={Radius.lg} />
        </View>
      ) : intelligence.error ? (
        <ErrorState what="fill-ups" onRetry={intelligence.retry} colors={colors} />
      ) : !vehicle ? (
        <EmptyState
          icon="car-outline"
          message="Add a vehicle to see monthly reports."
          buttonLabel="Add Vehicle"
          onPress={() => router.push('/modals/add-edit-vehicle')}
          colors={colors}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.monthNav, { borderColor: colors.border }]}>
            <NavButton
              icon="chevron-back"
              label={`Previous month${months[selectedIndex - 1] ? `, ${formatMonthLabel(months[selectedIndex - 1])}` : ''}`}
              disabled={selectedIndex <= 0}
              onPress={() => goToMonth(-1)}
              colors={colors}
            />
            <View style={styles.monthLabelWrap}>
              <Text style={[styles.monthLabel, { color: colors.text }]}>{report.label}</Text>
              <Text style={[styles.vehicleLabel, { color: colors.textMuted }]} numberOfLines={1}>
                {vehicle.name}
              </Text>
            </View>
            <NavButton
              icon="chevron-forward"
              label={`Next month${months[selectedIndex + 1] ? `, ${formatMonthLabel(months[selectedIndex + 1])}` : ''}`}
              disabled={selectedIndex >= months.length - 1}
              onPress={() => goToMonth(1)}
              colors={colors}
            />
          </View>

          <SectionCard
            title={report.isCurrentMonth ? 'So far this month' : 'What this month cost'}
            caption="Measured from the fill-ups you logged"
            colors={colors}
          >
            <MetricGrid metrics={metrics} colors={colors} />
          </SectionCard>

          {hasComparisons && (
            <SectionCard
              title={`Compared with ${report.previousLabel}`}
              caption={
                report.spendComparison?.basis === 'month-to-date'
                  ? `Spending is compared over the same days of both months (day 1 to ${report.spendComparison.throughDay}).`
                  : undefined
              }
              colors={colors}
            >
              <View style={styles.comparisonList}>
                <ComparisonRow label="Spending" trend={report.spendComparison} upIsGood={false} colors={colors} />
                <ComparisonRow label="Mileage" trend={report.mileageComparison} upIsGood colors={colors} />
                <ComparisonRow
                  label="Distance"
                  trend={report.distanceComparison}
                  upIsGood={null}
                  colors={colors}
                />
                {report.rollingSpend && (
                  <Text style={[styles.note, { color: colors.textMuted }]}>
                    Your usual month is{' '}
                    {formatCurrency(report.rollingSpend.value, currencySymbol)} across the{' '}
                    {report.rollingSpend.monthsCounted} months with fill-ups in the last{' '}
                    {report.rollingSpend.windowMonths}.
                  </Text>
                )}
              </View>
            </SectionCard>
          )}

          {report.budget && (
            <SectionCard title="Budget" colors={colors}>
              <BudgetMeter
                status={report.budget}
                currencySymbol={currencySymbol}
                monthLabel={report.label}
                colors={colors}
              />
            </SectionCard>
          )}

          {report.forecast && (
            <SectionCard
              title="Projection"
              caption="An estimate from this month's pace, not a final figure"
              colors={colors}
            >
              <View style={styles.projectionRow}>
                <View style={styles.projectionCell}>
                  <Text style={[styles.projectionLabel, { color: colors.textMuted }]}>
                    Spent so far
                  </Text>
                  <Text style={[styles.projectionValue, { color: colors.text }]}>
                    {formatCurrency(report.forecast.actual, currencySymbol)}
                  </Text>
                </View>
                <View style={styles.projectionCell}>
                  <Text style={[styles.projectionLabel, { color: colors.textMuted }]}>
                    Estimated month-end
                  </Text>
                  <Text style={[styles.projectionValue, { color: colors.text }]}>
                    {formatCurrency(report.forecast.projected, currencySymbol)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.note, { color: colors.textMuted }]}>
                {formatPercent(report.forecast.monthProgress * 100)} of the month has passed.{' '}
                {report.forecast.basis === 'pace-and-history'
                  ? 'Based on your pace this month and your recent monthly spending.'
                  : 'Based on your pace this month alone, so it may move a lot.'}
              </Text>
            </SectionCard>
          )}

          {insightsEnabled && report.isCurrentMonth && insights.length > 0 && (
            <View style={styles.insightGroup}>
              <Text style={[styles.groupTitle, { color: colors.text }]}>Tankful noticed</Text>
              <InsightCard insight={insights[0]} colors={colors} />
            </View>
          )}

          {!report.isCurrentMonth && report.notable && (
            <View style={styles.insightGroup}>
              <Text style={[styles.groupTitle, { color: colors.text }]}>Tankful noticed</Text>
              <Text style={[styles.note, { color: colors.textMuted }]}>{report.notable}</Text>
            </View>
          )}

          {report.dataNotes.length > 0 && (
            <View style={styles.notes}>
              {report.dataNotes.map((note) => (
                <View key={note} style={styles.noteRow}>
                  <Ionicons name="information-circle-outline" size={15} color={colors.textMuted} />
                  <Text style={[styles.note, { color: colors.textMuted }]}>{note}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function NavButton({
  icon,
  label,
  disabled,
  onPress,
  colors,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  disabled: boolean;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={styles.navButton}
    >
      <Ionicons name={icon} size={20} color={disabled ? colors.border : colors.text} />
    </Pressable>
  );
}

/**
 * One comparison line. `upIsGood` of null means the direction carries no
 * judgement -- driving further is neither good nor bad news.
 */
function ComparisonRow({
  label,
  trend,
  upIsGood,
  colors,
}: {
  label: string;
  trend: (Trend & { current: number; previous: number }) | null;
  upIsGood: boolean | null;
  colors: ThemeColors;
}) {
  if (!trend) {
    return (
      <View style={styles.comparisonRow}>
        <Text style={[styles.comparisonLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.comparisonValue, { color: colors.textMuted }]}>
          Not enough data
        </Text>
      </View>
    );
  }

  const color =
    upIsGood === null || trend.direction === 'flat'
      ? colors.textMuted
      : (trend.direction === 'up') === upIsGood
        ? colors.mileageGood
        : colors.mileageBad;

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${trend.direction === 'flat' ? 'unchanged' : `${trend.direction === 'up' ? 'up' : 'down'} ${formatPercent(trend.percent)}`}`}
      style={styles.comparisonRow}
    >
      <Text style={[styles.comparisonLabel, { color: colors.text }]}>{label}</Text>
      <View style={styles.comparisonEnd}>
        <Ionicons
          name={
            trend.direction === 'flat'
              ? 'remove'
              : trend.direction === 'up'
                ? 'arrow-up'
                : 'arrow-down'
          }
          size={13}
          color={color}
        />
        <Text style={[styles.comparisonValue, { color }]}>{formatPercent(trend.percent)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
  },
  headerButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: Fonts.bold },
  content: { padding: Space.lg, gap: Space.lg, paddingBottom: 48 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Space.sm,
  },
  navButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  monthLabelWrap: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: Space.sm },
  monthLabel: { fontSize: 16, fontFamily: Fonts.bold },
  vehicleLabel: { fontSize: 12, fontFamily: Fonts.regular },
  comparisonList: { gap: Space.md },
  comparisonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  comparisonLabel: { fontSize: 14, fontFamily: Fonts.semiBold },
  comparisonEnd: { flexDirection: 'row', alignItems: 'center', gap: Space.xs },
  comparisonValue: { fontSize: 14, fontFamily: Fonts.semiBold, fontVariant: ['tabular-nums'] },
  projectionRow: { flexDirection: 'row', gap: Space.lg },
  projectionCell: { flex: 1, gap: 2 },
  projectionLabel: { fontSize: 12, fontFamily: Fonts.regular },
  projectionValue: { fontSize: 20, fontFamily: Fonts.bold, fontVariant: ['tabular-nums'] },
  insightGroup: { gap: Space.sm },
  groupTitle: { fontSize: 16, fontFamily: Fonts.bold },
  notes: { gap: Space.sm },
  noteRow: { flexDirection: 'row', gap: Space.sm, alignItems: 'flex-start' },
  note: { flex: 1, fontSize: 12, fontFamily: Fonts.regular, lineHeight: 17 },
});
