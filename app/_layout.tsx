import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FontFiles, Fonts } from '@/constants/typography';
import { initDatabase } from '@/db';
import { useColorScheme } from '@/hooks/useColorScheme';
import { SelectedVehicleProvider } from '@/hooks/useSelectedVehicle';
import { SettingsProvider } from '@/hooks/useSettings';
import { useThemeColors } from '@/hooks/useThemeColors';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts(FontFiles);
  const colorScheme = useColorScheme();
  const colors = useThemeColors();

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

  // Keep the native splash screen up until fonts resolve, so there's never a
  // system-font flash before Manrope takes over.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  if (!dbReady) {
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
      <SettingsProvider>
        <SelectedVehicleProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              headerTitleStyle: { fontFamily: Fonts.bold },
            }}
          >
            <Stack.Screen name="(tabs)" />
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
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </SelectedVehicleProvider>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}
