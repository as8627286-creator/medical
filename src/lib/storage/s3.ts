import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getEnv } from "@/lib/env";
import {
  assertSafeKey,
  STORAGE_NAMESPACE,
  type LoadedObject,
  type StorageProvider,
  type StoredObject,
} from "./types";

/**
 * S3-compatible object storage driver.
 *
 * Prescriptions are stored in the same bucket but under a `prescriptions/`
 * prefix that the deployment must keep private (no public ACL, no public
 * bucket policy). They are only ever read through the authorised, audited
 * prescription route.
 */
export class S3StorageProvider implements StorageProvider {
  readonly driver = "s3" as const;
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const env = getEnv();
    if (!env.STORAGE_S3_BUCKET) {
      throw new Error("STORAGE_S3_BUCKET is required when STORAGE_DRIVER=s3.");
    }
    this.bucket = env.STORAGE_S3_BUCKET;
    this.client = new S3Client({
      region: env.STORAGE_S3_REGION ?? "us-east-1",
      endpoint: env.STORAGE_S3_ENDPOINT,
      forcePathStyle: env.STORAGE_S3_FORCE_PATH_STYLE,
      credentials:
        env.STORAGE_S3_ACCESS_KEY_ID && env.STORAGE_S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: env.STORAGE_S3_ACCESS_KEY_ID,
              secretAccessKey: env.STORAGE_S3_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  }

  async put(key: string, data: Buffer, contentType: string): Promise<StoredObject> {
    assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
        // Objects are never publicly readable through the driver itself.
        ServerSideEncryption: "AES256",
      }),
    );
    return { key, bytes: data.byteLength, contentType };
  }

  async get(key: string): Promise<LoadedObject | null> {
    assertSafeKey(key);
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const bytes = await result.Body?.transformToByteArray();
      if (!bytes) return null;
      return {
        body: bytes,
        contentType: result.ContentType ?? "application/octet-stream",
        bytes: bytes.byteLength,
      };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    assertSafeKey(key);
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  publicUrl(key: string): string | null {
    if (!key.startsWith(`${STORAGE_NAMESPACE.PRODUCTS}/`)) return null;
    return `/media/${key}`;
  }
}
