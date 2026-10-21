// Config plugin: registers FinJoy as a Device Administrator / Device Owner + Zero-Touch & FRP Guard on Android.
// This runs during `expo prebuild` (or EAS Build) and modifies the native Android project.
const expoPackage = require.resolve('expo/package.json');
const configPlugins = require(require.resolve('@expo/config-plugins', {
  paths: [expoPackage],
}));
const { withAndroidManifest, withDangerousMod } = configPlugins;
const fs = require('fs');
const path = require('path');

const REQUIRED_PERMISSIONS = [
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.WAKE_LOCK',
  'android.permission.DISABLE_KEYGUARD',
  'android.permission.REORDER_TASKS',
];

const DEVICE_ADMIN_XML = `<?xml version="1.0" encoding="utf-8"?>
<device-admin xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-policies>
    <force-lock />
    <watch-login />
    <limit-password />
    <wipe-data />
  </uses-policies>
</device-admin>
`;

// language=kotlin
function buildReceiverKotlin(packageName) {
  return `package ${packageName}

import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.app.admin.FactoryResetProtectionPolicy
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PersistableBundle
import android.os.UserManager

class FinJoyDeviceAdminReceiver : DeviceAdminReceiver() {
    @Suppress("DEPRECATION")
    private fun extractProvisioningExtras(context: Context, intent: Intent) {
        try {
            val extras = intent.getParcelableExtra<PersistableBundle>(
                DevicePolicyManager.EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE
            ) ?: return

            val prefs = context.getSharedPreferences("finjoy_lock_prefs", Context.MODE_PRIVATE)
            val editor = prefs.edit()

            val frpCsv = extras.getString("frp_account_ids")
            if (!frpCsv.isNullOrBlank()) {
                editor.putString("frp_account_ids", frpCsv.trim())
            }
            val orgName = extras.getString("organization_name")
            if (!orgName.isNullOrBlank()) {
                editor.putString("organization_name", orgName.trim())
            }
            editor.putBoolean("credit_protected", true)
            editor.putBoolean("is_locked", true)
            editor.apply()
        } catch (_: Throwable) {
        }
    }

    private fun applyAntiResetAndFrpProtection(context: Context) {
        try {
            val prefs = context.getSharedPreferences("finjoy_lock_prefs", Context.MODE_PRIVATE)
            if (!prefs.contains("credit_protected")) {
                prefs.edit()
                    .putBoolean("credit_protected", true)
                    .putBoolean("is_locked", true)
                    .apply()
            }

            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val pkg = context.packageName
            val component = ComponentName(pkg, "$pkg.FinJoyDeviceAdminReceiver")
            if (dpm.isDeviceOwnerApp(pkg)) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    dpm.setPermissionPolicy(
                        component,
                        DevicePolicyManager.PERMISSION_POLICY_AUTO_GRANT
                    )
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    dpm.setUninstallBlocked(component, pkg, true)
                    dpm.addUserRestriction(component, UserManager.DISALLOW_FACTORY_RESET)
                    dpm.addUserRestriction(component, UserManager.DISALLOW_SAFE_BOOT)
                    dpm.addUserRestriction(component, UserManager.DISALLOW_ADD_USER)
                    dpm.addUserRestriction(component, "no_oem_unlock")
                }

                // Nivel A: Enterprise Factory Reset Protection (FRP) en Android 11+ (API 30+)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    val frpCsv = prefs.getString("frp_account_ids", "") ?: ""
                    val accounts = frpCsv
                        .split(",")
                        .map { it.trim() }
                        .filter { it.isNotEmpty() }
                    if (accounts.isNotEmpty()) {
                        val policy = FactoryResetProtectionPolicy.Builder()
                            .setFactoryResetProtectionAccounts(accounts)
                            .setFactoryResetProtectionEnabled(true)
                            .build()
                        dpm.setFactoryResetProtectionPolicy(component, policy)
                    }
                }
            }
        } catch (_: Throwable) {
        }
    }

    private fun launchMainActivity(context: Context) {
        try {
            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            if (launchIntent != null) {
                launchIntent.addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP
                )
                context.startActivity(launchIntent)
            }
        } catch (_: Throwable) {
        }
    }

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        extractProvisioningExtras(context, intent)
        applyAntiResetAndFrpProtection(context)
    }

    override fun onProfileProvisioningComplete(context: Context, intent: Intent) {
        super.onProfileProvisioningComplete(context, intent)
        extractProvisioningExtras(context, intent)
        applyAntiResetAndFrpProtection(context)
        launchMainActivity(context)
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
    }

    override fun onDisableRequested(context: Context, intent: Intent): CharSequence {
        try {
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            dpm.lockNow()
            launchMainActivity(context)
        } catch (_: Throwable) {
        }
        return "Dispositivo protegido por FinJoy. Para desactivar la protección debes liquidar tu crédito."
    }
}
`;
}

// language=kotlin
function buildBootReceiverKotlin(packageName) {
  return `package ${packageName}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class FinJoyBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val prefs = context.getSharedPreferences("finjoy_lock_prefs", Context.MODE_PRIVATE)
        val isLocked = prefs.getBoolean("is_locked", false)
        val isCreditProtected = prefs.getBoolean("credit_protected", true)
        if (!isLocked && !isCreditProtected) return

        try {
            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            if (launchIntent != null) {
                launchIntent.addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP
                )
                context.startActivity(launchIntent)
            }
        } catch (_: Throwable) {
        }
    }
}
`;
}

module.exports = function withDeviceAdmin(config) {
  // 1. Add permissions, activity flags, and receivers to AndroidManifest.xml
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    if (!manifest.manifest['uses-permission']) {
      manifest.manifest['uses-permission'] = [];
    }
    const existingPerms = manifest.manifest['uses-permission'];
    for (const perm of REQUIRED_PERMISSIONS) {
      const hasPerm = existingPerms.some((p) => p.$?.['android:name'] === perm);
      if (!hasPerm) {
        existingPerms.push({ $: { 'android:name': perm } });
      }
    }

    const app = manifest.manifest.application[0];
    if (app.activity && app.activity[0]?.$) {
      app.activity[0].$['android:showWhenLocked'] = 'true';
      app.activity[0].$['android:turnScreenOn'] = 'true';
      app.activity[0].$['android:launchMode'] = 'singleTask';
    }

    if (!app.receiver) app.receiver = [];

    const hasAdminReceiver = (app.receiver || []).some(
      (r) => r.$?.['android:name'] === '.FinJoyDeviceAdminReceiver'
    );
    if (!hasAdminReceiver) {
      app.receiver.push({
        $: {
          'android:name': '.FinJoyDeviceAdminReceiver',
          'android:label': 'FinJoy Control de Crédito',
          'android:permission': 'android.permission.BIND_DEVICE_ADMIN',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.app.action.DEVICE_ADMIN_ENABLED' } },
              { $: { 'android:name': 'android.app.action.PROFILE_PROVISIONING_COMPLETE' } },
              { $: { 'android:name': 'android.app.action.DEVICE_OWNER_CHANGED' } },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.app.device_admin',
              'android:resource': '@xml/device_admin',
            },
          },
        ],
      });
    }

    const hasBootReceiver = (app.receiver || []).some(
      (r) => r.$?.['android:name'] === '.FinJoyBootReceiver'
    );
    if (!hasBootReceiver) {
      app.receiver.push({
        $: {
          'android:name': '.FinJoyBootReceiver',
          'android:enabled': 'true',
          'android:exported': 'true',
          'android:directBootAware': 'true',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
              { $: { 'android:name': 'android.intent.action.LOCKED_BOOT_COMPLETED' } },
              { $: { 'android:name': 'android.intent.action.QUICKBOOT_POWERON' } },
              { $: { 'android:name': 'android.intent.action.USER_PRESENT' } },
            ],
          },
        ],
      });
    }

    return cfg;
  });

  // 2. Write device_admin.xml + FinJoyDeviceAdminReceiver.kt + FinJoyBootReceiver.kt
  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      const projectRoot = cfg.modRequest.platformProjectRoot;
      const packageName = cfg.android?.package ?? 'com.finjoy.devicelock';
      const packagePath = packageName.replace(/\./g, '/');

      // Write res/xml/device_admin.xml
      const xmlDir = path.join(projectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(xmlDir, 'device_admin.xml'), DEVICE_ADMIN_XML, 'utf8');

      // Write receivers into the app's own package
      const javaDir = path.join(
        projectRoot,
        `app/src/main/java/${packagePath}`
      );
      fs.mkdirSync(javaDir, { recursive: true });
      fs.writeFileSync(
        path.join(javaDir, 'FinJoyDeviceAdminReceiver.kt'),
        buildReceiverKotlin(packageName),
        'utf8'
      );
      fs.writeFileSync(
        path.join(javaDir, 'FinJoyBootReceiver.kt'),
        buildBootReceiverKotlin(packageName),
        'utf8'
      );

      return cfg;
    },
  ]);

  return config;
};
