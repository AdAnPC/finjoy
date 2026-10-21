import { Router, type IRouter } from "express";
import { desc, eq, inArray } from "drizzle-orm";
import { db, clientsTable, loansTable, paymentsTable } from "@workspace/db";
import {
  GetDashboardResponse,
  GetRecentPaymentsResponse,
  GetOverdueLoansResponse,
} from "@workspace/api-zod";
import { syncAllLoanStatuses } from "../../lib/loanStatus";
import {
  serializeClient,
  serializeLoan,
  serializePayment,
} from "../../lib/serializers";

const router: IRouter = Router();

// GET /admin/dashboard
router.get("/admin/dashboard", async (_req, res): Promise<void> => {
  await syncAllLoanStatuses();

  const [clients, loans, payments] = await Promise.all([
    db.select().from(clientsTable),
    db.select().from(loansTable),
    db.select().from(paymentsTable),
  ]);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const completedPayments = payments.filter((p) => p.status === "completed");
  const totalCollected = completedPayments.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );
  const collectedThisMonth = completedPayments
    .filter((p) => new Date(p.date) >= startOfMonth)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const pendingBalance = loans.reduce(
    (sum, l) => sum + Math.max(0, Number(l.totalAmount) - Number(l.paidAmount)),
    0,
  );

  res.json(
    GetDashboardResponse.parse({
      totalClients: clients.length,
      totalLoans: loans.length,
      activeLoans: loans.filter(
        (l) => l.status === "active" || l.status === "due_soon",
      ).length,
      overdueLoans: loans.filter((l) => l.status === "overdue").length,
      lockedLoans: loans.filter((l) => l.status === "locked").length,
      completedLoans: loans.filter((l) => l.status === "completed").length,
      totalCollected,
      collectedThisMonth,
      pendingBalance,
    }),
  );
});

// GET /admin/dashboard/recent-payments
router.get("/admin/dashboard/recent-payments", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      payment: paymentsTable,
      loan: loansTable,
      client: clientsTable,
    })
    .from(paymentsTable)
    .leftJoin(loansTable, eq(paymentsTable.loanId, loansTable.id))
    .leftJoin(clientsTable, eq(loansTable.clientId, clientsTable.id))
    .orderBy(desc(paymentsTable.date))
    .limit(10);

  const results = rows.map(({ payment, loan, client }) => ({
    ...serializePayment(payment),
    client: client ? serializeClient(client) : undefined,
    loan: loan ? serializeLoan(loan) : undefined,
  }));

  res.json(GetRecentPaymentsResponse.parse(results));
});

// GET /admin/dashboard/overdue-loans
router.get("/admin/dashboard/overdue-loans", async (_req, res): Promise<void> => {
  await syncAllLoanStatuses();

  const rows = await db
    .select({
      loan: loansTable,
      client: clientsTable,
    })
    .from(loansTable)
    .leftJoin(clientsTable, eq(loansTable.clientId, clientsTable.id))
    .where(inArray(loansTable.status, ["overdue", "locked"]));

  const results = rows.map(({ loan, client }) => ({
    ...serializeLoan(loan),
    client: client ? serializeClient(client) : undefined,
  }));

  res.json(GetOverdueLoansResponse.parse(results));
});

export default router;
