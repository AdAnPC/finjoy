import { createHash } from "node:crypto";
import { Router, type IRouter } from "express";
import { asc, desc, eq } from "drizzle-orm";
import { db, apkVersionsTable } from "@workspace/db";
import {
  getApkStorageProvider,
  ObjectNotFoundError,
  ObjectStorageConfigurationError,
} from "../../lib/apkStorage";

const router: IRouter = Router();
const MAX_APK_BYTES = 100 * 1024 * 1024;
const APK_CONTENT_TYPES = new Set([
  "application/vnd.android.package-archive",
  "application/octet-stream",
]);
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;

function serializeVersion(version: typeof apkVersionsTable.$inferSelect) {
  return {
    ...version,
    createdAt: version.createdAt.toISOString(),
    publishedAt: version.publishedAt?.toISOString() ?? null,
  };
}

async function getDistribution() {
  const versions = await db
    .select()
    .from(apkVersionsTable)
    .orderBy(desc(apkVersionsTable.createdAt));
  const active = versions.find((version) => version.status === "active");
  return {
    available: Boolean(active),
    current: active ? serializeVersion(active) : null,
    versions: versions.map(serializeVersion),
  };
}

function isValidUploadMetadata(body: unknown): body is {
  fileName: string;
  size: number;
  contentType: string;
  version: string;
} {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.fileName === "string" &&
    candidate.fileName.toLowerCase().endsWith(".apk") &&
    typeof candidate.size === "number" &&
    Number.isInteger(candidate.size) &&
    candidate.size > 0 &&
    candidate.size <= MAX_APK_BYTES &&
    typeof candidate.contentType === "string" &&
    APK_CONTENT_TYPES.has(candidate.contentType) &&
    typeof candidate.version === "string" &&
    VERSION_PATTERN.test(candidate.version)
  );
}

function isUploadPath(objectPath: string): boolean {
  return (
    objectPath.startsWith("/objects/uploads/") &&
    objectPath.length > "/objects/uploads/".length &&
    !objectPath.includes("..")
  );
}

router.get("/admin/apk", async (req, res): Promise<void> => {
  try {
    res.json(await getDistribution());
  } catch (error) {
    req.log.error({ err: error }, "Failed to load APK distribution");
    res.status(500).json({ error: "No se pudo cargar el estado de la APK" });
  }
});

router.get("/admin/apk/download", async (req, res): Promise<void> => {
  try {
    const [active] = await db
      .select()
      .from(apkVersionsTable)
      .where(eq(apkVersionsTable.status, "active"))
      .orderBy(desc(apkVersionsTable.publishedAt), asc(apkVersionsTable.id))
      .limit(1);
    if (!active) {
      res.status(404).json({ error: "No APK has been published yet" });
      return;
    }
    const storage = getApkStorageProvider();
    const file = await storage.getObjectEntityFile(active.objectPath);
    const response = await storage.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      const stream = (await import("node:stream")).Readable.fromWeb(
        response.body as ReadableStream<Uint8Array>,
      );
      stream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Failed to download active APK");
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "The published APK object no longer exists" });
      return;
    }
    if (error instanceof ObjectStorageConfigurationError) {
      res.status(503).json({ error: "El almacenamiento de APK no está configurado" });
      return;
    }
    res.status(500).json({ error: "No se pudo descargar la APK" });
  }
});

router.post("/admin/apk/upload-url", async (req, res): Promise<void> => {
  if (!isValidUploadMetadata(req.body)) {
    res.status(400).json({ error: "Nombre, versión, tamaño o tipo de APK inválido" });
    return;
  }
  try {
    const uploadTarget = await getApkStorageProvider().createUploadTarget();
    res.json({ ...uploadTarget, version: req.body.version });
  } catch (error) {
    req.log.error({ err: error }, "Failed to create APK upload URL");
    if (error instanceof ObjectStorageConfigurationError) {
      res.status(503).json({ error: "El almacenamiento de APK no está configurado" });
      return;
    }
    res.status(500).json({ error: "No se pudo preparar la subida" });
  }
});

router.post("/admin/apk/versions", async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown> | undefined;
  const objectPath = typeof body?.objectPath === "string" ? body.objectPath : null;
  if (
    !isValidUploadMetadata(body) ||
    !objectPath ||
    !isUploadPath(objectPath)
  ) {
    res.status(400).json({ error: "Datos de subida de APK inválidos" });
    return;
  }

  try {
    const [duplicate] = await db
      .select({ id: apkVersionsTable.id })
      .from(apkVersionsTable)
      .where(eq(apkVersionsTable.version, body.version))
      .limit(1);
    if (duplicate) {
      res.status(409).json({ error: "La versión ya está registrada" });
      return;
    }

    const file = await getApkStorageProvider().getObjectEntityFile(objectPath);
    const [metadata] = await file.getMetadata();
    const actualSize = Number(metadata.size ?? 0);
    const actualType = String(metadata.contentType ?? "");
    if (actualSize !== body.size || actualSize > MAX_APK_BYTES) {
      await file.delete().catch((error) => req.log.warn({ err: error }, "Failed to clean invalid APK"));
      res.status(400).json({ error: "El tamaño del archivo no coincide o excede el límite" });
      return;
    }
    if (!APK_CONTENT_TYPES.has(actualType)) {
      await file.delete().catch((error) => req.log.warn({ err: error }, "Failed to clean invalid APK"));
      res.status(400).json({ error: "El tipo MIME del objeto no es una APK válida" });
      return;
    }

    const [bytes] = await file.download();
    if (bytes.length < 4 || bytes.readUInt32LE(0) !== 0x04034b50) {
      await file.delete().catch((error) => req.log.warn({ err: error }, "Failed to clean invalid APK"));
      res.status(400).json({ error: "El archivo no tiene una firma APK/ZIP válida" });
      return;
    }

    const checksum = createHash("sha256").update(bytes).digest("hex");
    const [version] = await db
      .insert(apkVersionsTable)
      .values({
        version: body.version,
        fileName: body.fileName,
        objectPath,
        size: actualSize,
        contentType: actualType,
        checksum,
        status: "pending",
      })
      .returning();
    res.status(201).json(serializeVersion(version));
  } catch (error) {
    req.log.error({ err: error }, "Failed to register APK version");
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "La APK subida no existe o expiró" });
      return;
    }
    if (error instanceof ObjectStorageConfigurationError) {
      res.status(503).json({ error: "El almacenamiento de APK no está configurado" });
      return;
    }
    res.status(500).json({ error: "No se pudo validar la APK" });
  }
});

router.post("/admin/apk/versions/:id/activate", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Identificador de versión inválido" });
    return;
  }

  try {
    const distribution = await db.transaction(async (tx) => {
      const [selected] = await tx
        .select()
        .from(apkVersionsTable)
        .where(eq(apkVersionsTable.id, id))
        .limit(1);
      if (!selected) return null;
      if (selected.status !== "pending") return { invalidState: true };

      await getApkStorageProvider().getObjectEntityFile(selected.objectPath);
      await tx
        .update(apkVersionsTable)
        .set({ status: "archived" })
        .where(eq(apkVersionsTable.status, "active"));
      await tx
        .update(apkVersionsTable)
        .set({ status: "active", publishedAt: new Date() })
        .where(eq(apkVersionsTable.id, selected.id));
      return { ok: true };
    });

    if (!distribution) {
      res.status(404).json({ error: "Versión no encontrada" });
      return;
    }
    if ("invalidState" in distribution) {
      res.status(409).json({ error: "Solo se pueden activar versiones pendientes" });
      return;
    }
    res.json(await getDistribution());
  } catch (error) {
    req.log.error({ err: error }, "Failed to activate APK version");
    if (error instanceof ObjectNotFoundError) {
      res.status(409).json({ error: "La APK de esta versión ya no existe en almacenamiento" });
      return;
    }
    if (error instanceof ObjectStorageConfigurationError) {
      res.status(503).json({ error: "El almacenamiento de APK no está configurado" });
      return;
    }
    res.status(500).json({ error: "No se pudo activar la versión" });
  }
});

export default router;