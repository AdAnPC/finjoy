import { createHash, randomInt } from "node:crypto";
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  clientAccountsTable,
  clientsTable,
  customerSessionsTable,
  db,
} from "@workspace/db";

const router: IRouter = Router();
const activationAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const activationCodeLifetimeMs = 24 * 60 * 60 * 1000;

router.post("/admin/clients/:id/activation-code", async (req, res): Promise<void> => {
  const clientId = Number(req.params.id);
  const body = req.body as { confirmReset?: unknown } | undefined;
  if (
    !Number.isSafeInteger(clientId) ||
    clientId < 1 ||
    typeof body?.confirmReset !== "boolean"
  ) {
    res.status(400).json({ error: "Datos de activación inválidos" });
    return;
  }

  try {
    const [client] = await db
      .select({ id: clientsTable.id })
      .from(clientsTable)
      .where(eq(clientsTable.id, clientId))
      .limit(1);
    if (!client) {
      res.status(404).json({ error: "Cliente no encontrado" });
      return;
    }

    const [existingAccount] = await db
      .select({ passwordHash: clientAccountsTable.passwordHash })
      .from(clientAccountsTable)
      .where(eq(clientAccountsTable.clientId, clientId))
      .limit(1);
    if (existingAccount?.passwordHash && !body.confirmReset) {
      res.status(409).json({
        error: "La cuenta ya fue activada. Confirma el restablecimiento antes de emitir otro código.",
      });
      return;
    }

    const code = createActivationCode();
    const expiresAt = new Date(Date.now() + activationCodeLifetimeMs);
    const activationCodeHash = hashToken(code);

    await db.transaction(async (tx) => {
      await tx
        .insert(clientAccountsTable)
        .values({
          clientId,
          activationCodeHash,
          activationCodeExpiresAt: expiresAt,
          passwordHash: null,
          activatedAt: null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: clientAccountsTable.clientId,
          set: {
            activationCodeHash,
            activationCodeExpiresAt: expiresAt,
            passwordHash: null,
            activatedAt: null,
            updatedAt: new Date(),
          },
        });
      await tx
        .delete(customerSessionsTable)
        .where(eq(customerSessionsTable.clientId, clientId));
    });

    res.json({ code, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    req.log.error({ err: error }, "Failed to issue customer activation code");
    res.status(500).json({ error: "No se pudo emitir el código de acceso" });
  }
});

function createActivationCode(): string {
  let result = "";
  for (let index = 0; index < 10; index += 1) {
    result += activationAlphabet[randomInt(activationAlphabet.length)];
  }
  return result;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export default router;
