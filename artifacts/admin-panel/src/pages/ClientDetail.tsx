import { useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import {
  useDeleteClient,
  useGetClient,
  useIssueClientActivationCode,
  type ClientActivationCode,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeviceLockButton } from "@/components/DeviceLockButton";
import { PaymentHistoryCard } from "@/components/PaymentHistoryCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatMoney, getInitials } from "@/lib/utils";

type LinkedCustomerDevice = {
  id: number;
  deviceIdHash: string;
  manufacturer: string | null;
  model: string;
  osVersion: string | null;
  deviceAdminActive: boolean;
  deviceOwner: boolean;
  lastSeenAt: string;
};

export default function ClientDetail() {
  const [, params] = useRoute("/clients/:id");
  const [, navigate] = useLocation();
  const id = Number(params?.id);
  const queryClient = useQueryClient();
  const { data: client, isLoading } = useGetClient(id, {
    query: { refetchInterval: 4000 },
  });
  const remove = useDeleteClient();
  const issueActivationCode = useIssueClientActivationCode();
  const { toast } = useToast();

  const [activationCode, setActivationCode] =
    useState<ClientActivationCode | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  if (isLoading) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Cargando cliente...
      </div>
    );
  }
  if (!client) {
    return <div className="py-16 text-center">Cliente no encontrado</div>;
  }

  const loan = client.loan;
  const linkedDevice =
    (client as unknown as { device?: LinkedCustomerDevice | null }).device ??
    null;

  async function deleteClient() {
    if (
      !window.confirm(
        "¿Eliminar este cliente y sus préstamos? Esta acción no se puede deshacer.",
      )
    ) {
      return;
    }
    await remove.mutateAsync({ id });
    await queryClient.invalidateQueries();
    navigate("/clients");
  }

  async function generateActivationCode() {
    try {
      const generated = await issueActivationCode.mutateAsync({
        id,
        data: { confirmReset: false },
      });
      setActivationCode(generated);
      setCopiedCode(false);
      toast({
        title: "Código de activación emitido",
        description:
          "Ingresa este código en la APK del cliente (válido por 24 horas).",
      });
    } catch (error) {
      const status =
        error && typeof error === "object" && "status" in error
          ? (error as { status?: number }).status
          : undefined;

      if (status === 409) {
        const shouldReset = window.confirm(
          "Este cliente ya activó su cuenta en la APK anteriormente. ¿Deseas restablecer su acceso y emitir un nuevo código? (Se cerrarán sus sesiones activas)",
        );
        if (!shouldReset) return;
        try {
          const generated = await issueActivationCode.mutateAsync({
            id,
            data: { confirmReset: true },
          });
          setActivationCode(generated);
          setCopiedCode(false);
          toast({
            title: "Acceso restablecido",
            description:
              "Se generó un nuevo código de activación válido por 24 horas.",
          });
        } catch {
          toast({
            title: "No se pudo restablecer el código",
            variant: "destructive",
          });
        }
        return;
      }

      toast({
        title: "No se pudo emitir el código de activación",
        variant: "destructive",
      });
    }
  }

  async function copyActivationCode() {
    if (!activationCode) return;
    await navigator.clipboard.writeText(activationCode.code);
    setCopiedCode(true);
    toast({
      title: "Código copiado",
      description: `${activationCode.code} copiado al portapapeles.`,
    });
    setTimeout(() => setCopiedCode(false), 2500);
  }

  const deviceFullName = linkedDevice
    ? [linkedDevice.manufacturer, linkedDevice.model]
        .filter(Boolean)
        .join(" ")
    : null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <Link
        href="/clients"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a clientes
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary">
            {getInitials(client.name)}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
            <p className="mt-1 text-muted-foreground">
              Cliente desde {formatDate(client.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Edit3 className="h-4 w-4" /> Editar
          </Button>
          <Button
            variant="outline"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={deleteClient}
          >
            <Trash2 className="h-4 w-4" /> Eliminar
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información de contacto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-primary" />
                <span>{client.phone}</span>
              </div>
              {client.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-primary" />
                  <span>{client.email}</span>
                </div>
              )}
              {client.address && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>{client.address}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={linkedDevice ? "border-emerald-500/40" : undefined}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary" /> Celular
                  Vinculado (APK)
                </span>
                {linkedDevice ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Conectado
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                    Pendiente de enlazar
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {linkedDevice ? (
                <div className="space-y-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Equipo:</span>
                    <span className="font-semibold text-foreground">
                      {deviceFullName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Sistema:</span>
                    <span className="font-medium text-foreground">
                      Android {linkedDevice.osVersion || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Modo Administrador:
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {linkedDevice.deviceOwner
                        ? "Device Owner (Total QR)"
                        : linkedDevice.deviceAdminActive
                          ? "Administrador Activo"
                          : "Sin permisos"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">ID Hardware:</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {linkedDevice.deviceIdHash.slice(0, 14)}…
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Última conexión:
                    </span>
                    <span className="text-foreground">
                      {formatDate(linkedDevice.lastSeenAt)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Genera el código abajo e ingrésalo en la pestaña{" "}
                  <b>Activar cuenta</b> de la APK en el celular (puedes dejar la
                  contraseña en blanco). En cuanto el celular active el código,
                  su marca, modelo y estado de administrador aparecerán aquí
                  automáticamente.
                </p>
              )}

              {activationCode && (
                <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Código de activación
                      </p>
                      <p className="font-mono text-xl font-bold tracking-widest text-primary">
                        {activationCode.code}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={copyActivationCode}
                    >
                      {copiedCode ? (
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
                  <p className="text-xs text-muted-foreground">
                    Teléfono: <b>{client.phone}</b> · Vence:{" "}
                    {formatDate(activationCode.expiresAt)}
                  </p>
                </div>
              )}

              <Button
                type="button"
                variant={activationCode || linkedDevice ? "outline" : "default"}
                className="w-full gap-2"
                disabled={issueActivationCode.isPending}
                onClick={generateActivationCode}
              >
                {issueActivationCode.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                {activationCode
                  ? "Generar nuevo código"
                  : linkedDevice
                    ? "Vincular otro celular / Nuevo código"
                    : "Generar código de activación"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Préstamo actual</CardTitle>
            {loan && <StatusBadge status={loan.status} />}
          </CardHeader>
          <CardContent>
            {loan ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between rounded-xl bg-muted/50 p-4">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-semibold">
                        {deviceFullName || loan.deviceModel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {loan.deviceImei ||
                          (linkedDevice
                            ? `ID: ${linkedDevice.deviceIdHash.slice(0, 16)}…`
                            : "IMEI no registrado")}
                      </p>
                    </div>
                  </div>
                  <Link href={`/loans/${loan.id}`}>
                    <Button variant="ghost" size="sm">
                      Ver préstamo
                    </Button>
                  </Link>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="font-bold">
                      {formatMoney(loan.monthlyPayment)}
                    </p>
                    <p className="text-xs text-muted-foreground">Cuota</p>
                  </div>
                  <div>
                    <p className="font-bold">{formatMoney(loan.paidAmount)}</p>
                    <p className="text-xs text-muted-foreground">Pagado</p>
                  </div>
                  <div>
                    <p className="font-bold">
                      {loan.paidMonths}/{loan.totalMonths}
                    </p>
                    <p className="text-xs text-muted-foreground">Meses</p>
                  </div>
                </div>

                <DeviceLockButton
                  loanId={loan.id}
                  status={loan.status}
                  className="w-full"
                />
              </div>
            ) : (
              <div className="space-y-4 py-6 text-center text-muted-foreground">
                <p>Este cliente aún no tiene un préstamo registrado.</p>
                <Link
                  href={`/loans/new?clientId=${client.id}${deviceFullName ? `&deviceModel=${encodeURIComponent(deviceFullName)}` : ""}`}
                >
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" /> Crear préstamo para{" "}
                    {deviceFullName || client.name}
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <PaymentHistoryCard payments={client.payments} showStatus />
    </div>
  );
}
