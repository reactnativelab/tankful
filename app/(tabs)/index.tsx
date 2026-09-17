import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import { VehicleSelector } from '@/components/VehicleSelector';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useSelectedVehicle } from '@/hooks/useSelectedVehicle';
import { useSettings } from '@/hooks/useSettings';
import { useVehicleDashboard } from '@/hooks/useVehicleDashboard';
import { useVehicles } from '@/hooks/useVehicles';
import { buildMonthlySummary, countFillupsInMonth } from '@/utils/buildMonthlySummary';
import { formatCurrency, formatDate, formatMileage, formatNumber } from '@/utils/format';

export default function HomeScreen() {
  const colors = useThemeColors();
  const { currencySymbol, distanceUnit } = useSettings();
  const { vehicles, loading: vehiclesLoading } = useVehicles();
  const { selectedVehicleId, setSelectedVehicleId } = useSelectedVehicle();

  const activeVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0] ?? null,
    [vehicles, selectedVehicleId]
  );

  const dashboard = useVehicleDashboard(activeVehicle?.id ?? null);

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

  if (vehiclesLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Tankful</Text>
        <Pressable onPress={() => router.push('/modals/vehicle-manager')} hitSlop={8}>
          <Ionicons name="car-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      {vehicles.length === 0 ? (
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
            <View style={styles.dashboardLoading}>
              <ActivityIndicator size="large" color={colors.tint} />
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.heroCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.heroLabel, { color: colors.textMuted }]}>
                  Current Mileage
                </Text>
                <Text style={[styles.heroValue, { color: colors.text }]}>
                  {formatMileage(dashboard.currentMileage, distanceUnit)}
                </Text>
                {dashboard.currentMileage === null && (
                  <Text style={[styles.heroCaption, { color: colors.textMuted }]}>
                    Log 2 full-tank fill-ups to see mileage.
                  </Text>
                )}
              </View>

              <View style={styles.statRow}>
                <StatCard
                  label="This Month"
                  value={formatCurrency(dashboard.monthlySpend, currencySymbol)}
                  colors={colors}
                />
                <StatCard
                  label="Avg Mileage"
                  value={formatMileage(dashboard.averageMileage, distanceUnit)}
                  colors={colors}
                />
                <StatCard
                  label="Last Fill-up"
                  value={
                    dashboard.lastEntry ? formatDate(dashboard.lastEntry.date) : '—'
                  }
                  colors={colors}
                />
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
                  <Text style={{ color: colors.textMuted }}>
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
                        <Text style={{ color: colors.textMuted }}>
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
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/modals/log-fillup',
              params: { vehicleId: activeVehicle.id },
            })
          }
          style={[
            styles.fab,
            { backgroundColor: colors.tint, shadowColor: colors.shadow },
          ]}
        >
          <Ionicons name="add" size={20} color={colors.onTint} />
          <Text style={[styles.fabLabel, { color: colors.onTint }]}>Log Fill-up</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 96 },
  dashboardLoading: { paddingVertical: 48, alignItems: 'center' },
  heroCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  heroLabel: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  heroValue: { fontSize: 40, fontWeight: '800' },
  heroCaption: { fontSize: 13, textAlign: 'center' },
  statRow: { flexDirection: 'row', gap: 10 },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  shareButtonLabel: { fontSize: 14, fontWeight: '600' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  recentList: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  recentDate: { fontSize: 14, fontWeight: '600', flex: 1 },
  recentCost: { fontSize: 14, fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 20,
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabLabel: { fontSize: 15, fontWeight: '700' },
});
