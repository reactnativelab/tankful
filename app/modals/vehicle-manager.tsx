import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { EmptyState } from '@/components/EmptyState';
import { VehicleRow } from '@/components/VehicleRow';
import { Radius, Space } from '@/constants/theme';
import { Fonts } from '@/constants/typography';
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

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          router.push('/modals/add-edit-vehicle');
        }}
        style={[styles.fab, { backgroundColor: colors.tint }, fabElevation]}
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
  listContent: { paddingTop: Space.md, paddingBottom: 96 },
  fab: {
    position: 'absolute',
    right: Space.lg,
    bottom: Space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    borderRadius: Radius.pill,
    paddingVertical: Space.md,
    paddingHorizontal: Space.xl,
  },
  fabLabel: { fontSize: 15, fontFamily: Fonts.bold },
});
