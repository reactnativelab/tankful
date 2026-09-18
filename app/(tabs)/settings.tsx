import { ReactNode, useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Space } from '@/constants/theme';
import { Fonts } from '@/constants/typography';
import { useFuelEntries } from '@/hooks/useFuelEntries';
import { useSelectedVehicle } from '@/hooks/useSelectedVehicle';
import { useSettings, type DistanceUnit, type ThemeOverride } from '@/hooks/useSettings';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useVehicleActions } from '@/hooks/useVehicleActions';
import { useVehicles } from '@/hooks/useVehicles';
import { buildFuelHistoryCsv } from '@/utils/buildFuelHistoryCsv';

const CURRENCY_PRESETS = ['₹', '$', '€', '£'];

const DISTANCE_UNIT_OPTIONS: { value: DistanceUnit; label: string }[] = [
  { value: 'km', label: 'Kilometers' },
  { value: 'mi', label: 'Miles' },
];

const THEME_OPTIONS: { value: ThemeOverride; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function SettingsScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const {
    currencySymbol,
    distanceUnit,
    fuelUnit,
    themeOverride,
    setCurrencySymbol,
    setDistanceUnit,
    setThemeOverride,
  } = useSettings();
  const { vehicles } = useVehicles();
  const { selectedVehicleId } = useSelectedVehicle();
  const { resetAll } = useVehicleActions();

  const activeVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0] ?? null,
    [vehicles, selectedVehicleId]
  );
  const { entries } = useFuelEntries(activeVehicle?.id ?? null);

  const isPreset = CURRENCY_PRESETS.includes(currencySymbol);
  const [customMode, setCustomMode] = useState(!isPreset);
  const [customInput, setCustomInput] = useState(isPreset ? '' : currencySymbol);
  const [exporting, setExporting] = useState(false);

  const exportDisabled = !activeVehicle || entries.length === 0 || exporting;

  const handleExportCsv = useCallback(async () => {
    if (!activeVehicle || entries.length === 0 || exporting) return;

    setExporting(true);
    try {
      const csv = buildFuelHistoryCsv(entries, { currencySymbol, distanceUnit });
      const fileName = `${activeVehicle.name.replace(/[^a-z0-9]+/gi, '_')}_fuel_history.csv`;
      const file = new File(Paths.cache, fileName);
      file.create({ overwrite: true });
      file.write(csv);

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Sharing unavailable', "This device doesn't support the share sheet.");
        return;
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
        dialogTitle: `${activeVehicle.name} Fuel History`,
      });
    } catch (error) {
      console.error('Failed to export CSV', error);
      Alert.alert(
        'Export Failed',
        'Something went wrong exporting your fill-up history. Please try again.'
      );
    } finally {
      setExporting(false);
    }
  }, [activeVehicle, entries, currencySymbol, distanceUnit, exporting]);

  const handleDeleteAll = useCallback(() => {
    Alert.alert(
      'Delete All Data?',
      "This permanently deletes every vehicle and fill-up you've logged. Currency, unit, and theme settings are kept.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            // Second, explicit confirmation -- this is more destructive than
            // a single-vehicle delete (every vehicle at once, irreversible),
            // so one Alert isn't enough of a speed bump on its own.
            Alert.alert(
              'Are You Absolutely Sure?',
              'All vehicles and fill-up history will be erased. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Everything',
                  style: 'destructive',
                  onPress: async () => {
                    await resetAll();
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, [resetAll]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Space.md }]}
    >
      <Text style={[styles.title, { color: colors.text }]}>Settings</Text>

      <Section title="Currency Symbol" colors={colors}>
        <View style={styles.chipRow}>
          {CURRENCY_PRESETS.map((symbol) => {
            const active = !customMode && currencySymbol === symbol;
            return (
              <Pressable
                key={symbol}
                onPress={() => {
                  setCustomMode(false);
                  setCurrencySymbol(symbol);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.tint : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.chipLabel, { color: active ? colors.onTint : colors.text }]}>
                  {symbol}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setCustomMode(true)}
            style={[
              styles.chip,
              {
                backgroundColor: customMode ? colors.tint : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.chipLabel, { color: customMode ? colors.onTint : colors.text }]}>
              Custom
            </Text>
          </Pressable>
        </View>

        {customMode && (
          <TextInput
            style={[
              styles.input,
              { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text },
            ]}
            value={customInput}
            onChangeText={(text) => {
              setCustomInput(text);
              if (text.trim() !== '') setCurrencySymbol(text.trim());
            }}
            placeholder="Enter a symbol, e.g. Rs."
            placeholderTextColor={colors.textMuted}
            maxLength={6}
          />
        )}
      </Section>

      <Section title="Distance Unit" colors={colors}>
        <View style={styles.chipRow}>
          {DISTANCE_UNIT_OPTIONS.map((option) => {
            const active = distanceUnit === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setDistanceUnit(option.value)}
                style={[
                  styles.chip,
                  styles.wideChip,
                  {
                    backgroundColor: active ? colors.tint : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.chipLabel, { color: active ? colors.onTint : colors.text }]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title="Fuel Unit" colors={colors}>
        <View
          style={[styles.staticRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.staticRowLabel, { color: colors.textMuted }]}>Litres</Text>
          <Text style={[styles.staticRowValue, { color: colors.textMuted }]}>{fuelUnit}</Text>
        </View>
      </Section>

      <Section title="Appearance" colors={colors}>
        <View style={styles.chipRow}>
          {THEME_OPTIONS.map((option) => {
            const active = themeOverride === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setThemeOverride(option.value)}
                style={[
                  styles.chip,
                  styles.thirdChip,
                  {
                    backgroundColor: active ? colors.tint : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.chipLabel, { color: active ? colors.onTint : colors.text }]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          The launch screen always follows your system setting -- the in-app override applies once
          Tankful opens.
        </Text>
      </Section>

      <Section title="Export" colors={colors}>
        <Pressable
          onPress={handleExportCsv}
          disabled={exportDisabled}
          style={[
            styles.actionRow,
            { backgroundColor: colors.surface, borderColor: colors.border, opacity: exportDisabled ? 0.5 : 1 },
          ]}
        >
          <Ionicons name="download-outline" size={18} color={colors.tint} />
          <Text style={[styles.actionRowLabel, { color: colors.text }]}>
            {exporting ? 'Exporting…' : 'Export Data (CSV)'}
          </Text>
        </Pressable>
        {activeVehicle && entries.length === 0 && (
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Log a fill-up for {activeVehicle.name} to enable export.
          </Text>
        )}
      </Section>

      <Section title="About & Help" colors={colors}>
        <InfoCard
          title="What counts as a full tank?"
          body="Mark a fill-up as a full tank when you fill the tank all the way up. Only full-tank fill-ups anchor a reliable litres-per-distance calculation -- a partial fill leaves the tank's true fuel level unknown, so it's excluded from mileage math (though it's still counted toward total spend and litres)."
          colors={colors}
        />
        <InfoCard
          title="How mileage is calculated"
          body="Mileage for a fill-up is the distance since the previous fill-up divided by the litres just added, and only counts when both that fill-up and the one before it were full tanks."
          colors={colors}
        />
        <InfoCard
          title="About Tankful"
          body="Tankful helps you log fill-ups, track mileage and spend trends, and manage multiple vehicles -- all stored locally on your device."
          colors={colors}
        />
      </Section>

      <Section title="Danger Zone" colors={colors}>
        <Pressable
          onPress={handleDeleteAll}
          style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.danger }]}
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={[styles.actionRowLabel, { color: colors.danger }]}>Delete All Data</Text>
        </Pressable>
      </Section>
    </ScrollView>
  );
}

function Section({
  title,
  colors,
  children,
}: {
  title: string;
  colors: ReturnType<typeof useThemeColors>;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
      {children}
    </View>
  );
}

function InfoCard({
  title,
  body,
  colors,
}: {
  title: string;
  body: string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View
      style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text style={[styles.infoCardTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.infoCardBody, { color: colors.textMuted }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Space.lg, gap: Space.xl, paddingBottom: 48 },
  title: { fontSize: 22, fontFamily: Fonts.extraBold },
  section: { gap: Space.md },
  sectionTitle: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  chip: {
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Space.sm,
    paddingHorizontal: Space.lg,
    alignItems: 'center',
  },
  wideChip: { flex: 1 },
  thirdChip: { flex: 1, paddingHorizontal: Space.sm },
  chipLabel: { fontSize: 15, fontFamily: Fonts.semiBold },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
    fontSize: 15,
    fontFamily: Fonts.regular,
  },
  staticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
    opacity: 0.7,
  },
  staticRowLabel: { fontSize: 15, fontFamily: Fonts.semiBold },
  staticRowValue: { fontSize: 15, fontFamily: Fonts.semiBold },
  hint: { fontSize: 12, fontFamily: Fonts.regular },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
  },
  actionRowLabel: { fontSize: 15, fontFamily: Fonts.semiBold },
  infoCard: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Space.lg,
    gap: Space.xs,
  },
  infoCardTitle: { fontSize: 14, fontFamily: Fonts.semiBold },
  infoCardBody: { fontSize: 13, fontFamily: Fonts.regular, lineHeight: 19 },
});
