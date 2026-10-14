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
}

let cachedProvider: ApkStorageProvider | undefined;

export function getApkStorageProvider(): ApkStorageProvider {
  if (cachedProvider) return cachedProvider;

  const providerName = (process.env.APK_STORAGE_PROVIDER ?? "replit")
    .trim()
    .toLowerCase();

  if (providerName === "replit") {
    cachedProvider = new ReplitApkStorageProvider();
  } else if (providerName === "s3") {
    cachedProvider = new S3ObjectStorageService();
  } else {
    throw new ObjectStorageConfigurationError(
      `Unsupported APK_STORAGE_PROVIDER "${providerName}". Use "replit" or "s3".`,
    );
  }

  return cachedProvider;
}

export { ObjectNotFoundError };
