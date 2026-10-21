package expo.modules.deviceadmin

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.app.admin.FactoryResetProtectionPolicy
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
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

  private val watchdogRunnable = object : Runnable {
    override fun run() {
      if (!isKioskLocked) return
      try {
        val context = appContext.reactContext
        val activity = appContext.currentActivity
        if (activity != null) {
          applyImmersiveLockFlags(activity)
        }
        if (context != null && (activity == null || !activity.hasWindowFocus())) {
          bringAppToFront(context)
        }
      } catch (_: Throwable) {
      } finally {
        if (isKioskLocked) {
          mainHandler.postDelayed(this, 350L)
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

  @Suppress("DEPRECATION")
  private fun applyImmersiveLockFlags(activity: Activity) {
    try {
      activity.window.addFlags(
        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
      )
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

  private fun applyFrpPolicy(context: Context, enabled: Boolean) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
    try {
      val dpm = getDpm(context)
      val pkg = context.packageName
      if (!dpm.isDeviceOwnerApp(pkg)) return
      val component = getComponentName(context)
      val accounts = readPersistentFrpAccounts(context)

      if (enabled && accounts.isNotEmpty()) {
        val policy = FactoryResetProtectionPolicy.Builder()
          .setFactoryResetProtectionAccounts(accounts)
          .setFactoryResetProtectionEnabled(true)
          .build()
        dpm.setFactoryResetProtectionPolicy(component, policy)
      } else if (!enabled) {
        dpm.setFactoryResetProtectionPolicy(component, null)
      }
    } catch (_: Throwable) {
    }
  }

  /**
   * Permanent anti-tamper, anti-factory-reset & Enterprise FRP protection
   * kept active throughout the entire life of the loan.
   */
  private fun configurePermanentCreditProtection(context: Context, protected: Boolean) {
    savePersistentCreditProtection(context, protected)
    try {
      val dpm = getDpm(context)
      val pkg = context.packageName
      if (!dpm.isDeviceOwnerApp(pkg)) return
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
      } else {
        dpm.clearUserRestriction(component, UserManager.DISALLOW_FACTORY_RESET)
        dpm.clearUserRestriction(component, UserManager.DISALLOW_SAFE_BOOT)
        dpm.clearUserRestriction(component, "no_oem_unlock")
        dpm.clearUserRestriction(component, UserManager.DISALLOW_ADD_USER)
      }

      applyFrpPolicy(context, protected)
    } catch (_: Throwable) {
    }
  }

  private fun configureKioskDeviceOwnerPolicies(context: Context, locked: Boolean) {
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
      val context = appContext.reactContext ?: return@AsyncFunction false
      val dpm = getDpm(context)
      val component = getComponentName(context)
      if (!dpm.isAdminActive(component)) return@AsyncFunction false
      dpm.lockNow()
      true
    }

    AsyncFunction("setFrpAccounts") { accounts: List<String> ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      savePersistentFrpAccounts(context, accounts)
      val isProtected = getPrefs(context).getBoolean("credit_protected", true)
      applyFrpPolicy(context, isProtected)
      true
    }

    AsyncFunction("setCreditProtectionEnabled") { protected: Boolean ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      configurePermanentCreditProtection(context, protected)
      true
    }

    AsyncFunction("setKioskLockEnabled") { enabled: Boolean ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      isKioskLocked = enabled
      savePersistentLockState(context, enabled)

      mainHandler.post {
        mainHandler.removeCallbacks(watchdogRunnable)
        configureKioskDeviceOwnerPolicies(context, enabled)
        val activity = appContext.currentActivity
        if (enabled) {
          if (activity != null) {
            applyImmersiveLockFlags(activity)
            try {
              activity.startLockTask()
            } catch (_: Throwable) {
            }
          } else {
            bringAppToFront(context)
          }
          mainHandler.postDelayed(watchdogRunnable, 350L)
        } else {
          if (activity != null) {
            try {
              activity.stopLockTask()
            } catch (_: Throwable) {
            }
            clearImmersiveLockFlags(activity)
          }
        }
      }
      true
    }
  }
}
