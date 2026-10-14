import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, clientsTable, loansTable, paymentsTable } from "@workspace/db";
import {
  CreateLoanBody,
  UpdateLoanBody,
  GetLoanParams,
  UpdateLoanParams,
  DeleteLoanParams,
  LockDeviceParams,
  UnlockDeviceParams,
  ListLoansQueryParams,
  CreateLoanResponse,
  UpdateLoanResponse,
  GetLoanResponse,
  ListLoansResponse,
  LockDeviceResponse,
  UnlockDeviceResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeLoan(loan: any) {
  return {
    ...loan,
    totalAmount: Number(loan.totalAmount),
    paidAmount: Number(loan.paidAmount),
    monthlyPayment: Number(loan.monthlyPayment),
    nextDueDate: loan.nextDueDate instanceof Date ? loan.nextDueDate.toISOString() : loan.nextDueDate,
    startDate: loan.startDate instanceof Date ? loan.startDate.toISOString() : loan.startDate,
    createdAt: loan.createdAt instanceof Date ? loan.createdAt.toISOString() : loan.createdAt,
  };
}

function serializeClient(client: any) {
  return {
    ...client,
    createdAt: client.createdAt instanceof Date ? client.createdAt.toISOString() : client.createdAt,
  };
}

// GET /admin/loans
router.get("/admin/loans", async (req, res): Promise<void> => {
  const query = ListLoansQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const { status, clientId } = query.data;

  const loans = await db.select().from(loansTable).orderBy(loansTable.createdAt);

  const results = await Promise.all(
    loans
      .filter((l) => (!status || status === "all" || l.status === status) && (!clientId || l.clientId === clientId))
      .map(async (l) => {
        const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, l.clientId));
        return { ...serializeLoan(l), client: client ? serializeClient(client) : undefined };
      })
  );

  res.json(ListLoansResponse.parse(results));
});

// POST /admin/loans
router.post("/admin/loans", async (req, res): Promise<void> => {
  const body = CreateLoanBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const { clientId, deviceModel, deviceImei, totalAmount, monthlyPayment, startDate, totalMonths, gracePeriodDays } = body.data;

  const start = new Date(startDate as string);
  const nextDue = new Date(start);
  nextDue.setMonth(nextDue.getMonth() + 1);

  const [loan] = await db.insert(loansTable).values({
    clientId,
    deviceModel,
    deviceImei: deviceImei ?? null,
    totalAmount: String(totalAmount),
    paidAmount: "0",
    monthlyPayment: String(monthlyPayment),
    nextDueDate: nextDue,
    startDate: start,
    totalMonths,
    paidMonths: 0,
    gracePeriodDays: gracePeriodDays ?? 3,
    status: "active",
  }).returning();

  res.status(201).json(CreateLoanResponse.parse(serializeLoan(loan)));
});

// GET /admin/loans/:id
router.get("/admin/loans/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, id));
  if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, loan.clientId));
  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.loanId, id)).orderBy(paymentsTable.date);

  res.json(GetLoanResponse.parse({
    ...serializeLoan(loan),
    client: client ? serializeClient(client) : undefined,
    payments: payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
      date: p.date.toISOString(),
      createdAt: p.createdAt.toISOString(),
    })),
  }));
});

// PATCH /admin/loans/:id
router.patch("/admin/loans/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = UpdateLoanBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const updateData: Record<string, any> = {};
  if (body.data.deviceModel) updateData.deviceModel = body.data.deviceModel;
  if (body.data.deviceImei !== undefined) updateData.deviceImei = body.data.deviceImei;
  if (body.data.totalAmount !== undefined) updateData.totalAmount = String(body.data.totalAmount);
  if (body.data.monthlyPayment !== undefined) updateData.monthlyPayment = String(body.data.monthlyPayment);
  if (body.data.paidAmount !== undefined) updateData.paidAmount = String(body.data.paidAmount);
  if (body.data.nextDueDate) updateData.nextDueDate = new Date(body.data.nextDueDate);
  if (body.data.status) updateData.status = body.data.status;
  if (body.data.paidMonths !== undefined) updateData.paidMonths = body.data.paidMonths;
  if (body.data.gracePeriodDays !== undefined) updateData.gracePeriodDays = body.data.gracePeriodDays;

  const [loan] = await db.update(loansTable).set(updateData).where(eq(loansTable.id, id)).returning();
  if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }

  res.json(UpdateLoanResponse.parse(serializeLoan(loan)));
});

// DELETE /admin/loans/:id
router.delete("/admin/loans/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(loansTable).where(eq(loansTable.id, id));
  res.status(204).send();
});

// POST /admin/loans/:id/lock
router.post("/admin/loans/:id/lock", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [loan] = await db.update(loansTable).set({ status: "locked" }).where(eq(loansTable.id, id)).returning();
  if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }

  res.json(LockDeviceResponse.parse(serializeLoan(loan)));
});

// POST /admin/loans/:id/unlock
router.post("/admin/loans/:id/unlock", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [loan] = await db.update(loansTable).set({ status: "active" }).where(eq(loansTable.id, id)).returning();
  if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }

  res.json(UnlockDeviceResponse.parse(serializeLoan(loan)));
});

export default router;
