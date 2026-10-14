import {
  createHash,
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
  customerSessionsTable,
  db,
  loansTable,
  paymentsTable,
} from "@workspace/db";

const router: IRouter = Router();
const scryptAsync = promisify(scrypt);
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const ACTIVATE_LIMIT = { max: 5, windowMs: 15 * 60 * 1000 };
const LOGIN_LIMIT = { max: 10, windowMs: 15 * 60 * 1000 };
const requestCounts = new Map<string, { count: number; resetsAt: number }>();

router.post("/customer/auth/activate", async (req, res): Promise<void> => {
  if (isRateLimited(req.ip ?? "unknown", "activate", ACTIVATE_LIMIT)) {
    res.status(429).json({ error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." });
    return;
  }
  const body = req.body as { code?: unknown; password?: unknown } | undefined;
  if (
    typeof body?.code !== "string" ||
    body.code.trim().length < 8 ||
    body.code.trim().length > 16 ||
    typeof body.password !== "string" ||
    body.password.length < 10 ||
    body.password.length > 128
  ) {
    res.status(400).json({ error: "Código o contraseña inválidos" });
    return;
  }

  try {
    const codeHash = hashToken(body.code.replace(/[\s-]/g, "").toUpperCase());
    const passwordHash = await hashPassword(body.password);
    const now = new Date();
    const token = createSessionToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

    const clientId = await db.transaction(async (tx) => {
      const [account] = await tx
        .select({ clientId: clientAccountsTable.clientId })
        .from(clientAccountsTable)
        .where(
          and(
            eq(clientAccountsTable.activationCodeHash, codeHash),
            gt(clientAccountsTable.activationCodeExpiresAt, now),
          ),
        )
        .limit(1);
      if (!account) return null;

      const [activated] = await tx
        .update(clientAccountsTable)
        .set({
          passwordHash,
          activationCodeHash: null,
          activationCodeExpiresAt: null,
          activatedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(clientAccountsTable.clientId, account.clientId),
            eq(clientAccountsTable.activationCodeHash, codeHash),
            gt(clientAccountsTable.activationCodeExpiresAt, now),
          ),
        )
        .returning({ clientId: clientAccountsTable.clientId });
      if (!activated) return null;

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
      res.status(400).json({ error: "Código inválido, vencido o ya utilizado" });
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
  if (
    typeof body?.phone !== "string" ||
    body.phone.trim().length < 5 ||
    body.phone.trim().length > 32 ||
    typeof body.password !== "string" ||
    body.password.length < 1 ||
    body.password.length > 128
  ) {
    res.status(401).json({ error: "Teléfono o contraseña incorrectos" });
    return;
  }

  try {
    const normalizedPhone = normalizePhone(body.phone);
    if (normalizedPhone.length < 5) {
      res.status(401).json({ error: "Teléfono o contraseña incorrectos" });
      return;
    }
    const matches = await db
      .select({
        clientId: clientsTable.id,
        passwordHash: clientAccountsTable.passwordHash,
      })
      .from(clientsTable)
      .innerJoin(clientAccountsTable, eq(clientAccountsTable.clientId, clientsTable.id))
      .where(
        sql`regexp_replace(${clientsTable.phone}, '[^0-9]', '', 'g') = ${normalizedPhone}`,
      )
      .limit(2);

    if (
      matches.length !== 1 ||
      !matches[0].passwordHash ||
      !(await verifyPassword(body.password, matches[0].passwordHash))
    ) {
      res.status(401).json({ error: "Teléfono o contraseña incorrectos" });
      return;
    }

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
    await db
      .delete(customerSessionsTable)
      .where(
        and(
          eq(customerSessionsTable.clientId, matches[0].clientId),
          sql`${customerSessionsTable.expiresAt} <= now()`,
        ),
      );
    await db.insert(customerSessionsTable).values({
      clientId: matches[0].clientId,
      tokenHash: hashToken(token),
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
    const loan = loans.find((candidate) => candidate.status !== "completed") ?? loans[0] ?? null;
    const payments = loan
      ? await db
          .select()
          .from(paymentsTable)
          .where(eq(paymentsTable.loanId, loan.id))
          .orderBy(desc(paymentsTable.date))
      : [];

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
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to load customer account");
    res.status(500).json({ error: "No se pudo cargar la cuenta" });
  }
});

router.post("/customer/auth/logout", async (req, res): Promise<void> => {
  try {
    const token = readBearerToken(req);
    if (token) {
      await db
        .delete(customerSessionsTable)
        .where(eq(customerSessionsTable.tokenHash, hashToken(token)));
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
        eq(customerSessionsTable.tokenHash, hashToken(token)),
        gt(customerSessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return session ?? null;
}

function readBearerToken(req: { header(name: string): string | undefined }): string | null {
  const authorization = req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length).trim() || null;
}

function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
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
