import { useRef } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { Radius, Space, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';
import { useElevation } from '@/hooks/useThemeColors';
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
  onDelete: (id: string) => Promise<void>;
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
 * itself), which then confirms via Alert before deleting -- consistent with
 * vehicle delete's pattern (VehicleRow) -- since a fill-up can't be undone
 * once removed.
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
  const elevation = useElevation('level1');

  const confirmDelete = () => {
    Alert.alert(
      'Delete Fill-up?',
      `This will permanently delete the ${formatDate(entry.date)} fill-up (${formatNumber(
        entry.litresFilled,
        2
      )} L). This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => swipeableRef.current?.close() },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            swipeableRef.current?.close();
            try {
              await onDelete(entry.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            } catch (error) {
              console.error('Failed to delete fill-up', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
              Alert.alert(
                "Couldn't Delete Fill-up",
                'Something went wrong deleting this fill-up. Please try again.'
              );
            }
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
      <View
        style={[
          styles.row,
          { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          elevation,
        ]}
      >
        <View style={styles.rowMain}>
          <Text style={[styles.date, { color: colors.text }]}>{formatDate(entry.date)}</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.tabularText, { color: colors.textMuted }]}>
              {formatNumber(entry.litresFilled, 2)} L
            </Text>
            {/* Explains the dash in the mileage column: a partial fill can't
                anchor a litres-per-distance figure, though it still counts
                towards spending and litres. */}
            {!entry.isTankFull && (
              <View style={[styles.partialChip, { borderColor: colors.border }]}>
                <Text style={[styles.partialLabel, { color: colors.textMuted }]}>Partial</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.rowEnd}>
          <Text style={[styles.cost, { color: colors.text }]}>
            {formatCurrency(entry.totalCost, currencySymbol)}
          </Text>
          <Text style={[styles.tabularText, { color: colors.textMuted }]}>
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
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
    marginHorizontal: Space.md,
    marginBottom: Space.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowMain: { gap: Space.xs, flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  partialChip: {
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Space.sm,
    paddingVertical: 1,
  },
  partialLabel: {
    fontSize: 10,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    fontFamily: Fonts.semiBold,
  },
  rowEnd: { alignItems: 'flex-end', gap: Space.xs },
  date: { fontSize: 15, fontFamily: Fonts.semiBold },
  cost: { fontSize: 15, fontFamily: Fonts.bold, fontVariant: ['tabular-nums'] },
  tabularText: { fontFamily: Fonts.regular, fontVariant: ['tabular-nums'] },
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
