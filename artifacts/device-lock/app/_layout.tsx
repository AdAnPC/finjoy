import React, { useEffect } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LockScreen } from '@/components/LockScreen';
import { PaymentModal } from '@/components/PaymentModal';
import { LoanProvider, useLoan } from '@/context/LoanContext';
import { useDeviceAdmin } from '@/hooks/useDeviceAdmin';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AdminGuard() {
  const { isSupported, isActive, isChecking, requestAdmin } = useDeviceAdmin();

  // Once we know the status, if admin is missing → prompt
  useEffect(() => {
    if (!isSupported || isChecking || isActive) return;

    // Small delay so the app finishes rendering before the system dialog appears
    const t = setTimeout(() => {
      Alert.alert(
        'Activar protección del dispositivo',
        'FinJoy necesita permisos de administrador para bloquear el dispositivo en caso de impago, según el contrato de crédito firmado.',
        [
          {
            text: 'Activar',
            onPress: requestAdmin,
          },
          {
            text: 'Más tarde',
            style: 'cancel',
          },
        ]
      );
    }, 800);
    return () => clearTimeout(t);
  }, [isSupported, isActive, isChecking, requestAdmin]);

  return null;
}

function RootLayoutNav() {
  const { isDeviceLocked } = useLoan();
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <LockScreen visible={isDeviceLocked} />
      <PaymentModal />
      {/* Only runs on Android native builds; no-op on iOS/Expo Go */}
      {Platform.OS === 'android' && <AdminGuard />}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <LoanProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </LoanProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
