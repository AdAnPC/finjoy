import { createHash, timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";

const router: IRouter = Router();

export function adminAuthStatus() {
  const key = process.env.ADMIN_API_KEY?.trim() ?? "";
  return {
    required: process.env.NODE_ENV === "production" || key.length > 0,
    configured: key.length >= 32,
  };
}

router.get("/admin/auth/status", (_req, res): void => {
  res.json(adminAuthStatus());
});

router.post("/admin/auth/verify", (req, res): void => {
  const status = adminAuthStatus();
  if (!status.required) {
    res.json({ valid: true });
    return;
  }
  if (!status.configured) {
    res.status(503).json({ error: "ADMIN_API_KEY debe tener al menos 32 caracteres" });
    return;
  }

  const suppliedKey = readBearerToken(req);
  const expectedKey = process.env.ADMIN_API_KEY?.trim() ?? "";
  if (!suppliedKey || !constantTimeMatches(suppliedKey, expectedKey)) {
    res.status(401).json({ error: "Clave administrativa inválida" });
    return;
  }
  res.json({ valid: true });
});

export function requireAdminApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const status = adminAuthStatus();
  if (!status.required) {
    next();
    return;
  }
  if (!status.configured) {
    res.status(503).json({ error: "Configura ADMIN_API_KEY con al menos 32 caracteres" });
    return;
  }

  const suppliedKey = readBearerToken(req);
  const expectedKey = process.env.ADMIN_API_KEY?.trim() ?? "";
  if (!suppliedKey || !constantTimeMatches(suppliedKey, expectedKey)) {
    res.status(401).json({ error: "Autenticación administrativa requerida" });
    return;
  }
  next();
}

function readBearerToken(req: Request): string | null {
  const value = req.header("authorization");
  if (!value?.startsWith("Bearer ")) return null;
  const token = value.slice("Bearer ".length).trim();
  return token || null;
}

function constantTimeMatches(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export default router;
