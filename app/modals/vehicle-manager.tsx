import { useCallback } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { EmptyState } from '@/components/EmptyState';
import { Fab } from '@/components/Fab';
import { VehicleRow } from '@/components/VehicleRow';
import { Space } from '@/constants/theme';
import { useElevation, useThemeColors } from '@/hooks/useThemeColors';
import { useVehicleActions } from '@/hooks/useVehicleActions';
import { useVehicles } from '@/hooks/useVehicles';
import type { Vehicle } from '@/types';

export default function VehicleManagerModal() {
  const colors = useThemeColors();
  const fabElevation = useElevation('level2');
  const { vehicles, loading, refresh } = useVehicles();
  const { removeVehicle } = useVehicleActions();

  const handleDelete = useCallback(
    async (id: string) => {
      await removeVehicle(id);
      await refresh();
    },
    [removeVehicle, refresh]
  );

  if (loading) {
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
          message="Add a vehicle to get started."
          buttonLabel="Add Vehicle"
          onPress={() => router.push('/modals/add-edit-vehicle')}
          colors={colors}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList<Vehicle>
        data={vehicles}
        keyExtractor={(vehicle) => vehicle.id}
        renderItem={({ item }) => (
          <VehicleRow
            vehicle={item}
            colors={colors}
            onPress={() =>
              router.push({
                pathname: '/modals/add-edit-vehicle',
                params: { vehicleId: item.id },
              })
            }
            onDelete={handleDelete}
          />
        )}
        contentContainerStyle={styles.listContent}
      />

      <Fab
        icon="add"
        label="Add Vehicle"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          router.push('/modals/add-edit-vehicle');
        }}
        bottom={Space.lg}
        colors={colors}
        elevation={fabElevation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingTop: Space.md, paddingBottom: 96 },
});
