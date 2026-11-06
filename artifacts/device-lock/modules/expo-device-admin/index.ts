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

/** Returns true only when Android has provisioned this app as Device Owner. */
export async function isDeviceOwner(): Promise<boolean> {
  if (!isSupported || !ExpoDeviceAdmin) return false;
  try {
    return await ExpoDeviceAdmin.isDeviceOwner();
  } catch {
    return false;
  }
}

/** Returns a SHA-256 fingerprint of Android's app-scoped device ID. */
export async function getDeviceIdHash(): Promise<string | null> {
  if (!isSupported || !ExpoDeviceAdmin) return null;
  try {
    const value = await ExpoDeviceAdmin.getDeviceIdHash();
    return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value) ? value : null;
  } catch {
    return null;
  }
}

export type FinJoyDeviceInfo = {
  manufacturer: string | null;
  model: string | null;
  osVersion: string | null;
};

/** Returns basic Android hardware details for device enrollment records. */
export async function getDeviceInfo(): Promise<FinJoyDeviceInfo | null> {
  if (!isSupported || !ExpoDeviceAdmin) return null;
  try {
    const value = await ExpoDeviceAdmin.getDeviceInfo();
    if (!value || typeof value !== 'object') return null;
    return {
      manufacturer: typeof value.manufacturer === 'string' ? value.manufacturer : null,
      model: typeof value.model === 'string' ? value.model : null,
      osVersion: typeof value.osVersion === 'string' ? value.osVersion : null,
    };
  } catch {
    return null;
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
 * Requests the enterprise FRP policy using Google account user IDs (Android 11+).
 * Requires Device Owner, a supported device/FRP agent, and valid account IDs.
 * FRP does not prevent every reset or guarantee behavior across all OEMs.
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
 * Requests Device Owner restrictions for factory reset from Settings, safe boot,
 * adding users, OEM unlock, and uninstalling FinJoy. Device/OEM support varies;
 * these restrictions cannot prevent every physical reset or firmware rewrite.
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


export async function configureBackgroundSync(
  apiBaseUrl: string,
  sessionToken: string | null,
): Promise<boolean> {
  if (!isSupported || !ExpoDeviceAdmin?.configureBackgroundSync) return false;
  try {
    return await ExpoDeviceAdmin.configureBackgroundSync(apiBaseUrl, sessionToken);
  } catch {
    return false;
  }
}
