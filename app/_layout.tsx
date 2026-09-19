import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FontFiles, Fonts } from '@/constants/typography';
import { initDatabase } from '@/db';
import { SelectedVehicleProvider } from '@/hooks/useSelectedVehicle';
import { SettingsProvider, useSettings } from '@/hooks/useSettings';
import { useResolvedColorScheme, useThemeColors } from '@/hooks/useThemeColors';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // SettingsProvider has to wrap everything else in this tree (not just be
  // rendered from inside it) because useThemeColors/useResolvedColorScheme
  // now read themeOverride from it -- see hooks/useThemeColors.ts.
  return (
    <SettingsProvider>
      <RootLayoutInner />
    </SettingsProvider>
  );
}

function RootLayoutInner() {
  const [dbReady, setDbReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts(FontFiles);
  const resolvedScheme = useResolvedColorScheme();
  const colors = useThemeColors();
  const { settingsLoaded, hasSeenOnboarding } = useSettings();

  useEffect(() => {
    initDatabase()
      .then(() => setDbReady(true))
      .catch((error) => {
        console.error('Failed to initialize database', error);
      });
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Redirect to the one-time first-run flow (splash cover -> onboarding) on
  // true first launch, once we actually know hasSeenOnboarding (not just its
  // pre-load default). Gated on dbReady too so this only fires once the
  // Stack below has actually mounted -- calling router.replace any earlier
  // has no navigator to act on yet. Runs once per app start; splash-cover
  // hands off to onboarding, whose own CTA replaces the flow away.
  useEffect(() => {
    if (dbReady && settingsLoaded && !hasSeenOnboarding) {
      router.replace('/splash-cover');
    }
  }, [dbReady, settingsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the native splash screen up until fonts resolve, so there's never a
  // system-font flash before Manrope takes over.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  if (!dbReady || !settingsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SelectedVehicleProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            headerTitleStyle: { fontFamily: Fonts.bold },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="splash-cover" options={{ gestureEnabled: false }} />
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
          <Stack.Screen
            name="modals/log-fillup"
            options={{ presentation: 'modal', headerShown: true, title: 'Log Fill-up' }}
          />
          <Stack.Screen
            name="modals/vehicle-manager"
            options={{ presentation: 'modal', headerShown: true, title: 'Vehicles' }}
          />
          <Stack.Screen
            name="modals/add-edit-vehicle"
            options={{ presentation: 'modal', headerShown: true, title: 'Vehicle' }}
          />
        </Stack>
        <StatusBar style={resolvedScheme === 'dark' ? 'light' : 'dark'} />
      </SelectedVehicleProvider>
    </GestureHandlerRootView>
  );
}
