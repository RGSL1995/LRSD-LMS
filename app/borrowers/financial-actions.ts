"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseFinancialReport } from "./financial-parser";

const BUCKET = "borrower-documents";

export type FinancialUploadState = {
  error: string | null;
  extracted: { statementType: string; financialYearEnding: string }[] | null;
};

export async function uploadFinancialReport(
  _prevState: FinancialUploadState,
  formData: FormData,
): Promise<FinancialUploadState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in.", extracted: null };

  const borrowerId = formData.get("borrower_id") as string;
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return { error: "Choose a file to upload.", extracted: null };
  }

  const storagePath = `${borrowerId}/financial/financial_report-${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type });

  if (uploadError) {
    return { error: uploadError.message, extracted: null };
  }

  const { data: document, error: insertDocError } = await supabase
    .from("borrower_documents")
    .insert({
      borrower_id: borrowerId,
      stage: "financial",
      category: "financial_report",
      file_name: file.name,
      storage_path: storagePath,
      content_type: file.type || null,
      file_size: file.size,
      uploaded_by: user.id,
    })
    .select("id")
    .single();

  if (insertDocError || !document) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { error: insertDocError?.message ?? "Failed to save document.", extracted: null };
  }

  let statements;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    statements = parseFinancialReport(buffer);
  } catch {
    return {
      error: null,
      extracted: [],
    };
  }

  if (statements.length === 0) {
    revalidatePath(`/borrowers/${borrowerId}`);
    return { error: null, extracted: [] };
  }

  const rows = statements.map((s) => ({
    borrower_id: borrowerId,
    statement_type: s.statementType,
    financial_year_ending: s.financialYearEnding,
    source_document_id: document.id,
    created_by: user.id,
    ...s.fields,
  }));

  const { error: financialsError } = await supabase
    .from("corporate_financials")
    .upsert(rows, { onConflict: "borrower_id,statement_type,financial_year_ending" });

  if (financialsError) {
    return { error: financialsError.message, extracted: null };
  }

  revalidatePath(`/borrowers/${borrowerId}`);

  return {
    error: null,
    extracted: statements.map((s) => ({
      statementType: s.statementType,
      financialYearEnding: s.financialYearEnding,
    })),
  };
}

export type CorporateFinancialRow = {
  id: string;
  statement_type: string;
  financial_year_ending: string;
  net_revenue: number | null;
  ebitda: number | null;
  profit_after_tax: number | null;
  total_assets: number | null;
  total_equity: number | null;
  debt_to_equity: number | null;
  current_ratio: number | null;
};

export async function getCorporateFinancials(borrowerId: string): Promise<CorporateFinancialRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("corporate_financials")
    .select(
      "id, statement_type, financial_year_ending, net_revenue, ebitda, profit_after_tax, total_assets, total_equity, debt_to_equity, current_ratio",
    )
    .eq("borrower_id", borrowerId)
    .order("financial_year_ending", { ascending: false });

  return data ?? [];
}
