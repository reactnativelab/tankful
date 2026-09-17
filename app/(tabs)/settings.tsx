import { ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Space } from '@/constants/theme';
import { Fonts } from '@/constants/typography';
import { useSettings, type DistanceUnit } from '@/hooks/useSettings';
import { useThemeColors } from '@/hooks/useThemeColors';

const CURRENCY_PRESETS = ['₹', '$', '€', '£'];

const DISTANCE_UNIT_OPTIONS: { value: DistanceUnit; label: string }[] = [
  { value: 'km', label: 'Kilometers' },
  { value: 'mi', label: 'Miles' },
];

export default function SettingsScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { currencySymbol, distanceUnit, fuelUnit, setCurrencySymbol, setDistanceUnit } =
    useSettings();

  const isPreset = CURRENCY_PRESETS.includes(currencySymbol);
  const [customMode, setCustomMode] = useState(!isPreset);
  const [customInput, setCustomInput] = useState(isPreset ? '' : currencySymbol);

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
});
