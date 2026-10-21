import type { ApkVersion, Client, Loan, Payment } from "@workspace/db";

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function serializeClient(client: Client) {
  return {
    ...client,
    createdAt: toIsoString(client.createdAt),
  };
}

export function serializeLoan(loan: Loan) {
  return {
    ...loan,
    totalAmount: Number(loan.totalAmount),
    paidAmount: Number(loan.paidAmount),
    monthlyPayment: Number(loan.monthlyPayment),
    nextDueDate: toIsoString(loan.nextDueDate),
    startDate: toIsoString(loan.startDate),
    createdAt: toIsoString(loan.createdAt),
  };
}

export function serializePayment(payment: Payment) {
  return {
    ...payment,
    amount: Number(payment.amount),
    date: toIsoString(payment.date),
    createdAt: toIsoString(payment.createdAt),
  };
}

export function serializeApkVersion(version: ApkVersion) {
  return {
    ...version,
    createdAt: toIsoString(version.createdAt),
    publishedAt: version.publishedAt ? toIsoString(version.publishedAt) : null,
  };
}
