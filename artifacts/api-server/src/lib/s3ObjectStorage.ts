import { randomUUID } from "node:crypto";
import { PassThrough, Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  ObjectNotFoundError,
  ObjectStorageConfigurationError,
  type ApkObjectMetadata,
  type ApkStorageProvider,
  type ApkStoredFile,
  type ApkUploadTarget,
} from "./apkStorage";

const UUID_PATH_PATTERN =
  /^\/objects\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class S3StoredApk implements ApkStoredFile {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    private readonly key: string,
  ) {}

  async getMetadata(): Promise<[ApkObjectMetadata]> {
    try {
      const metadata = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.key }),
      );
      return [toApkMetadata(metadata)];
    } catch (error) {
      throw mapStorageError(error);
    }
  }

  async download(): Promise<[Buffer]> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.key }),
      );
      if (!result.Body) throw new ObjectNotFoundError();
      return [Buffer.from(await result.Body.transformToByteArray())];
    } catch (error) {
      throw mapStorageError(error);
    }
  }

  createReadStream(): NodeJS.ReadableStream {
    const output = new PassThrough();
    void this.client
      .send(new GetObjectCommand({ Bucket: this.bucket, Key: this.key }))
      .then((result) => {
        if (!result.Body) {
          output.destroy(new ObjectNotFoundError());
          return;
        }
        const source = result.Body as Readable;
        source.on("error", (error) => output.destroy(mapStorageError(error)));
        source.pipe(output);
      })
      .catch((error: unknown) => output.destroy(mapStorageError(error)));
    return output;
  }

  async delete(): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: this.key }),
      );
    } catch (error) {
      throw mapStorageError(error);
    }
  }
}

export class S3ObjectStorageService implements ApkStorageProvider {
  private readonly bucket: string;
  private readonly client: S3Client;

  constructor() {
    const bucket = process.env.S3_BUCKET?.trim();
    const region = process.env.S3_REGION?.trim();
    const endpoint = process.env.S3_ENDPOINT?.trim();
    const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
    const forcePathStyleValue = process.env.S3_FORCE_PATH_STYLE?.trim().toLowerCase();

    if (!bucket || !region) {
      throw new ObjectStorageConfigurationError(
        "S3_BUCKET and S3_REGION are required when APK_STORAGE_PROVIDER=s3.",
      );
    }
    if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
      throw new ObjectStorageConfigurationError(
        "Set both S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY, or omit both to use the hosting provider's IAM credentials.",
      );
    }
    if (
      forcePathStyleValue &&
      !["true", "false"].includes(forcePathStyleValue)
    ) {
      throw new ObjectStorageConfigurationError(
        "S3_FORCE_PATH_STYLE must be true or false.",
      );
    }

    this.bucket = bucket;
    this.client = new S3Client({
      region,
      ...(endpoint ? { endpoint } : {}),
      forcePathStyle: forcePathStyleValue === "true",
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
  }

  async createUploadTarget(): Promise<ApkUploadTarget> {
    const key = `uploads/${randomUUID()}`;
    const uploadURL = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: 900 },
    );
    return {
      uploadURL,
      objectPath: `/objects/${key}`,
    };
  }

  async getObjectEntityFile(objectPath: string): Promise<ApkStoredFile> {
    const key = this.getObjectKey(objectPath);
    const file = new S3StoredApk(this.client, this.bucket, key);
    await file.getMetadata();
    return file;
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

  private getObjectKey(objectPath: string): string {
    if (!UUID_PATH_PATTERN.test(objectPath)) throw new ObjectNotFoundError();
    return objectPath.slice("/objects/".length);
  }
}

function toApkMetadata(metadata: HeadObjectCommandOutput): ApkObjectMetadata {
  return {
    size: metadata.ContentLength,
    contentType: metadata.ContentType,
  };
}

function mapStorageError(error: unknown): Error {
  if (error instanceof ObjectNotFoundError) return error;
  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      name?: string;
      $metadata?: { httpStatusCode?: number };
    };
    if (
      candidate.name === "NoSuchKey" ||
      candidate.name === "NotFound" ||
      candidate.$metadata?.httpStatusCode === 404
    ) {
      return new ObjectNotFoundError();
    }
  }
  return error instanceof Error ? error : new Error(String(error));
}
