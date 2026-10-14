import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, clientsTable, loansTable, paymentsTable } from "@workspace/db";
import {
  RecordPaymentBody,
  DeletePaymentParams,
  ListPaymentsQueryParams,
  RecordPaymentResponse,
  ListPaymentsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializePayment(p: any) {
  return {
    ...p,
    amount: Number(p.amount),
    date: p.date instanceof Date ? p.date.toISOString() : p.date,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
  };
}

// GET /admin/payments
router.get("/admin/payments", async (req, res): Promise<void> => {
  const query = ListPaymentsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const { loanId, clientId } = query.data;

  let payments = await db.select().from(paymentsTable).orderBy(paymentsTable.date);

  if (loanId) payments = payments.filter((p) => p.loanId === loanId);

  const results = await Promise.all(
    payments.map(async (p) => {
      const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, p.loanId));
      if (clientId && loan?.clientId !== clientId) return null;
      const [client] = loan
        ? await db.select().from(clientsTable).where(eq(clientsTable.id, loan.clientId))
        : [undefined];
      return {
        ...serializePayment(p),
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

  res.json(ListPaymentsResponse.parse(results.filter(Boolean)));
});

// POST /admin/payments
router.post("/admin/payments", async (req, res): Promise<void> => {
  const body = RecordPaymentBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const { loanId, amount, date, method, notes } = body.data;

  // Verify loan exists
  const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, loanId));
  if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }

  const reference = "TXN-" + Date.now().toString().slice(-8);

  const [payment] = await db.insert(paymentsTable).values({
    loanId,
    amount: String(amount),
    date: new Date(date as string),
    method,
    reference,
    status: "completed",
    notes: notes ?? null,
  }).returning();

  // Update loan paid amount and months
  const newPaidAmount = Number(loan.paidAmount) + amount;
  const newPaidMonths = loan.paidMonths + 1;
  const nextDue = new Date(loan.nextDueDate);
  nextDue.setMonth(nextDue.getMonth() + 1);
  const newStatus = newPaidMonths >= loan.totalMonths ? "completed" : loan.status === "locked" ? "active" : loan.status;

  await db.update(loansTable).set({
    paidAmount: String(newPaidAmount),
    paidMonths: newPaidMonths,
    nextDueDate: nextDue,
    status: newStatus as any,
  }).where(eq(loansTable.id, loanId));

  res.status(201).json(RecordPaymentResponse.parse(serializePayment(payment)));
});

// DELETE /admin/payments/:id
router.delete("/admin/payments/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(paymentsTable).where(eq(paymentsTable.id, id));
  res.status(204).send();
});

export default router;
