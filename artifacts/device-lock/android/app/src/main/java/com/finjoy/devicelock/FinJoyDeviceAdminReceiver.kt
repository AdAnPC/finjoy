package com.finjoy.devicelock

import android.Manifest
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
    companion object {
        const val DEFAULT_FRP_ACCOUNT_ID = "116938243967547435961"
    }

    @Suppress("DEPRECATION")
    private fun extractProvisioningExtras(context: Context, intent: Intent) {
        try {
            val prefs = context.getSharedPreferences("finjoy_lock_prefs", Context.MODE_PRIVATE)
            val editor = prefs.edit()

            val extras = intent.getParcelableExtra<PersistableBundle>(
                DevicePolicyManager.EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE
            )
            val frpCsv = extras?.getString("frp_account_ids")
            if (!frpCsv.isNullOrBlank()) {
                editor.putString("frp_account_ids", frpCsv.trim())
            } else if (prefs.getString("frp_account_ids", "").isNullOrBlank()) {
                editor.putString("frp_account_ids", DEFAULT_FRP_ACCOUNT_ID)
            }

            val orgName = extras?.getString("organization_name")
            if (!orgName.isNullOrBlank()) {
                editor.putString("organization_name", orgName.trim())
            }
            if (!prefs.contains("credit_protected")) {
                editor.putBoolean("credit_protected", true)
            }
            if (!prefs.contains("is_locked")) {
                editor.putBoolean("is_locked", false)
            }
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
                    .apply()
            }
            if (prefs.getString("frp_account_ids", "").isNullOrBlank()) {
                prefs.edit().putString("frp_account_ids", DEFAULT_FRP_ACCOUNT_ID).apply()
            }
            val isProtected = prefs.getBoolean("credit_protected", true)

            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val pkg = context.packageName
            val component = ComponentName(pkg, "$pkg.FinJoyDeviceAdminReceiver")
            if (dpm.isDeviceOwnerApp(pkg)) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    dpm.setPermissionPolicy(
                        component,
                        DevicePolicyManager.PERMISSION_POLICY_AUTO_GRANT
                    )
                    val permissionsToGrant = mutableListOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    )
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        permissionsToGrant.add(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        permissionsToGrant.add(Manifest.permission.POST_NOTIFICATIONS)
                    }
                    for (perm in permissionsToGrant) {
                        try {
                            dpm.setPermissionGrantState(
                                component,
                                pkg,
                                perm,
                                DevicePolicyManager.PERMISSION_GRANT_STATE_GRANTED
                            )
                        } catch (_: Throwable) {
                        }
                    }
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && isProtected) {
                    dpm.setUninstallBlocked(component, pkg, true)
                    dpm.addUserRestriction(component, UserManager.DISALLOW_FACTORY_RESET)
                    dpm.addUserRestriction(component, UserManager.DISALLOW_SAFE_BOOT)
                    dpm.addUserRestriction(component, UserManager.DISALLOW_ADD_USER)
                    dpm.addUserRestriction(component, UserManager.DISALLOW_APPS_CONTROL)
                    dpm.addUserRestriction(component, UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES)
                    dpm.addUserRestriction(component, UserManager.DISALLOW_DEBUGGING_FEATURES)
                    dpm.addUserRestriction(component, UserManager.DISALLOW_USB_FILE_TRANSFER)
                    dpm.addUserRestriction(component, UserManager.DISALLOW_MOUNT_PHYSICAL_MEDIA)
                    dpm.addUserRestriction(component, "no_oem_unlock")
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        dpm.addUserRestriction(
                            component,
                            UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES_GLOBALLY
                        )
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                        dpm.addUserRestriction(component, UserManager.DISALLOW_CONFIG_DATE_TIME)
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        dpm.setAutoTimeEnabled(component, true)
                        try {
                            dpm.setLocationEnabled(component, true)
                        } catch (_: Throwable) {
                        }
                    }
                }

                // Nivel A: Enterprise Factory Reset Protection (FRP) en Android 11+ (API 30+)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && isProtected) {
                    val frpCsv = prefs.getString("frp_account_ids", DEFAULT_FRP_ACCOUNT_ID) ?: DEFAULT_FRP_ACCOUNT_ID
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
                        try {
                            context.sendBroadcast(Intent("android.accounts.LOGIN_ACCOUNTS_CHANGED"))
                        } catch (_: Throwable) {
                        }
                    }
                }
            }
            FinJoyMonitorService.start(context)
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
            launchMainActivity(context)
        } catch (_: Throwable) {
        }
        return "Dispositivo protegido por FinJoy. Para desactivar la protección debes liquidar tu crédito."
    }
}
