import {
  isS3Configured,
  uploadToS3,
  getS3SignedDownloadUrl,
  deleteFromS3,
  checkObjectExistsInS3,
  downloadFromS3,
  getS3SignedUploadUrl,
  ensureBucketCors,
} from "./s3";
export { getS3SignedUploadUrl, ensureBucketCors };
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const SUPABASE_BUCKET = "borrower-documents";

async function getSupabaseStorageClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (serviceKey && url) {
    return createSupabaseClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return await createClient();
}

/**
 * Universal document buffer upload function:
 * Automatically uses AWS S3 when AWS credentials are provided.
 * Falls back to Supabase Storage if S3 is not yet configured.
 */
export async function uploadDocumentBuffer({
  storagePath,
  buffer,
  contentType,
}: {
  storagePath: string;
  buffer: Buffer | Uint8Array;
  contentType?: string;
}): Promise<{ success: boolean; storagePath?: string; provider?: "s3" | "supabase"; error?: string }> {
  if (isS3Configured()) {
    const s3Result = await uploadToS3({
      key: storagePath,
      buffer,
      contentType: contentType || "application/octet-stream",
    });

    if (s3Result.success) {
      return { success: true, storagePath, provider: "s3" };
    }
    // If S3 explicitly failed, return the error
    return { success: false, error: s3Result.error };
  }

  // Fallback to Supabase Storage
  try {
    const supabase = await getSupabaseStorageClient();
    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(storagePath, buffer, { contentType: contentType || "application/octet-stream" });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    return { success: true, storagePath, provider: "supabase" };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Storage upload failed." };
  }
}

/**
 * Universal document upload function for File objects
 */
export async function uploadDocumentFile({
  storagePath,
  file,
}: {
  storagePath: string;
  file: File;
}): Promise<{ success: boolean; storagePath?: string; provider?: "s3" | "supabase"; error?: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return uploadDocumentBuffer({
    storagePath,
    buffer,
    contentType: file.type || "application/octet-stream",
  });
}


/**
 * Universal signed download URL generator:
 * Tries S3 first if S3 is configured and file exists there, or falls back to Supabase Storage.
 */
export async function getDocumentSignedUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<{ success: boolean; url?: string; provider?: "s3" | "supabase"; error?: string }> {
  if (isS3Configured()) {
    const inS3 = await checkObjectExistsInS3(storagePath);
    if (inS3) {
      const s3Result = await getS3SignedDownloadUrl(storagePath, expiresInSeconds);
      if (s3Result.success && s3Result.url) {
        return { success: true, url: s3Result.url, provider: "s3" };
      }
    }
  }

  // Fallback to Supabase Storage (for documents uploaded before S3 switch)
  try {
    const supabase = await getSupabaseStorageClient();
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (!error && data?.signedUrl) {
      return { success: true, url: data.signedUrl, provider: "supabase" };
    }
  } catch {
    // Continue
  }

  // Last-ditch check for S3 if checkObjectExists was inconclusive
  if (isS3Configured()) {
    const s3Result = await getS3SignedDownloadUrl(storagePath, expiresInSeconds);
    if (s3Result.success && s3Result.url) {
      return { success: true, url: s3Result.url, provider: "s3" };
    }
  }

  return { success: false, error: "Could not locate file in storage." };
}

/**
 * Universal document delete function:
 * Deletes from S3 if configured, and also cleans up from Supabase Storage if present.
 */
export async function deleteDocumentFile(
  storagePath: string,
): Promise<{ success: boolean; error?: string }> {
  if (isS3Configured()) {
    const s3Result = await deleteFromS3(storagePath);
    if (s3Result.success) {
      return { success: true };
    }
  }

  try {
    const supabase = await getSupabaseStorageClient();
    await supabase.storage.from(SUPABASE_BUCKET).remove([storagePath]);
    return { success: true };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Storage delete failed." };
  }
}

/**
 * Universal document buffer downloader:
 * Downloads the binary file buffer from S3 if present, or falls back to Supabase.
 */
export async function downloadDocumentBuffer(storagePath: string): Promise<Buffer | null> {
  if (isS3Configured()) {
    const inS3 = await checkObjectExistsInS3(storagePath);
    if (inS3) {
      const buf = await downloadFromS3(storagePath);
      if (buf) return buf;
    }
  }

  try {
    const supabase = await getSupabaseStorageClient();
    const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).download(storagePath);
    if (!error && data) {
      return Buffer.from(await data.arrayBuffer());
    }
  } catch {
    // Fallback
  }

  // Fallback try S3
  if (isS3Configured()) {
    return await downloadFromS3(storagePath);
  }

  return null;
}
