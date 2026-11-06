import { Router, type IRouter } from "express";
import { desc, eq, ilike, inArray, or } from "drizzle-orm";
import {
  clientAccountsTable,
  clientsTable,
  customerDevicesTable,
  db,
  loansTable,
  paymentsTable,
  type CustomerDevice,
  type Loan,
} from "@workspace/db";
import {
  CreateClientBody,
  UpdateClientBody,
  ListClientsQueryParams,
  CreateClientResponse,
  UpdateClientResponse,
  GetClientResponse,
  ListClientsResponse,
} from "@workspace/api-zod";
import { parsePositiveIntParam } from "../../lib/http";
import { syncAllLoanStatuses, syncSingleLoanStatus } from "../../lib/loanStatus";
import {
  serializeClient,
  serializeLoan,
  serializePayment,
} from "../../lib/serializers";

const router: IRouter = Router();

function serializeCustomerDevice(device: CustomerDevice) {
  return {
    id: device.id,
    clientId: device.clientId,
    loanId: device.loanId,
    deviceIdHash: device.deviceIdHash,
    manufacturer: device.manufacturer,
    model: device.model,
    osVersion: device.osVersion,
    deviceAdminActive: device.deviceAdminActive,
    deviceOwner: device.deviceOwner,
    latitude: device.latitude ?? null,
    longitude: device.longitude ?? null,
    locationAccuracy: device.locationAccuracy ?? null,
    locationUpdatedAt: device.locationUpdatedAt
      ? device.locationUpdatedAt.toISOString()
      : null,
    lastSeenAt: device.lastSeenAt.toISOString(),
    firstSeenAt: device.firstSeenAt.toISOString(),
  };
}

// GET /admin/clients
router.get("/admin/clients", async (req, res): Promise<void> => {
  const query = ListClientsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { search, status } = query.data;
  const trimmedSearch = search?.trim();

  await syncAllLoanStatuses();

  const clients = await db
    .select()
    .from(clientsTable)
    .where(
      trimmedSearch
        ? or(
            ilike(clientsTable.name, `%${trimmedSearch}%`),
            ilike(clientsTable.phone, `%${trimmedSearch}%`),
          )
        : undefined,
    )
    .orderBy(clientsTable.createdAt);

  const clientIds = clients.map((c) => c.id);
  const [loans, devices] =
    clientIds.length > 0
      ? await Promise.all([
          db
            .select()
            .from(loansTable)
            .where(inArray(loansTable.clientId, clientIds))
            .orderBy(loansTable.createdAt),
          db
            .select()
            .from(customerDevicesTable)
            .where(inArray(customerDevicesTable.clientId, clientIds))
            .orderBy(desc(customerDevicesTable.lastSeenAt)),
        ])
      : [[], []];

  const loanByClientId = new Map<number, Loan>();
  for (const loan of loans) {
    if (!loanByClientId.has(loan.clientId)) {
      loanByClientId.set(loan.clientId, loan);
    }
  }

  const deviceByClientId = new Map<number, CustomerDevice>();
  for (const device of devices) {
    if (!deviceByClientId.has(device.clientId)) {
      deviceByClientId.set(device.clientId, device);
    }
  }

  const results = clients.map((client) => {
    const loan = loanByClientId.get(client.id);
    return {
      ...serializeClient(client),
      loan: loan ? serializeLoan(loan) : undefined,
    };
  });

  const filtered =
    status && status !== "all"
      ? results.filter((r) => r.loan?.status === status)
      : results;

  const parsed = ListClientsResponse.parse(filtered);
  res.json(
    parsed.map((item) => {
      const device = deviceByClientId.get(item.id);
      return {
        ...item,
        device: device ? serializeCustomerDevice(device) : null,
      };
    }),
  );
});

// POST /admin/clients
router.post("/admin/clients", async (req, res): Promise<void> => {
  const body = CreateClientBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [client] = await db.insert(clientsTable).values(body.data).returning();
  res.status(201).json(CreateClientResponse.parse(serializeClient(client)));
});

// GET /admin/clients/:id
router.get("/admin/clients/:id", async (req, res): Promise<void> => {
  const id = parsePositiveIntParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [client] = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, id));
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  const [rawLoans, devices, accounts] = await Promise.all([
    db.select().from(loansTable).where(eq(loansTable.clientId, id)).limit(1),
    db
      .select()
      .from(customerDevicesTable)
      .where(eq(customerDevicesTable.clientId, id))
      .orderBy(desc(customerDevicesTable.lastSeenAt))
      .limit(1),
    db
      .select({ activatedAt: clientAccountsTable.activatedAt })
      .from(clientAccountsTable)
      .where(eq(clientAccountsTable.clientId, id))
      .limit(1),
  ]);

  let rawLoan = rawLoans[0];
  const device = devices[0];
  const account = accounts[0];

  if (!rawLoan && device) {
    const now = new Date();
    const nextDueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const fullModel = [device.manufacturer, device.model]
      .filter(Boolean)
      .join(" ")
      .slice(0, 160);
    const [createdLoan] = await db
      .insert(loansTable)
      .values({
        clientId: id,
        deviceModel: fullModel || device.model,
        deviceImei: device.deviceIdHash.slice(0, 15).toUpperCase(),
        totalAmount: "600.00",
        paidAmount: "0.00",
        monthlyPayment: "50.00",
        nextDueDate,
        startDate: now,
        totalMonths: 12,
        paidMonths: 0,
        gracePeriodDays: 3,
        status: "active",
      })
      .returning();
    rawLoan = createdLoan;
    await db
      .update(customerDevicesTable)
      .set({ loanId: createdLoan.id })
      .where(eq(customerDevicesTable.id, device.id));
  }

  const loan = rawLoan ? await syncSingleLoanStatus(rawLoan) : undefined;
  const payments = loan
    ? await db
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.loanId, loan.id))
        .orderBy(paymentsTable.date)
    : [];

  const parsed = GetClientResponse.parse({
    ...serializeClient(client),
    loan: loan ? serializeLoan(loan) : undefined,
    payments: payments.map(serializePayment),
  });

  res.json({
    ...parsed,
    accountActivatedAt: account?.activatedAt
      ? account.activatedAt.toISOString()
      : null,
    device: device ? serializeCustomerDevice(device) : null,
  });
});

// PATCH /admin/clients/:id
router.patch("/admin/clients/:id", async (req, res): Promise<void> => {
  const id = parsePositiveIntParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const body = UpdateClientBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [client] = await db
    .update(clientsTable)
    .set(body.data)
    .where(eq(clientsTable.id, id))
    .returning();
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  res.json(UpdateClientResponse.parse(serializeClient(client)));
});

// DELETE /admin/clients/:id
router.delete("/admin/clients/:id", async (req, res): Promise<void> => {
  const id = parsePositiveIntParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  await db.delete(clientsTable).where(eq(clientsTable.id, id));
  res.status(204).send();
});

export default router;
