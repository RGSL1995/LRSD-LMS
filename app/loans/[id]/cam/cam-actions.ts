"use server";

import { createClient } from "@/lib/supabase/server";
import { uploadDocumentFile, getDocumentSignedUrl } from "@/lib/storage";
import { unwrapRelation, type Relation } from "@/lib/utils";
import { buildCamDocx } from "./cam-generator";
import {
  type CamAutoData,
  type CamAutoParty,
  type CamManualData,
  type CamPartyManualData,
  type CamCorporateFinancialRow,
  emptyCamManualData,
} from "./cam-types";
import { formatIndianNumber, type LASSecurityItem } from "@/app/loans/las-types";
import { fetchLiveStockPrice } from "@/app/loans/market-actions";

function formatSanctionAmount(amount: number): string {
  return `Rs. ${formatIndianNumber(amount)}/-`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function partyDisplayName(borrowers: Relation<any>): string {
  const b = unwrapRelation(borrowers);
  if (!b) return "—";
  const ind = unwrapRelation(b.individual_profiles);
  const corp = unwrapRelation(b.corporate_profiles);
  const oth = unwrapRelation(b.other_profiles);
  return ind?.full_name ?? corp?.legal_name ?? oth?.entity_name ?? b.borrower_code ?? "—";
}

/**
 * Compiles everything the CAM can auto-fill from the loan application's
 * existing data (borrower profile, parties, security/collateral, corporate financials).
 */
async function buildAutoData(applicationId: string): Promise<CamAutoData | null> {
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("loan_applications")
    .select(
      `id, application_code, requested_amount, purpose, facility_type, tenure_months, borrower_id,
       borrowers (
         id, borrower_code, borrower_type, pan,
         individual_profiles ( full_name, phone, email, current_address_line, current_city, occupation, date_of_birth, pan ),
         corporate_profiles ( legal_name, trade_name, cin, gstin, pan, registered_office_address, registered_office_city ),
         other_profiles ( entity_name, address )
       )`,
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (!app) return null;

  const primary = unwrapRelation(app.borrowers);
  const primaryCorp = primary ? unwrapRelation(primary.corporate_profiles) : null;
  const primaryInd = primary ? unwrapRelation(primary.individual_profiles) : null;

  const { data: partiesData } = await supabase
    .from("loan_application_parties")
    .select(
      `id, party_role, guarantee_type, borrower_id,
       borrowers (
         id, borrower_code, borrower_type, pan,
         individual_profiles ( full_name, phone, email, current_address_line, current_city, occupation, date_of_birth, pan ),
         corporate_profiles ( legal_name, trade_name, cin, gstin, pan, registered_office_address, registered_office_city ),
         other_profiles ( entity_name, address )
       )`,
    )
    .eq("loan_application_id", applicationId)
    .order("order_index", { ascending: true });

  const guarantorParties = (partiesData || []).filter((p) => p.party_role === "guarantor");

  const guarantorSummaries: string[] = guarantorParties.map((p, i) => {
    const name = partyDisplayName(p.borrowers);
    const roleTag = p.guarantee_type === "corporate" ? "Corporate Guarantor" : "Guarantor";
    return `${name} (${roleTag}-${i + 1})`;
  });

  // Security / collateral - pledged equity shares are stored as loan_collaterals
  const { data: collateralsData } = await supabase
    .from("loan_collaterals")
    .select("*")
    .eq("loan_application_id", applicationId);

  const securities: CamAutoData["securities"] = [];
  let totalMarketValueNum = 0;

  for (const c of collateralsData || []) {
    if (c.collateral_type === "Equity Shares" && c.details) {
      try {
        const parsed = JSON.parse(c.details) as LASSecurityItem;
        if (parsed && parsed.security_name) {
          const qty = Number(parsed.quantity) || 0;
          const cmp = Number(parsed.cmp) || 0;
          const mVal = Number(parsed.market_value) || qty * cmp || 0;
          securities.push({
            id: c.id,
            scripName: parsed.security_name,
            quantity: formatIndianNumber(qty),
            quantityNum: qty,
            price: formatIndianNumber(cmp),
            priceNum: cmp,
            marketValue: formatIndianNumber(mVal),
            marketValueNum: mVal,
            isin: parsed.isin,
            pledgorName: parsed.pledgor_name,
            pledgorBorrowerId: parsed.pledgor_borrower_id,
          });
          totalMarketValueNum += mVal;
          continue;
        }
      } catch {
        // Fallback for non-JSON collateral
      }
    }

    if (c.estimated_value) {
      const val = Number(c.estimated_value) || 0;
      securities.push({
        id: c.id,
        scripName: c.collateral_type || "Collateral Asset",
        quantity: "1",
        quantityNum: 1,
        price: formatIndianNumber(val),
        priceNum: val,
        marketValue: formatIndianNumber(val),
        marketValueNum: val,
        pledgorName: c.address || "Borrower",
      });
      totalMarketValueNum += val;
    }
  }

  // Fetch 3-year Corporate Financials for corporate borrower if available
  const corporateFinancials: CamCorporateFinancialRow[] = [];
  if (app.borrower_id) {
    const { data: finRows } = await supabase
      .from("corporate_financials")
      .select("*")
      .eq("borrower_id", app.borrower_id)
      .order("financial_year_ending", { ascending: false })
      .limit(3);

    if (finRows && finRows.length > 0) {
      for (const row of finRows) {
        const fyYear = row.financial_year_ending
          ? `FY ${new Date(row.financial_year_ending).getFullYear()}`
          : "—";
        corporateFinancials.push({
          financialYear: fyYear,
          netRevenue: row.net_revenue != null ? `Rs. ${formatIndianNumber(row.net_revenue)}` : "—",
          ebitda: row.ebitda != null ? `Rs. ${formatIndianNumber(row.ebitda)}` : "—",
          ebitdaMargin: row.ebitda_margin_percent != null ? `${row.ebitda_margin_percent}%` : "—",
          pat: row.profit_after_tax != null ? `Rs. ${formatIndianNumber(row.profit_after_tax)}` : "—",
          netMargin: row.net_margin_percent != null ? `${row.net_margin_percent}%` : "—",
          totalEquity: row.total_equity != null ? `Rs. ${formatIndianNumber(row.total_equity)}` : "—",
          debtToEquity: row.debt_to_equity != null ? `${row.debt_to_equity}x` : "—",
          currentRatio: row.current_ratio != null ? `${row.current_ratio}x` : "—",
          interestCoverageRatio: row.interest_coverage_ratio != null ? `${row.interest_coverage_ratio}x` : "—",
        });
      }
    }
  }

  // Build KYC field tables per party
  function buildKyc(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    borrowers: Relation<any>,
  ): {
    name: string;
    isCompany: boolean;
    pan?: string;
    cin?: string;
    email?: string;
    phone?: string;
    address?: string;
    kyc: Record<string, string>;
  } {
    const b = unwrapRelation(borrowers);
    if (!b) return { name: "—", isCompany: true, kyc: {} };
    const ind = unwrapRelation(b.individual_profiles);
    const corp = unwrapRelation(b.corporate_profiles);
    const oth = unwrapRelation(b.other_profiles);

    if (corp) {
      return {
        name: corp.legal_name,
        isCompany: true,
        pan: corp.pan || b.pan,
        cin: corp.cin,
        address: corp.registered_office_address,
        kyc: {
          "Entity Name": corp.legal_name || "",
          CIN: corp.cin || "",
          PAN: corp.pan || b.pan || "",
          "GSTIN / Reg. Cert.": corp.gstin || "",
          "Registered Address": corp.registered_office_address || "",
          City: corp.registered_office_city || "",
        },
      };
    }
    if (ind) {
      return {
        name: ind.full_name,
        isCompany: false,
        pan: ind.pan || b.pan,
        email: ind.email,
        phone: ind.phone,
        address: ind.current_address_line,
        kyc: {
          "Full Name": ind.full_name || "",
          "Date of Birth": ind.date_of_birth || "",
          PAN: ind.pan || b.pan || "",
          "Residential Address": ind.current_address_line || "",
          City: ind.current_city || "",
          Occupation: ind.occupation || "",
          "Contact Number": ind.phone || "",
          "Email Address": ind.email || "",
        },
      };
    }
    return {
      name: oth?.entity_name || b.borrower_code || "—",
      isCompany: true,
      address: oth?.address,
      kyc: { Name: oth?.entity_name || "", Address: oth?.address || "" },
    };
  }

  const primaryKyc = buildKyc(app.borrowers);
  const parties: CamAutoParty[] = [
    {
      borrowerId: app.borrower_id,
      name: primaryKyc.name,
      roleLabel: "Primary Borrower",
      isCompany: primaryKyc.isCompany,
      pan: primaryKyc.pan,
      cin: primaryKyc.cin,
      email: primaryKyc.email,
      phone: primaryKyc.phone,
      address: primaryKyc.address,
      kyc: primaryKyc.kyc,
    },
    ...guarantorParties.map((p, i) => {
      const k = buildKyc(p.borrowers);
      return {
        borrowerId: p.borrower_id,
        name: k.name,
        roleLabel: `Guarantor-${i + 1}`,
        isCompany: k.isCompany,
        pan: k.pan,
        cin: k.cin,
        email: k.email,
        phone: k.phone,
        address: k.address,
        kyc: k.kyc,
      };
    }),
  ];

  const requestedAmountNum = Number(app.requested_amount) || 0;
  const securityCoverRatio =
    requestedAmountNum > 0 && totalMarketValueNum > 0
      ? Number((totalMarketValueNum / requestedAmountNum).toFixed(2))
      : 0;
  const ltvPercent =
    totalMarketValueNum > 0 && requestedAmountNum > 0
      ? Number(((requestedAmountNum / totalMarketValueNum) * 100).toFixed(1))
      : 0;

  // Fetch configured Credit Committee approvers
  let approvers: CamAutoData["approvers"] = [];
  try {
    const { data: approversData } = await supabase
      .from("cam_approvals")
      .select("*")
      .eq("loan_application_id", applicationId)
      .order("order_index", { ascending: true });

    if (approversData) {
      approvers = approversData.map((d) => ({
        id: d.id,
        camDocumentId: d.cam_document_id,
        loanApplicationId: d.loan_application_id,
        approverName: d.approver_name,
        approverEmail: d.approver_email,
        approverRole: d.approver_role || "Credit Committee Member",
        approvalStatus: d.approval_status,
        approvalToken: d.approval_token,
        tokenExpiresAt: d.token_expires_at,
        sentAt: d.sent_at,
        decisionAt: d.decision_at,
        comments: d.comments,
        conditions: d.conditions,
        digitalSignature: d.digital_signature,
        ipAddress: d.ip_address,
        orderIndex: d.order_index ?? 0,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      }));
    }
  } catch {
    // Table may not exist yet
  }

  return {
    applicationId: app.id,
    applicationCode: app.application_code,
    facilityType: app.facility_type || "Loan Against Shares (LAS)",
    requestedAmountNum,
    sanctionAmountText: formatSanctionAmount(requestedAmountNum),
    tenureMonths: app.tenure_months || 12,
    purpose: app.purpose || "Working Capital / Business Expansion / Equity Financing",
    borrower: {
      name: primaryCorp?.legal_name || primaryInd?.full_name || "—",
      cin: primaryCorp?.cin || "",
      pan: primary?.pan || "",
      gstin: primaryCorp?.gstin || "",
      address: primaryCorp?.registered_office_address || primaryInd?.current_address_line || "",
      tradeName: primaryCorp?.trade_name || undefined,
    },
    guarantorSummaries,
    securities,
    totalSecurityMarketValueNum: totalMarketValueNum,
    totalSecurityMarketValue: `Rs. ${formatIndianNumber(totalMarketValueNum)}/-`,
    securityCoverRatio,
    ltvPercent,
    marginCallThreshold: "Cover <= 2.00x (or LTV >= 50%)",
    liquidationThreshold: "Cover <= 1.75x (or LTV >= 57%)",
    corporateFinancials,
    parties,
    approvers,
  };
}

/**
 * Loads the manually-entered CAM data (CIBIL, banking, narrative sections)
 * for a loan application, or populated defaults if none exists yet.
 */
export async function getCamManualData(applicationId: string): Promise<CamManualData> {
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("cam_documents")
    .select("*")
    .eq("loan_application_id", applicationId)
    .maybeSingle();

  // If no document exists yet, auto-populate intelligent defaults
  if (!doc) {
    const autoData = await buildAutoData(applicationId);
    const base = emptyCamManualData();

    if (autoData) {
      // Default adverse checks for each party
      base.googleSearchResults = autoData.parties.map((p) => ({
        partyName: `${p.name} (${p.roleLabel})`,
        result: "No Adverse Media, Litigation, or Wilful Defaulter record identified upon public domain & MCA search.",
      }));

      // Default standard verification items
      base.verification = [
        { particular: "CIBIL / Credit Bureau Check", remark: "Verified satisfactory. Repayment track record is clear with no write-offs." },
        { particular: "MCA-21 / Director DIN Status", remark: "Directors and DIN status verified active and compliant on MCA portal." },
        { particular: "Demat & Depository Pledge Check", remark: "Pledged equity shares verified in target depository account with valid ISINs." },
        { particular: "AML / WorldCheck / PEP Screening", remark: "Clear. Entity and Key Persons not listed on RBI / UN / OFAC watchlists." },
        { particular: "Legal & Documentation Check", remark: "Loan agreement, Pledge deeds, and Guarantees drafted under standard NBFC terms." },
      ];

      // Default risk and mitigants
      base.risks = [
        {
          risk: "Market Volatility / Share Price Fluctuations",
          mitigate: `Strong initial security cover of ${autoData.securityCoverRatio > 0 ? autoData.securityCoverRatio : 2.5}x maintained with active daily mark-to-market monitoring.`,
        },
        {
          risk: "Margin Call & Liquidity Risk",
          mitigate: "Strict contract clause: Margin call trigger at 2.0x cover (top-up required within 24 hours), Liquidation trigger at 1.75x cover.",
        },
        {
          risk: "Promoter & Repayment Track Record",
          mitigate: "Personal & Corporate guarantees from key promoters; escrow of interest servicing accounts.",
        },
      ];

      base.underwritingJustification = [
        `Requested facility of ${autoData.sanctionAmountText} is fully backed by liquid collateral valued at ${autoData.totalSecurityMarketValue}.`,
        `Comfortable Security Cover ratio of ${autoData.securityCoverRatio > 0 ? `${autoData.securityCoverRatio}x` : ">= 2.50x"} (LTV: ${autoData.ltvPercent > 0 ? `${autoData.ltvPercent}%` : "<= 40%"}).`,
        "All Borrower & Guarantor profiles display compliant KYC and clean credit bureau track records.",
        "Facility terms include mandatory Top-Up covenants and Depository Pledge invocation rights upon margin breach.",
      ].join("\n");
    }

    return base;
  }

  const { data: partyRows } = await supabase
    .from("cam_party_credit_data")
    .select("*")
    .eq("cam_document_id", doc.id);

  const parties: Record<string, CamPartyManualData> = {};
  for (const row of partyRows || []) {
    parties[row.borrower_id] = {
      borrowerId: row.borrower_id,
      cibilScore: row.cibil_score || "",
      cibilOverdue: row.cibil_overdue || "",
      cibilDpd: row.cibil_dpd || "",
      cibilEnquiries3m: row.cibil_enquiries_3m || "",
      cibilLoans3m: row.cibil_loans_3m || "",
      cibilRemarks: row.cibil_remarks || "",
      bankingAnalysis: row.banking_analysis || [],
      creditFacilities: row.credit_facilities || [],
      itrData: row.itr_data || [],
    };
  }

  return {
    aboutCompanyText: doc.about_company_text || "",
    promoterProfiles: doc.promoter_profiles || [],
    underwritingJustification: doc.underwriting_justification || "",
    risks: doc.risks || [],
    googleSearchResults: doc.google_search_results || [],
    verification: doc.verification || [],
    preparedBy: doc.prepared_by || "",
    approvedBy: doc.approved_by || "",
    status: doc.status || "draft",
    parties,
  };
}

/** Saves (upserts) the manually-entered CAM data for a loan application. */
export async function saveCamManualData(
  applicationId: string,
  data: CamManualData,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  try {
    const { data: existing } = await supabase
      .from("cam_documents")
      .select("id")
      .eq("loan_application_id", applicationId)
      .maybeSingle();

    let camDocumentId = existing?.id as string | undefined;

    const payload = {
      loan_application_id: applicationId,
      about_company_text: data.aboutCompanyText,
      promoter_profiles: data.promoterProfiles,
      underwriting_justification: data.underwritingJustification,
      risks: data.risks,
      google_search_results: data.googleSearchResults,
      verification: data.verification,
      prepared_by: data.preparedBy,
      approved_by: data.approvedBy,
      updated_at: new Date().toISOString(),
    };

    if (camDocumentId) {
      const { error } = await supabase.from("cam_documents").update(payload).eq("id", camDocumentId);
      if (error) return { success: false, error: error.message };
    } else {
      const { data: inserted, error } = await supabase
        .from("cam_documents")
        .insert({ ...payload, created_by: user.id })
        .select("id")
        .single();
      if (error || !inserted) return { success: false, error: error?.message || "Failed to create CAM record." };
      camDocumentId = inserted.id;
    }

    // Replace party credit rows
    await supabase.from("cam_party_credit_data").delete().eq("cam_document_id", camDocumentId);

    const partyRows = Object.values(data.parties)
      .filter((p) => p.borrowerId)
      .map((p) => ({
        cam_document_id: camDocumentId,
        borrower_id: p.borrowerId,
        cibil_score: p.cibilScore,
        cibil_overdue: p.cibilOverdue,
        cibil_dpd: p.cibilDpd,
        cibil_enquiries_3m: p.cibilEnquiries3m,
        cibil_loans_3m: p.cibilLoans3m,
        cibil_remarks: p.cibilRemarks,
        banking_analysis: p.bankingAnalysis,
        credit_facilities: p.creditFacilities,
        itr_data: p.itrData,
      }));

    if (partyRows.length > 0) {
      const { error: partyErr } = await supabase.from("cam_party_credit_data").insert(partyRows);
      if (partyErr) return { success: false, error: partyErr.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Failed to save CAM data." };
  }
}

export type GenerateCamResult = { success: boolean; url?: string; error?: string };

/**
 * Generates the final CAM .docx by merging auto-filled loan/borrower data
 * with the manually-entered sections, stores it, and returns a download URL.
 */
export async function generateCamDocument(applicationId: string): Promise<GenerateCamResult> {
  try {
    const autoData = await buildAutoData(applicationId);
    if (!autoData) return { success: false, error: "Loan application not found." };

    const manualData = await getCamManualData(applicationId);

    const buffer = await buildCamDocx(autoData, manualData);

    const fileName = `CAM_${autoData.applicationCode}_${Date.now()}.docx`;
    const storagePath = `cam/${applicationId}/${fileName}`;

    const file = new File([new Uint8Array(buffer)], fileName, {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const uploadRes = await uploadDocumentFile({ storagePath, file });
    if (!uploadRes.success) {
      return { success: false, error: uploadRes.error || "Failed to store generated CAM." };
    }

    const supabase = await createClient();
    await supabase
      .from("cam_documents")
      .update({ generated_storage_path: storagePath, generated_at: new Date().toISOString() })
      .eq("loan_application_id", applicationId);

    const urlRes = await getDocumentSignedUrl(storagePath, 60 * 60);
    if (!urlRes.success || !urlRes.url) {
      return { success: false, error: "CAM generated but could not create a download link." };
    }

    return { success: true, url: urlRes.url };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Failed to generate CAM." };
  }
}

export async function getAutoCamPreview(applicationId: string): Promise<CamAutoData | null> {
  return buildAutoData(applicationId);
}

/**
 * Saves/replaces pledged securities directly from the CAM Collateral & LTV tab
 * and returns the re-calculated CamAutoData.
 */
export async function saveCamSecurities(
  applicationId: string,
  securities: Array<{
    scripName: string;
    quantity: number;
    cmp: number;
    isin?: string;
    pledgorName?: string;
    pledgorBorrowerId?: string;
    securityCover?: number;
  }>,
): Promise<{ success: boolean; autoData?: CamAutoData; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  try {
    // Delete existing collaterals for this application
    await supabase.from("loan_collaterals").delete().eq("loan_application_id", applicationId);

    if (securities.length > 0) {
      const collateralsToInsert = securities.map((s) => {
        const mVal = Number(s.quantity) * Number(s.cmp);
        const item: LASSecurityItem = {
          id: crypto.randomUUID(),
          security_name: s.scripName,
          isin: s.isin || "",
          quantity: Number(s.quantity) || 0,
          cmp: Number(s.cmp) || 0,
          market_value: mVal,
          security_cover: s.securityCover || 2.5,
          loan_value: mVal / (s.securityCover || 2.5),
          pledgor_name: s.pledgorName || "Primary Borrower",
          pledgor_borrower_id: s.pledgorBorrowerId,
        };

        return {
          loan_application_id: applicationId,
          collateral_type: "Equity Shares",
          charge_type: "Pledge",
          property_status: "Dematerialized",
          estimated_value: mVal,
          details: JSON.stringify(item),
        };
      });

      const { error: insertErr } = await supabase.from("loan_collaterals").insert(collateralsToInsert);
      if (insertErr) return { success: false, error: insertErr.message };
    }

    const updated = await buildAutoData(applicationId);
    if (!updated) return { success: false, error: "Failed to recalculate loan metrics." };

    return { success: true, autoData: updated };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Failed to update securities." };
  }
}

/**
 * Refreshes live market prices (CMP) from NSE/BSE for all pledged scrips in the CAM,
 * updates the database, and returns the newly computed CamAutoData.
 */
export async function refreshCamSecurityPrices(
  applicationId: string,
): Promise<{ success: boolean; autoData?: CamAutoData; error?: string; updatedCount?: number }> {
  const supabase = await createClient();

  try {
    const { data: collateralsData } = await supabase
      .from("loan_collaterals")
      .select("*")
      .eq("loan_application_id", applicationId);

    if (!collateralsData || collateralsData.length === 0) {
      return { success: false, error: "No pledged collateral found to refresh." };
    }

    let updatedCount = 0;

    for (const c of collateralsData) {
      if (c.collateral_type === "Equity Shares" && c.details) {
        try {
          const parsed = JSON.parse(c.details) as LASSecurityItem;
          const query = parsed.isin || parsed.security_name;
          if (query) {
            const quote = await fetchLiveStockPrice(query);
            if (quote.success && quote.cmp && quote.cmp > 0) {
              parsed.cmp = quote.cmp;
              parsed.market_value = (Number(parsed.quantity) || 0) * quote.cmp;
              if (quote.isin && !parsed.isin) {
                parsed.isin = quote.isin;
              }
              if (parsed.security_cover && parsed.security_cover > 0) {
                parsed.loan_value = parsed.market_value / parsed.security_cover;
              }

              await supabase
                .from("loan_collaterals")
                .update({
                  estimated_value: parsed.market_value,
                  details: JSON.stringify(parsed),
                })
                .eq("id", c.id);

              updatedCount++;
            }
          }
        } catch {
          // Continue with next
        }
      }
    }

    const updated = await buildAutoData(applicationId);
    if (!updated) return { success: false, error: "Failed to recalculate loan metrics after refresh." };

    return { success: true, autoData: updated, updatedCount };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Failed to refresh market prices." };
  }
}

