import { useState } from "react";
import { Link, useSearch } from "wouter";
import { Eye, Smartphone } from "lucide-react";
import { useListLoans, type ListLoansStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeviceLockButton } from "@/components/DeviceLockButton";
import {
  LoanProgressBar,
  getLoanProgressPercent,
} from "@/components/LoanProgressBar";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, formatMoney } from "@/lib/utils";

const STATUS_FILTERS: Array<[ListLoansStatus | "all", string]> = [
  ["all", "Todos"],
  ["active", "Activos"],
  ["due_soon", "Próximos"],
  ["overdue", "Atrasados"],
  ["locked", "Bloqueados"],
  ["completed", "Completados"],
];

export default function Loans() {
  const query = new URLSearchParams(useSearch());
  const initialStatus =
    (query.get("status") as ListLoansStatus | "all") || "all";
  const [status, setStatus] = useState<ListLoansStatus | "all">(initialStatus);
  const [search, setSearch] = useState("");

  const { data: loans, isLoading } = useListLoans({
    status: status === "all" ? undefined : status,
  });

  const normalizedSearch = search.trim().toLowerCase();
  const rows =
    loans?.filter(
      (loan) =>
        !normalizedSearch ||
        loan.client?.name.toLowerCase().includes(normalizedSearch) ||
        loan.deviceModel.toLowerCase().includes(normalizedSearch),
    ) ?? [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <PageHeader
        title="Préstamos"
        description="Controla créditos, cuotas y dispositivos financiados."
        action={
          <Link href="/clients/new">
            <Button>Nuevo préstamo</Button>
          </Link>
        }
      />

      <Card>
        <CardHeader className="gap-4 pb-3">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <CardTitle>Portafolio de préstamos</CardTitle>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar cliente o equipo"
              className="md:w-72"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={status === value ? "default" : "outline"}
                onClick={() => setStatus(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Cliente / equipo</th>
                  <th className="px-4 py-3 font-medium">Monto</th>
                  <th className="px-4 py-3 font-medium">Progreso</th>
                  <th className="px-4 py-3 font-medium">Próximo pago</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-10 text-center text-muted-foreground"
                    >
                      Cargando préstamos...
                    </td>
                  </tr>
                ) : (
                  rows.map((loan) => {
                    const progress = getLoanProgressPercent(
                      loan.paidAmount,
                      loan.totalAmount,
                    );
                    return (
                      <tr key={loan.id} className="hover:bg-muted/30">
                        <td className="px-4 py-4">
                          <Link
                            href={`/loans/${loan.id}`}
                            className="flex items-center gap-3 hover:text-primary"
                          >
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                              <Smartphone className="h-4 w-4 text-primary" />
                            </span>
                            <span>
                              <b className="block">
                                {loan.client?.name || "Sin cliente"}
                              </b>
                              <span className="text-xs text-muted-foreground">
                                {loan.deviceModel}
                              </span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-4">
                          <b>{formatMoney(loan.totalAmount)}</b>
                          <span className="block text-xs text-muted-foreground">
                            {formatMoney(loan.monthlyPayment)}/mes
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="mb-1 flex justify-between text-xs">
                            <span>
                              {loan.paidMonths}/{loan.totalMonths} meses
                            </span>
                            <span>{Math.round(progress)}%</span>
                          </div>
                          <LoanProgressBar
                            paidAmount={loan.paidAmount}
                            totalAmount={loan.totalAmount}
                            size="sm"
                            className="w-32"
                          />
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">
                          {formatDate(loan.nextDueDate)}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={loan.status} />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-1">
                            <Link href={`/loans/${loan.id}`}>
                              <Button size="icon" variant="ghost" title="Ver">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <DeviceLockButton
                              loanId={loan.id}
                              status={loan.status}
                              mode="icon"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-10 text-center text-muted-foreground"
                    >
                      No se encontraron préstamos.
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