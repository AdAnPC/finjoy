import { useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { ArrowLeft, CreditCard, Edit3, Lock, Mail, MapPin, Phone, Smartphone, Trash2, Unlock, UserRound } from "lucide-react";
import { useDeleteClient, useGetClient, useLockDevice, useUnlockDevice } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function ClientDetail() {
  const [, params] = useRoute("/clients/:id");
  const [, navigate] = useLocation();
  const id = Number(params?.id);
  const { toast } = useToast();
  const { data: client, isLoading } = useGetClient(id);
  const lock = useLockDevice();
  const unlock = useUnlockDevice();
  const remove = useDeleteClient();
  const [busy, setBusy] = useState(false);
  if (isLoading) return <div className="py-16 text-center text-muted-foreground">Cargando cliente...</div>;
  if (!client) return <div className="py-16 text-center">Cliente no encontrado</div>;
  const loan = client.loan;
  async function toggleDevice() {
    if (!loan) return;
    setBusy(true);
    try {
      if (loan.status === "locked") await unlock.mutateAsync({ id: loan.id });
      else await lock.mutateAsync({ id: loan.id });
      toast({ title: loan.status === "locked" ? "Dispositivo desbloqueado" : "Dispositivo bloqueado" });
    } catch { toast({ title: "No se pudo actualizar el dispositivo", variant: "destructive" }); }
    finally { setBusy(false); }
  }
  async function deleteClient() {
    if (!window.confirm("¿Eliminar este cliente y sus préstamos? Esta acción no se puede deshacer.")) return;
    await remove.mutateAsync({ id });
    navigate("/clients");
  }
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <Link href="/clients" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Volver a clientes</Link>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary">{client.name.split(" ").map((x) => x[0]).join("").slice(0, 2)}</div>
          <div><h1 className="text-3xl font-bold tracking-tight">{client.name}</h1><p className="mt-1 text-muted-foreground">Cliente desde {formatDate(client.createdAt)}</p></div>
        </div>
        <div className="flex gap-2"><Button variant="outline" className="gap-2"><Edit3 className="h-4 w-4" /> Editar</Button><Button variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={deleteClient}><Trash2 className="h-4 w-4" /> Eliminar</Button></div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card><CardHeader><CardTitle>Información de contacto</CardTitle></CardHeader><CardContent className="space-y-4">
          <div className="flex items-center gap-3 text-sm"><Phone className="h-4 w-4 text-primary" /><span>{client.phone}</span></div>
          {client.email && <div className="flex items-center gap-3 text-sm"><Mail className="h-4 w-4 text-primary" /><span>{client.email}</span></div>}
          {client.address && <div className="flex items-center gap-3 text-sm"><MapPin className="h-4 w-4 text-primary" /><span>{client.address}</span></div>}
        </CardContent></Card>
        <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>Préstamo actual</CardTitle>{loan && <StatusBadge status={loan.status} />}</CardHeader><CardContent>
          {loan ? <div className="space-y-5"><div className="flex items-center justify-between rounded-xl bg-muted/50 p-4"><div className="flex items-center gap-3"><Smartphone className="h-5 w-5 text-primary" /><div><p className="font-semibold">{loan.deviceModel}</p><p className="text-xs text-muted-foreground">{loan.deviceImei || "IMEI no registrado"}</p></div></div><Link href={`/loans/${loan.id}`}><Button variant="ghost" size="sm">Ver préstamo</Button></Link></div><div className="grid grid-cols-3 gap-3 text-center"><div><p className="font-bold">{formatMoney(loan.monthlyPayment)}</p><p className="text-xs text-muted-foreground">Cuota</p></div><div><p className="font-bold">{formatMoney(loan.paidAmount)}</p><p className="text-xs text-muted-foreground">Pagado</p></div><div><p className="font-bold">{loan.paidMonths}/{loan.totalMonths}</p><p className="text-xs text-muted-foreground">Meses</p></div></div><Button onClick={toggleDevice} disabled={busy || loan.status === "completed"} variant={loan.status === "locked" ? "default" : "outline"} className="w-full gap-2">{loan.status === "locked" ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}{loan.status === "locked" ? "Desbloquear dispositivo" : "Bloquear dispositivo"}</Button></div> : <div className="py-6 text-center text-muted-foreground">Este cliente aún no tiene un préstamo.</div>}
        </CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Historial de pagos</CardTitle></CardHeader><CardContent><div className="divide-y">{client.payments.map((p) => <div key={p.id} className="flex items-center justify-between py-4"><div><p className="font-medium">{p.reference}</p><p className="text-sm text-muted-foreground">{formatDateTime(p.date)} · {p.method === "cash" ? "Efectivo" : p.method === "card" ? "Tarjeta" : "Transferencia"}</p></div><div className="text-right"><p className="font-semibold text-emerald-600">{formatMoney(p.amount)}</p><StatusBadge status={p.status} /></div></div>)}{client.payments.length === 0 && <p className="py-8 text-center text-muted-foreground">Sin pagos registrados.</p>}</div></CardContent></Card>
    </div>
  );
}