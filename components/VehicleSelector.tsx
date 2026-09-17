import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '@/constants/theme';
import type { Vehicle } from '@/types';

interface VehicleSelectorProps {
  vehicles: Vehicle[];
  selectedId: string;
  onSelect: (id: string) => void;
  colors: ThemeColors;
}

export function VehicleSelector({
  vehicles,
  selectedId,
  onSelect,
  colors,
}: VehicleSelectorProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (vehicles.length <= 1) return null;

  if (vehicles.length <= 3) {
    return (
      <View style={styles.tabRow}>
        {vehicles.map((vehicle) => {
          const active = vehicle.id === selectedId;
          return (
            <Pressable
              key={vehicle.id}
              onPress={() => onSelect(vehicle.id)}
              style={[
                styles.tab,
                {
                  backgroundColor: active ? colors.tint : colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: active ? colors.onTint : colors.text },
                ]}
                numberOfLines={1}
              >
                {vehicle.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  const selectedVehicle = vehicles.find((v) => v.id === selectedId);

  return (
    <>
      <Pressable
        onPress={() => setDropdownOpen(true)}
        style={[
          styles.dropdownButton,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.dropdownLabel, { color: colors.text }]}>
          {selectedVehicle?.name ?? 'Select vehicle'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <Modal
        visible={dropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownOpen(false)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={() => setDropdownOpen(false)}
        >
          <View
            style={[
              styles.dropdownList,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <FlatList
              data={vehicles}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onSelect(item.id);
                    setDropdownOpen(false);
                  }}
                  style={styles.dropdownRow}
                >
                  <Text
                    style={[
                      styles.dropdownRowLabel,
                      {
                        color: item.id === selectedId ? colors.tint : colors.text,
                        fontWeight: item.id === selectedId ? '700' : '400',
                      },
                    ]}
                  >
                    {item.name}
                  </Text>
                  {item.id === selectedId && (
                    <Ionicons name="checkmark" size={18} color={colors.tint} />
                  )}
                </Pressable>
              )}
              ItemSeparatorComponent={() => (
                <View style={[styles.separator, { backgroundColor: colors.border }]} />
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  dropdownLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  dropdownList: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: 320,
    overflow: 'hidden',
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  dropdownRowLabel: {
    fontSize: 15,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
});
