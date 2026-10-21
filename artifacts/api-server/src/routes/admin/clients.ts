import { Router, type IRouter } from "express";
import { eq, ilike, inArray, or } from "drizzle-orm";
import { db, clientsTable, loansTable, paymentsTable, type Loan } from "@workspace/db";
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
  const loans =
    clientIds.length > 0
      ? await db
          .select()
          .from(loansTable)
          .where(inArray(loansTable.clientId, clientIds))
          .orderBy(loansTable.createdAt)
      : [];

  const loanByClientId = new Map<number, Loan>();
  for (const loan of loans) {
    if (!loanByClientId.has(loan.clientId)) {
      loanByClientId.set(loan.clientId, loan);
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

  res.json(ListClientsResponse.parse(filtered));
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

  const [rawLoan] = await db
    .select()
    .from(loansTable)
    .where(eq(loansTable.clientId, id))
    .limit(1);
  const loan = rawLoan ? await syncSingleLoanStatus(rawLoan) : undefined;
  const payments = loan
    ? await db
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.loanId, loan.id))
        .orderBy(paymentsTable.date)
    : [];

  res.json(
    GetClientResponse.parse({
      ...serializeClient(client),
      loan: loan ? serializeLoan(loan) : undefined,
      payments: payments.map(serializePayment),
    }),
  );
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
