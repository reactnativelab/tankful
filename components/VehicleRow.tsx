import { useRef } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { fuelTypeLabel, vehicleTypeLabel } from '@/constants/vehicleOptions';
import type { ThemeColors } from '@/constants/theme';
import type { Vehicle } from '@/types';

const DELETE_WIDTH = 80;

interface VehicleRowProps {
  vehicle: Vehicle;
  colors: ThemeColors;
  onPress: () => void;
  onDelete: (id: string) => void;
}

function DeleteAction({
  progress,
  colors,
  onPress,
}: {
  progress: SharedValue<number>;
  colors: ThemeColors;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, 1],
          [DELETE_WIDTH, 0],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  return (
    <Animated.View style={[styles.deleteAction, { backgroundColor: colors.danger }, style]}>
      <Pressable style={styles.deleteButton} onPress={onPress}>
        <Text style={[styles.deleteLabel, { color: colors.onTint }]}>Delete</Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Swipe left reveals a Delete button that confirms via Alert before
 * deleting, since removing a vehicle also removes all of its fill-up
 * history and can't be undone (unlike a single fuel-entry delete).
 */
export function VehicleRow({ vehicle, colors, onPress, onDelete }: VehicleRowProps) {
  const swipeableRef = useRef<SwipeableMethods>(null);

  const confirmDelete = () => {
    Alert.alert(
      'Delete Vehicle?',
      `This will permanently delete "${vehicle.name}" and all of its fill-up history. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => swipeableRef.current?.close() },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            swipeableRef.current?.close();
            onDelete(vehicle.id);
          },
        },
      ]
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={(progress) => (
        <DeleteAction progress={progress} colors={colors} onPress={confirmDelete} />
      )}
    >
      <Pressable
        onPress={onPress}
        style={[
          styles.row,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.rowMain}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {vehicle.name}
          </Text>
          <Text style={{ color: colors.textMuted }} numberOfLines={1}>
            {vehicleTypeLabel(vehicle.type)} · {fuelTypeLabel(vehicle.fuelType)}
            {vehicle.plate ? ` · ${vehicle.plate}` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  rowMain: { gap: 4, flex: 1 },
  name: { fontSize: 15, fontWeight: '600' },
  deleteAction: {
    width: DELETE_WIDTH,
  },
  deleteButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteLabel: { fontWeight: '700', fontSize: 14 },
});
