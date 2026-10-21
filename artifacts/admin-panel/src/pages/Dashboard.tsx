import { Link } from "wouter";
import {
  useGetDashboard,
  useGetRecentPayments,
  useGetOverdueLoans,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  AlertTriangle,
  Lock,
  Wallet,
  ArrowRight,
  TrendingUp,
  Activity,
} from "lucide-react";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboard();
  const { data: recentPayments, isLoading: isLoadingPayments } =
    useGetRecentPayments();
  const { data: overdueLoans, isLoading: isLoadingOverdue } =
    useGetOverdueLoans();

  if (isLoadingSummary || isLoadingPayments || isLoadingOverdue) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-muted/50 rounded-t-xl" />
              <CardContent className="h-16" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Resumen General"
        description="Monitorea el estado de tu cartera de préstamos."
        action={
          <Link
            href="/clients/new"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Nuevo Cliente
          </Link>
        }
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-soft border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cobrado este mes
            </CardTitle>
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">
              {formatMoney(summary?.collectedThisMonth || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              De {formatMoney(summary?.totalCollected || 0)} total histórico
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Préstamos Activos
            </CardTitle>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Activity className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary?.activeLoans || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.totalLoans} préstamos totales
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo Pendiente
            </CardTitle>
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-indigo-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {formatMoney(summary?.pendingBalance || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Esperado en cobros
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft border-red-100 bg-red-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-600">
              Atrasos / Bloqueos
            </CardTitle>
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {(summary?.overdueLoans || 0) + (summary?.lockedLoans || 0)}
            </div>
            <p className="text-xs text-red-600/80 mt-1">
              {summary?.overdueLoans} atrasados, {summary?.lockedLoans}{" "}
              bloqueados
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-soft">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pagos Recientes</CardTitle>
                <CardDescription>Últimos cobros registrados</CardDescription>
              </div>
              <Link
                href="/payments"
                className="text-sm text-primary hover:underline flex items-center gap-1 font-medium"
              >
                Ver todos <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentPayments?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay pagos recientes
              </div>
            ) : (
              <div className="space-y-4">
                {recentPayments?.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <Wallet className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {payment.client?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(payment.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600">
                        {formatMoney(payment.amount)}
                      </p>
                      <StatusBadge status={payment.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Atención Requerida</CardTitle>
                <CardDescription>
                  Préstamos atrasados o bloqueados
                </CardDescription>
              </div>
              <Link
                href="/loans?status=overdue"
                className="text-sm text-primary hover:underline flex items-center gap-1 font-medium"
              >
                Ver todos <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {overdueLoans?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay préstamos atrasados
              </div>
            ) : (
              <div className="space-y-4">
                {overdueLoans?.slice(0, 5).map((loan) => (
                  <Link key={loan.id} href={`/loans/${loan.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                            loan.status === "locked"
                              ? "bg-red-100"
                              : "bg-orange-100"
                          }`}
                        >
                          {loan.status === "locked" ? (
                            <Lock className="w-5 h-5 text-red-600" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-orange-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                            {loan.client?.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {loan.deviceModel}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <p className="font-medium text-foreground">
                          {formatMoney(loan.monthlyPayment)}/mes
                        </p>
                        <StatusBadge status={loan.status} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
