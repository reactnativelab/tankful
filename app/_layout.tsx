import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDatabase } from '@/db';
import { useColorScheme } from '@/hooks/useColorScheme';
import { SelectedVehicleProvider } from '@/hooks/useSelectedVehicle';
import { useThemeColors } from '@/hooks/useThemeColors';

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const colorScheme = useColorScheme();
  const colors = useThemeColors();

  useEffect(() => {
    initDatabase()
      .then(() => setDbReady(true))
      .catch((error) => {
        console.error('Failed to initialize database', error);
      });
  }, []);

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
      <SelectedVehicleProvider>
        <Stack screenOptions={{ headerShown: false }}>
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
    </GestureHandlerRootView>
  );
}
