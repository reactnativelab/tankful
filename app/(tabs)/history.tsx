import { useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { HistoryRow } from '@/components/HistoryRow';
import { VehicleSelector } from '@/components/VehicleSelector';
import { useFuelEntries } from '@/hooks/useFuelEntries';
import { useSelectedVehicle } from '@/hooks/useSelectedVehicle';
import { useSettings } from '@/hooks/useSettings';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useVehicles } from '@/hooks/useVehicles';
import type { FuelEntry } from '@/types';

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
      <View style={styles.header}>
        <VehicleSelector
          vehicles={vehicles}
          selectedId={activeVehicle?.id ?? ''}
          onSelect={setSelectedVehicleId}
          colors={colors}
        />
      </View>

      {entriesLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.tint} />
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
        <FlatList<FuelEntry>
          data={entries}
          keyExtractor={(entry) => entry.id}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: 16, paddingBottom: 8 },
  listContent: { paddingBottom: 24 },
});
