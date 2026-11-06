param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("reset", "enroll")]
  [string] $Action,

  [string] $Serial,

  [string] $ApkPath
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path

if (-not $ApkPath) {
  $ApkPath = Join-Path $repoRoot "generated-apk\FinJoy-debug.apk"
}
elseif (-not [System.IO.Path]::IsPathRooted($ApkPath)) {
  $ApkPath = Join-Path (Get-Location).Path $ApkPath
}

$adbCommand = Get-Command adb -ErrorAction SilentlyContinue
if ($adbCommand) {
  $adb = $adbCommand.Source
}
else {
  $sdkAdb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
  if (-not (Test-Path -LiteralPath $sdkAdb)) {
    throw "No encuentro adb. Instala Android SDK Platform-Tools o agrega adb al PATH."
  }
  $adb = $sdkAdb
}

function Invoke-Adb {
  param([string[]] $Arguments)
  $output = & $script:adb @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Falló adb $($Arguments -join ' '): $output"
  }
  return $output
}

$deviceLines = @(& $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\S+\s+device$" })
if (-not $Serial) {
  if ($deviceLines.Count -ne 1) {
    throw "Conecta un solo teléfono autorizado por USB o indica -Serial. Dispositivos listos: $($deviceLines.Count)."
  }
  $Serial = ($deviceLines[0] -split "\s+")[0]
}

if ((Invoke-Adb @("-s", $Serial, "get-state")).Trim() -ne "device") {
  throw "El dispositivo $Serial no está autorizado para depuración USB. Acepta el diálogo de autorización en el teléfono."
}

if ($Action -eq "reset") {
  Write-Host "Esto abrirá Recuperación de Android. El borrado se confirma físicamente en el teléfono."
  Write-Host "Se eliminarán las cuentas, fotos, archivos y aplicaciones del dispositivo $Serial."
  $confirmation = Read-Host "Para reiniciar a Recuperación, escribe BORRAR $Serial"
  if ($confirmation -cne "BORRAR $Serial") {
    throw "Cancelado. No se reinició el teléfono."
  }
  Invoke-Adb @("-s", $Serial, "reboot", "recovery") | Out-Null
  Write-Host "En Recuperación, selecciona Wipe data/factory reset y confirma en el teléfono."
  Write-Host "Al terminar, completa la configuración inicial sin añadir cuentas Google ni cuentas de trabajo."
  Write-Host "Activa Opciones de desarrollador y Depuración USB, autoriza esta computadora y ejecuta la acción enroll."
  exit 0
}

if (-not (Test-Path -LiteralPath $ApkPath -PathType Leaf)) {
  throw "No encuentro la APK: $ApkPath. Primero compílala con scripts/build-apk-local.js."
}

$accounts = Invoke-Adb @("-s", $Serial, "shell", "dumpsys", "account")
if ($accounts -match "Account\s*\{\s*name=") {
  throw "Android aún tiene una cuenta configurada. Restablece el teléfono y termina la configuración inicial sin añadir cuentas antes de instalar Device Owner."
}

$component = "com.finjoy.devicelock/.FinJoyDeviceAdminReceiver"
Write-Host "Instalando FinJoy por USB en $Serial..."
Invoke-Adb @("-s", $Serial, "install", "-r", $ApkPath) | Write-Host
Write-Host "Asignando Device Owner..."
Invoke-Adb @("-s", $Serial, "shell", "dpm", "set-device-owner", $component) | Write-Host

$owners = Invoke-Adb @("-s", $Serial, "shell", "dpm", "list-owners")
if ($owners -notmatch "com\.finjoy\.devicelock/\.FinJoyDeviceAdminReceiver") {
  throw "Android no confirmó a FinJoy como Device Owner. Respuesta: $owners"
}

Write-Host "FinJoy quedó confirmada como Device Owner en $Serial."
Write-Host "Verifica en la app que las políticas de protección se hayan aplicado correctamente."
