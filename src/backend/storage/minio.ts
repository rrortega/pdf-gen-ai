import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ObjectStore, PutPdfInput, PresignDownloadInput } from "../contracts";

export interface MinioConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  presignExpiresSeconds: number;
}

export type MinioEnvironment = Record<string, string | undefined>;

/** Minimal send surface of the S3 client, injectable for offline tests. */
export interface S3Sender {
  send(command: unknown): Promise<unknown>;
}

/**
 * Reads the MinIO configuration from the environment. Error messages name the
 * missing variables; values are never logged or embedded in errors.
 */
export function readMinioConfig(env: MinioEnvironment = process.env): MinioConfig {
  const missing: string[] = [];
  if (!env.S3_ENDPOINT) missing.push("S3_ENDPOINT");
  if (!env.S3_BUCKET) missing.push("S3_BUCKET");
  if (!env.S3_ACCESS_KEY) missing.push("S3_ACCESS_KEY");
  if (!env.S3_SECRET_KEY) missing.push("S3_SECRET_KEY");

  if (missing.length > 0) {
    throw new Error(
      `MinIO object storage requires the environment variables: ${missing.join(", ")}`,
    );
  }

  const parsedExpiry = Number.parseInt(env.S3_PRESIGN_EXPIRES_SECONDS ?? "", 10);

  return {
    endpoint: env.S3_ENDPOINT!,
    region: env.S3_REGION ?? "us-east-1",
    bucket: env.S3_BUCKET!,
    accessKeyId: env.S3_ACCESS_KEY!,
    secretAccessKey: env.S3_SECRET_KEY!,
    presignExpiresSeconds: Number.isFinite(parsedExpiry) && parsedExpiry > 0 ? parsedExpiry : 900,
  };
}

/**
 * MinIO object storage through the S3 API, implementing the shared ObjectStore
 * contract used for generated PDFs. Presigning is computed locally, so it works
 * without a live MinIO connection.
 */
export function createMinioObjectStore(
  env: MinioEnvironment = process.env,
  client?: S3Sender,
): ObjectStore {
  const config = readMinioConfig(env);

  const s3: S3Sender =
    client ??
    new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });

  return {
    async putPdf(input: PutPdfInput) {
      await s3.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType ?? "application/pdf",
        }),
      );
      return { key: input.key };
    },

    async delete(key: string) {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: key,
        }),
      );
    },

    async presignDownload(input: PresignDownloadInput) {
      return getSignedUrl(
        s3 as never,
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: input.key,
        }),
        { expiresIn: input.expiresInSeconds ?? config.presignExpiresSeconds },
      );
    },
  };
}
