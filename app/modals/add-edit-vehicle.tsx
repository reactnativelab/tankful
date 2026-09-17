import { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { FUEL_TYPE_OPTIONS, VEHICLE_TYPE_OPTIONS } from '@/constants/vehicleOptions';
import { Radius, Space, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useVehicleForm } from '@/hooks/useVehicleForm';

export default function AddEditVehicleModal() {
  const colors = useThemeColors();
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const form = useVehicleForm(vehicleId ?? null);

  if (form.loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  const handleSave = async () => {
    const success = await form.submit();
    if (success) router.back();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <FormField label="Name" colors={colors} error={form.fieldErrors.name}>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: form.fieldErrors.name ? colors.danger : colors.border,
                backgroundColor: colors.surface,
                color: colors.text,
              },
            ]}
            value={form.name}
            onChangeText={form.setName}
            placeholder="e.g. Activa"
            placeholderTextColor={colors.textMuted}
          />
        </FormField>

        <FormField label="Type" colors={colors}>
          <SegmentedControl
            options={VEHICLE_TYPE_OPTIONS}
            value={form.type}
            onChange={form.setType}
            colors={colors}
          />
        </FormField>

        <FormField label="Fuel Type" colors={colors}>
          <SegmentedControl
            options={FUEL_TYPE_OPTIONS}
            value={form.fuelType}
            onChange={form.setFuelType}
            colors={colors}
          />
        </FormField>

        <FormField label="Plate" colors={colors}>
          <TextInput
            style={[
              styles.input,
              { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text },
            ]}
            value={form.plate}
            onChangeText={form.setPlate}
            placeholder="Optional"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
          />
        </FormField>

        {form.submitError && (
          <Text style={[styles.submitError, { color: colors.danger }]}>{form.submitError}</Text>
        )}

        <Pressable
          onPress={handleSave}
          disabled={form.submitting}
          style={[
            styles.saveButton,
            { backgroundColor: colors.tint, opacity: form.submitting ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.saveButtonLabel, { color: colors.onTint }]}>
            {form.submitting ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  colors,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.segmentRow}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              {
                backgroundColor: active ? colors.tint : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: active ? colors.onTint : colors.text },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FormField({
  label,
  colors,
  error,
  children,
}: {
  label: string;
  colors: ThemeColors;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      {children}
      {error && <Text style={[styles.fieldError, { color: colors.danger }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: Space.lg, gap: Space.lg, paddingBottom: Space.xxl },
  field: { gap: Space.sm },
  label: { fontSize: 13, fontFamily: Fonts.semiBold },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
    fontSize: 15,
    fontFamily: Fonts.regular,
  },
  fieldError: { fontSize: 12, fontFamily: Fonts.regular },
  segmentRow: { flexDirection: 'row', gap: Space.sm },
  segment: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Space.md,
    alignItems: 'center',
  },
  segmentLabel: { fontSize: 14, fontFamily: Fonts.semiBold },
  submitError: { fontSize: 13, textAlign: 'center', fontFamily: Fonts.regular },
  saveButton: {
    borderRadius: Radius.pill,
    paddingVertical: Space.lg,
    alignItems: 'center',
    marginTop: Space.sm,
  },
  saveButtonLabel: { fontSize: 16, fontFamily: Fonts.bold },
});
