import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Router, type IRouter, type Response } from "express";
import { asc, desc, eq } from "drizzle-orm";
import { db, apkVersionsTable } from "@workspace/db";
import {
  getApkStorageProvider,
  getLocalApkUploadDir,
  ObjectNotFoundError,
  ObjectStorageConfigurationError,
} from "../../lib/apkStorage";
import { parsePositiveIntParam, sha256Hex } from "../../lib/http";
import {
  getProtectionConfig,
  saveProtectionConfig,
} from "../../lib/protectionConfig";
import { serializeApkVersion } from "../../lib/serializers";

const router: IRouter = Router();
const MAX_APK_BYTES = 100 * 1024 * 1024;
const APK_CONTENT_TYPES = new Set([
  "application/vnd.android.package-archive",
  "application/octet-stream",
]);
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
const ZIP_MAGIC_HEADER = 0x04034b50;

async function getDistribution() {
  const versions = await db
    .select()
    .from(apkVersionsTable)
    .orderBy(desc(apkVersionsTable.createdAt));
  const active = versions.find((version) => version.status === "active");
  return {
    available: Boolean(active),
    current: active ? serializeApkVersion(active) : null,
    versions: versions.map(serializeApkVersion),
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

function respondStorageError(
  res: Response,
  error: unknown,
  fallbackMessage: string,
  notFoundOption?: { status: number; message: string },
): void {
  if (error instanceof ObjectNotFoundError && notFoundOption) {
    res.status(notFoundOption.status).json({ error: notFoundOption.message });
    return;
  }
  if (error instanceof ObjectStorageConfigurationError) {
    res.status(503).json({ error: "El almacenamiento de APK no está configurado" });
    return;
  }
  res.status(500).json({ error: fallbackMessage });
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
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Failed to download active APK");
    respondStorageError(res, error, "No se pudo descargar la APK", {
      status: 404,
      message: "The published APK object no longer exists",
    });
  }
});

router.put("/admin/apk/upload-file/:uploadId", async (req, res): Promise<void> => {
  const uploadId = req.params.uploadId;
  if (!uploadId || !/^[A-Za-z0-9-]+$/.test(uploadId)) {
    res.status(400).json({ error: "Upload ID inválido" });
    return;
  }
  try {
    const uploadDir = getLocalApkUploadDir();
    const filePath = path.join(uploadDir, `${uploadId}.apk`);
    const metaPath = path.join(uploadDir, `${uploadId}.json`);

    const contentType =
      req.headers["content-type"] || "application/vnd.android.package-archive";
    await fs.promises.writeFile(
      metaPath,
      JSON.stringify({ contentType }),
      "utf8",
    );

    const writeStream = fs.createWriteStream(filePath);
    await pipeline(req, writeStream);
    res.status(200).send("OK");
  } catch (error) {
    req.log.error({ err: error }, "Failed to save uploaded APK file");
    res.status(500).json({ error: "Error al guardar el archivo de la APK" });
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
    respondStorageError(res, error, "No se pudo preparar la subida");
  }
});

router.post("/admin/apk/versions", async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown> | undefined;
  const objectPath = typeof body?.objectPath === "string" ? body.objectPath : null;
  if (!isValidUploadMetadata(body) || !objectPath || !isUploadPath(objectPath)) {
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
    const cleanupInvalidFile = async () => {
      await file
        .delete()
        .catch((error) => req.log.warn({ err: error }, "Failed to clean invalid APK"));
    };

    const [metadata] = await file.getMetadata();
    const actualSize = Number(metadata.size ?? 0);
    const actualType = String(metadata.contentType ?? "");
    if (actualSize !== body.size || actualSize > MAX_APK_BYTES) {
      await cleanupInvalidFile();
      res.status(400).json({ error: "El tamaño del archivo no coincide o excede el límite" });
      return;
    }
    if (!APK_CONTENT_TYPES.has(actualType)) {
      await cleanupInvalidFile();
      res.status(400).json({ error: "El tipo MIME del objeto no es una APK válida" });
      return;
    }

    const [bytes] = await file.download();
    if (bytes.length < 4 || bytes.readUInt32LE(0) !== ZIP_MAGIC_HEADER) {
      await cleanupInvalidFile();
      res.status(400).json({ error: "El archivo no tiene una firma APK/ZIP válida" });
      return;
    }

    const checksum = sha256Hex(bytes);
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
    res.status(201).json(serializeApkVersion(version));
  } catch (error) {
    req.log.error({ err: error }, "Failed to register APK version");
    respondStorageError(res, error, "No se pudo validar la APK", {
      status: 404,
      message: "La APK subida no existe o expiró",
    });
  }
});

router.post("/admin/apk/versions/:id/activate", async (req, res): Promise<void> => {
  const id = parsePositiveIntParam(req.params.id);
  if (!id) {
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
    respondStorageError(res, error, "No se pudo activar la versión", {
      status: 409,
      message: "La APK de esta versión ya no existe en almacenamiento",
    });
  }
});

router.get("/admin/apk/protection-config", async (req, res): Promise<void> => {
  try {
    res.json(await getProtectionConfig());
  } catch (error) {
    req.log.error({ err: error }, "Failed to read device protection config");
    res.status(500).json({ error: "No se pudo leer la configuración de protección" });
  }
});

router.put("/admin/apk/protection-config", async (req, res): Promise<void> => {
  try {
    const body = req.body as {
      frpAccountIds?: unknown;
      organizationName?: unknown;
    } | undefined;
    const frpAccountIds = Array.isArray(body?.frpAccountIds)
      ? body.frpAccountIds
          .map((item) => String(item).trim())
          .filter(Boolean)
      : undefined;
    const organizationName =
      typeof body?.organizationName === "string"
        ? body.organizationName
        : undefined;
    const saved = await saveProtectionConfig({
      frpAccountIds,
      organizationName,
    });
    res.json(saved);
  } catch (error) {
    req.log.error({ err: error }, "Failed to update device protection config");
    res.status(500).json({ error: "No se pudo guardar la configuración de protección" });
  }
});

export default router;