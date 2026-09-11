"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface GstRecordRow {
  id: string;
  borrower_id: string;
  gstin: string;
  financial_year: string;
  return_type: "gstr_1" | "gstr_3b" | "gstr_9" | "annual_aggregate";
  period_month: string;
  taxable_turnover: number;
  igst_amount: number | null;
  cgst_amount: number | null;
  sgst_amount: number | null;
  total_tax_paid: number | null;
  filing_date: string | null;
}

export async function addGstRecord(formData: FormData) {
  const supabase = await createClient();
  const borrowerId = formData.get("borrower_id") as string;
  const gstin = (formData.get("gstin") as string)?.toUpperCase();
  const financialYear = (formData.get("financial_year") as string) || "FY 2024-25";
  const returnType = formData.get("return_type") as string;
  const periodMonth = formData.get("period_month") as string;
  const taxableTurnover = Number(formData.get("taxable_turnover") || 0);
  const igst = formData.get("igst_amount") ? Number(formData.get("igst_amount")) : 0;
  const cgst = formData.get("cgst_amount") ? Number(formData.get("cgst_amount")) : 0;
  const sgst = formData.get("sgst_amount") ? Number(formData.get("sgst_amount")) : 0;
  const totalTaxPaid = formData.get("total_tax_paid")
    ? Number(formData.get("total_tax_paid"))
    : igst + cgst + sgst;
  const filingDate = (formData.get("filing_date") as string) || null;

  if (!borrowerId || !gstin || !periodMonth) {
    return { error: "GSTIN and Period are required." };
  }

  const { error } = await supabase.from("corporate_gst_records").insert({
    borrower_id: borrowerId,
    gstin,
    financial_year: financialYear,
    return_type: returnType,
    period_month: periodMonth,
    taxable_turnover: taxableTurnover,
    igst_amount: igst,
    cgst_amount: cgst,
    sgst_amount: sgst,
    total_tax_paid: totalTaxPaid,
    filing_date: filingDate,
  });

  if (error) return { error: error.message };

  revalidatePath(`/borrowers/${borrowerId}`);
  return { error: null };
}

export async function deleteGstRecord(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const borrowerId = formData.get("borrower_id") as string;

  const { error } = await supabase.from("corporate_gst_records").delete().eq("id", id);
  if (error) return { error: error.message };

  if (borrowerId) {
    revalidatePath(`/borrowers/${borrowerId}`);
  }
  return { error: null };
}

export async function getGstRecords(borrowerId: string): Promise<GstRecordRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("corporate_gst_records")
    .select("*")
    .eq("borrower_id", borrowerId)
    .order("created_at", { ascending: false });

  return (data as GstRecordRow[]) ?? [];
}
