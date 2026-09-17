import { useRef } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { fuelTypeLabel, vehicleTypeLabel } from '@/constants/vehicleOptions';
import { Radius, Space, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';
import { useElevation } from '@/hooks/useThemeColors';
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
  const elevation = useElevation('level1');

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
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
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
          { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          elevation,
        ]}
      >
        <View style={styles.rowMain}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {vehicle.name}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
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
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
    marginHorizontal: Space.md,
    marginBottom: Space.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Space.sm,
  },
  rowMain: { gap: Space.xs, flex: 1 },
  name: { fontSize: 15, fontFamily: Fonts.semiBold },
  subtitle: { fontFamily: Fonts.regular },
  deleteAction: {
    width: DELETE_WIDTH,
    marginBottom: Space.sm,
  },
  deleteButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteLabel: { fontFamily: Fonts.bold, fontSize: 14 },
});
