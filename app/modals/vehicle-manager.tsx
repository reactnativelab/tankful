import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/EmptyState';
import { VehicleRow } from '@/components/VehicleRow';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useVehicleActions } from '@/hooks/useVehicleActions';
import { useVehicles } from '@/hooks/useVehicles';
import type { Vehicle } from '@/types';

export default function VehicleManagerModal() {
  const colors = useThemeColors();
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

      <Pressable
        onPress={() => router.push('/modals/add-edit-vehicle')}
        style={[styles.fab, { backgroundColor: colors.tint, shadowColor: colors.shadow }]}
      >
        <Ionicons name="add" size={20} color={colors.onTint} />
        <Text style={[styles.fabLabel, { color: colors.onTint }]}>Add Vehicle</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingBottom: 96 },
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
