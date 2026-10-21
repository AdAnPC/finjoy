import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { ObjectNotFoundError, ObjectStorageService } from "./objectStorage";
import { S3ObjectStorageService } from "./s3ObjectStorage";

export type ApkObjectMetadata = {
  size?: string | number;
  contentType?: string;
};

export interface ApkStoredFile {
  getMetadata(): Promise<[ApkObjectMetadata]>;
  download(): Promise<[Buffer]>;
  createReadStream(): NodeJS.ReadableStream;
  delete(): Promise<unknown>;
}

export type ApkUploadTarget = {
  uploadURL: string;
  objectPath: string;
};

export interface ApkStorageProvider {
  createUploadTarget(): Promise<ApkUploadTarget>;
  getObjectEntityFile(objectPath: string): Promise<ApkStoredFile>;
  downloadObject(file: ApkStoredFile, cacheTtlSec?: number): Promise<Response>;
}

export class ObjectStorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ObjectStorageConfigurationError";
  }
}

export function getLocalApkUploadDir(): string {
  const dir =
    process.env.APK_STORAGE_DIR?.trim() ||
    path.resolve(process.cwd(), "data/apk_uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export class LocalApkStorageProvider implements ApkStorageProvider {
  async createUploadTarget(): Promise<ApkUploadTarget> {
    const uploadId = randomUUID();
    return {
      uploadURL: `/api/admin/apk/upload-file/${uploadId}`,
      objectPath: `/objects/uploads/${uploadId}`,
    };
  }

  async getObjectEntityFile(objectPath: string): Promise<ApkStoredFile> {
    const uploadId = path.basename(objectPath);
    const dir = getLocalApkUploadDir();
    const filePath = path.join(dir, `${uploadId}.apk`);
    const metaPath = path.join(dir, `${uploadId}.json`);

    if (!fs.existsSync(filePath)) {
      throw new ObjectNotFoundError();
    }

    return {
      getMetadata: async () => {
        const stats = await fs.promises.stat(filePath);
        let contentType = "application/vnd.android.package-archive";
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(await fs.promises.readFile(metaPath, "utf8"));
            if (meta.contentType) contentType = meta.contentType;
          } catch {}
        }
        return [{ size: stats.size, contentType }];
      },
      download: async () => {
        const buf = await fs.promises.readFile(filePath);
        return [buf];
      },
      createReadStream: () => fs.createReadStream(filePath),
      delete: async () => {
        await fs.promises.unlink(filePath).catch(() => {});
        await fs.promises.unlink(metaPath).catch(() => {});
      },
    };
  }

  async downloadObject(file: ApkStoredFile, cacheTtlSec = 300): Promise<Response> {
    return buildApkDownloadResponse(file, cacheTtlSec);
  }
}

class ReplitApkStorageProvider implements ApkStorageProvider {
  private readonly storage = new ObjectStorageService();

  async createUploadTarget(): Promise<ApkUploadTarget> {
    const uploadURL = await this.storage.getObjectEntityUploadURL();
    return {
      uploadURL,
      objectPath: this.storage.normalizeObjectEntityPath(uploadURL),
    };
  }

  async getObjectEntityFile(objectPath: string): Promise<ApkStoredFile> {
    const file = await this.storage.getObjectEntityFile(objectPath);
    return {
      getMetadata: async () => {
        const [metadata] = await file.getMetadata();
        return [
          {
            size: metadata.size,
            contentType: metadata.contentType,
          },
        ];
      },
      download: async () => {
        const [bytes] = await file.download();
        return [Buffer.from(bytes)];
      },
      createReadStream: () => file.createReadStream(),
      delete: async () => {
        await file.delete();
      },
    };
  }

  async downloadObject(file: ApkStoredFile, cacheTtlSec = 300): Promise<Response> {
    return buildApkDownloadResponse(file, cacheTtlSec);
  }
}

export async function buildApkDownloadResponse(
  file: ApkStoredFile,
  cacheTtlSec = 300,
): Promise<Response> {
  const [metadata] = await file.getMetadata();
  const webStream = Readable.toWeb(
    file.createReadStream() as Readable,
  ) as ReadableStream<Uint8Array>;
  const headers: Record<string, string> = {
    "Content-Type": metadata.contentType ?? "application/octet-stream",
    "Cache-Control": `private, max-age=${cacheTtlSec}`,
    "Content-Disposition": 'attachment; filename="finjoy.apk"',
  };
  if (metadata.size) headers["Content-Length"] = String(metadata.size);
  return new Response(webStream, { headers });
}

let cachedProvider: ApkStorageProvider | undefined;

export function getApkStorageProvider(): ApkStorageProvider {
  if (cachedProvider) return cachedProvider;

  const providerName = (process.env.APK_STORAGE_PROVIDER ?? "local")
    .trim()
    .toLowerCase();

  if (providerName === "s3") {
    cachedProvider = new S3ObjectStorageService();
  } else if (providerName === "replit") {
    if (process.env.PRIVATE_OBJECT_DIR || process.env.REPL_ID) {
      cachedProvider = new ReplitApkStorageProvider();
    } else {
      cachedProvider = new LocalApkStorageProvider();
    }
  } else if (providerName === "local" || providerName === "filesystem") {
    cachedProvider = new LocalApkStorageProvider();
  } else {
    cachedProvider = new LocalApkStorageProvider();
  }

  return cachedProvider;
}

export { ObjectNotFoundError };
