import React, { useEffect } from 'react';
import { Alert, Platform, Text } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';
import * as SecureStore from 'expo-secure-store';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LockScreen } from '@/components/LockScreen';
import { PaymentModal } from '@/components/PaymentModal';
import { CUSTOMER_SESSION_KEY, LoanProvider, useLoan } from '@/context/LoanContext';
import { API_BASE_URL } from '@/lib/api-config';
import { CustomerAccessScreen } from '@/components/CustomerAccessScreen';
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

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

setBaseUrl(API_BASE_URL);
setAuthTokenGetter(() => SecureStore.getItemAsync(CUSTOMER_SESSION_KEY));

function AdminGuard() {
  const {
    isSupported,
    isActive,
    hasOverlayPermission,
    isChecking,
    requestAdmin,
    requestOverlay,
  } = useDeviceAdmin();

  useEffect(() => {
    if (!isSupported || isChecking) return;

    if (!isActive) {
      const t = setTimeout(() => {
        Alert.alert(
          'Permiso obligatorio de Administrador',
          'Para usar el dispositivo financiado con FinJoy es obligatorio activar el permiso de Administrador del Dispositivo.',
          [
            {
              text: 'Activar ahora',
              onPress: requestAdmin,
            },
          ],
          { cancelable: false },
        );
      }, 600);
      return () => clearTimeout(t);
    }

    if (!hasOverlayPermission) {
      const t = setTimeout(() => {
        Alert.alert(
          'Permiso obligatorio de Superposición',
          'Activa "Mostrar sobre otras aplicaciones" para completar la vinculación de seguridad de FinJoy.',
          [
            {
              text: 'Configurar permiso',
              onPress: requestOverlay,
            },
          ],
          { cancelable: false },
        );
      }, 600);
      return () => clearTimeout(t);
    }
  }, [
    isSupported,
    isActive,
    hasOverlayPermission,
    isChecking,
    requestAdmin,
    requestOverlay,
  ]);

  return null;
}

function RootLayoutNav() {
  const {
    isDeviceLocked,
    isLoading,
    isAuthenticated,
    hasSession,
    apiConfigured,
    syncError,
    refreshAccount,
    logout,
  } = useLoan();

  if (isLoading) {
    return (
      <GestureHandlerRootView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Conectando con FinJoy…</Text>
      </GestureHandlerRootView>
    );
  }
  if (!apiConfigured || !hasSession || !isAuthenticated) {
    return <CustomerAccessScreen />;
  }
  if (syncError) {
    return (
      <CustomerAccessScreen
        syncError={syncError}
        onRetry={refreshAccount}
        onLogout={logout}
      />
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <LockScreen visible={isDeviceLocked} />
      {!isDeviceLocked && <PaymentModal />}
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
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <LoanProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <RootLayoutNav />
            </GestureHandlerRootView>
          </LoanProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
