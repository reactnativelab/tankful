import { ReactNode, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { EmptyState } from '@/components/EmptyState';
import { InfoTooltip } from '@/components/InfoTooltip';
import { Radius, Space, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';
import { useLogFillupForm } from '@/hooks/useLogFillupForm';
import { useSettings } from '@/hooks/useSettings';
import { useThemeColors } from '@/hooks/useThemeColors';
import { formatDate } from '@/utils/format';

export default function LogFillupModal() {
  const colors = useThemeColors();
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();

  if (!vehicleId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="alert-circle-outline"
          message="No vehicle selected. Go back and pick a vehicle before logging a fill-up."
          buttonLabel="Go Back"
          onPress={() => router.back()}
          colors={colors}
        />
      </View>
    );
  }

  return <LogFillupFormView vehicleId={vehicleId} colors={colors} />;
}

function LogFillupFormView({
  vehicleId,
  colors,
}: {
  vehicleId: string;
  colors: ThemeColors;
}) {
  const form = useLogFillupForm(vehicleId);
  const { currencySymbol, distanceUnit, fuelUnit } = useSettings();
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleSave = async () => {
    const success = await form.submit();
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    }
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
        <FormField label="Date" colors={colors}>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={[
              styles.input,
              styles.dateRow,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.dateText, { color: colors.text }]}>
              {formatDate(form.date.getTime())}
            </Text>
          </Pressable>
          {showDatePicker && (
            <DateTimePicker
              value={form.date}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onValueChange={(_event, selectedDate) => {
                setShowDatePicker(false);
                form.setDate(selectedDate);
              }}
              onDismiss={() => setShowDatePicker(false)}
            />
          )}
        </FormField>

        <FormField label="Odometer Reading" colors={colors} error={form.fieldErrors.odometer}>
          <AdornedInput
            colors={colors}
            value={form.odometer}
            onChangeText={form.setOdometer}
            placeholder="0"
            suffix={distanceUnit}
            error={form.fieldErrors.odometer}
          />
        </FormField>

        <FormField
          label="Litres Filled"
          colors={colors}
          error={form.fieldErrors.litresFilled}
        >
          <AdornedInput
            colors={colors}
            value={form.litresFilled}
            onChangeText={form.setLitresFilled}
            placeholder="0.00"
            suffix={fuelUnit}
            error={form.fieldErrors.litresFilled}
          />
        </FormField>

        <FormField
          label="Price per Litre"
          colors={colors}
          error={form.fieldErrors.pricePerLitre}
        >
          <AdornedInput
            colors={colors}
            value={form.pricePerLitre}
            onChangeText={form.setPricePerLitre}
            placeholder="0.00"
            prefix={currencySymbol}
            error={form.fieldErrors.pricePerLitre}
          />
        </FormField>

        <FormField label="Total Cost" colors={colors}>
          <AdornedInput
            colors={colors}
            value={form.totalCost}
            onChangeText={form.setTotalCost}
            placeholder="0.00"
            prefix={currencySymbol}
            trailingIcon="pencil-outline"
          />
        </FormField>

        <View style={styles.switchRow}>
          <View style={styles.switchLabelRow}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Full Tank?</Text>
            <InfoTooltip
              text="Only full-tank fill-ups are used to calculate mileage -- a partial fill breaks the litres-per-distance math, so it's skipped."
              colors={colors}
            />
          </View>
          <Switch
            value={form.isTankFull}
            onValueChange={form.setIsTankFull}
            trackColor={{ false: colors.border, true: colors.tint }}
            thumbColor={colors.onTint}
          />
        </View>

        <FormField label="Notes" colors={colors}>
          <TextInput
            style={[
              styles.input,
              { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text },
            ]}
            value={form.notes}
            onChangeText={form.setNotes}
            placeholder="Optional"
            placeholderTextColor={colors.textMuted}
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

/**
 * Bordered input row with optional leading prefix (e.g. a currency symbol),
 * trailing suffix (e.g. a distance/volume unit) and trailing icon (e.g. a
 * pencil hinting the value is a manually-overridable default). Reused by
 * every numeric field in this form instead of one-off styling per field.
 */
function AdornedInput({
  colors,
  value,
  onChangeText,
  placeholder,
  prefix,
  suffix,
  trailingIcon,
  error,
}: {
  colors: ThemeColors;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  prefix?: string;
  suffix?: string;
  trailingIcon?: keyof typeof Ionicons.glyphMap;
  error?: string | null;
}) {
  return (
    <View
      style={[
        styles.inputBox,
        { borderColor: error ? colors.danger : colors.border, backgroundColor: colors.surface },
      ]}
    >
      {prefix && <Text style={[styles.adornmentText, { color: colors.textMuted }]}>{prefix}</Text>}
      <TextInput
        style={[styles.adornedTextInput, styles.inputTabular, { color: colors.text }]}
        keyboardType="decimal-pad"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
      />
      {suffix && <Text style={[styles.adornmentText, { color: colors.textMuted }]}>{suffix}</Text>}
      {trailingIcon && <Ionicons name={trailingIcon} size={16} color={colors.textMuted} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  inputTabular: { fontVariant: ['tabular-nums'] },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  dateText: { fontSize: 15, fontFamily: Fonts.regular },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
  },
  adornedTextInput: {
    flex: 1,
    padding: 0,
    fontSize: 15,
    fontFamily: Fonts.regular,
  },
  adornmentText: { fontSize: 15, fontFamily: Fonts.medium },
  fieldError: { fontSize: 12, fontFamily: Fonts.regular },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Space.xs,
  },
  switchLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Space.xs },
  switchLabel: { fontSize: 15, fontFamily: Fonts.semiBold },
  submitError: { fontSize: 13, textAlign: 'center', fontFamily: Fonts.regular },
  saveButton: {
    borderRadius: Radius.pill,
    paddingVertical: Space.lg,
    alignItems: 'center',
    marginTop: Space.sm,
  },
  saveButtonLabel: { fontSize: 16, fontFamily: Fonts.bold },
});
