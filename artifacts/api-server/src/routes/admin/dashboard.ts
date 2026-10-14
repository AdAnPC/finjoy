import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
import { db, clientsTable, loansTable, paymentsTable } from "@workspace/db";
import {
  GetDashboardResponse,
  GetRecentPaymentsResponse,
  GetOverdueLoansResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /admin/dashboard
router.get("/admin/dashboard", async (req, res): Promise<void> => {
  const [clients, loans, payments] = await Promise.all([
    db.select().from(clientsTable),
    db.select().from(loansTable),
    db.select().from(paymentsTable),
  ]);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalCollected = payments
    .filter((p) => p.status === "completed")
    .reduce((s, p) => s + Number(p.amount), 0);

  const collectedThisMonth = payments
    .filter((p) => p.status === "completed" && new Date(p.date) >= startOfMonth)
    .reduce((s, p) => s + Number(p.amount), 0);

  const pendingBalance = loans.reduce((s, l) => s + (Number(l.totalAmount) - Number(l.paidAmount)), 0);

  res.json(GetDashboardResponse.parse({
    totalClients: clients.length,
    totalLoans: loans.length,
    activeLoans: loans.filter((l) => l.status === "active" || l.status === "due_soon").length,
    overdueLoans: loans.filter((l) => l.status === "overdue").length,
    lockedLoans: loans.filter((l) => l.status === "locked").length,
    completedLoans: loans.filter((l) => l.status === "completed").length,
    totalCollected,
    collectedThisMonth,
    pendingBalance,
  }));
});

// GET /admin/dashboard/recent-payments
router.get("/admin/dashboard/recent-payments", async (req, res): Promise<void> => {
  const payments = await db.select().from(paymentsTable).orderBy(paymentsTable.date).limit(10);

  const results = await Promise.all(
    payments.reverse().map(async (p) => {
      const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, p.loanId));
      const [client] = loan
        ? await db.select().from(clientsTable).where(eq(clientsTable.id, loan.clientId))
        : [undefined];
      return {
        ...p,
        amount: Number(p.amount),
        date: p.date.toISOString(),
        createdAt: p.createdAt.toISOString(),
        client: client ? { ...client, createdAt: client.createdAt.toISOString() } : undefined,
        loan: loan
          ? {
              ...loan,
              totalAmount: Number(loan.totalAmount),
              paidAmount: Number(loan.paidAmount),
              monthlyPayment: Number(loan.monthlyPayment),
              nextDueDate: loan.nextDueDate.toISOString(),
              startDate: loan.startDate.toISOString(),
              createdAt: loan.createdAt.toISOString(),
            }
          : undefined,
      };
    })
  );

  res.json(GetRecentPaymentsResponse.parse(results));
});

// GET /admin/dashboard/overdue-loans
router.get("/admin/dashboard/overdue-loans", async (req, res): Promise<void> => {
  const loans = await db.select().from(loansTable);
  const overdueOrLocked = loans.filter((l) => l.status === "overdue" || l.status === "locked");

  const results = await Promise.all(
    overdueOrLocked.map(async (l) => {
      const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, l.clientId));
      return {
        ...l,
        totalAmount: Number(l.totalAmount),
        paidAmount: Number(l.paidAmount),
        monthlyPayment: Number(l.monthlyPayment),
        nextDueDate: l.nextDueDate.toISOString(),
        startDate: l.startDate.toISOString(),
        createdAt: l.createdAt.toISOString(),
        client: client ? { ...client, createdAt: client.createdAt.toISOString() } : undefined,
      };
    })
  );

  res.json(GetOverdueLoansResponse.parse(results));
});

export default router;
