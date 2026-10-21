import type { Loan, LoanStatus, Payment, PaymentMethod } from "@/context/LoanContext";

export function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function buildInitialDemoLoan(): Loan {
  return {
    id: 101,
    totalAmount: 7200,
    paidAmount: 2400,
    monthlyPayment: 600,
    nextDueDate: addDaysIso(5),
    status: "active",
    deviceModel: "Samsung Galaxy A54 5G",
    clientName: "Carlos Mendoza",
    startDate: addDaysIso(-120),
    totalMonths: 12,
    paidMonths: 4,
    gracePeriodDays: 3,
  };
}

export function buildInitialDemoPayments(): Payment[] {
  return [
    {
      id: "pay-4",
      amount: 600,
      date: addDaysIso(-25),
      method: "transfer",
      reference: "SPEI-948271",
      status: "completed",
    },
    {
      id: "pay-3",
      amount: 600,
      date: addDaysIso(-55),
      method: "card",
      reference: "VISA-4829",
      status: "completed",
    },
    {
      id: "pay-2",
      amount: 600,
      date: addDaysIso(-85),
      method: "cash",
      reference: "OXXO-773190",
      status: "completed",
    },
    {
      id: "pay-1",
      amount: 600,
      date: addDaysIso(-115),
      method: "transfer",
      reference: "SPEI-102938",
      status: "completed",
    },
  ];
}

export function applyDemoLoanStatus(prev: Loan, status: LoanStatus): Loan {
  let nextDueDate = prev.nextDueDate;
  if (status === "active") nextDueDate = addDaysIso(12);
  else if (status === "due_soon") nextDueDate = addDaysIso(2);
  else if (status === "overdue") nextDueDate = addDaysIso(-4);
  else if (status === "locked") nextDueDate = addDaysIso(-8);
  return {
    ...prev,
    status,
    nextDueDate,
  };
}

export function buildDemoPayment(amount: number, method: PaymentMethod): Payment {
  const prefix =
    method === "transfer" ? "SPEI" : method === "card" ? "VISA" : "OXXO";
  const ref = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
  return {
    id: `pay-${Date.now()}`,
    amount,
    date: new Date().toISOString(),
    method,
    reference: ref,
    status: "completed",
  };
}

export function applyDemoPaymentToLoan(prev: Loan, amount: number): Loan {
  const nextPaidAmount = Math.min(prev.paidAmount + amount, prev.totalAmount);
  const nextPaidMonths = Math.min(prev.paidMonths + 1, prev.totalMonths);
  const isCompleted =
    nextPaidMonths >= prev.totalMonths || nextPaidAmount >= prev.totalAmount;
  return {
    ...prev,
    paidAmount: nextPaidAmount,
    paidMonths: nextPaidMonths,
    nextDueDate: addDaysIso(30),
    status: isCompleted ? "completed" : "active",
  };
}
