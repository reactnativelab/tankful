import { useMemo } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { HistoryRow } from '@/components/HistoryRow';
import { SkeletonBox } from '@/components/Skeleton';
import { VehicleSelector } from '@/components/VehicleSelector';
import { Radius, Space, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';
import { useFuelEntries } from '@/hooks/useFuelEntries';
import { useSelectedVehicle } from '@/hooks/useSelectedVehicle';
import { useSettings } from '@/hooks/useSettings';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useVehicles } from '@/hooks/useVehicles';
import { groupEntriesByMonth, type MonthSection } from '@/utils/groupEntriesByMonth';

export default function HistoryScreen() {
  const colors = useThemeColors();
  const { currencySymbol, distanceUnit } = useSettings();
  const { vehicles, loading: vehiclesLoading } = useVehicles();
  const { selectedVehicleId, setSelectedVehicleId } = useSelectedVehicle();

  const activeVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0] ?? null,
    [vehicles, selectedVehicleId]
  );

  const { loading: entriesLoading, entries, mileageById, removeEntry } = useFuelEntries(
    activeVehicle?.id ?? null
  );

  const sections = useMemo(() => groupEntriesByMonth(entries), [entries]);

  if (vehiclesLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.listContent}>
          <HistorySkeleton colors={colors} />
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
      <View style={styles.header}>
        <VehicleSelector
          vehicles={vehicles}
          selectedId={activeVehicle?.id ?? ''}
          onSelect={setSelectedVehicleId}
          colors={colors}
        />
      </View>

      {entriesLoading ? (
        <View style={styles.listContent}>
          <HistorySkeleton colors={colors} />
        </View>
      ) : entries.length === 0 ? (
        <EmptyState
          icon="water-outline"
          message="Log your first fill-up."
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
        <SectionList<MonthSection['data'][number], MonthSection>
          sections={sections}
          keyExtractor={(entry) => entry.id}
          stickySectionHeadersEnabled
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
              <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>
                {section.title}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <HistoryRow
              entry={item}
              mileage={mileageById.get(item.id) ?? null}
              colors={colors}
              currencySymbol={currencySymbol}
              distanceUnit={distanceUnit}
              onDelete={removeEntry}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

function HistorySkeleton({ colors }: { colors: ThemeColors }) {
  return (
    <View style={styles.skeletonGroup}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.skeletonRow,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          ]}
        >
          <View style={styles.skeletonRowMain}>
            <SkeletonBox colors={colors} width={90} height={14} />
            <SkeletonBox colors={colors} width={60} height={12} />
          </View>
          <View style={styles.skeletonRowEnd}>
            <SkeletonBox colors={colors} width={70} height={14} />
            <SkeletonBox colors={colors} width={60} height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: Space.lg, paddingBottom: Space.sm },
  listContent: { paddingTop: Space.sm, paddingBottom: Space.xl },
  sectionHeader: { paddingHorizontal: Space.lg, paddingVertical: Space.sm },
  sectionHeaderText: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Fonts.semiBold,
  },
  skeletonGroup: { paddingHorizontal: Space.md, gap: Space.sm },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  skeletonRowMain: { gap: Space.xs },
  skeletonRowEnd: { gap: Space.xs, alignItems: 'flex-end' },
});
