package expo.modules.deviceadmin

import android.app.Activity
import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.app.admin.FactoryResetProtectionPolicy
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.UserManager
import android.provider.Settings
import java.security.MessageDigest
import android.view.View
import android.view.WindowManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DeviceAdminModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  @Volatile private var isKioskLocked = false
  @Volatile private var lastAppliedPolicyState: Boolean? = null

  private fun isScreenInteractive(context: Context): Boolean {
    return try {
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      pm.isInteractive
    } catch (_: Throwable) {
      true
    }
  }

  private fun isInLockTaskMode(context: Context): Boolean {
    return try {
      val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        am.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE
      } else {
        @Suppress("DEPRECATION")
        am.isInLockTaskMode
      }
    } catch (_: Throwable) {
      false
    }
  }

  private val watchdogRunnable = object : Runnable {
    override fun run() {
      if (!isKioskLocked) return
      try {
        val context = appContext.reactContext
        if (context != null && isScreenInteractive(context)) {
          val activity = appContext.currentActivity
          if (activity == null) {
            bringAppToFront(context)
          } else if (!isInLockTaskMode(context)) {
            try {
              activity.startLockTask()
            } catch (_: Throwable) {
            }
          }
        }
      } catch (_: Throwable) {
      } finally {
        if (isKioskLocked) {
          mainHandler.postDelayed(this, 2000L)
        }
      }
    }
  }

  private fun getComponentName(context: Context): ComponentName {
    val pkg = context.packageName
    return ComponentName(pkg, "$pkg.FinJoyDeviceAdminReceiver")
  }

  private fun getDpm(context: Context): DevicePolicyManager =
    context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager

  private fun getPrefs(context: Context) =
    context.getSharedPreferences("finjoy_lock_prefs", Context.MODE_PRIVATE)

  private fun savePersistentLockState(context: Context, locked: Boolean) {
    getPrefs(context).edit().putBoolean("is_locked", locked).apply()
  }

  private fun savePersistentCreditProtection(context: Context, protected: Boolean) {
    getPrefs(context).edit().putBoolean("credit_protected", protected).apply()
  }

  private fun savePersistentFrpAccounts(context: Context, accounts: List<String>) {
    val clean = accounts.map { it.trim() }.filter { it.isNotEmpty() }.joinToString(",")
    getPrefs(context).edit().putString("frp_account_ids", clean).apply()
  }

  private fun readPersistentFrpAccounts(context: Context): List<String> {
    val raw = getPrefs(context).getString("frp_account_ids", "") ?: ""
    return raw.split(",").map { it.trim() }.filter { it.isNotEmpty() }
  }

  private fun bringAppToFront(context: Context) {
    if (!isScreenInteractive(context)) return
    try {
      val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
      if (launchIntent != null) {
        launchIntent.addFlags(
          Intent.FLAG_ACTIVITY_NEW_TASK or
            Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
            Intent.FLAG_ACTIVITY_SINGLE_TOP
        )
        context.startActivity(launchIntent)
      }
    } catch (_: Throwable) {
    }
  }

  @Suppress("DEPRECATION")
  private fun applyImmersiveLockFlags(activity: Activity) {
    try {
      activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      activity.window.decorView.systemUiVisibility = (
        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
          View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
          View.SYSTEM_UI_FLAG_FULLSCREEN or
          View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
          View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
          View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        )
    } catch (_: Throwable) {
    }
  }

  @Suppress("DEPRECATION")
  private fun clearImmersiveLockFlags(activity: Activity) {
    try {
      activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      activity.window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
    } catch (_: Throwable) {
    }
  }

  private fun notifyFrpAgent(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      context.sendBroadcast(
        Intent("com.google.android.gms.auth.FRP_CONFIG_CHANGED")
          .setPackage("com.google.android.gms")
      )
    }
  }

  private fun applyFrpPolicy(context: Context, enabled: Boolean): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return false
    try {
      val dpm = getDpm(context)
      val pkg = context.packageName
      if (!dpm.isDeviceOwnerApp(pkg)) return false
      val component = getComponentName(context)
      val accounts = readPersistentFrpAccounts(context)

      if (enabled && accounts.isNotEmpty()) {
        val policy = FactoryResetProtectionPolicy.Builder()
          .setFactoryResetProtectionAccounts(accounts)
          .setFactoryResetProtectionEnabled(true)
          .build()
        dpm.setFactoryResetProtectionPolicy(component, policy)
        notifyFrpAgent(context)
        return true
      }

      if (!enabled || accounts.isEmpty()) {
        dpm.setFactoryResetProtectionPolicy(component, null)
        notifyFrpAgent(context)
      }
      return !enabled
    } catch (_: Throwable) {
      return false
    }
  }

  private fun configurePermanentCreditProtection(context: Context, protected: Boolean): Boolean {
    savePersistentCreditProtection(context, protected)
    try {
      val dpm = getDpm(context)
      val pkg = context.packageName
      if (!dpm.isDeviceOwnerApp(pkg)) return false
      val component = getComponentName(context)

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && protected) {
        dpm.setPermissionPolicy(
          component,
          DevicePolicyManager.PERMISSION_POLICY_AUTO_GRANT
        )
      }

      dpm.setUninstallBlocked(component, pkg, protected)
      if (protected) {
        dpm.addUserRestriction(component, UserManager.DISALLOW_FACTORY_RESET)
        dpm.addUserRestriction(component, UserManager.DISALLOW_SAFE_BOOT)
        dpm.addUserRestriction(component, "no_oem_unlock")
        dpm.addUserRestriction(component, UserManager.DISALLOW_ADD_USER)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          dpm.addUserRestriction(component, UserManager.DISALLOW_CONFIG_DATE_TIME)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          dpm.setAutoTimeEnabled(component, true)
        }
      } else {
        dpm.clearUserRestriction(component, UserManager.DISALLOW_FACTORY_RESET)
        dpm.clearUserRestriction(component, UserManager.DISALLOW_SAFE_BOOT)
        dpm.clearUserRestriction(component, "no_oem_unlock")
        dpm.clearUserRestriction(component, UserManager.DISALLOW_ADD_USER)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          dpm.clearUserRestriction(component, UserManager.DISALLOW_CONFIG_DATE_TIME)
        }
      }

      val frpConfigured = applyFrpPolicy(context, protected)
      return !protected || frpConfigured
    } catch (_: Throwable) {
      return false
    }
  }

  private fun suspendOrUnsuspendUserApps(
    context: Context,
    dpm: DevicePolicyManager,
    component: ComponentName,
    suspend: Boolean
  ) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return
    try {
      val pm = context.packageManager
      val installed = pm.getInstalledApplications(0)
      val targets = installed
        .filter { app ->
          val isSystem = (app.flags and ApplicationInfo.FLAG_SYSTEM) != 0 ||
            (app.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0
          val isSelf = app.packageName == context.packageName
          !isSelf && (!isSystem ||
            app.packageName == "com.android.chrome" ||
            app.packageName == "com.google.android.youtube" ||
            app.packageName == "com.android.vending" ||
            app.packageName == "com.miui.securitycenter")
        }
        .map { it.packageName }
        .toTypedArray()

      if (targets.isNotEmpty()) {
        dpm.setPackagesSuspended(component, targets, suspend)
      }
    } catch (_: Throwable) {
    }
  }

  private fun configureKioskDeviceOwnerPolicies(context: Context, locked: Boolean) {
    if (lastAppliedPolicyState == locked) return
    lastAppliedPolicyState = locked
    try {
      val dpm = getDpm(context)
      val pkg = context.packageName
      if (!dpm.isDeviceOwnerApp(pkg)) return
      val component = getComponentName(context)

      if (locked) {
        configurePermanentCreditProtection(context, true)
      }

      dpm.setLockTaskPackages(component, if (locked) arrayOf(pkg) else emptyArray())
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        dpm.setLockTaskFeatures(
          component,
          if (locked) DevicePolicyManager.LOCK_TASK_FEATURE_NONE
          else DevicePolicyManager.LOCK_TASK_FEATURE_SYSTEM_INFO
        )
      }
      dpm.setStatusBarDisabled(component, locked)
      suspendOrUnsuspendUserApps(context, dpm, component, locked)
    } catch (_: Throwable) {
    }
  }

  override fun definition() = ModuleDefinition {
    Name("ExpoDeviceAdmin")

    AsyncFunction("isDeviceAdminActive") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val dpm = getDpm(context)
      dpm.isAdminActive(getComponentName(context))
    }

    AsyncFunction("isDeviceOwner") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val dpm = getDpm(context)
      dpm.isDeviceOwnerApp(context.packageName)
    }

    AsyncFunction("getDeviceIdHash") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      val androidId = Settings.Secure.getString(
        context.contentResolver,
        Settings.Secure.ANDROID_ID
      ) ?: return@AsyncFunction null
      MessageDigest.getInstance("SHA-256")
        .digest(androidId.toByteArray(Charsets.UTF_8))
        .joinToString("") { byte -> "%02x".format(byte) }
    }

    AsyncFunction("getDeviceInfo") {
      mapOf(
        "manufacturer" to Build.MANUFACTURER,
        "model" to Build.MODEL,
        "osVersion" to Build.VERSION.RELEASE
      )
    }

    AsyncFunction("requestDeviceAdmin") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      val component = getComponentName(context)
      val dpm = getDpm(context)

      if (dpm.isAdminActive(component)) return@AsyncFunction true

      val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
        putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, component)
        putExtra(
          DevicePolicyManager.EXTRA_ADD_EXPLANATION,
          "FinJoy necesita permisos de administrador para proteger el dispositivo " +
            "según el contrato de crédito firmado."
        )
      }
      activity.startActivityForResult(intent, 9821)
      false
    }

    AsyncFunction("canDrawOverlays") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) true
      else Settings.canDrawOverlays(context)
    }

    AsyncFunction("requestOverlayPermission") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)) {
        return@AsyncFunction true
      }
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:${context.packageName}")
      )
      activity.startActivityForResult(intent, 9822)
      false
    }

    AsyncFunction("lockNow") {
      true
    }

    AsyncFunction("setFrpAccounts") { accounts: List<String> ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      savePersistentFrpAccounts(context, accounts)
      val isProtected = getPrefs(context).getBoolean("credit_protected", true)
      applyFrpPolicy(context, isProtected)
    }

    AsyncFunction("setCreditProtectionEnabled") { protected: Boolean ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      configurePermanentCreditProtection(context, protected)
    }

    AsyncFunction("configureBackgroundSync") { apiBaseUrl: String, sessionToken: String? ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val editor = getPrefs(context).edit()
      editor.putString("api_base_url", apiBaseUrl)
      if (!sessionToken.isNullOrBlank()) {
        editor.putString("session_token", sessionToken)
      } else {
        editor.remove("session_token")
      }
      editor.apply()
      try {
        val serviceIntent = Intent().apply {
          setClassName(context.packageName, "${context.packageName}.FinJoyMonitorService")
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(serviceIntent)
        } else {
          context.startService(serviceIntent)
        }
      } catch (_: Throwable) {
      }
      true
    }

    AsyncFunction("setKioskLockEnabled") { enabled: Boolean ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val stateChanged = isKioskLocked != enabled
      isKioskLocked = enabled
      savePersistentLockState(context, enabled)

      mainHandler.post {
        configureKioskDeviceOwnerPolicies(context, enabled)
        val activity = appContext.currentActivity
        if (enabled) {
          if (activity != null) {
            if (stateChanged) {
              applyImmersiveLockFlags(activity)
            }
            if (!isInLockTaskMode(context)) {
              try {
                activity.startLockTask()
              } catch (_: Throwable) {
              }
            }
          } else if (stateChanged) {
            bringAppToFront(context)
          }
          if (stateChanged) {
            mainHandler.removeCallbacks(watchdogRunnable)
            mainHandler.postDelayed(watchdogRunnable, 2000L)
          }
        } else {
          mainHandler.removeCallbacks(watchdogRunnable)
          if (activity != null) {
            if (isInLockTaskMode(context)) {
              try {
                activity.stopLockTask()
              } catch (_: Throwable) {
              }
            }
            if (stateChanged) {
              clearImmersiveLockFlags(activity)
            }
          }
        }
      }
      true
    }
  }
}
