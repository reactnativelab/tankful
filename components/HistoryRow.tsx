import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import type { ThemeColors } from '@/constants/theme';
import type { DistanceUnit } from '@/hooks/useSettings';
import type { FuelEntry } from '@/types';
import { formatCurrency, formatDate, formatMileage, formatNumber } from '@/utils/format';

const DELETE_WIDTH = 80;

interface HistoryRowProps {
  entry: FuelEntry;
  mileage: number | null;
  colors: ThemeColors;
  currencySymbol: string;
  distanceUnit: DistanceUnit;
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
 * Swipe left reveals a Delete button (rather than deleting on the swipe
 * itself) so an accidental swipe can't remove a fill-up outright.
 */
export function HistoryRow({
  entry,
  mileage,
  colors,
  currencySymbol,
  distanceUnit,
  onDelete,
}: HistoryRowProps) {
  const swipeableRef = useRef<SwipeableMethods>(null);

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={(progress) => (
        <DeleteAction
          progress={progress}
          colors={colors}
          onPress={() => {
            swipeableRef.current?.close();
            onDelete(entry.id);
          }}
        />
      )}
    >
      <View
        style={[
          styles.row,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.rowMain}>
          <Text style={[styles.date, { color: colors.text }]}>{formatDate(entry.date)}</Text>
          <Text style={{ color: colors.textMuted }}>
            {formatNumber(entry.litresFilled, 2)} L
          </Text>
        </View>
        <View style={styles.rowEnd}>
          <Text style={[styles.cost, { color: colors.text }]}>
            {formatCurrency(entry.totalCost, currencySymbol)}
          </Text>
          <Text style={{ color: colors.textMuted }}>
            {formatMileage(mileage, distanceUnit)}
          </Text>
        </View>
      </View>
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
  },
  rowMain: { gap: 4 },
  rowEnd: { alignItems: 'flex-end', gap: 4 },
  date: { fontSize: 15, fontWeight: '600' },
  cost: { fontSize: 15, fontWeight: '700' },
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
