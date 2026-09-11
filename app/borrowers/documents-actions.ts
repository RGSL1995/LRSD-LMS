"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "borrower-documents";

export type DocumentUploadState = { error: string | null };

export async function uploadBorrowerDocument(
  _prevState: DocumentUploadState,
  formData: FormData,
): Promise<DocumentUploadState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  const borrowerId = formData.get("borrower_id") as string;
  const stage = formData.get("stage") as string;
  const category = formData.get("category") as string;
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return { error: "Choose a file to upload." };
  }

  const storagePath = `${borrowerId}/${stage}/${category}-${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { error: insertError } = await supabase.from("borrower_documents").insert({
    borrower_id: borrowerId,
    stage,
    category,
    file_name: file.name,
    storage_path: storagePath,
    content_type: file.type || null,
    file_size: file.size,
    uploaded_by: user.id,
  });

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { error: insertError.message };
  }

  revalidatePath(`/borrowers/${borrowerId}`);
  return { error: null };
}

export async function deleteBorrowerDocument(formData: FormData) {
  const supabase = await createClient();
  const documentId = formData.get("document_id") as string;
  const borrowerId = formData.get("borrower_id") as string;
  const storagePath = formData.get("storage_path") as string;

  await supabase.storage.from(BUCKET).remove([storagePath]);
  await supabase.from("borrower_documents").delete().eq("id", documentId);

  revalidatePath(`/borrowers/${borrowerId}`);
}

export async function getDocumentUrl(storagePath: string) {
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 10);

  return data?.signedUrl ?? null;
}

export type BorrowerDocument = {
  id: string;
  stage: string;
  category: string;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
};

export async function getBorrowerDocuments(
  borrowerId: string,
  stage: "kyc" | "financial",
): Promise<BorrowerDocument[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("borrower_documents")
    .select("id, stage, category, file_name, storage_path, uploaded_at")
    .eq("borrower_id", borrowerId)
    .eq("stage", stage)
    .order("uploaded_at", { ascending: false });

  return data ?? [];
}
