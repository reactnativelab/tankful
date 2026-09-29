import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Radius, Space, type ThemeColors } from '@/constants/theme';
import { Fonts } from '@/constants/typography';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useThemeColors } from '@/hooks/useThemeColors';

/** Matches expo-router's ErrorBoundary contract: a route exporting a component
 * named `ErrorBoundary` with these exact props gets wrapped by expo-router's
 * own try/catch (`Try`, in `views/ErrorBoundary.js`) and rendered with them
 * in place of the route on a render-time throw. */
export interface AppErrorBoundaryProps {
  error: Error;
  retry: () => void;
}

/** Pure presentational core -- no hooks of its own, so it can be exercised
 * directly (as a plain function call) in a test without a React renderer. */
function ErrorBoundaryView({
  error,
  retry,
  colors,
  showSettingsLink,
}: {
  error: Error;
  retry: () => void;
  colors: ThemeColors;
  showSettingsLink: boolean;
}) {
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Ionicons name="warning-outline" size={48} color={colors.danger} />
      <Text style={[styles.title, { color: colors.text }]}>Something went wrong</Text>
      <Text style={[styles.message, { color: colors.textMuted }]}>
        Tankful hit an unexpected error. Your saved data hasn&apos;t been changed.
      </Text>
      {__DEV__ && (
        <Text style={[styles.debug, { color: colors.textMuted }]} numberOfLines={4}>
          {error.message}
        </Text>
      )}
      <Pressable
        onPress={retry}
        accessibilityRole="button"
        accessibilityLabel="Retry"
        style={[styles.button, { backgroundColor: colors.tint }]}
      >
        <Text style={[styles.buttonLabel, { color: colors.onTint }]}>Retry</Text>
      </Pressable>
      {showSettingsLink && (
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel="Open Settings"
        >
          <Text style={[styles.settingsLink, { color: colors.tint }]}>Open Settings</Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * Themed instance for every ErrorBoundary export except the root layout's:
 * rendered from inside the provider tree (Settings + the data store are both
 * reachable), so it can read the real theme and offer a way back to Settings
 * -- a data-shaped crash shouldn't permanently lock a user out of Delete All
 * Data as a last resort.
 */
export function AppErrorBoundary({ error, retry }: AppErrorBoundaryProps) {
  const colors = useThemeColors();
  return <ErrorBoundaryView error={error} retry={retry} colors={colors} showSettingsLink />;
}

/**
 * Root-layout instance only. This boundary can catch a throw from inside
 * SettingsProvider itself, so it never reads useSettings/useThemeColors (that
 * would just throw again) -- it falls back to the raw system color scheme and
 * the static Colors tokens, and skips the Settings link, since there's no
 * reliable path back into a working app state from here.
 */
export function RootAppErrorBoundary({ error, retry }: AppErrorBoundaryProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return (
    <ErrorBoundaryView error={error} retry={retry} colors={Colors[scheme]} showSettingsLink={false} />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.lg,
    padding: Space.xl,
  },
  title: { fontSize: 18, fontFamily: Fonts.bold, textAlign: 'center' },
  message: { fontSize: 15, textAlign: 'center', fontFamily: Fonts.regular },
  debug: { fontSize: 12, textAlign: 'center', fontFamily: Fonts.regular },
  button: {
    paddingVertical: Space.md,
    paddingHorizontal: Space.xl,
    borderRadius: Radius.pill,
  },
  buttonLabel: { fontSize: 15, fontFamily: Fonts.semiBold },
  settingsLink: { fontSize: 14, fontFamily: Fonts.semiBold },
});
