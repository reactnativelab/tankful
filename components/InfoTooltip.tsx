import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Space, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';

interface InfoTooltipProps {
  text: string;
  colors: ThemeColors;
}

/**
 * Small info-icon button that opens a centered popover with an explanation.
 * Uses a Modal (like VehicleSelector's dropdown) rather than an anchored
 * popover, since that's simpler and reliable cross-platform without
 * measuring the icon's on-screen position.
 */
export function InfoTooltip({ text, colors }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={10}>
        <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            onPress={() => {}}
          >
            <Text style={[styles.text, { color: colors.text }]}>{text}</Text>
            <Pressable
              onPress={() => setOpen(false)}
              style={[styles.button, { backgroundColor: colors.tint }]}
            >
              <Text style={[styles.buttonLabel, { color: colors.onTint }]}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Space.xxl,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Space.lg,
    gap: Space.lg,
  },
  text: { fontSize: 14, fontFamily: Fonts.regular, lineHeight: 20 },
  button: {
    alignSelf: 'flex-end',
    borderRadius: Radius.pill,
    paddingVertical: Space.sm,
    paddingHorizontal: Space.lg,
  },
  buttonLabel: { fontSize: 14, fontFamily: Fonts.semiBold },
});
