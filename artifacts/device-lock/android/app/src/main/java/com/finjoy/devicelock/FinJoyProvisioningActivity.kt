package com.finjoy.devicelock

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.Intent
import android.os.Build
import android.os.Bundle

class FinJoyProvisioningActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val currentIntent = intent ?: Intent()
    when (currentIntent.action) {
      DevicePolicyManager.ACTION_GET_PROVISIONING_MODE -> {
        val resultIntent = Intent()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          resultIntent.putExtra(
            DevicePolicyManager.EXTRA_PROVISIONING_MODE,
            DevicePolicyManager.PROVISIONING_MODE_FULLY_MANAGED_DEVICE
          )
        } else {
          resultIntent.putExtra("android.app.extra.PROVISIONING_MODE", 1)
        }
        setResult(RESULT_OK, resultIntent)
        finish()
      }

      DevicePolicyManager.ACTION_ADMIN_POLICY_COMPLIANCE -> {
        FinJoyDeviceAdminReceiver().onEnabled(this, currentIntent)
        setResult(RESULT_OK, Intent())
        finish()
      }

      DevicePolicyManager.ACTION_PROVISIONING_SUCCESSFUL -> {
        FinJoyDeviceAdminReceiver().onProfileProvisioningComplete(this, currentIntent)
        setResult(RESULT_OK, Intent())
        finish()
      }

      else -> {
        setResult(RESULT_OK)
        finish()
      }
    }
  }
}
