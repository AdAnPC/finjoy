import { useState } from "react";
import {
  Archive,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  FileArchive,
  Loader2,
  Lock,
  Smartphone,
  ShieldCheck,
  Terminal,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import {
  APK_API_BASE,
  useApkDistribution,
} from "@/hooks/use-apk-distribution";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime, formatFileSize } from "@/lib/utils";

const ADB_DEVICE_OWNER_CMD =
  "adb shell dpm set-device-owner com.finjoy.devicelock/.FinJoyDeviceAdminReceiver";

function formatNullableDateTime(value: string | null): string {
  return value ? formatDateTime(value) : "—";
}

function hexToBase64Url(hex: string): string {
  const clean = hex.trim();
  if (clean.length % 2 !== 0) return "";
  let binary = "";
  for (let i = 0; i < clean.length; i += 2) {
    binary += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export default function ApkDistribution() {
  const {
    current,
    versions,
    pending,
    version,
    setVersion,
    uploading,
    activatingId,
    upload,
    activate,
    frpAccountIds,
    frpInput,
    setFrpInput,
    organizationName,
    setOrganizationName,
    savingProtection,
    saveProtection,
  } = useApkDistribution();
  const { toast } = useToast();
  const [copiedAdb, setCopiedAdb] = useState(false);
  const [copiedZeroTouch, setCopiedZeroTouch] = useState(false);

  const adminExtrasBundle = {
    frp_account_ids: frpAccountIds.join(","),
    organization_name: organizationName,
  };

  const provisioningPayload = current
    ? JSON.stringify({
        "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME":
          "com.finjoy.devicelock/.FinJoyDeviceAdminReceiver",
        "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION":
          `${window.location.origin}${APK_API_BASE}/download`,
        "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_CHECKSUM":
          hexToBase64Url(current.checksum),
        "android.app.extra.PROVISIONING_SKIP_EDUCATION_SCREENS": true,
        "android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED": true,
        "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": adminExtrasBundle,
      })
    : null;

  const zeroTouchDpcExtras = JSON.stringify(
    {
      "android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED": true,
      "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": adminExtrasBundle,
    },
    null,
    2,
  );

  const qrImageUrl = provisioningPayload
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(provisioningPayload)}`
    : null;

  async function copyAdbCommand() {
    await navigator.clipboard.writeText(ADB_DEVICE_OWNER_CMD);
    setCopiedAdb(true);
    toast({
      title: "Comando ADB copiado",
      description: "Ejecútalo con el celular conectado por USB con Depuración USB activa.",
    });
    setTimeout(() => setCopiedAdb(false), 2500);
  }

  async function copyZeroTouchJson() {
    await navigator.clipboard.writeText(zeroTouchDpcExtras);
    setCopiedZeroTouch(true);
    toast({
      title: "JSON Zero-Touch copiado",
      description: "Pégalo en el campo DPC Extras de Google Zero-Touch / Knox.",
    });
    setTimeout(() => setCopiedZeroTouch(false), 2500);
  }

  return (
    <div className="max-w-5xl space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <PageHeader
        title="Distribución APK"
        description="Administra versiones verificadas de FinJoy y conserva la versión activa anterior mientras revisas una nueva."
      />

      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Smartphone className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">Instalador de FinJoy</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enlace estable para clientes: conserva siempre la última versión
              activada.
            </p>
            {current && (
              <p className="mt-2 text-sm font-medium">
                Versión activa {current.version} · {formatFileSize(current.size)}
              </p>
            )}
          </div>
          {current && (
            <a href={`${APK_API_BASE}/download`} download>
              <Button className="gap-2">
                <Download className="h-4 w-4" /> Descargar activa
              </Button>
            </a>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" /> Subir una versión
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apk-version">Versión</Label>
              <Input
                id="apk-version"
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                placeholder="1.4.0"
                disabled={uploading}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              La APK se valida por extensión, MIME, tamaño y firma ZIP antes de
              aparecer como pendiente.
            </p>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 px-6 py-8 text-center transition hover:border-primary hover:bg-primary/10">
              {uploading ? (
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              ) : (
                <FileArchive className="h-7 w-7 text-primary" />
              )}
              <span className="text-sm font-semibold">
                {uploading
                  ? "Subiendo y validando..."
                  : "Seleccionar archivo APK"}
              </span>
              <span className="text-xs text-muted-foreground">
                Hasta 100 MB · quedará pendiente hasta activarla
              </span>
              <input
                type="file"
                accept=".apk,application/vnd.android.package-archive"
                className="hidden"
                onChange={upload}
                disabled={uploading}
              />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" /> Estado de
              publicación
            </CardTitle>
          </CardHeader>
          <CardContent>
            {current ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-emerald-500/10 p-4">
                  <p className="font-semibold text-emerald-700">APK activa</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {current.fileName} · {formatFileSize(current.size)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Versión</span>
                    <p className="font-semibold">{current.version}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Activada</span>
                    <p className="font-semibold">
                      {formatNullableDateTime(current.publishedAt)}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  Al instalarla, Android solicitará activar FinJoy como
                  Administrador del dispositivo para proteger el crédito.
                </div>
              </div>
            ) : (
              <div className="py-6 text-center">
                <FileArchive className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-medium">No hay una APK activa</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sube y activa una versión para habilitar la descarga.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" /> Blindaje Anti-Formateo Total
            (Nivel A: FRP Empresarial + Nivel B: Zero-Touch / QR / ADB)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4 text-sm">
              <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
                <p className="font-semibold text-foreground">
                  Nivel A: Bloqueo en Chip FRP Empresarial (Contra formateo por botones físicos / Recovery)
                </p>
                <p className="text-xs text-muted-foreground">
                  Ingresa el ID numérico de la cuenta de Google de tu negocio (puedes separar varios con coma). FinJoy lo graba en el chip de seguridad de Android 11+ (<code>FactoryResetProtectionPolicy</code>): si alguien formatea el celular con los botones físicos de <i>Recovery</i>, al encender quedará 100% bloqueado de fábrica pidiendo exclusivamente la cuenta de tu empresa.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="frp-accounts" className="text-xs">
                      ID(s) de cuenta Google FRP de tu negocio
                    </Label>
                    <Input
                      id="frp-accounts"
                      value={frpInput}
                      onChange={(e) => setFrpInput(e.target.value)}
                      placeholder="Ej: 109823471928374912345"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="org-name" className="text-xs">
                      Nombre de la financiera
                    </Label>
                    <Input
                      id="org-name"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      placeholder="FinJoy Crédito Móvil"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void saveProtection()}
                  disabled={savingProtection}
                  className="gap-2"
                >
                  {savingProtection && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Guardar blindaje FRP y sincronizar APKs
                </Button>
              </div>

              <div className="space-y-2 rounded-xl border bg-muted/40 p-4">
                <p className="flex items-center gap-2 font-semibold">
                  <Terminal className="h-4 w-4 text-primary" /> Instalación por Cable USB (ADB) en teléfono encendido
                </p>
                <p className="text-xs text-muted-foreground">
                  Instala la APK en el celular, quita temporalmente las cuentas de Google en Ajustes, activa Depuración USB y ejecuta este comando desde la PC:
                </p>
                <div className="flex items-center justify-between gap-2 rounded-lg bg-background p-2.5 font-mono text-xs">
                  <span className="truncate">{ADB_DEVICE_OWNER_CMD}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5"
                    onClick={copyAdbCommand}
                  >
                    {copiedAdb ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copiar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center rounded-xl border bg-muted/20 p-4 text-center">
              {qrImageUrl ? (
                <>
                  <img
                    src={qrImageUrl}
                    alt="QR de aprovisionamiento Android Enterprise FinJoy"
                    className="h-48 w-48 rounded-lg border bg-white p-2"
                  />
                  <p className="mt-2 text-xs font-medium">
                    QR Device Owner + FRP · v{current?.version}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    En teléfono nuevo/formateado: toca <b>6 veces</b> en &ldquo;Hola&rdquo; para escanear
                  </p>
                </>
              ) : (
                <p className="px-4 text-xs text-muted-foreground">
                  Sube y activa una versión de la APK para generar automáticamente el código QR de aprovisionamiento anti-formateo.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2 rounded-xl border bg-muted/40 p-4 text-sm">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <p className="font-semibold">
                  Nivel B: Configuración Google Zero-Touch Enrollment / Samsung Knox Guard (Reinstalación automática por IMEI)
                </p>
                <p className="text-xs text-muted-foreground">
                  Al registrar el IMEI en tu portal de Google Zero-Touch o Knox Guard, pega este bloque en <b>DPC Extras</b>. Si formatean el equipo por botones físicos, Android descargará FinJoy automáticamente al conectarse a internet, otorgará todos los permisos sin preguntar (<code>PERMISSION_POLICY_AUTO_GRANT</code>) y bloqueará el celular de inmediato.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5"
                onClick={copyZeroTouchJson}
              >
                {copiedZeroTouch ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> JSON Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copiar DPC Extras
                  </>
                )}
              </Button>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-background p-3 font-mono text-xs">
              {zeroTouchDpcExtras}
            </pre>
          </div>
        </CardContent>
      </Card>

      {pending.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-amber-600" /> Pendientes de
              activación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4 sm:flex-row sm:items-center"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">v{item.version}</span>
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 text-amber-700"
                    >
                      Pendiente
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.fileName} · {formatFileSize(item.size)} · subida{" "}
                    {formatNullableDateTime(item.createdAt)}
                  </p>
                </div>
                <Button
                  onClick={() => void activate(item.id)}
                  disabled={activatingId !== null}
                  className="gap-2"
                >
                  {activatingId === item.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}{" "}
                  Activar versión
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-muted-foreground" /> Historial de
            versiones
          </CardTitle>
        </CardHeader>
        <CardContent>
          {versions.length > 0 ? (
            <div className="divide-y">
              {versions.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">v{item.version}</span>
                      <Badge
                        variant="outline"
                        className={
                          item.status === "active"
                            ? "border-emerald-500/40 text-emerald-700"
                            : item.status === "pending"
                              ? "border-amber-500/40 text-amber-700"
                              : "text-muted-foreground"
                        }
                      >
                        {item.status === "active"
                          ? "Activa"
                          : item.status === "pending"
                            ? "Pendiente"
                            : "Archivada"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.fileName} · {formatFileSize(item.size)} ·{" "}
                      {formatNullableDateTime(item.createdAt)}
                    </p>
                  </div>
                  <span
                    className="font-mono text-xs text-muted-foreground"
                    title={item.checksum}
                  >
                    SHA-256 {item.checksum.slice(0, 12)}…
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Todavía no hay versiones registradas.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cómo generar la APK en tu PC</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
            <li>
              <b className="block text-foreground">1. Prepara el equipo</b>
              Instala Node.js LTS y Android Studio con Android SDK Platform 36.
            </li>
            <li>
              <b className="block text-foreground">2. Compila</b>
              Al descargar el proyecto, abre{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                GENERAR_APK_WINDOWS.bat
              </code>
              .
            </li>
            <li>
              <b className="block text-foreground">3. Publica</b>
              Sube{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                generated-apk/FinJoy-debug.apk
              </code>
              , revisa la versión y actívala.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}