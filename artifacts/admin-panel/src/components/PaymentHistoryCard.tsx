import { CreditCard } from "lucide-react";
import type { Payment } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import {
  formatDateTime,
  formatMoney,
  formatPaymentMethod,
} from "@/lib/utils";

interface PaymentHistoryCardProps {
  payments: Payment[];
  showStatus?: boolean;
}

export function PaymentHistoryCard({
  payments,
  showStatus = false,
}: PaymentHistoryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" /> Historial de pagos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="flex items-center justify-between py-4"
            >
              <div>
                <p className="font-medium">{payment.reference}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(payment.date)} ·{" "}
                  {formatPaymentMethod(payment.method)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-emerald-600">
                  {formatMoney(payment.amount)}
                </p>
                {showStatus && <StatusBadge status={payment.status} />}
              </div>
            </div>
          ))}
          {payments.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">
              Sin pagos registrados.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
