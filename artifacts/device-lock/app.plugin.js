// Config plugin: registers FinJoy as a Device Administrator on Android.
// This runs during `expo prebuild` (or EAS Build) and modifies the native Android project.
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const DEVICE_ADMIN_XML = `<?xml version="1.0" encoding="utf-8"?>
<device-admin xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-policies>
    <force-lock />
    <watch-login />
  </uses-policies>
</device-admin>
`;

// language=kotlin
function buildReceiverKotlin(packageName) {
  return `package ${packageName}

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent

class FinJoyDeviceAdminReceiver : DeviceAdminReceiver() {
    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
    }

    override fun onDisableRequested(context: Context, intent: Intent): CharSequence {
        return "Para desinstalar FinJoy primero debes saldar el crédito pendiente."
    }
}
`;
}

module.exports = function withDeviceAdmin(config) {
  // 1. Add <receiver> entry to AndroidManifest.xml
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const app = manifest.manifest.application[0];

    if (!app.receiver) app.receiver = [];

    const alreadyAdded = (app.receiver || []).some(
      (r) => r.$?.['android:name'] === '.FinJoyDeviceAdminReceiver'
    );
    if (!alreadyAdded) {
      app.receiver.push({
        $: {
          'android:name': '.FinJoyDeviceAdminReceiver',
          'android:label': 'FinJoy Control de Crédito',
          'android:permission': 'android.permission.BIND_DEVICE_ADMIN',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.app.action.DEVICE_ADMIN_ENABLED' } }],
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
    return cfg;
  });

  // 2. Write device_admin.xml + FinJoyDeviceAdminReceiver.kt into the Android project
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

      // Write FinJoyDeviceAdminReceiver.kt into the app's own package
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

      return cfg;
    },
  ]);

  return config;
};
