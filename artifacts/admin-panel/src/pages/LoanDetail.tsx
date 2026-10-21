import { FormEvent, useState } from "react";
import { Link, useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Loader2, Smartphone } from "lucide-react";
import {
  useGetLoan,
  useRecordPayment,
  type PaymentInputMethod,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeviceLockButton } from "@/components/DeviceLockButton";
import {
  LoanProgressBar,
  getLoanProgressPercent,
} from "@/components/LoanProgressBar";
import { PaymentHistoryCard } from "@/components/PaymentHistoryCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, formatMoney } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function LoanDetail() {
  const [, params] = useRoute("/loans/:id");
  const id = Number(params?.id);
  const queryClient = useQueryClient();
  const { data: loan, isLoading } = useGetLoan(id);
  const record = useRecordPayment();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentInputMethod>("cash");
  const [saving, setSaving] = useState(false);

  if (isLoading) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Cargando préstamo...
      </div>
    );
  }
  if (!loan) {
    return <div className="py-16 text-center">Préstamo no encontrado</div>;
  }

  const currentLoan = loan;
  const progress = getLoanProgressPercent(
    currentLoan.paidAmount,
    currentLoan.totalAmount,
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!amount) return;
    setSaving(true);
    try {
      await record.mutateAsync({
        data: {
          loanId: currentLoan.id,
          amount: Number(amount),
          date: new Date().toISOString(),
          method,
        },
      });
      await queryClient.invalidateQueries();
      toast({
        title: "Pago registrado",
        description: "El saldo del préstamo se actualizó.",
      });
      setAmount("");
    } catch {
      toast({
        title: "No se pudo registrar el pago",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <Link
        href="/loans"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a préstamos
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {loan.deviceModel}
            </h1>
            <StatusBadge status={loan.status} />
          </div>
          <p className="mt-1 text-muted-foreground">
            Crédito #{loan.id} · {loan.client?.name}
          </p>
        </div>
        <DeviceLockButton
          loanId={loan.id}
          status={loan.status}
          unlockLabel="Desbloquear"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Resumen del crédito</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Monto total</p>
                <p className="mt-1 text-xl font-bold">
                  {formatMoney(loan.totalAmount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pagado</p>
                <p className="mt-1 text-xl font-bold text-emerald-600">
                  {formatMoney(loan.paidAmount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Saldo</p>
                <p className="mt-1 text-xl font-bold">
                  {formatMoney(loan.totalAmount - loan.paidAmount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cuota</p>
                <p className="mt-1 text-xl font-bold">
                  {formatMoney(loan.monthlyPayment)}
                </p>
              </div>
            </div>

            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span>Progreso del crédito</span>
                <b>{Math.round(progress)}%</b>
              </div>
              <LoanProgressBar
                paidAmount={loan.paidAmount}
                totalAmount={loan.totalAmount}
              />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>
                  {loan.paidMonths} de {loan.totalMonths} cuotas
                </span>
                <span>Vence {formatDate(loan.nextDueDate)}</span>
              </div>
            </div>

            <div className="grid gap-3 border-t pt-5 text-sm md:grid-cols-2">
              <p className="flex items-center gap-2 text-muted-foreground">
                <Smartphone className="h-4 w-4 text-primary" /> IMEI:{" "}
                <b className="text-foreground">
                  {loan.deviceImei || "No registrado"}
                </b>
              </p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="h-4 w-4 text-primary" /> Inicio:{" "}
                <b className="text-foreground">{formatDate(loan.startDate)}</b>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registrar pago</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Monto (MXN)</Label>
                <Input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={String(loan.monthlyPayment)}
                />
              </div>
              <div className="space-y-2">
                <Label>Método</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={method}
                  onChange={(e) =>
                    setMethod(e.target.value as PaymentInputMethod)
                  }
                >
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                  <option value="card">Tarjeta</option>
                </select>
              </div>
              <Button className="w-full gap-2" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}{" "}
                Registrar pago
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <PaymentHistoryCard payments={loan.payments} />
    </div>
  );
}