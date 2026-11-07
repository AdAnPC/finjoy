package com.finjoy.devicelock

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors

class FinJoyMonitorService : Service() {
  companion object {
    private const val CHANNEL_ID = "finjoy_protection_channel"
    private const val NOTIFICATION_ID = 4401

    fun start(context: Context) {
      try {
        val intent = Intent(context, FinJoyMonitorService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
      } catch (_: Throwable) {
      }
    }
  }

  private val mainHandler = Handler(Looper.getMainLooper())
  private val executor = Executors.newSingleThreadExecutor()
  @Volatile private var latestLocation: Location? = null
  @Volatile private var lastSyncedLockedState: Boolean? = null
  @Volatile private var appliedPolicyLockState: Boolean? = null
  private var tickCount = 0

  private val locationListener = object : LocationListener {
    override fun onLocationChanged(location: Location) {
      latestLocation = location
    }
    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {}
  }

  private val monitorRunnable = object : Runnable {
    override fun run() {
      try {
        val prefs = getSharedPreferences("finjoy_lock_prefs", Context.MODE_PRIVATE)
        val isLocked = prefs.getBoolean("is_locked", false)
        if (isLocked) {
          ensureLockedForegroundIfInteractive()
        } else if (appliedPolicyLockState == true) {
          enforceImmediateLockdown(false)
        }
        executor.execute {
          pollServerAndSyncLocation()
        }
      } catch (_: Throwable) {
      } finally {
        mainHandler.postDelayed(this, 4000L)
      }
    }
  }

  override fun onCreate() {
    super.onCreate()
    startForegroundNotification()
    startLocationUpdates()
    mainHandler.post(monitorRunnable)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startForegroundNotification()
    return START_STICKY
  }

  override fun onDestroy() {
    mainHandler.removeCallbacks(monitorRunnable)
    try {
      val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
      lm.removeUpdates(locationListener)
    } catch (_: Throwable) {
    }
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun isScreenInteractive(): Boolean {
    return try {
      val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
      pm.isInteractive
    } catch (_: Throwable) {
      true
    }
  }

  private fun startForegroundNotification() {
    try {
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val channel = NotificationChannel(
          CHANNEL_ID,
          "Protección FinJoy",
          NotificationManager.IMPORTANCE_LOW
        ).apply {
          description = "Monitoreo activo de seguridad y crédito FinJoy"
          setShowBadge(false)
        }
        nm.createNotificationChannel(channel)
      }

      val launchIntent = Intent(this, MainActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      }
      val pendingFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      } else {
        PendingIntent.FLAG_UPDATE_CURRENT
      }
      val pendingIntent = PendingIntent.getActivity(this, 0, launchIntent, pendingFlags)

      val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Notification.Builder(this, CHANNEL_ID)
      } else {
        @Suppress("DEPRECATION")
        Notification.Builder(this)
      }

      val notification = builder
        .setContentTitle("FinJoy Protección Activa")
        .setContentText("Dispositivo protegido y sincronizado en tiempo real")
        .setSmallIcon(android.R.drawable.ic_lock_lock)
        .setOngoing(true)
        .setContentIntent(pendingIntent)
        .build()

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
        )
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (_: Throwable) {
    }
  }

  @SuppressLint("MissingPermission")
  private fun startLocationUpdates() {
    try {
      val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
      val providers = listOf(
        LocationManager.GPS_PROVIDER,
        LocationManager.NETWORK_PROVIDER,
        LocationManager.PASSIVE_PROVIDER
      )
      for (provider in providers) {
        try {
          if (lm.isProviderEnabled(provider)) {
            val last = lm.getLastKnownLocation(provider)
            if (last != null && (latestLocation == null || last.time > (latestLocation?.time ?: 0L))) {
              latestLocation = last
            }
            lm.requestLocationUpdates(provider, 10000L, 5f, locationListener, Looper.getMainLooper())
          }
        } catch (_: Throwable) {
        }
      }
    } catch (_: Throwable) {
    }
  }

  @SuppressLint("MissingPermission")
  private fun getBestLocation(): Location? {
    try {
      val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
      var best: Location? = latestLocation
      for (provider in listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER, LocationManager.PASSIVE_PROVIDER)) {
        try {
          val loc = lm.getLastKnownLocation(provider)
          if (loc != null && (best == null || loc.time > best.time)) {
            best = loc
          }
        } catch (_: Throwable) {
        }
      }
      latestLocation = best
      return best
    } catch (_: Throwable) {
      return latestLocation
    }
  }

  private fun getDeviceIdHash(): String? {
    return try {
      val androidId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID) ?: return null
      MessageDigest.getInstance("SHA-256")
        .digest(androidId.toByteArray(Charsets.UTF_8))
        .joinToString("") { byte -> "%02x".format(byte) }
    } catch (_: Throwable) {
      null
    }
  }

  private fun pollServerAndSyncLocation() {
    try {
      val prefs = getSharedPreferences("finjoy_lock_prefs", Context.MODE_PRIVATE)
      val token = prefs.getString("session_token", null)
      val baseUrl = (prefs.getString("api_base_url", null) ?: "https://workspaceapi-server-production-d7bb.up.railway.app").trimEnd('/')
      if (token.isNullOrBlank()) return

      // 1. Poll /api/customer/account for real-time lock/unlock status
      val accountConn = (URL("$baseUrl/api/customer/account").openConnection() as HttpURLConnection).apply {
        requestMethod = "GET"
        connectTimeout = 5000
        readTimeout = 5000
        setRequestProperty("Authorization", "Bearer $token")
        setRequestProperty("Accept", "application/json")
      }

      val code = accountConn.responseCode
      if (code == 200) {
        val body = accountConn.inputStream.bufferedReader().use { it.readText() }
        val json = JSONObject(body)
        val loanObj = json.optJSONObject("loan")
        if (loanObj != null) {
          val status = loanObj.optString("status", "active")
          val shouldLock = status == "locked" || status == "overdue"
          val prevLocked = prefs.getBoolean("is_locked", false)
          if (shouldLock != prevLocked || lastSyncedLockedState != shouldLock) {
            prefs.edit().putBoolean("is_locked", shouldLock).apply()
            lastSyncedLockedState = shouldLock
            mainHandler.post {
              enforceImmediateLockdown(shouldLock)
            }
          }
        }
      }
      accountConn.disconnect()

      // 2. Sync device heartbeat & GPS location every 3 ticks (~12s) or when location is available
      tickCount = (tickCount + 1) % 3
      val loc = getBestLocation()
      if (tickCount == 1 || loc != null) {
        val deviceIdHash = getDeviceIdHash() ?: return
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val component = ComponentName(packageName, "$packageName.FinJoyDeviceAdminReceiver")
        val payload = JSONObject().apply {
          put("deviceIdHash", deviceIdHash)
          put("manufacturer", Build.MANUFACTURER ?: "Android")
          put("model", Build.MODEL ?: "Android")
          put("osVersion", Build.VERSION.RELEASE ?: "")
          put("deviceAdminActive", dpm.isAdminActive(component))
          put("deviceOwner", dpm.isDeviceOwnerApp(packageName))
          if (loc != null) {
            put("latitude", loc.latitude)
            put("longitude", loc.longitude)
            put("locationAccuracy", loc.accuracy.toDouble())
          }
        }

        val regConn = (URL("$baseUrl/api/customer/device/register").openConnection() as HttpURLConnection).apply {
          requestMethod = "POST"
          connectTimeout = 5000
          readTimeout = 5000
          doOutput = true
          setRequestProperty("Authorization", "Bearer $token")
          setRequestProperty("Content-Type", "application/json")
        }
        OutputStreamWriter(regConn.outputStream, Charsets.UTF_8).use { writer ->
          writer.write(payload.toString())
          writer.flush()
        }
        regConn.responseCode
        regConn.disconnect()
      }
    } catch (_: Throwable) {
    }
  }

  private fun suspendOrUnsuspendUserApps(dpm: DevicePolicyManager, component: ComponentName, suspend: Boolean) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return
    try {
      val pm = packageManager
      val installed = pm.getInstalledApplications(0)
      val targets = installed
        .filter { app ->
          val isSystem = (app.flags and ApplicationInfo.FLAG_SYSTEM) != 0 ||
            (app.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0
          val isSelf = app.packageName == packageName
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

  private fun ensureLockedForegroundIfInteractive() {
    try {
      if (appliedPolicyLockState != true) {
        enforceImmediateLockdown(true)
        return
      }
      if (!isScreenInteractive()) return
      val activity = MainActivity.currentInstance
      if (activity == null || !MainActivity.isActivityVisible) {
        val launchIntent = Intent(this, MainActivity::class.java).apply {
          addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK or
              Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
              Intent.FLAG_ACTIVITY_SINGLE_TOP
          )
        }
        startActivity(launchIntent)
      } else {
        activity.engageKioskLock()
      }
    } catch (_: Throwable) {
    }
  }

  private fun enforceImmediateLockdown(locked: Boolean) {
    try {
      val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
      val component = ComponentName(packageName, "$packageName.FinJoyDeviceAdminReceiver")
      val isOwner = dpm.isDeviceOwnerApp(packageName)

      if (isOwner && appliedPolicyLockState != locked) {
        appliedPolicyLockState = locked
        dpm.setLockTaskPackages(component, if (locked) arrayOf(packageName) else emptyArray())
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          dpm.setLockTaskFeatures(
            component,
            if (locked) DevicePolicyManager.LOCK_TASK_FEATURE_NONE
            else DevicePolicyManager.LOCK_TASK_FEATURE_SYSTEM_INFO
          )
        }
        dpm.setStatusBarDisabled(component, locked)
        suspendOrUnsuspendUserApps(dpm, component, locked)
      }

      val activity = MainActivity.currentInstance
      if (locked) {
        if (isScreenInteractive() && (activity == null || !MainActivity.isActivityVisible)) {
          val launchIntent = Intent(this, MainActivity::class.java).apply {
            addFlags(
              Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            )
          }
          startActivity(launchIntent)
        }
        activity?.engageKioskLock()
      } else {
        activity?.releaseKioskLock()
      }
    } catch (_: Throwable) {
    }
  }
}
