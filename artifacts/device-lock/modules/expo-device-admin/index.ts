import { NativeModules, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

function getNativeModule() {
  if (Platform.OS !== 'android') return null;
  try {
    return requireOptionalNativeModule('ExpoDeviceAdmin') ?? NativeModules?.ExpoDeviceAdmin ?? null;
  } catch {
    return NativeModules?.ExpoDeviceAdmin ?? null;
  }
}

const ExpoDeviceAdmin = getNativeModule();

/** True only when running as an Android native build (not Expo Go, not iOS, not web). */
export const isSupported: boolean = Platform.OS === 'android' && !!ExpoDeviceAdmin;

/**
 * Returns true if the app currently holds Device Administrator privileges.
 */
export async function isDeviceAdminActive(): Promise<boolean> {
  if (!isSupported || !ExpoDeviceAdmin) return false;
  try {
    return await ExpoDeviceAdmin.isDeviceAdminActive();
  } catch {
    return false;
  }
}

/**
 * Returns true if the app is provisioned as Android Device Owner (full anti-factory-reset mode).
 */
export async function isDeviceOwner(): Promise<boolean> {
  if (!isSupported || !ExpoDeviceAdmin) return false;
  try {
    return await ExpoDeviceAdmin.isDeviceOwner();
  } catch {
    return false;
  }
}

/**
 * Opens the Android system dialog asking the user to grant Device Admin.
 */
export async function requestDeviceAdmin(): Promise<boolean> {
  if (!isSupported || !ExpoDeviceAdmin) return false;
  try {
    return await ExpoDeviceAdmin.requestDeviceAdmin();
  } catch {
    return false;
  }
}

/**
 * Returns true if the app has permission to draw over other apps (Android 10+ foreground lock enforcement).
 */
export async function canDrawOverlays(): Promise<boolean> {
  if (!isSupported || !ExpoDeviceAdmin) return false;
  try {
    return await ExpoDeviceAdmin.canDrawOverlays();
  } catch {
    return false;
  }
}

/**
 * Opens the Android system settings screen to grant "Display over other apps".
 */
export async function requestOverlayPermission(): Promise<boolean> {
  if (!isSupported || !ExpoDeviceAdmin) return false;
  try {
    return await ExpoDeviceAdmin.requestOverlayPermission();
  } catch {
    return false;
  }
}

/**
 * Immediately locks the Android device screen when Device Admin is active.
 */
export async function lockDeviceNow(): Promise<boolean> {
  if (!isSupported || !ExpoDeviceAdmin) return false;
  try {
    return await ExpoDeviceAdmin.lockNow();
  } catch {
    return false;
  }
}

/**
 * Configures Enterprise Factory Reset Protection (FRP) Google Account IDs on the device (Android 11+ / API 30+).
 * If someone forces a hardware factory reset from Recovery Mode, the phone will be locked on boot
 * requiring one of these business Google accounts.
 */
export async function setFrpAccounts(accounts: string[]): Promise<boolean> {
  if (!isSupported || !ExpoDeviceAdmin) return false;
  try {
    return await ExpoDeviceAdmin.setFrpAccounts(accounts);
  } catch {
    return false;
  }
}

/**
 * Enables or disables permanent anti-factory-reset (DISALLOW_FACTORY_RESET),
 * Enterprise FRP, anti-safe-boot (DISALLOW_SAFE_BOOT), anti-OEM-unlock, and
 * anti-uninstall policies while the device has an active unpaid loan.
 */
export async function setCreditProtectionEnabled(protectedState: boolean): Promise<boolean> {
  if (!isSupported || !ExpoDeviceAdmin) return false;
  try {
    return await ExpoDeviceAdmin.setCreditProtectionEnabled(protectedState);
  } catch {
    return false;
  }
}

/**
 * Enables or disables full Kiosk Lockdown mode (blocks Home, Recents, Status Bar,
 * and continuously forces FinJoy to the foreground until unlocked).
 */
export async function setKioskLockEnabled(enabled: boolean): Promise<boolean> {
  if (!isSupported || !ExpoDeviceAdmin) return false;
  try {
    return await ExpoDeviceAdmin.setKioskLockEnabled(enabled);
  } catch {
    return false;
  }
}
