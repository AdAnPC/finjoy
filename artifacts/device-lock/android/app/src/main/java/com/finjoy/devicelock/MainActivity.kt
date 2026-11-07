package com.finjoy.devicelock
import expo.modules.splashscreen.SplashScreenManager

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  companion object {
    @Volatile
    var currentInstance: MainActivity? = null

    @Volatile
    var isActivityVisible: Boolean = false
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    super.onCreate(null)
    currentInstance = this
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        setShowWhenLocked(true)
      }
      FinJoyDeviceAdminReceiver().onEnabled(this, intent ?: Intent())
      FinJoyMonitorService.start(this)
    } catch (_: Throwable) {
    }
  }

  override fun onStart() {
    super.onStart()
    currentInstance = this
    isActivityVisible = true
  }

  override fun onResume() {
    super.onResume()
    currentInstance = this
    isActivityVisible = true
    try {
      FinJoyMonitorService.start(this)
      val prefs = getSharedPreferences("finjoy_lock_prefs", Context.MODE_PRIVATE)
      if (prefs.getBoolean("is_locked", false)) {
        engageKioskLock()
      }
    } catch (_: Throwable) {
    }
  }

  override fun onStop() {
    isActivityVisible = false
    super.onStop()
  }

  override fun onDestroy() {
    if (currentInstance === this) {
      currentInstance = null
      isActivityVisible = false
    }
    super.onDestroy()
  }

  private fun isAlreadyInLockTaskMode(): Boolean {
    return try {
      val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
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

  @Suppress("DEPRECATION")
  fun engageKioskLock() {
    runOnUiThread {
      try {
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.decorView.systemUiVisibility = (
          View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
            View.SYSTEM_UI_FLAG_FULLSCREEN or
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
          )
        if (!isAlreadyInLockTaskMode()) {
          startLockTask()
        }
      } catch (_: Throwable) {
      }
    }
  }

  @Suppress("DEPRECATION")
  fun releaseKioskLock() {
    runOnUiThread {
      try {
        if (isAlreadyInLockTaskMode()) {
          stopLockTask()
        }
      } catch (_: Throwable) {
      }
      try {
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
      } catch (_: Throwable) {
      }
    }
  }

  override fun getMainComponentName(): String = "main"

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  override fun invokeDefaultOnBackPressed() {
      val prefs = getSharedPreferences("finjoy_lock_prefs", Context.MODE_PRIVATE)
      if (prefs.getBoolean("is_locked", false)) {
          return
      }
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              super.invokeDefaultOnBackPressed()
          }
          return
      }
      super.invokeDefaultOnBackPressed()
  }
}
