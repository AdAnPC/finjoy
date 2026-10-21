import { FormEvent, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Smartphone, UserPlus } from "lucide-react";
import { useCreateClient, useCreateLoan } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/hooks/use-toast";

export default function NewClient() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createClient = useCreateClient();
  const createLoan = useCreateLoan();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    deviceModel: "",
    deviceImei: "",
    totalAmount: "",
    monthlyPayment: "",
    startDate: new Date().toISOString().slice(0, 10),
    totalMonths: "12",
    gracePeriodDays: "3",
  });

  const update =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((current) => ({ ...current, [key]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const client = await createClient.mutateAsync({
        data: {
          name: form.name,
          phone: form.phone,
          email: form.email || undefined,
          address: form.address || undefined,
        },
      });
      if (form.deviceModel && form.totalAmount && form.monthlyPayment) {
        await createLoan.mutateAsync({
          data: {
            clientId: client.id,
            deviceModel: form.deviceModel,
            deviceImei: form.deviceImei || undefined,
            totalAmount: Number(form.totalAmount),
            monthlyPayment: Number(form.monthlyPayment),
            startDate: new Date(form.startDate).toISOString(),
            totalMonths: Number(form.totalMonths),
            gracePeriodDays: Number(form.gracePeriodDays),
          },
        });
      }
      await queryClient.invalidateQueries();
      toast({
        title: "Cliente creado",
        description: "La información quedó guardada correctamente.",
      });
      navigate(`/clients/${client.id}`);
    } catch {
      toast({
        title: "No se pudo guardar",
        description: "Revisa los datos e inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <PageHeader
        title="Nuevo cliente"
        description="Registra al cliente y, si quieres, emite su crédito en el mismo paso."
        backHref="/clients"
        backLabel="Volver a clientes"
      />
      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> Información personal
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre completo *</Label>
              <Input
                required
                value={form.name}
                onChange={update("name")}
                placeholder="Ej. María López"
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono *</Label>
              <Input
                required
                value={form.phone}
                onChange={update("phone")}
                placeholder="555 123 4567"
              />
            </div>
            <div className="space-y-2">
              <Label>Correo electrónico</Label>
              <Input
                type="email"
                value={form.email}
                onChange={update("email")}
                placeholder="cliente@correo.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input
                value={form.address}
                onChange={update("address")}
                placeholder="Calle, número, ciudad"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" /> Crédito y
              dispositivo{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (opcional)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Modelo del dispositivo</Label>
              <Input
                value={form.deviceModel}
                onChange={update("deviceModel")}
                placeholder="Samsung Galaxy A54"
              />
            </div>
            <div className="space-y-2">
              <Label>IMEI</Label>
              <Input
                value={form.deviceImei}
                onChange={update("deviceImei")}
                placeholder="15 dígitos"
              />
            </div>
            <div className="space-y-2">
              <Label>Monto total (MXN)</Label>
              <Input
                type="number"
                min="1"
                value={form.totalAmount}
                onChange={update("totalAmount")}
                placeholder="15000"
              />
            </div>
            <div className="space-y-2">
              <Label>Cuota mensual (MXN)</Label>
              <Input
                type="number"
                min="1"
                value={form.monthlyPayment}
                onChange={update("monthlyPayment")}
                placeholder="1250"
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha de inicio</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={update("startDate")}
              />
            </div>
            <div className="space-y-2">
              <Label>Número de meses</Label>
              <Input
                type="number"
                min="1"
                value={form.totalMonths}
                onChange={update("totalMonths")}
              />
            </div>
            <div className="space-y-2">
              <Label>Días de gracia</Label>
              <Input
                type="number"
                min="0"
                value={form.gracePeriodDays}
                onChange={update("gracePeriodDays")}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/clients">
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}{" "}
            Guardar cliente
          </Button>
        </div>
      </form>
    </div>
  );
}