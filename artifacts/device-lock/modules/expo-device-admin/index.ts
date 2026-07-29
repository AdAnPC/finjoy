import { NativeModules, Platform } from 'react-native';

/**
 * Native module bridged from DeviceAdminModule.kt.
 * Only present in Android native builds; null everywhere else.
 */
const { ExpoDeviceAdmin } = NativeModules;

/** True only when running as an Android native build (not Expo Go, not iOS, not web). */
export const isSupported: boolean = Platform.OS === 'android' && !!ExpoDeviceAdmin;

/**
 * Returns true if the app currently holds Device Administrator privileges.
 * Always false outside of an Android native build.
 */
export async function isDeviceAdminActive(): Promise<boolean> {
  if (!isSupported) return false;
  return ExpoDeviceAdmin.isDeviceAdminActive();
}

/**
 * Opens the Android system dialog asking the user to grant Device Admin.
 * Resolves immediately after launching the system intent (before the user responds).
 * Call isDeviceAdminActive() once the app resumes to know the outcome.
 * No-op outside of an Android native build.
 */
export async function requestDeviceAdmin(): Promise<boolean> {
  if (!isSupported) return false;
  return ExpoDeviceAdmin.requestDeviceAdmin();
}
