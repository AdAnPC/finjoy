import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as DeviceAdmin from 'expo-device-admin';

export interface DeviceAdminState {
  /** Whether the Device Admin API is available (Android native build only). */
  isSupported: boolean;
  /** Whether the app currently holds Device Admin privileges. */
  isActive: boolean;
  /** True while checking status. */
  isChecking: boolean;
  /** Open the system dialog to request Device Admin. */
  requestAdmin: () => Promise<void>;
}

/**
 * Hook that manages Android Device Administrator status.
 *
 * - On Android native builds: checks and requests admin on mount, then
 *   re-checks every time the app comes back to the foreground.
 * - On iOS / Expo Go: all values are no-ops; isSupported is false.
 */
export function useDeviceAdmin(): DeviceAdminState {
  const [isActive, setIsActive] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const hasMounted = useRef(false);

  const check = useCallback(async () => {
    if (!DeviceAdmin.isSupported) {
      setIsChecking(false);
      return;
    }
    const active = await DeviceAdmin.isDeviceAdminActive();
    setIsActive(active);
    setIsChecking(false);
  }, []);

  // Check on mount and whenever the app comes back to foreground
  useEffect(() => {
    check();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, [check]);

  // On first render (after check), if not active, request admin
  useEffect(() => {
    if (isChecking) return;
    if (hasMounted.current) return;
    hasMounted.current = true;

    if (!isActive && DeviceAdmin.isSupported) {
      DeviceAdmin.requestDeviceAdmin();
    }
  }, [isChecking, isActive]);

  const requestAdmin = useCallback(async () => {
    await DeviceAdmin.requestDeviceAdmin();
  }, []);

  return {
    isSupported: DeviceAdmin.isSupported,
    isActive,
    isChecking,
    requestAdmin,
  };
}
