import { Router, type IRouter } from "express";
import { eq, ilike, and, or } from "drizzle-orm";
import { db, clientsTable, loansTable, paymentsTable } from "@workspace/db";
import {
  CreateClientBody,
  UpdateClientBody,
  GetClientParams,
  UpdateClientParams,
  DeleteClientParams,
  ListClientsQueryParams,
  CreateClientResponse,
  UpdateClientResponse,
  GetClientResponse,
  ListClientsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /admin/clients
router.get("/admin/clients", async (req, res): Promise<void> => {
  const query = ListClientsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { search, status } = query.data;

  const clients = await db.select().from(clientsTable).orderBy(clientsTable.createdAt);

  const results = await Promise.all(
    clients
      .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search))
      .map(async (c) => {
        const [loan] = await db
          .select()
          .from(loansTable)
          .where(eq(loansTable.clientId, c.id))
          .limit(1);
        return {
          ...c,
          createdAt: c.createdAt.toISOString(),
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

  const filtered = status && status !== "all"
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
  res.status(201).json(CreateClientResponse.parse({ ...client, createdAt: client.createdAt.toISOString() }));
});

// GET /admin/clients/:id
router.get("/admin/clients/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id));
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }

  const [loan] = await db.select().from(loansTable).where(eq(loansTable.clientId, id)).limit(1);
  const payments = loan
    ? await db.select().from(paymentsTable).where(eq(paymentsTable.loanId, loan.id)).orderBy(paymentsTable.date)
    : [];

  res.json(
    GetClientResponse.parse({
      ...client,
      createdAt: client.createdAt.toISOString(),
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
      payments: payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
        date: p.date.toISOString(),
        createdAt: p.createdAt.toISOString(),
      })),
    })
  );
});

// PATCH /admin/clients/:id
router.patch("/admin/clients/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = UpdateClientBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [client] = await db.update(clientsTable).set(body.data).where(eq(clientsTable.id, id)).returning();
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }

  res.json(UpdateClientResponse.parse({ ...client, createdAt: client.createdAt.toISOString() }));
});

// DELETE /admin/clients/:id
router.delete("/admin/clients/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(clientsTable).where(eq(clientsTable.id, id));
  res.status(204).send();
});

export default router;
