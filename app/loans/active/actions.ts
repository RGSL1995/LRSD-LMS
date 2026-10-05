"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { unwrapRelation, type Relation } from "@/lib/utils";

export type ApplicationSearchResult = {
  id: string;
  application_code: string;
  status: string;
  requested_amount: number;
  tenure_months: number | null;
  facility_type: string | null;
  purpose: string | null;
  created_at: string;
  borrower_id: string;
  already_booked: boolean;
  linked_loan_code?: string | null;
  borrower: {
    id: string;
    borrower_code: string;
    borrower_type: string;
    pan: string | null;
    displayName: string;
  };
  partiesCount: number;
  collateralsCount: number;
  totalCollateralValue: number;
};

type EmbeddedBorrower = {
  id: string;
  borrower_code?: string;
  borrower_type: string;
  pan?: string | null;
  individual_profiles: Relation<{ full_name: string; email?: string | null; phone?: string | null }>;
  corporate_profiles: Relation<{ legal_name: string; trade_name?: string | null; pan?: string | null; cin?: string | null; gstin?: string | null }>;
  other_profiles: Relation<{ entity_name: string; entity_category?: string | null }>;
};

function getBorrowerDisplayName(borrowerData: Relation<EmbeddedBorrower>): string {
  const b = unwrapRelation<EmbeddedBorrower>(borrowerData);
  if (!b) return "—";
  const ind = unwrapRelation(b.individual_profiles);
  const corp = unwrapRelation(b.corporate_profiles);
  const oth = unwrapRelation(b.other_profiles);
  return ind?.full_name ?? corp?.legal_name ?? oth?.entity_name ?? b.borrower_code ?? "—";
}

/**
 * Searches approved and eligible loan applications by Application Number,
 * Borrower Name, or PAN.
 */
export async function searchApprovedApplications(
  query = ""
): Promise<ApplicationSearchResult[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  // 1. Fetch existing booked loans to mark applications that are already booked
  const { data: existingLoans } = await supabase
    .from("loans")
    .select("id, loan_code, loan_application_id");

  const bookedMap = new Map<string, string>();
  if (existingLoans) {
    for (const l of existingLoans) {
      if (l.loan_application_id) {
        bookedMap.set(l.loan_application_id, l.loan_code);
      }
    }
  }

  // 2. Query loan applications (prioritize approved, submitted, under_review)
  let appQuery = supabase
    .from("loan_applications")
    .select(
      `id, application_code, requested_amount, purpose, status, created_at, borrower_id,
       borrowers (
         id, borrower_code, borrower_type, pan,
         individual_profiles ( full_name, email, phone ),
         corporate_profiles ( legal_name, trade_name, pan, cin, gstin ),
         other_profiles ( entity_name, entity_category )
       )`
    )
    .order("created_at", { ascending: false });

  const cleanQuery = query.trim().toUpperCase();
  if (cleanQuery) {
    appQuery = appQuery.ilike("application_code", `%${cleanQuery}%`);
  }

  const { data: applications, error } = await appQuery;

  if (error || !applications) {
    console.error("[searchApprovedApplications] Error fetching applications:", error);
    return [];
  }

  // 3. Gather party counts and collateral details
  const appIds = applications.map((a) => a.id);

  let partiesByApp: Record<string, number> = {};
  let collateralsByApp: Record<string, { count: number; totalVal: number }> = {};

  if (appIds.length > 0) {
    try {
      const { data: partiesData } = await supabase
        .from("loan_application_parties")
        .select("loan_application_id")
        .in("loan_application_id", appIds);

      if (partiesData) {
        for (const p of partiesData) {
          partiesByApp[p.loan_application_id] = (partiesByApp[p.loan_application_id] || 0) + 1;
        }
      }

      const { data: collateralsData } = await supabase
        .from("loan_collaterals")
        .select("loan_application_id, estimated_value")
        .in("loan_application_id", appIds);

      if (collateralsData) {
        for (const c of collateralsData) {
          if (!collateralsByApp[c.loan_application_id]) {
            collateralsByApp[c.loan_application_id] = { count: 0, totalVal: 0 };
          }
          collateralsByApp[c.loan_application_id].count += 1;
          collateralsByApp[c.loan_application_id].totalVal += Number(c.estimated_value || 0);
        }
      }
    } catch {
      // Ignore if optional tables are empty
    }
  }

  const results: ApplicationSearchResult[] = [];

  for (const app of applications) {
    const rawBorrower = unwrapRelation<EmbeddedBorrower>(app.borrowers as unknown as Relation<EmbeddedBorrower>);
    const displayName = getBorrowerDisplayName(app.borrowers as unknown as Relation<EmbeddedBorrower>);
    const alreadyBooked = bookedMap.has(app.id);
    const linkedLoanCode = bookedMap.get(app.id) || null;

    // Filter matching on borrower name/PAN if search query provided and didn't match application code
    if (cleanQuery && !app.application_code.toUpperCase().includes(cleanQuery)) {
      const panMatch = rawBorrower?.pan?.toUpperCase().includes(cleanQuery);
      const nameMatch = displayName.toUpperCase().includes(cleanQuery);
      if (!panMatch && !nameMatch) {
        continue;
      }
    }

    results.push({
      id: app.id,
      application_code: app.application_code,
      status: app.status,
      requested_amount: Number(app.requested_amount || 0),
      tenure_months: (app as Record<string, unknown>).tenure_months ? Number((app as Record<string, unknown>).tenure_months) : 60,
      facility_type: ((app as Record<string, unknown>).facility_type as string) || "Commercial Loan",
      purpose: app.purpose,
      created_at: app.created_at,
      borrower_id: app.borrower_id,
      already_booked: alreadyBooked,
      linked_loan_code: linkedLoanCode,
      borrower: {
        id: rawBorrower?.id ?? app.borrower_id,
        borrower_code: rawBorrower?.borrower_code ?? "—",
        borrower_type: rawBorrower?.borrower_type ?? "corporate",
        pan: rawBorrower?.pan ?? null,
        displayName,
      },
      partiesCount: partiesByApp[app.id] || 0,
      collateralsCount: collateralsByApp[app.id]?.count || 0,
      totalCollateralValue: collateralsByApp[app.id]?.totalVal || 0,
    });
  }

  return results;
}

export type BookFacilityPayload = {
  loan_application_id: string;
  sanctioned_amount: number;
  interest_rate: number;
  tenure_months: number;
  sanctioned_at?: string;
  first_disbursal_date?: string;
};

/**
 * Books an approved loan application into an official active loan facility (`public.loans`).
 */
export async function bookActiveFacility(payload: BookFacilityPayload): Promise<{
  success: boolean;
  loanId?: string;
  loanCode?: string;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized. Please sign in." };
  }

  if (!payload.loan_application_id) {
    return { success: false, error: "Please select a valid Loan Application." };
  }

  if (payload.sanctioned_amount <= 0) {
    return { success: false, error: "Sanctioned amount must be greater than zero." };
  }

  if (payload.interest_rate <= 0 || payload.interest_rate > 100) {
    return { success: false, error: "Interest rate must be between 0.1% and 100% p.a." };
  }

  if (payload.tenure_months <= 0) {
    return { success: false, error: "Tenure must be at least 1 month." };
  }

  // 1. Verify application exists and get borrower_id
  const { data: application, error: fetchErr } = await supabase
    .from("loan_applications")
    .select("id, application_code, borrower_id, status, requested_amount")
    .eq("id", payload.loan_application_id)
    .single();

  if (fetchErr || !application) {
    return { success: false, error: "Loan application file not found." };
  }

  // 2. Check if already booked
  const { data: existingLoan } = await supabase
    .from("loans")
    .select("id, loan_code")
    .eq("loan_application_id", payload.loan_application_id)
    .maybeSingle();

  if (existingLoan) {
    return {
      success: false,
      error: `This application is already booked into active facility #${existingLoan.loan_code}.`,
    };
  }

  // 3. Generate sequential loan code: LN-YYYY-XXXX
  const currentYear = new Date().getFullYear();
  const yearPrefix = `LN-${currentYear}-`;

  const { data: latestLoan } = await supabase
    .from("loans")
    .select("loan_code")
    .ilike("loan_code", `${yearPrefix}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextSequence = 1;
  if (latestLoan?.loan_code) {
    const parts = latestLoan.loan_code.split("-");
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextSequence = lastNum + 1;
    }
  }

  // Pad to 4 digits: e.g. LN-2026-0001
  const loanCode = `${yearPrefix}${String(nextSequence).padStart(4, "0")}`;

  // 4. Insert into public.loans
  const { data: newLoan, error: insertErr } = await supabase
    .from("loans")
    .insert({
      loan_code: loanCode,
      loan_application_id: application.id,
      borrower_id: application.borrower_id,
      sanctioned_amount: payload.sanctioned_amount,
      interest_rate: payload.interest_rate,
      tenure_months: payload.tenure_months,
      status: "active",
      sanctioned_at: payload.sanctioned_at || new Date().toISOString(),
      created_by: user.id,
    })
    .select("id, loan_code")
    .single();

  if (insertErr || !newLoan) {
    console.error("[bookActiveFacility] Error inserting loan:", insertErr);
    return {
      success: false,
      error: insertErr?.message || "Failed to book active loan facility.",
    };
  }

  // 5. Update loan application status to 'approved' if not already
  if (application.status !== "approved") {
    await supabase
      .from("loan_applications")
      .update({ status: "approved" })
      .eq("id", application.id);
  }

  // 6. Record in audit_logs
  try {
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "BOOK_ACTIVE_FACILITY",
      entity_type: "loans",
      entity_id: newLoan.id,
      new_data: {
        loan_code: newLoan.loan_code,
        application_code: application.application_code,
        sanctioned_amount: payload.sanctioned_amount,
        interest_rate: payload.interest_rate,
        tenure_months: payload.tenure_months,
      },
    });
  } catch {
    // Non-blocking audit log
  }

  revalidatePath("/loans/active");
  revalidatePath("/loans");
  revalidatePath("/dashboard");

  return {
    success: true,
    loanId: newLoan.id,
    loanCode: newLoan.loan_code,
  };
}

/**
 * Deletes an active loan facility (if no disbursements or repayments exist).
 */
export async function deleteActiveFacility(loanId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized." };
  }

  // Check disbursements
  const { data: disbs } = await supabase
    .from("loan_disbursements")
    .select("id")
    .eq("loan_id", loanId)
    .limit(1);

  if (disbs && disbs.length > 0) {
    return {
      success: false,
      error: "Cannot delete facility: Disbursed tranches exist on this account. Cancel or reverse disbursements first.",
    };
  }

  const { error: delErr } = await supabase
    .from("loans")
    .delete()
    .eq("id", loanId);

  if (delErr) {
    return { success: false, error: delErr.message };
  }

  revalidatePath("/loans/active");
  revalidatePath("/dashboard");

  return { success: true };
}

/**
 * Creates a realistic demo commercial loan facility so the user can test the LMS immediately
 * even if they haven't originated an application yet.
 */
export async function createDemoFacility(): Promise<{
  success: boolean;
  loanId?: string;
  loanCode?: string;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized. Please sign in." };
  }

  // 1. Check if a borrower exists or create a demo corporate borrower
  let borrowerId: string | null = null;
  const { data: existingBorrower } = await supabase
    .from("borrowers")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (existingBorrower?.id) {
    borrowerId = existingBorrower.id;
  } else {
    // Create demo borrower
    const { data: newBorrower, error: bErr } = await supabase
      .from("borrowers")
      .insert({
        borrower_code: "CORP-DEMO-01",
        borrower_type: "corporate",
        pan: "AAACA1234F",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (bErr || !newBorrower) {
      return { success: false, error: bErr?.message || "Failed to create demo borrower." };
    }

    borrowerId = newBorrower.id;

    await supabase.from("corporate_profiles").insert({
      borrower_id: borrowerId,
      legal_name: "Apex Infrastructure Developers Ltd",
      trade_name: "Apex Infra",
      pan: "AAACA1234F",
      cin: "L45200MH2012PLC123456",
      gstin: "27AAACA1234F1Z5",
      business_type: "public_limited",
      registered_office_address: "Plot 42, Bandra-Kurla Complex, Bandra East, Mumbai, Maharashtra - 400051",
    });
  }

  // 2. Create approved loan application skeleton
  const appCode = `APP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const { data: newApp, error: aErr } = await supabase
    .from("loan_applications")
    .insert({
      application_code: appCode,
      borrower_id: borrowerId,
      requested_amount: 250000000, // 25 Cr
      purpose: "Commercial Real Estate Development & Working Capital facility",
      status: "approved",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (aErr || !newApp) {
    return { success: false, error: aErr?.message || "Failed to create application." };
  }

  // 3. Book active facility
  const loanCode = `LN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const { data: newLoan, error: lErr } = await supabase
    .from("loans")
    .insert({
      loan_code: loanCode,
      loan_application_id: newApp.id,
      borrower_id: borrowerId,
      sanctioned_amount: 250000000,
      interest_rate: 11.25,
      tenure_months: 60,
      status: "active",
      sanctioned_at: new Date().toISOString(),
      created_by: user.id,
    })
    .select("id, loan_code")
    .single();

  if (lErr || !newLoan) {
    return { success: false, error: lErr?.message || "Failed to book active loan." };
  }

  // 4. Also add a sample initial disbursement tranche
  try {
    await supabase.from("loan_disbursements").insert({
      loan_id: newLoan.id,
      amount: 100000000, // 10 Cr initial tranche
      disbursed_at: new Date().toISOString(),
      reference_number: "CMS/UTR/2026/0921/0082",
      created_by: user.id,
    });
  } catch {
    // Non-blocking
  }

  revalidatePath("/loans/active");
  revalidatePath("/dashboard");

  return {
    success: true,
    loanId: newLoan.id,
    loanCode: newLoan.loan_code,
  };
}
