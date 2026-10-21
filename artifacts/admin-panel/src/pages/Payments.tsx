import { useState } from "react";
import { Link } from "wouter";
import { CreditCard, Wallet } from "lucide-react";
import { useListPayments } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { StatusBadge } from "@/components/StatusBadge";
import {
  formatDateTime,
  formatMoney,
  formatPaymentMethod,
} from "@/lib/utils";

export default function Payments() {
  const [search, setSearch] = useState("");
  const { data: payments, isLoading } = useListPayments();

  const normalizedSearch = search.trim().toLowerCase();
  const rows =
    payments?.filter(
      (payment) =>
        !normalizedSearch ||
        payment.client?.name.toLowerCase().includes(normalizedSearch) ||
        payment.reference.toLowerCase().includes(normalizedSearch),
    ) ?? [];
  const total = rows.reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <PageHeader
        title="Pagos"
        description="Consulta y verifica todos los cobros registrados."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <span className="rounded-xl bg-emerald-500/10 p-3 text-emerald-600">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Pagos registrados</p>
              <p className="text-2xl font-bold">{payments?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <span className="rounded-xl bg-primary/10 p-3 text-primary">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Total cobrado</p>
              <p className="text-2xl font-bold">{formatMoney(total)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <span className="rounded-xl bg-amber-500/10 p-3 text-amber-600">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Promedio por pago</p>
              <p className="text-2xl font-bold">
                {formatMoney(rows.length ? total / rows.length : 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <CardTitle>Todos los pagos</CardTitle>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar cliente o referencia"
              className="sm:w-80"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3">Referencia</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Fecha y método</th>
                  <th className="px-4 py-3">Monto</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-10 text-center text-muted-foreground"
                    >
                      Cargando pagos...
                    </td>
                  </tr>
                ) : (
                  rows.map((payment) => (
                    <tr key={payment.id} className="hover:bg-muted/30">
                      <td className="px-4 py-4 font-medium">
                        {payment.reference}
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={
                            payment.loan ? `/loans/${payment.loan.id}` : "/loans"
                          }
                          className="hover:text-primary"
                        >
                          {payment.client?.name || "Sin cliente"}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {formatDateTime(payment.date)} ·{" "}
                        {formatPaymentMethod(payment.method)}
                      </td>
                      <td className="px-4 py-4 font-semibold text-emerald-600">
                        {formatMoney(payment.amount)}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={payment.status} />
                      </td>
                    </tr>
                  ))
                )}
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-10 text-center text-muted-foreground"
                    >
                      No se encontraron pagos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}