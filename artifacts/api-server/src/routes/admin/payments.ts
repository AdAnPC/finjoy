import { Router, type IRouter } from "express";
import { and, eq, type SQL } from "drizzle-orm";
import { db, clientsTable, loansTable, paymentsTable, type Loan } from "@workspace/db";
import {
  RecordPaymentBody,
  ListPaymentsQueryParams,
  RecordPaymentResponse,
  ListPaymentsResponse,
} from "@workspace/api-zod";
import { parsePositiveIntParam } from "../../lib/http";
import { computeAutomaticLoanStatus } from "../../lib/loanStatus";
import {
  serializeClient,
  serializeLoan,
  serializePayment,
} from "../../lib/serializers";

const router: IRouter = Router();

// GET /admin/payments
router.get("/admin/payments", async (req, res): Promise<void> => {
  const query = ListPaymentsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { loanId, clientId } = query.data;

  const filters: SQL[] = [];
  if (loanId) filters.push(eq(paymentsTable.loanId, loanId));
  if (clientId) filters.push(eq(loansTable.clientId, clientId));

  const rows = await db
    .select({
      payment: paymentsTable,
      loan: loansTable,
      client: clientsTable,
    })
    .from(paymentsTable)
    .leftJoin(loansTable, eq(paymentsTable.loanId, loansTable.id))
    .leftJoin(clientsTable, eq(loansTable.clientId, clientsTable.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(paymentsTable.date);

  const results = rows.map(({ payment, loan, client }) => ({
    ...serializePayment(payment),
    client: client ? serializeClient(client) : undefined,
    loan: loan ? serializeLoan(loan) : undefined,
  }));

  res.json(ListPaymentsResponse.parse(results));
});

// POST /admin/payments
router.post("/admin/payments", async (req, res): Promise<void> => {
  const body = RecordPaymentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { loanId, amount, date, method, notes } = body.data;
  const reference = `TXN-${Date.now().toString().slice(-8)}`;

  const payment = await db.transaction(async (tx) => {
    const [loan] = await tx
      .select()
      .from(loansTable)
      .where(eq(loansTable.id, loanId))
      .limit(1);
    if (!loan) return null;

    const [createdPayment] = await tx
      .insert(paymentsTable)
      .values({
        loanId,
        amount: String(amount),
        date: new Date(date as string),
        method,
        reference,
        status: "completed",
        notes: notes ?? null,
      })
      .returning();

    const newPaidAmount = Number(loan.paidAmount) + amount;
    const newPaidMonths = loan.paidMonths + 1;
    const now = new Date();
    const nextDue = new Date(loan.nextDueDate);
    nextDue.setMonth(nextDue.getMonth() + 1);
    while (nextDue <= now) {
      nextDue.setMonth(nextDue.getMonth() + 1);
    }

    const newStatus: Loan["status"] = computeAutomaticLoanStatus(
      {
        status: "active",
        nextDueDate: nextDue,
        gracePeriodDays: loan.gracePeriodDays,
        paidAmount: String(newPaidAmount),
        totalAmount: loan.totalAmount,
        paidMonths: newPaidMonths,
        totalMonths: loan.totalMonths,
      },
      now,
    );

    await tx
      .update(loansTable)
      .set({
        paidAmount: String(newPaidAmount),
        paidMonths: newPaidMonths,
        nextDueDate: nextDue,
        status: newStatus,
      })
      .where(eq(loansTable.id, loanId));

    return createdPayment;
  });

  if (!payment) {
    res.status(404).json({ error: "Loan not found" });
    return;
  }

  res.status(201).json(RecordPaymentResponse.parse(serializePayment(payment)));
});

// DELETE /admin/payments/:id
router.delete("/admin/payments/:id", async (req, res): Promise<void> => {
  const id = parsePositiveIntParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  await db.delete(paymentsTable).where(eq(paymentsTable.id, id));
  res.status(204).send();
});

export default router;
