import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface AwsConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket: string;
  isConfigured: boolean;
}

/**
 * Resolves AWS S3 configuration from process.env or dynamically reads
 * .env.local on the server so that updates take effect immediately without dev server restart.
 */
export function getAwsConfig(): AwsConfig {
  let region = process.env.AWS_REGION || "ap-south-1";
  let accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  let secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  let bucket =
    process.env.AWS_S3_BUCKET_NAME ||
    process.env.AWS_S3_BUCKET ||
    "loan-management-documents-lrsd-800591602024-ap-south-1-an";

  if ((!accessKeyId || !secretAccessKey) && typeof window === "undefined") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require("fs");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require("path");
      const envPath = path.resolve(process.cwd(), ".env.local");
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");

        const regionMatch = content.match(/^AWS_REGION=(.+)$/m);
        if (regionMatch) region = regionMatch[1].trim().replace(/^['"]|['"]$/g, "");

        const keyMatch = content.match(/^AWS_ACCESS_KEY_ID=(.+)$/m);
        if (keyMatch) accessKeyId = keyMatch[1].trim().replace(/^['"]|['"]$/g, "");

        const secretMatch = content.match(/^AWS_SECRET_ACCESS_KEY=(.+)$/m);
        if (secretMatch) secretAccessKey = secretMatch[1].trim().replace(/^['"]|['"]$/g, "");

        const bucketMatch = content.match(/^(?:AWS_S3_BUCKET_NAME|AWS_S3_BUCKET)=(.+)$/m);
        if (bucketMatch) bucket = bucketMatch[1].trim().replace(/^['"]|['"]$/g, "");
      }
    } catch {
      // Fallback
    }
  }

  const isDummyKey =
    !accessKeyId ||
    !secretAccessKey ||
    accessKeyId.includes("...") ||
    accessKeyId.includes("EXAMPLE") ||
    secretAccessKey.includes("...") ||
    secretAccessKey.includes("EXAMPLE");

  const isConfigured = !isDummyKey && Boolean(bucket);

  return {
    region,
    accessKeyId,
    secretAccessKey,
    bucket,
    isConfigured,
  };
}

export function isS3Configured(): boolean {
  return getAwsConfig().isConfigured;
}

export function getS3Client(): S3Client | null {
  const config = getAwsConfig();
  if (!config.isConfigured || !config.accessKeyId || !config.secretAccessKey) {
    return null;
  }
  return new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

/**
 * Uploads a binary file directly to the configured AWS S3 bucket.
 */
export async function uploadToS3({
  key,
  buffer,
  contentType,
}: {
  key: string;
  buffer: Buffer | Uint8Array;
  contentType?: string;
}): Promise<{ success: boolean; storagePath?: string; error?: string }> {
  try {
    const s3 = getS3Client();
    const config = getAwsConfig();
    if (!s3 || !config.bucket) {
      return {
        success: false,
        error: "AWS S3 credentials not found. Please add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to .env.local.",
      };
    }

    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
    });

    await s3.send(command);
    return { success: true, storagePath: key };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Failed to upload file to AWS S3." };
  }
}

/**
 * Generates an encrypted pre-signed download URL for a file stored in S3.
 * Defaults to 1-hour expiration.
 */
export async function getS3SignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600,
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const s3 = getS3Client();
    const config = getAwsConfig();
    if (!s3 || !config.bucket) {
      return { success: false, error: "AWS S3 is not configured." };
    }

    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
    return { success: true, url };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Failed to generate S3 pre-signed download link." };
  }
}

/**
 * Deletes an object from AWS S3.
 */
export async function deleteFromS3(key: string): Promise<{ success: boolean; error?: string }> {
  try {
    const s3 = getS3Client();
    const config = getAwsConfig();
    if (!s3 || !config.bucket) {
      return { success: false, error: "AWS S3 is not configured." };
    }

    const command = new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });

    await s3.send(command);
    return { success: true };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Failed to delete file from AWS S3." };
  }
}

/**
 * Checks if an object exists in AWS S3 using a lightweight HEAD request.
 */
export async function checkObjectExistsInS3(key: string): Promise<boolean> {
  const s3 = getS3Client();
  const config = getAwsConfig();
  if (!s3 || !config.bucket) return false;

  try {
    await s3.send(
      new HeadObjectCommand({
        Bucket: config.bucket,
        Key: key,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Downloads a file buffer from AWS S3.
 */
export async function downloadFromS3(key: string): Promise<Buffer | null> {
  const s3 = getS3Client();
  const config = getAwsConfig();
  if (!s3 || !config.bucket) return null;

  try {
    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });
    const response = await s3.send(command);
    if (!response.Body) return null;
    const byteArray = await response.Body.transformToByteArray();
    return Buffer.from(byteArray);
  } catch {
    return null;
  }
}

/**
 * Generates an encrypted pre-signed PUT upload URL for direct browser-to-S3 uploads.
 * This bypasses Next.js server memory and size limits completely.
 */
export async function getS3SignedUploadUrl({
  key,
  contentType,
  expiresInSeconds = 3600,
}: {
  key: string;
  contentType?: string;
  expiresInSeconds?: number;
}): Promise<{ success: boolean; url?: string; storagePath?: string; error?: string }> {
  try {
    const s3 = getS3Client();
    const config = getAwsConfig();
    if (!s3 || !config.bucket) {
      return { success: false, error: "AWS S3 is not configured." };
    }

    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType || "application/octet-stream",
    });

    const url = await getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
    return { success: true, url, storagePath: key };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Failed to generate S3 upload URL." };
  }
}

/**
 * Ensures the S3 bucket has standard CORS configuration for browser direct uploads and downloads.
 */
export async function ensureBucketCors(): Promise<boolean> {
  const s3 = getS3Client();
  const config = getAwsConfig();
  if (!s3 || !config.bucket) return false;

  try {
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: config.bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ["*"],
              AllowedMethods: ["PUT", "POST", "GET", "HEAD"],
              AllowedOrigins: ["*"],
              ExposeHeaders: ["ETag"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );
    return true;
  } catch {
    return false;
  }
}

