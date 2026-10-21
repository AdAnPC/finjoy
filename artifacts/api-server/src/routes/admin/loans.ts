import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, type SQL } from "drizzle-orm";
import { db, clientsTable, customerDevicesTable, loansTable, paymentsTable, type Loan } from "@workspace/db";
import {
  CreateLoanBody,
  UpdateLoanBody,
  ListLoansQueryParams,
  CreateLoanResponse,
  UpdateLoanResponse,
  GetLoanResponse,
  ListLoansResponse,
  LockDeviceResponse,
  UnlockDeviceResponse,
} from "@workspace/api-zod";
import { parsePositiveIntParam } from "../../lib/http";
import {
  computeAutomaticLoanStatus,
  getDaysUntilDue,
  syncAllLoanStatuses,
  syncSingleLoanStatus,
} from "../../lib/loanStatus";
import {
  serializeClient,
  serializeLoan,
  serializePayment,
} from "../../lib/serializers";

const router: IRouter = Router();

// GET /admin/loans
router.get("/admin/loans", async (req, res): Promise<void> => {
  const query = ListLoansQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { status, clientId } = query.data;

  await syncAllLoanStatuses();

  const filters: SQL[] = [];
  if (status && status !== "all") {
    filters.push(eq(loansTable.status, status as Loan["status"]));
  }
  if (clientId) {
    filters.push(eq(loansTable.clientId, clientId));
  }

  const rows = await db
    .select({
      loan: loansTable,
      client: clientsTable,
    })
    .from(loansTable)
    .leftJoin(clientsTable, eq(loansTable.clientId, clientsTable.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(loansTable.createdAt);

  const results = rows.map(({ loan, client }) => ({
    ...serializeLoan(loan),
    client: client ? serializeClient(client) : undefined,
  }));

  res.json(ListLoansResponse.parse(results));
});

// POST /admin/loans
router.post("/admin/loans", async (req, res): Promise<void> => {
  const body = CreateLoanBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const {
    clientId,
    deviceModel,
    deviceImei,
    totalAmount,
    monthlyPayment,
    startDate,
    totalMonths,
    gracePeriodDays,
  } = body.data;

  const start = new Date(startDate as string);
  const nextDue = new Date(start);
  nextDue.setMonth(nextDue.getMonth() + 1);
  const resolvedGraceDays = gracePeriodDays ?? 3;
  const initialStatus = computeAutomaticLoanStatus({
    status: "active",
    nextDueDate: nextDue,
    gracePeriodDays: resolvedGraceDays,
    paidAmount: "0",
    totalAmount: String(totalAmount),
    paidMonths: 0,
    totalMonths,
  });

  const [loan] = await db
    .insert(loansTable)
    .values({
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
      gracePeriodDays: resolvedGraceDays,
      status: initialStatus,
    })
    .returning();

  res.status(201).json(CreateLoanResponse.parse(serializeLoan(loan)));
});

// GET /admin/loans/:id
router.get("/admin/loans/:id", async (req, res): Promise<void> => {
  const id = parsePositiveIntParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [row] = await db
    .select({
      loan: loansTable,
      client: clientsTable,
    })
    .from(loansTable)
    .leftJoin(clientsTable, eq(loansTable.clientId, clientsTable.id))
    .where(eq(loansTable.id, id))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Loan not found" });
    return;
  }

  const syncedLoan = await syncSingleLoanStatus(row.loan);

  const payments = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.loanId, id))
    .orderBy(paymentsTable.date);

  let device: {
    manufacturer: string | null;
    model: string;
    osVersion: string | null;
    deviceAdminActive: boolean;
    deviceOwner: boolean;
    firstSeenAt: Date;
    lastSeenAt: Date;
  } | undefined;
  try {
    [device] = await db
      .select({
        manufacturer: customerDevicesTable.manufacturer,
        model: customerDevicesTable.model,
        osVersion: customerDevicesTable.osVersion,
        deviceAdminActive: customerDevicesTable.deviceAdminActive,
        deviceOwner: customerDevicesTable.deviceOwner,
        firstSeenAt: customerDevicesTable.firstSeenAt,
        lastSeenAt: customerDevicesTable.lastSeenAt,
      })
      .from(customerDevicesTable)
      .where(eq(customerDevicesTable.loanId, id))
      .limit(1);
  } catch (error) {
    if ((error as { code?: string })?.code !== "42P01") throw error;
    req.log.warn("Customer device table is not migrated yet");
  }

  res.json(
    GetLoanResponse.parse({
      ...serializeLoan(syncedLoan),
      client: row.client ? serializeClient(row.client) : undefined,
      payments: payments.map(serializePayment),
      deviceEnrollment: device
        ? {
            ...device,
            firstSeenAt: device.firstSeenAt.toISOString(),
            lastSeenAt: device.lastSeenAt.toISOString(),
          }
        : null,
    }),
  );
});

// PATCH /admin/loans/:id
router.patch("/admin/loans/:id", async (req, res): Promise<void> => {
  const id = parsePositiveIntParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const body = UpdateLoanBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updateData: Partial<typeof loansTable.$inferInsert> = {};
  if (body.data.deviceModel) updateData.deviceModel = body.data.deviceModel;
  if (body.data.deviceImei !== undefined) updateData.deviceImei = body.data.deviceImei;
  if (body.data.totalAmount !== undefined) updateData.totalAmount = String(body.data.totalAmount);
  if (body.data.monthlyPayment !== undefined) updateData.monthlyPayment = String(body.data.monthlyPayment);
  if (body.data.paidAmount !== undefined) updateData.paidAmount = String(body.data.paidAmount);
  if (body.data.nextDueDate) updateData.nextDueDate = new Date(body.data.nextDueDate);
  if (body.data.status) updateData.status = body.data.status;
  if (body.data.paidMonths !== undefined) updateData.paidMonths = body.data.paidMonths;
  if (body.data.gracePeriodDays !== undefined) updateData.gracePeriodDays = body.data.gracePeriodDays;

  const [loan] = await db
    .update(loansTable)
    .set(updateData)
    .where(eq(loansTable.id, id))
    .returning();
  if (!loan) {
    res.status(404).json({ error: "Loan not found" });
    return;
  }

  res.json(UpdateLoanResponse.parse(serializeLoan(loan)));
});

// DELETE /admin/loans/:id
router.delete("/admin/loans/:id", async (req, res): Promise<void> => {
  const id = parsePositiveIntParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  await db.delete(loansTable).where(eq(loansTable.id, id));
  res.status(204).send();
});

async function updateDeviceLockState(
  req: Request,
  res: Response,
  targetStatus: "locked" | "active",
): Promise<void> {
  const id = parsePositiveIntParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [existing] = await db
    .select()
    .from(loansTable)
    .where(eq(loansTable.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Loan not found" });
    return;
  }

  const updateFields: Partial<typeof loansTable.$inferInsert> = {
    status: targetStatus,
  };

  if (targetStatus === "active" && getDaysUntilDue(existing.nextDueDate) <= 0) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    updateFields.nextDueDate = tomorrow;
    updateFields.status = "due_soon";
  }

  const [loan] = await db
    .update(loansTable)
    .set(updateFields)
    .where(eq(loansTable.id, id))
    .returning();

  const parser = targetStatus === "locked" ? LockDeviceResponse : UnlockDeviceResponse;
  res.json(parser.parse(serializeLoan(loan)));
}

// POST /admin/loans/:id/lock
router.post("/admin/loans/:id/lock", async (req, res): Promise<void> => {
  await updateDeviceLockState(req, res, "locked");
});

// POST /admin/loans/:id/unlock
router.post("/admin/loans/:id/unlock", async (req, res): Promise<void> => {
  await updateDeviceLockState(req, res, "active");
});

export default router;
