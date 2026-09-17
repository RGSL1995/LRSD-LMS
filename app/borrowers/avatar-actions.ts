"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "borrower-documents";
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 7; // 7 days

export type AvatarActionState = {
  success: boolean;
  error?: string | null;
  avatarUrl?: string | null;
};

/**
 * Resolves the active avatar / logo URL for a borrower.
 * Checks borrowers.avatar_url first, then falls back to storage and photograph KYC documents.
 */
export async function getBorrowerAvatarUrl(borrowerId: string): Promise<string | null> {
  const supabase = await createClient();

  // 1. Try borrowers.avatar_url column if it exists
  try {
    const { data: borrower } = await supabase
      .from("borrowers")
      .select("avatar_url")
      .eq("id", borrowerId)
      .maybeSingle();

    if (borrower?.avatar_url) {
      return borrower.avatar_url;
    }
  } catch {
    // avatar_url column might not exist yet; continue to storage fallback
  }

  // 2. Check storage for existing avatar file
  try {
    const { data: files } = await supabase.storage
      .from(BUCKET)
      .list(`${borrowerId}/avatar`, { sortBy: { column: "created_at", order: "desc" } });

    if (files && files.length > 0 && files[0]?.name) {
      const storagePath = `${borrowerId}/avatar/${files[0].name}`;
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

      if (signed?.signedUrl) return signed.signedUrl;
    }
  } catch {
    // Storage check failed, fall through to borrower_documents
  }

  // 3. Check borrower_documents for photograph category (KYC photo)
  try {
    const { data: doc } = await supabase
      .from("borrower_documents")
      .select("storage_path")
      .eq("borrower_id", borrowerId)
      .eq("category", "photograph")
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (doc?.storage_path) {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(doc.storage_path, SIGNED_URL_EXPIRY);

      if (signed?.signedUrl) return signed.signedUrl;
    }
  } catch {
    // Ignore error
  }

  return null;
}

/**
 * Uploads a logo (for corporate) or profile photo (for individual).
 */
export async function uploadBorrowerAvatar(
  formData: FormData,
): Promise<AvatarActionState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be signed in to upload." };
  }

  const borrowerId = formData.get("borrower_id") as string;
  const borrowerType = (formData.get("borrower_type") as string) || "corporate";
  const file = formData.get("file") as File | null;

  if (!borrowerId) {
    return { success: false, error: "Missing borrower ID." };
  }

  if (!file || file.size === 0) {
    return { success: false, error: "Please choose an image file." };
  }

  // Validate image type
  const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
  if (!validTypes.includes(file.type) && !file.name.match(/\.(png|jpe?g|webp|svg)$/i)) {
    return { success: false, error: "Please select a valid image file (PNG, JPG, WebP, or SVG)." };
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: "Image file must be under 5MB." };
  }

  const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const storagePath = `${borrowerId}/avatar/${Date.now()}-${cleanName}`;

  // 1. Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type || "image/png", upsert: true });

  if (uploadError) {
    return { success: false, error: uploadError.message };
  }

  // 2. Generate signed URL for immediate use
  const { data: signedData } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

  const signedUrl = signedData?.signedUrl ?? null;

  // 3. Track in borrower_documents table
  try {
    const docCategory = borrowerType === "individual" ? "photograph" : "other";
    await supabase.from("borrower_documents").insert({
      borrower_id: borrowerId,
      stage: "kyc",
      category: docCategory,
      file_name: borrowerType === "corporate" ? `logo-${file.name}` : `photo-${file.name}`,
      storage_path: storagePath,
      content_type: file.type || "image/png",
      file_size: file.size,
      uploaded_by: user.id,
    });
  } catch {
    // Non-critical if document table insert has constraint
  }

  // 4. Try updating borrowers table avatar_url column (if column exists)
  try {
    await supabase
      .from("borrowers")
      .update({ avatar_url: signedUrl })
      .eq("id", borrowerId);
  } catch {
    // Ignored if column doesn't exist yet
  }

  // 5. Try updating corporate_profiles.logo_url or individual_profiles.photo_url
  try {
    if (borrowerType === "corporate") {
      await supabase
        .from("corporate_profiles")
        .update({ logo_url: signedUrl })
        .eq("borrower_id", borrowerId);
    } else if (borrowerType === "individual") {
      await supabase
        .from("individual_profiles")
        .update({ photo_url: signedUrl })
        .eq("borrower_id", borrowerId);
    }
  } catch {
    // Ignored if columns don't exist yet
  }

  revalidatePath(`/borrowers/${borrowerId}`);
  revalidatePath("/borrowers");
  revalidatePath("/loans");

  return { success: true, avatarUrl: signedUrl };
}

/**
 * Removes a logo or profile photo for a borrower.
 */
export async function removeBorrowerAvatar(
  borrowerId: string,
  borrowerType: string = "corporate",
): Promise<AvatarActionState> {
  const supabase = await createClient();

  // 1. List and remove all files in the avatar folder
  try {
    const { data: files } = await supabase.storage
      .from(BUCKET)
      .list(`${borrowerId}/avatar`);

    if (files && files.length > 0) {
      const paths = files.map((f) => `${borrowerId}/avatar/${f.name}`);
      await supabase.storage.from(BUCKET).remove(paths);
    }
  } catch {
    // Storage remove failure handled gracefully
  }

  // 2. Remove from borrower_documents if tagged as photograph or avatar
  try {
    await supabase
      .from("borrower_documents")
      .delete()
      .eq("borrower_id", borrowerId)
      .eq("category", "photograph");
  } catch {
    // Ignored
  }

  // 3. Clear avatar_url column
  try {
    await supabase
      .from("borrowers")
      .update({ avatar_url: null })
      .eq("id", borrowerId);
  } catch {
    // Ignored
  }

  // 4. Clear logo_url / photo_url
  try {
    if (borrowerType === "corporate") {
      await supabase
        .from("corporate_profiles")
        .update({ logo_url: null })
        .eq("borrower_id", borrowerId);
    } else {
      await supabase
        .from("individual_profiles")
        .update({ photo_url: null })
        .eq("borrower_id", borrowerId);
    }
  } catch {
    // Ignored
  }

  revalidatePath(`/borrowers/${borrowerId}`);
  revalidatePath("/borrowers");
  revalidatePath("/loans");

  return { success: true, avatarUrl: null };
}
