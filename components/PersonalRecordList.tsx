import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Space, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';
import type { DistanceUnit } from '@/types';
import {
  formatCurrency,
  formatDate,
  formatDistance,
  formatLitres,
  formatMileage,
} from '@/utils/format';
import type { PersonalRecord } from '@/utils/personalRecords';

interface PersonalRecordListProps {
  records: PersonalRecord[];
  colors: ThemeColors;
  currencySymbol: string;
  distanceUnit: DistanceUnit;
}

function formatRecordValue(
  record: PersonalRecord,
  currencySymbol: string,
  distanceUnit: DistanceUnit
): string {
  switch (record.kind) {
    case 'mileage':
      return formatMileage(record.value, distanceUnit);
    case 'costPerDistance':
      return `${formatCurrency(record.value, currencySymbol)}/${distanceUnit}`;
    case 'distance':
      return formatDistance(record.value, distanceUnit);
    case 'litres':
      return formatLitres(record.value);
    case 'currency':
      return formatCurrency(record.value, currencySymbol);
  }
}

function formatWhen(record: PersonalRecord): string {
  return record.occurredAt.type === 'date'
    ? formatDate(record.occurredAt.timestamp)
    : record.occurredAt.label;
}

/**
 * Records are quiet by design -- a list of real results with the date they
 * happened, not badges or points. A value flagged as unusual keeps its place
 * and gets a note instead of being dropped: it is the user's row to check.
 */
export function PersonalRecordList({
  records,
  colors,
  currencySymbol,
  distanceUnit,
}: PersonalRecordListProps) {
  return (
    <View style={styles.list}>
      {records.map((record, index) => {
        const value = formatRecordValue(record, currencySymbol, distanceUnit);
        const when = formatWhen(record);
        return (
          <View
            key={record.id}
            accessible
            accessibilityLabel={`${record.title}: ${value}, ${when}. ${record.caption}.${record.unusual ? ' This result is far above the rest of your history and may come from a mistyped reading.' : ''}`}
            style={[
              styles.row,
              index > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              },
            ]}
          >
            <View style={styles.main}>
              <Text style={[styles.title, { color: colors.text }]}>{record.title}</Text>
              <Text style={[styles.caption, { color: colors.textMuted }]}>{record.caption}</Text>
              {record.unusual && (
                <View style={styles.flagRow}>
                  <Ionicons name="alert-circle-outline" size={13} color={colors.textMuted} />
                  <Text style={[styles.flag, { color: colors.textMuted }]}>
                    Far above your other results — worth checking that fill-up
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.end}>
              <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
              <Text style={[styles.when, { color: colors.textMuted }]}>{when}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Space.md,
    paddingVertical: Space.md,
  },
  main: { flex: 1, gap: 2 },
  end: { alignItems: 'flex-end', gap: 2 },
  title: { fontSize: 14, fontFamily: Fonts.semiBold },
  caption: { fontSize: 12, fontFamily: Fonts.regular, lineHeight: 16 },
  value: { fontSize: 15, fontFamily: Fonts.bold, fontVariant: ['tabular-nums'] },
  when: { fontSize: 11, fontFamily: Fonts.regular },
  flagRow: { flexDirection: 'row', alignItems: 'center', gap: Space.xs, marginTop: 2 },
  flag: { flex: 1, fontSize: 11, fontFamily: Fonts.regular, lineHeight: 15 },
});
