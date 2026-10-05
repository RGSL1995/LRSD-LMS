"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { uploadDocumentFile, getDocumentSignedUrl } from "@/lib/storage";
import { buildSanctionDocx } from "./sanction-generator";
import { convertNumberToIndianWords } from "./number-to-words";
import {
  type SanctionAutoData,
  type SanctionManualData,
  type SanctionSecurityItem,
  emptySanctionManualData,
} from "./sanction-types";
import { type LASSecurityItem, formatIndianNumber } from "@/app/loans/las-types";
import { unwrapRelation } from "@/lib/utils";

/**
 * Formats numeric amounts into Indian Currency string (e.g. ₹5,00,00,000)
 */
function formatSanctionAmount(val: number): string {
  if (!val || isNaN(val)) return "Rs. 0/-";
  return `Rs. ${val.toLocaleString("en-IN")}/-`;
}

/**
 * Loads auto-populated application data for the Sanction Letter from the database.
 */
export async function getSanctionAutoData(applicationId: string): Promise<SanctionAutoData | null> {
  const supabase = await createClient();

  const { data: app, error: appError } = await supabase
    .from("loan_applications")
    .select(`
      id,
      application_code,
      facility_type,
      requested_amount,
      tenure_months,
      purpose,
      borrower_id,
      borrowers (
        id,
        borrower_code,
        borrower_type,
        pan,
        individual_profiles (
          full_name,
          phone,
          email,
          current_address_line,
          current_city,
          current_state,
          current_pincode
        ),
        corporate_profiles (
          legal_name,
          trade_name,
          cin,
          gstin,
          registered_office_address,
          registered_office_city,
          registered_office_state,
          registered_office_pincode
        ),
        other_profiles (
          entity_name,
          address
        )
      )
    `)
    .eq("id", applicationId)
    .maybeSingle();

  if (appError || !app) {
    console.error("Failed to load loan application for sanction letter:", appError || "Application not found");
    return null;
  }

  const { data: partiesData } = await supabase
    .from("loan_application_parties")
    .select(`
      id,
      party_role,
      role_label,
      borrower_id,
      borrowers (
        id,
        borrower_code,
        borrower_type,
        pan,
        individual_profiles (
          full_name,
          phone,
          email,
          current_address_line,
          current_city,
          current_state,
          current_pincode
        ),
        corporate_profiles (
          legal_name,
          trade_name,
          cin,
          gstin,
          registered_office_address,
          registered_office_city,
          registered_office_state,
          registered_office_pincode
        ),
        other_profiles (
          entity_name,
          address
        )
      )
    `)
    .eq("loan_application_id", applicationId);

  const { data: collateralsData } = await supabase
    .from("loan_collaterals")
    .select("*")
    .eq("loan_application_id", applicationId);

  const primary = unwrapRelation(app.borrowers as any);
  const primaryCorp = primary ? unwrapRelation(primary.corporate_profiles as any) : null;
  const primaryInd = primary ? unwrapRelation(primary.individual_profiles as any) : null;
  const primaryOth = primary ? unwrapRelation(primary.other_profiles as any) : null;

  const guarantors: Array<{
    id?: string;
    name: string;
    roleLabel: string;
    pan?: string;
    cin?: string;
    address?: string;
  }> = [];

  const rawParties = partiesData || [];
  for (const p of rawParties) {
    const b = unwrapRelation(p.borrowers as any);
    if (!b) continue;
    const corp = unwrapRelation(b.corporate_profiles as any);
    const ind = unwrapRelation(b.individual_profiles as any);
    const oth = unwrapRelation(b.other_profiles as any);
    const name = corp?.legal_name || ind?.full_name || oth?.entity_name || b.borrower_code || "—";
    const addr = corp?.registered_office_address || ind?.current_address_line || oth?.address || "";
    guarantors.push({
      id: b.id,
      name,
      roleLabel: p.role_label || p.party_role || "Guarantor",
      pan: b.pan || undefined,
      cin: corp?.cin || undefined,
      address: addr || undefined,
    });
  }

  const securities: SanctionSecurityItem[] = [];
  let totalMarketValueNum = 0;

  const rawCollaterals = collateralsData || [];
  for (const c of rawCollaterals) {
    if (c.details) {
      try {
        const parsed = JSON.parse(c.details) as LASSecurityItem;
        if (parsed && parsed.security_name) {
          const qty = Number(parsed.quantity) || 0;
          const cmp = Number(parsed.cmp) || 0;
          const mVal = Number(parsed.market_value) || qty * cmp || 0;
          securities.push({
            scripName: parsed.security_name,
            isin: parsed.isin,
            quantity: formatIndianNumber(qty),
            price: formatIndianNumber(cmp),
            marketValue: formatIndianNumber(mVal),
            pledgorName: parsed.pledgor_name,
          });
          totalMarketValueNum += mVal;
          continue;
        }
      } catch {
        // Fallback
      }
    }

    if (c.estimated_value) {
      const val = Number(c.estimated_value) || 0;
      securities.push({
        scripName: c.collateral_type || "Collateral Asset",
        quantity: "1",
        price: formatIndianNumber(val),
        marketValue: formatIndianNumber(val),
        pledgorName: c.address || "Borrower",
      });
      totalMarketValueNum += val;
    }
  }

  const requestedAmountNum = Number(app.requested_amount) || 0;
  const securityCoverRatio =
    requestedAmountNum > 0 && totalMarketValueNum > 0
      ? Number((totalMarketValueNum / requestedAmountNum).toFixed(2))
      : 2.5;
  const ltvPercent =
    totalMarketValueNum > 0 && requestedAmountNum > 0
      ? Number(((requestedAmountNum / totalMarketValueNum) * 100).toFixed(1))
      : 40.0;

  const addrParts = [
    primaryCorp?.registered_office_address || primaryInd?.current_address_line,
    primaryCorp?.registered_office_city || primaryInd?.current_city,
    primaryCorp?.registered_office_state || primaryInd?.current_state,
    primaryCorp?.registered_office_pincode || primaryInd?.current_pincode,
  ].filter(Boolean);

  return {
    applicationId: app.id,
    applicationCode: app.application_code,
    facilityType: app.facility_type || "Secured Term Loan",
    requestedAmountNum,
    sanctionAmountText: formatSanctionAmount(requestedAmountNum),
    sanctionAmountInWords: convertNumberToIndianWords(requestedAmountNum),
    tenureMonths: app.tenure_months || 12,
    purpose:
      app.purpose || "Loan Facility shall be utilized for business expansion and working capital needs of the Borrower",
    borrower: {
      id: primary?.id,
      name: primaryCorp?.legal_name || primaryInd?.full_name || "Borrower Company Ltd.",
      cin: primaryCorp?.cin,
      pan: primary?.pan,
      gstin: primaryCorp?.gstin,
      address: addrParts.length > 0 ? addrParts.join(", ") : undefined,
      tradeName: primaryCorp?.trade_name,
      city: primaryCorp?.registered_office_city || primaryInd?.current_city,
      state: primaryCorp?.registered_office_state || primaryInd?.current_state,
      pincode: primaryCorp?.registered_office_pincode || primaryInd?.current_pincode,
    },
    guarantors,
    securities,
    totalSecurityMarketValue: formatSanctionAmount(totalMarketValueNum),
    securityCoverRatio,
    ltvPercent,
  };
}

/**
 * Loads the manually-entered / customized Sanction Letter data or returns populated defaults.
 */
export async function getSanctionManualData(applicationId: string): Promise<SanctionManualData> {
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("sanction_documents")
    .select("*")
    .eq("loan_application_id", applicationId)
    .maybeSingle();

  const autoData = await getSanctionAutoData(applicationId);
  const baseDefaults = emptySanctionManualData(autoData || undefined);

  if (!doc) {
    return baseDefaults;
  }

  const raw = (doc.raw_data as Partial<SanctionManualData>) || {};
  const amount = doc.sanctioned_amount != null ? Number(doc.sanctioned_amount) : (raw.sanctionedAmount ?? baseDefaults.sanctionedAmount);

  return {
    ...baseDefaults,
    ...raw,
    sanctionLetterRef: doc.sanction_letter_ref || raw.sanctionLetterRef || baseDefaults.sanctionLetterRef,
    sanctionDate: doc.sanction_date || raw.sanctionDate || baseDefaults.sanctionDate,
    validityDays: doc.validity_days || raw.validityDays || baseDefaults.validityDays,

    sanctionedAmount: amount,
    sanctionedAmountText: formatSanctionAmount(amount),
    sanctionedAmountInWords: convertNumberToIndianWords(amount),

    interestRateText: doc.interest_rate_text || raw.interestRateText || baseDefaults.interestRateText,
    legalFeesText: doc.processing_fee_text || raw.legalFeesText || baseDefaults.legalFeesText,
    penalChargeText: doc.penal_interest_text || raw.penalChargeText || baseDefaults.penalChargeText,
    tenureMonths: doc.tenure_months || raw.tenureMonths || baseDefaults.tenureMonths,
    repaymentMode: doc.repayment_terms || raw.repaymentMode || baseDefaults.repaymentMode,

    securityCoverText: doc.security_cover_text || raw.securityCoverText || baseDefaults.securityCoverText,
    topUpTriggerText: doc.margin_call_text || raw.topUpTriggerText || baseDefaults.topUpTriggerText,
    saleTriggerText: doc.liquidation_text || raw.saleTriggerText || baseDefaults.saleTriggerText,

    preDisbursementConditions:
      doc.pre_disbursement_conditions && doc.pre_disbursement_conditions.length > 0
        ? doc.pre_disbursement_conditions
        : raw.preDisbursementConditions || baseDefaults.preDisbursementConditions,
    postDisbursementConditions:
      doc.post_disbursement_conditions && doc.post_disbursement_conditions.length > 0
        ? doc.post_disbursement_conditions
        : raw.postDisbursementConditions || baseDefaults.postDisbursementConditions,
    cashTopUpTiers: raw.cashTopUpTiers || baseDefaults.cashTopUpTiers,

    authorizedSignatoryLender: doc.authorized_signatory_1 || raw.authorizedSignatoryLender || baseDefaults.authorizedSignatoryLender,
    status: (doc.status as any) || raw.status || "draft",
  };
}

/**
 * Saves or updates the Sanction Letter data for a loan application.
 */
export async function saveSanctionManualData(
  applicationId: string,
  data: SanctionManualData,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  try {
    const { data: existing } = await supabase
      .from("sanction_documents")
      .select("id")
      .eq("loan_application_id", applicationId)
      .maybeSingle();

    const payload = {
      loan_application_id: applicationId,
      sanction_letter_ref: data.sanctionLetterRef,
      sanction_date: data.sanctionDate,
      validity_days: data.validityDays,
      sanctioned_amount: data.sanctionedAmount,
      interest_rate_text: data.interestRateText,
      processing_fee_text: data.legalFeesText,
      penal_interest_text: data.penalChargeText,
      tenure_months: data.tenureMonths,
      repayment_terms: data.repaymentMode,
      security_cover_text: data.securityCoverText,
      margin_call_text: data.topUpTriggerText,
      liquidation_text: data.saleTriggerText,
      pre_disbursement_conditions: data.preDisbursementConditions,
      post_disbursement_conditions: data.postDisbursementConditions,
      special_conditions: data.cashTopUpTiers as any,
      authorized_signatory_1: data.authorizedSignatoryLender,
      raw_data: data as any,
      status: data.status,
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error } = await supabase.from("sanction_documents").update(payload).eq("id", existing.id);
      if (error) return { success: false, error: error.message };
    } else {
      const { error } = await supabase
        .from("sanction_documents")
        .insert({ ...payload, created_by: user.id });
      if (error) return { success: false, error: error.message };
    }

    revalidatePath(`/loans/${applicationId}/sanction`);
    return { success: true };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Failed to save Sanction Letter data." };
  }
}

/**
 * Generates the .docx Sanction Letter, uploads to S3, and returns a download link.
 */
export async function generateSanctionDocument(
  applicationId: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  try {
    const autoData = await getSanctionAutoData(applicationId);
    if (!autoData) {
      return { success: false, error: "Loan application not found." };
    }

    const manualData = await getSanctionManualData(applicationId);

    // Build the DOCX binary matching LRSD template
    const docxBuffer = await buildSanctionDocx(autoData, manualData);

    // S3 Storage Path
    const filename = `sanction_letter_${autoData.applicationCode}_${Date.now()}.docx`;
    const storagePath = `sanctions/${applicationId}/${filename}`;

    const file = new File([new Uint8Array(docxBuffer)], filename, {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const uploadRes = await uploadDocumentFile({ storagePath, file });
    if (!uploadRes.success) {
      return { success: false, error: uploadRes.error || "Failed to store generated Sanction Letter." };
    }

    const urlRes = await getDocumentSignedUrl(storagePath, 60 * 60);
    if (!urlRes.success || !urlRes.url) {
      return { success: false, error: "Sanction Letter generated but could not create a download link." };
    }

    // Update sanction_documents record with path and timestamp
    await supabase
      .from("sanction_documents")
      .update({
        generated_storage_path: storagePath,
        generated_at: new Date().toISOString(),
        status: "issued",
      })
      .eq("loan_application_id", applicationId);

    revalidatePath(`/loans/${applicationId}/sanction`);
    return { success: true, url: urlRes.url };
  } catch (err: unknown) {
    console.error("Sanction document generation error:", err);
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Failed to generate Sanction Letter." };
  }
}
