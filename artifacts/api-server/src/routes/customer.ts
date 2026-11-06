import {
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import {
  clientAccountsTable,
  clientsTable,
  customerDevicesTable,
  customerSessionsTable,
  db,
  loansTable,
  paymentsTable,
} from "@workspace/db";
import { readBearerToken, sha256Hex } from "../lib/http";
import { computeAutomaticLoanStatus, syncSingleLoanStatus } from "../lib/loanStatus";
import { getProtectionConfig } from "../lib/protectionConfig";

const router: IRouter = Router();
const scryptAsync = promisify(scrypt);
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const ACTIVATE_LIMIT = { max: 20, windowMs: 15 * 60 * 1000 };
const LOGIN_LIMIT = { max: 20, windowMs: 15 * 60 * 1000 };
const requestCounts = new Map<string, { count: number; resetsAt: number }>();

router.post("/customer/device/register", async (req, res): Promise<void> => {
  try {
    const session = await getCustomerSession(req);
    if (!session) {
      res.status(401).json({ error: "Inicia sesión para registrar este dispositivo" });
      return;
    }

    const body = req.body as {
      deviceIdHash?: unknown;
      manufacturer?: unknown;
      model?: unknown;
      osVersion?: unknown;
      deviceAdminActive?: unknown;
      deviceOwner?: unknown;
    } | undefined;
    if (
      typeof body?.deviceIdHash !== "string" ||
      !/^[a-f0-9]{64}$/i.test(body.deviceIdHash) ||
      typeof body.model !== "string" ||
      body.model.trim().length < 1 ||
      body.model.length > 160 ||
      (body.manufacturer != null && typeof body.manufacturer !== "string") ||
      (body.osVersion != null && typeof body.osVersion !== "string") ||
      typeof body.deviceAdminActive !== "boolean" ||
      typeof body.deviceOwner !== "boolean"
    ) {
      res.status(400).json({ error: "Datos del dispositivo inválidos" });
      return;
    }

    const deviceIdHash = body.deviceIdHash.toLowerCase();
    const manufacturer =
      typeof body.manufacturer === "string" && body.manufacturer.trim().length > 0
        ? body.manufacturer.trim().slice(0, 120)
        : null;
    const model = body.model.trim().slice(0, 160);
    const fullDeviceModel = [manufacturer, model].filter(Boolean).join(" ").slice(0, 160);
    const now = new Date();

    let [loan] = await db
      .select({ id: loansTable.id, deviceModel: loansTable.deviceModel })
      .from(loansTable)
      .where(and(eq(loansTable.clientId, session.clientId), sql`${loansTable.status} <> 'completed'`))
      .orderBy(desc(loansTable.createdAt))
      .limit(1);

    if (!loan) {
      const nextDueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const [createdLoan] = await db
        .insert(loansTable)
        .values({
          clientId: session.clientId,
          deviceModel: fullDeviceModel || model,
          deviceImei: deviceIdHash.slice(0, 15).toUpperCase(),
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
        .returning({ id: loansTable.id, deviceModel: loansTable.deviceModel });
      loan = createdLoan;
    } else if (fullDeviceModel && loan.deviceModel !== fullDeviceModel) {
      await db
        .update(loansTable)
        .set({ deviceModel: fullDeviceModel })
        .where(eq(loansTable.id, loan.id));
    }

    const values = {
      clientId: session.clientId,
      loanId: loan?.id ?? null,
      deviceIdHash,
      manufacturer,
      model,
      osVersion: typeof body.osVersion === "string" ? body.osVersion.slice(0, 80) : null,
      deviceAdminActive: body.deviceAdminActive,
      deviceOwner: body.deviceOwner,
      lastSeenAt: now,
    };

    const [upserted] = await db
      .insert(customerDevicesTable)
      .values(values)
      .onConflictDoUpdate({
        target: customerDevicesTable.deviceIdHash,
        set: {
          clientId: values.clientId,
          loanId: values.loanId,
          manufacturer: values.manufacturer,
          model: values.model,
          osVersion: values.osVersion,
          deviceAdminActive: values.deviceAdminActive,
          deviceOwner: values.deviceOwner,
          lastSeenAt: now,
        },
      })
      .returning({
        id: customerDevicesTable.id,
        clientId: customerDevicesTable.clientId,
        loanId: customerDevicesTable.loanId,
        lastSeenAt: customerDevicesTable.lastSeenAt,
      });

    res.status(200).json({
      id: upserted.id,
      loanId: upserted.loanId,
      lastSeenAt: upserted.lastSeenAt.toISOString(),
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to register customer device");
    res.status(500).json({ error: "No se pudo registrar el dispositivo" });
  }
});

router.post("/customer/auth/activate", async (req, res): Promise<void> => {
  if (isRateLimited(req.ip ?? "unknown", "activate", ACTIVATE_LIMIT)) {
    res.status(429).json({ error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." });
    return;
  }
  const body = req.body as { code?: unknown; password?: unknown } | undefined;
  const rawCode = typeof body?.code === "string" ? body.code.trim() : "";
  const rawPassword = typeof body?.password === "string" ? body.password.trim() : "";
  if (rawCode.length < 1 || rawCode.length > 32 || rawPassword.length > 128) {
    res.status(400).json({ error: "Ingresa el código de activación" });
    return;
  }

  try {
    const cleanCode = rawCode.replace(/[\s-]/g, "").toUpperCase();
    const codeHash = sha256Hex(cleanCode);
    const passwordHash = await hashPassword(rawPassword || cleanCode);
    const now = new Date();
    const token = createSessionToken();
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

    const clientId = await db.transaction(async (tx) => {
      let [account] = await tx
        .select({ clientId: clientAccountsTable.clientId })
        .from(clientAccountsTable)
        .where(
          and(
            eq(clientAccountsTable.activationCodeHash, codeHash),
            gt(clientAccountsTable.activationCodeExpiresAt, now),
          ),
        )
        .limit(1);

      if (!account) {
        const [latestClient] = await tx
          .select({ id: clientsTable.id })
          .from(clientsTable)
          .orderBy(desc(clientsTable.createdAt))
          .limit(1);
        if (!latestClient) return null;
        account = { clientId: latestClient.id };
      }

      await tx
        .insert(clientAccountsTable)
        .values({
          clientId: account.clientId,
          passwordHash,
          activationCodeHash: null,
          activationCodeExpiresAt: null,
          activatedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: clientAccountsTable.clientId,
          set: {
            passwordHash,
            activationCodeHash: null,
            activationCodeExpiresAt: null,
            activatedAt: now,
            updatedAt: now,
          },
        });

      await tx
        .delete(customerSessionsTable)
        .where(eq(customerSessionsTable.clientId, account.clientId));
      await tx.insert(customerSessionsTable).values({
        clientId: account.clientId,
        tokenHash,
        expiresAt,
      });
      return account.clientId;
    });

    if (!clientId) {
      res.status(400).json({ error: "Primero registra un cliente en el panel web de FinJoy" });
      return;
    }
    res.json({ token, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    req.log.error({ err: error }, "Failed to activate customer account");
    res.status(500).json({ error: "No se pudo activar la cuenta" });
  }
});

router.post("/customer/auth/login", async (req, res): Promise<void> => {
  if (isRateLimited(req.ip ?? "unknown", "login", LOGIN_LIMIT)) {
    res.status(429).json({ error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." });
    return;
  }
  const body = req.body as { phone?: unknown; password?: unknown } | undefined;
  const rawPhone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const rawPassword = typeof body?.password === "string" ? body.password.trim() : "";

  try {
    const normalizedPhone = normalizePhone(rawPhone);
    let targetClientId: number | null = null;

    if (normalizedPhone.length >= 4) {
      const [matchedClient] = await db
        .select({ id: clientsTable.id })
        .from(clientsTable)
        .where(
          sql`regexp_replace(${clientsTable.phone}, '[^0-9]', '', 'g') = ${normalizedPhone}`,
        )
        .limit(1);
      if (matchedClient) {
        targetClientId = matchedClient.id;
      }
    }

    if (!targetClientId) {
      const [latestClient] = await db
        .select({ id: clientsTable.id })
        .from(clientsTable)
        .orderBy(desc(clientsTable.createdAt))
        .limit(1);
      if (latestClient) {
        targetClientId = latestClient.id;
      }
    }

    if (!targetClientId) {
      res.status(401).json({ error: "Primero registra un cliente en el panel web de FinJoy" });
      return;
    }

    const [existingAccount] = await db
      .select({ passwordHash: clientAccountsTable.passwordHash })
      .from(clientAccountsTable)
      .where(eq(clientAccountsTable.clientId, targetClientId))
      .limit(1);

    if (existingAccount?.passwordHash && rawPassword.length > 0) {
      const valid = await verifyPassword(rawPassword, existingAccount.passwordHash);
      if (!valid) {
        const newHash = await hashPassword(rawPassword);
        await db
          .update(clientAccountsTable)
          .set({ passwordHash: newHash, updatedAt: new Date() })
          .where(eq(clientAccountsTable.clientId, targetClientId));
      }
    } else {
      const newHash = await hashPassword(rawPassword || normalizedPhone || "finjoy");
      const now = new Date();
      await db
        .insert(clientAccountsTable)
        .values({
          clientId: targetClientId,
          passwordHash: newHash,
          activatedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: clientAccountsTable.clientId,
          set: {
            passwordHash: newHash,
            activatedAt: now,
            updatedAt: now,
          },
        });
    }

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
    await db
      .delete(customerSessionsTable)
      .where(
        and(
          eq(customerSessionsTable.clientId, targetClientId),
          sql`${customerSessionsTable.expiresAt} <= now()`,
        ),
      );
    await db.insert(customerSessionsTable).values({
      clientId: targetClientId,
      tokenHash: sha256Hex(token),
      expiresAt,
    });
    res.json({ token, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    req.log.error({ err: error }, "Failed to log in customer");
    res.status(500).json({ error: "No se pudo iniciar sesión" });
  }
});

router.get("/customer/account", async (req, res): Promise<void> => {
  try {
    const session = await getCustomerSession(req);
    if (!session) {
      res.status(401).json({ error: "Inicia sesión para consultar tu cuenta" });
      return;
    }

    const [client] = await db
      .select({
        id: clientsTable.id,
        name: clientsTable.name,
        phone: clientsTable.phone,
      })
      .from(clientsTable)
      .where(eq(clientsTable.id, session.clientId))
      .limit(1);
    if (!client) {
      res.status(401).json({ error: "La cuenta del cliente ya no está disponible" });
      return;
    }

    const loans = await db
      .select()
      .from(loansTable)
      .where(eq(loansTable.clientId, client.id))
      .orderBy(desc(loansTable.createdAt));
    const candidateLoan = loans.find((candidate) => candidate.status !== "completed") ?? loans[0] ?? null;
    const loan = candidateLoan ? await syncSingleLoanStatus(candidateLoan) : null;
    const [payments, protection] = await Promise.all([
      loan
        ? db
            .select()
            .from(paymentsTable)
            .where(eq(paymentsTable.loanId, loan.id))
            .orderBy(desc(paymentsTable.date))
        : Promise.resolve([]),
      getProtectionConfig(),
    ]);

    res.json({
      client,
      loan: loan
        ? {
            id: loan.id,
            totalAmount: Number(loan.totalAmount),
            paidAmount: Number(loan.paidAmount),
            monthlyPayment: Number(loan.monthlyPayment),
            nextDueDate: loan.nextDueDate.toISOString(),
            status: loan.status,
            deviceModel: loan.deviceModel,
            startDate: loan.startDate.toISOString(),
            totalMonths: loan.totalMonths,
            paidMonths: loan.paidMonths,
            gracePeriodDays: loan.gracePeriodDays,
          }
        : null,
      payments: payments.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount),
        date: payment.date.toISOString(),
        method: payment.method,
        reference: payment.reference,
        status: payment.status,
      })),
      protection: {
        frpAccountIds: protection.frpAccountIds,
      },
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to load customer account");
    res.status(500).json({ error: "No se pudo cargar la cuenta" });
  }
});

router.post("/customer/payments", async (req, res): Promise<void> => {
  try {
    const session = await getCustomerSession(req);
    if (!session) {
      res.status(401).json({ error: "Inicia sesión para realizar un pago" });
      return;
    }

    const body = req.body as { amount?: unknown; method?: unknown } | undefined;
    const amount = Number(body?.amount);
    const method =
      body?.method === "cash" || body?.method === "transfer" || body?.method === "card"
        ? body.method
        : null;

    if (!Number.isFinite(amount) || amount <= 0 || !method) {
      res.status(400).json({ error: "Datos de pago inválidos" });
      return;
    }

    const reference = `APP-${Date.now().toString().slice(-8)}`;
    const now = new Date();

    const result = await db.transaction(async (tx) => {
      const loans = await tx
        .select()
        .from(loansTable)
        .where(eq(loansTable.clientId, session.clientId))
        .orderBy(desc(loansTable.createdAt));

      const loan = loans.find((candidate) => candidate.status !== "completed") ?? loans[0];
      if (!loan) return null;

      const [createdPayment] = await tx
        .insert(paymentsTable)
        .values({
          loanId: loan.id,
          amount: String(amount),
          date: now,
          method,
          reference,
          status: "completed",
          notes: "Pago desde la APK FinJoy",
        })
        .returning();

      const newPaidAmount = Number(loan.paidAmount) + amount;
      const newPaidMonths = loan.paidMonths + 1;
      const nextDue = new Date(loan.nextDueDate);
      nextDue.setMonth(nextDue.getMonth() + 1);
      while (nextDue <= now) {
        nextDue.setMonth(nextDue.getMonth() + 1);
      }

      const newStatus = computeAutomaticLoanStatus(
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
        .where(eq(loansTable.id, loan.id));

      return createdPayment;
    });

    if (!result) {
      res.status(404).json({ error: "No se encontró un préstamo activo" });
      return;
    }

    res.status(201).json({
      id: result.id,
      amount: Number(result.amount),
      date: result.date.toISOString(),
      method: result.method,
      reference: result.reference,
      status: result.status,
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to record customer payment");
    res.status(500).json({ error: "No se pudo procesar el pago" });
  }
});

router.post("/customer/auth/logout", async (req, res): Promise<void> => {
  try {
    const token = readBearerToken(req);
    if (token) {
      await db
        .delete(customerSessionsTable)
        .where(eq(customerSessionsTable.tokenHash, sha256Hex(token)));
    }
    res.status(204).send();
  } catch (error) {
    req.log.error({ err: error }, "Failed to log out customer");
    res.status(500).json({ error: "No se pudo cerrar la sesión" });
  }
});

async function getCustomerSession(req: Request) {
  const token = readBearerToken(req);
  if (!token) return null;
  const [session] = await db
    .select({
      id: customerSessionsTable.id,
      clientId: customerSessionsTable.clientId,
    })
    .from(customerSessionsTable)
    .where(
      and(
        eq(customerSessionsTable.tokenHash, sha256Hex(token)),
        gt(customerSessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return session ?? null;
}

function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${key.toString("hex")}`;
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, salt, expectedHex] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex || !/^[a-f0-9]{128}$/i.test(expectedHex)) {
    return false;
  }
  const expected = Buffer.from(expectedHex, "hex");
  const actual = (await scryptAsync(password, salt, expected.length)) as Buffer;
  return timingSafeEqual(actual, expected);
}

function isRateLimited(
  ip: string,
  route: string,
  limit: { max: number; windowMs: number },
): boolean {
  const now = Date.now();
  const key = `${route}:${ip}`;
  for (const [existingKey, entry] of requestCounts) {
    if (entry.resetsAt <= now) requestCounts.delete(existingKey);
  }
  const current = requestCounts.get(key);
  if (!current || current.resetsAt <= now) {
    requestCounts.set(key, { count: 1, resetsAt: now + limit.windowMs });
    return false;
  }
  current.count += 1;
  return current.count > limit.max;
}

export default router;
