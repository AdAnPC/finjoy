import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as DeviceAdmin from 'expo-device-admin';

export interface DeviceAdminState {
  /** Whether the Device Admin API is available (Android native build only). */
  isSupported: boolean;
  /** Whether the app currently holds Device Admin privileges. */
  isActive: boolean;
  /** Whether the app has "Display over other apps" permission for foreground lock enforcement. */
  hasOverlayPermission: boolean;
  /** True while checking status. */
  isChecking: boolean;
  /** Open the system dialog to request Device Admin. */
  requestAdmin: () => Promise<void>;
  /** Open the system settings screen to grant Overlay permission. */
  requestOverlay: () => Promise<void>;
}

/**
 * Hook that manages Android Device Administrator + Overlay permissions.
 */
export function useDeviceAdmin(): DeviceAdminState {
  const [isActive, setIsActive] = useState(false);
  const [hasOverlayPermission, setHasOverlayPermission] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const check = useCallback(async () => {
    try {
      if (!DeviceAdmin.isSupported) {
        setIsChecking(false);
        return;
      }
      const [active, overlay] = await Promise.all([
        DeviceAdmin.isDeviceAdminActive(),
        DeviceAdmin.canDrawOverlays(),
      ]);
      setIsActive(Boolean(active));
      setHasOverlayPermission(Boolean(overlay));
    } catch {
      setIsActive(false);
      setHasOverlayPermission(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Check on mount and whenever the app comes back to foreground
  useEffect(() => {
    void check();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  const requestAdmin = useCallback(async () => {
    try {
      await DeviceAdmin.requestDeviceAdmin();
    } catch {
      // Ignore errors
    }
  }, []);

  const requestOverlay = useCallback(async () => {
    try {
      await DeviceAdmin.requestOverlayPermission();
    } catch {
      // Ignore errors
    }
  }, []);

  return {
    isSupported: DeviceAdmin.isSupported,
    isActive,
    hasOverlayPermission,
    isChecking,
    requestAdmin,
    requestOverlay,
  };
}
