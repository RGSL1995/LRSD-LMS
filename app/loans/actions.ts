"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

import { unwrapRelation } from "@/lib/utils";
import { getBorrowerAvatarUrl } from "@/app/borrowers/avatar-actions";
import { type LASSecurityItem } from "./las-types";

export type BorrowerLookup = {
  id: string;
  borrower_code: string;
  borrower_type: "individual" | "corporate" | "other";
  displayName: string;
  pan: string;
  avatar_url?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  email?: string | null;
  phone?: string | null;
  business_type?: string | null;
  incorporation_date?: string | null;
  date_of_birth?: string | null;
  cin?: string | null;
  gstin?: string | null;
  trade_name?: string | null;
  occupation?: string | null;
  registered_address?: string | null;
  corporate_address?: string | null;
  entity_category?: string | null;
};

function getPanVariations(input: string): string[] {
  const clean = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean) return [];

  const variations = new Set<string>([clean]);

  // Standard Indian PAN is 10 characters:
  // Chars 0-4: Letters
  // Chars 5-8: Digits
  // Char 9: Letter
  // Humans often confuse letter 'O' with digit '0':
  if (clean.length === 10) {
    // 5th character (index 4) should be a letter (e.g. 'O'), but might be entered as digit '0'
    if (clean[4] === "O") {
      variations.add(clean.slice(0, 4) + "0" + clean.slice(5));
    } else if (clean[4] === "0") {
      variations.add(clean.slice(0, 4) + "O" + clean.slice(5));
    }

    // 9th character (index 8) should be a digit (e.g. '0'), but might be entered as letter 'O'
    if (clean[8] === "0") {
      variations.add(clean.slice(0, 8) + "O" + clean.slice(9));
    } else if (clean[8] === "O") {
      variations.add(clean.slice(0, 8) + "0" + clean.slice(9));
    }

    // Both swapped
    const both = clean
      .split("")
      .map((c, idx) => {
        if (idx === 4) return c === "O" ? "0" : c === "0" ? "O" : c;
        if (idx === 8) return c === "0" ? "O" : c === "0" ? "0" : c;
        return c;
      })
      .join("");
    variations.add(both);
  }

  return Array.from(variations);
}

async function resolveBorrowerById(borrowerId: string, fallbackPan: string): Promise<BorrowerLookup | null> {
  const supabase = await createClient();
  const { data: b, error } = await supabase
    .from("borrowers")
    .select(
      `id, borrower_code, borrower_type, pan,
       individual_profiles ( full_name, date_of_birth, email, phone, current_address_line, current_city, current_state, current_pincode, occupation, pan ),
       corporate_profiles ( legal_name, trade_name, cin, business_type, incorporation_date, registered_office_address, registered_office_city, registered_office_state, registered_office_pincode, corporate_office_address, corporate_office_city, corporate_office_state, corporate_office_pincode, contact_email, contact_no, pan, gstin ),
       other_profiles ( entity_name, entity_category, address, pan )`,
    )
    .eq("id", borrowerId)
    .maybeSingle();

  if (error || !b) {
    console.error("[findBorrowerByPan] resolveBorrowerById error:", error);
    return null;
  }

  const ind = unwrapRelation<{
    full_name: string;
    date_of_birth?: string;
    email?: string;
    phone?: string;
    current_address_line?: string;
    current_city?: string;
    current_state?: string;
    current_pincode?: string;
    occupation?: string;
    pan?: string;
  }>(b.individual_profiles);

  const corp = unwrapRelation<{
    legal_name: string;
    trade_name?: string;
    cin?: string;
    business_type?: string;
    incorporation_date?: string;
    registered_office_address?: string;
    registered_office_city?: string;
    registered_office_state?: string;
    registered_office_pincode?: string;
    corporate_office_address?: string;
    corporate_office_city?: string;
    corporate_office_state?: string;
    corporate_office_pincode?: string;
    contact_email?: string;
    contact_no?: string;
    pan?: string;
    gstin?: string;
  }>(b.corporate_profiles);

  const oth = unwrapRelation<{
    entity_name: string;
    entity_category?: string;
    address?: string;
    pan?: string;
  }>(b.other_profiles);

  const displayName =
    ind?.full_name ??
    corp?.legal_name ??
    oth?.entity_name ??
    b.borrower_code;

  const resolvedPan = b.pan || corp?.pan || ind?.pan || oth?.pan || fallbackPan;

  // Auto back-fill borrowers.pan if it was null so future lookups are instantaneous
  if (!b.pan && resolvedPan) {
    try {
      await supabase.from("borrowers").update({ pan: resolvedPan }).eq("id", b.id);
    } catch {
      // ignore
    }
  }

  const avatarUrl = await getBorrowerAvatarUrl(b.id);

  const resolvedAddress =
    corp?.registered_office_address ||
    corp?.corporate_office_address ||
    ind?.current_address_line ||
    oth?.address ||
    null;

  const resolvedCity =
    corp?.registered_office_city ||
    corp?.corporate_office_city ||
    ind?.current_city ||
    null;

  const resolvedState =
    corp?.registered_office_state ||
    corp?.corporate_office_state ||
    ind?.current_state ||
    null;

  const resolvedPincode =
    corp?.registered_office_pincode ||
    corp?.corporate_office_pincode ||
    ind?.current_pincode ||
    null;

  return {
    id: b.id,
    borrower_code: b.borrower_code,
    borrower_type: b.borrower_type,
    displayName,
    pan: resolvedPan,
    avatar_url: avatarUrl,
    address: resolvedAddress,
    city: resolvedCity,
    state: resolvedState,
    pincode: resolvedPincode,
    email: ind?.email || corp?.contact_email || null,
    phone: ind?.phone || corp?.contact_no || null,
    business_type: corp?.business_type || null,
    incorporation_date: corp?.incorporation_date || null,
    date_of_birth: ind?.date_of_birth || null,
    cin: corp?.cin || null,
    gstin: corp?.gstin || null,
    trade_name: corp?.trade_name || null,
    occupation: ind?.occupation || null,
    registered_address: corp?.registered_office_address || null,
    corporate_address: corp?.corporate_office_address || null,
    entity_category: oth?.entity_category || null,
  };
}

export async function findBorrowerByPan(pan: string): Promise<BorrowerLookup | null> {
  const supabase = await createClient();
  const rawInput = pan.trim();
  if (!rawInput) return null;

  const upperInput = rawInput.toUpperCase();

  // 0A. Check if input matches a Loan Application Number (e.g. APP-2026-0001)
  const { data: appMatch } = await supabase
    .from("loan_applications")
    .select("borrower_id, application_code, status")
    .ilike("application_code", upperInput)
    .limit(1)
    .maybeSingle();

  if (appMatch?.borrower_id) {
    console.log("[findBorrowerByPan] Matched loan application:", appMatch.application_code, "borrower_id:", appMatch.borrower_id);
    return resolveBorrowerById(appMatch.borrower_id, "");
  }

  // 0B. Check if input matches a Borrower Code (e.g. BRW-XXXXXX)
  const { data: brwMatch } = await supabase
    .from("borrowers")
    .select("id, borrower_code")
    .ilike("borrower_code", upperInput)
    .limit(1)
    .maybeSingle();

  if (brwMatch?.id) {
    console.log("[findBorrowerByPan] Matched borrower code:", brwMatch.borrower_code, "id:", brwMatch.id);
    return resolveBorrowerById(brwMatch.id, "");
  }

  const cleanPan = upperInput.replace(/[^A-Z0-9]/g, "");
  if (!cleanPan) return null;

  const variations = getPanVariations(cleanPan);
  console.log("[findBorrowerByPan] Searching for PAN:", cleanPan, "variations:", variations);

  // 1. Check borrowers table directly
  for (const v of variations) {

    const { data: b } = await supabase
      .from("borrowers")
      .select("id")
      .or(`pan.ilike.${v},pan.ilike.%${v}%`)
      .limit(1)
      .maybeSingle();

    if (b?.id) {
      console.log("[findBorrowerByPan] Matched borrowers.pan for variant:", v, "id:", b.id);
      return resolveBorrowerById(b.id, cleanPan);
    }
  }

  // 2. Check corporate_profiles table (pan, gstin, cin)
  for (const v of variations) {
    const { data: corp } = await supabase
      .from("corporate_profiles")
      .select("borrower_id")
      .or(`pan.ilike.${v},pan.ilike.%${v}%,gstin.ilike.%${v}%,cin.ilike.%${v}%`)
      .limit(1)
      .maybeSingle();

    if (corp?.borrower_id) {
      console.log("[findBorrowerByPan] Matched corporate_profiles for variant:", v, "borrower_id:", corp.borrower_id);
      return resolveBorrowerById(corp.borrower_id, cleanPan);
    }
  }

  // 3. Check individual_profiles table (pan)
  for (const v of variations) {
    const { data: ind } = await supabase
      .from("individual_profiles")
      .select("borrower_id")
      .or(`pan.ilike.${v},pan.ilike.%${v}%`)
      .limit(1)
      .maybeSingle();

    if (ind?.borrower_id) {
      console.log("[findBorrowerByPan] Matched individual_profiles for variant:", v, "borrower_id:", ind.borrower_id);
      return resolveBorrowerById(ind.borrower_id, cleanPan);
    }
  }

  // 4. Check corporate_gst_records table (every GST record has PAN inside)
  for (const v of variations) {
    try {
      const { data: gst } = await supabase
        .from("corporate_gst_records")
        .select("borrower_id")
        .ilike("gstin", `%${v}%`)
        .limit(1)
        .maybeSingle();

      if (gst?.borrower_id) {
        console.log("[findBorrowerByPan] Matched corporate_gst_records for variant:", v, "borrower_id:", gst.borrower_id);
        return resolveBorrowerById(gst.borrower_id, cleanPan);
      }
    } catch {
      // ignore if table doesn't exist
    }
  }

  // 5. Check other_profiles
  for (const v of variations) {
    const { data: oth } = await supabase
      .from("other_profiles")
      .select("borrower_id")
      .or(`pan.ilike.${v},pan.ilike.%${v}%`)
      .limit(1)
      .maybeSingle();

    if (oth?.borrower_id) {
      console.log("[findBorrowerByPan] Matched other_profiles for variant:", v, "borrower_id:", oth.borrower_id);
      return resolveBorrowerById(oth.borrower_id, cleanPan);
    }
  }

  // 6. Check corporate_associates
  for (const v of variations) {
    try {
      const { data: asc } = await supabase
        .from("corporate_associates")
        .select("borrower_id")
        .or(`pan.ilike.${v},pan.ilike.%${v}%`)
        .limit(1)
        .maybeSingle();

      if (asc?.borrower_id) {
        console.log("[findBorrowerByPan] Matched corporate_associates for variant:", v, "borrower_id:", asc.borrower_id);
        return resolveBorrowerById(asc.borrower_id, cleanPan);
      }
    } catch {
      // ignore
    }
  }

  // 7. Check borrower_documents (if file_name has PAN)
  for (const v of variations) {
    try {
      const { data: doc } = await supabase
        .from("borrower_documents")
        .select("borrower_id")
        .or(`file_name.ilike.%${v}%,storage_path.ilike.%${v}%`)
        .limit(1)
        .maybeSingle();

      if (doc?.borrower_id) {
        console.log("[findBorrowerByPan] Matched borrower_documents for variant:", v, "borrower_id:", doc.borrower_id);
        return resolveBorrowerById(doc.borrower_id, cleanPan);
      }
    } catch {
      // ignore
    }
  }

  console.log("[findBorrowerByPan] No borrower found for PAN or variations:", variations);
  return null;
}

export type InlineBorrowerData = {
  borrower_type: "individual" | "corporate" | "other";
  pan: string;
  // Individual fields
  full_name?: string;
  date_of_birth?: string;
  gender?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  occupation?: string;
  photo_url?: string;
  // Corporate fields
  legal_name?: string;
  trade_name?: string;
  business_type?: string;
  cin?: string;
  gstin?: string;
  incorporation_date?: string;
  registered_address?: string;
  corporate_address?: string;
  contact_no?: string;
  contact_email?: string;
  logo_url?: string;
};

export async function createBorrowerInline(
  data: InlineBorrowerData,
): Promise<{ success: boolean; borrower?: BorrowerLookup; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "You must be signed in." };

  const pan = data.pan.trim().toUpperCase();
  if (!pan) return { success: false, error: "PAN is required." };

  // Double check if already exists
  const existing = await findBorrowerByPan(pan);
  if (existing) {
    return { success: true, borrower: existing };
  }

  const prefix = data.borrower_type.slice(0, 3).toUpperCase();
  const borrowerCode = `${prefix}-${Date.now().toString(36).toUpperCase()}`;

  const { data: borrower, error: borrowerError } = await supabase
    .from("borrowers")
    .insert({
      borrower_code: borrowerCode,
      borrower_type: data.borrower_type,
      pan,
      created_by: user.id,
    })
    .select("id, borrower_code, borrower_type, pan")
    .single();

  if (borrowerError || !borrower) {
    return {
      success: false,
      error:
        borrowerError?.code === "23505"
          ? "A borrower with this PAN already exists."
          : borrowerError?.message ?? "Failed to create borrower.",
    };
  }

  let displayName = borrowerCode;
  let address = data.address || data.registered_address || null;

  if (data.borrower_type === "individual") {
    displayName = data.full_name?.trim() || borrowerCode;
    const { error: indError } = await supabase.from("individual_profiles").insert({
      borrower_id: borrower.id,
      full_name: displayName,
      pan,
      date_of_birth: data.date_of_birth || null,
      email: data.email || null,
      phone: data.phone || null,
      current_address_line: data.address || null,
    });
    if (indError) return { success: false, error: indError.message };
  } else if (data.borrower_type === "corporate") {
    displayName = data.legal_name?.trim() || borrowerCode;
    address = data.registered_address || data.address || null;
    const { error: corpError } = await supabase.from("corporate_profiles").insert({
      borrower_id: borrower.id,
      legal_name: displayName,
      business_type: data.business_type || "other",
      pan,
      cin: data.cin || null,
      gstin: data.gstin || null,
      incorporation_date: data.incorporation_date || null,
      registered_office_address: address,
    });
    if (corpError) return { success: false, error: corpError.message };
  } else {
    displayName = data.legal_name || data.full_name || borrowerCode;
    const { error: othError } = await supabase.from("other_profiles").insert({
      borrower_id: borrower.id,
      entity_name: displayName,
      pan,
      address,
    });
    if (othError) return { success: false, error: othError.message };
  }

  return {
    success: true,
    borrower: {
      id: borrower.id,
      borrower_code: borrower.borrower_code,
      borrower_type: borrower.borrower_type,
      displayName,
      pan,
      avatar_url: data.photo_url || data.logo_url || null,
      address,
      city: data.city || null,
      state: data.state || null,
      pincode: data.pincode || null,
      email: data.email || data.contact_email || null,
      phone: data.phone || data.contact_no || null,
      business_type: data.business_type || null,
      incorporation_date: data.incorporation_date || null,
      date_of_birth: data.date_of_birth || null,
      cin: data.cin || null,
      gstin: data.gstin || null,
      trade_name: data.trade_name || null,
      occupation: data.occupation || null,
      registered_address: data.registered_address || address || null,
      corporate_address: data.corporate_address || null,
    },
  };
}

export type CreateWholesaleLoanPayload = {
  application_code: string;
  primary_borrower_id: string;
  requested_amount: number;
  purpose: string;
  tenure_months: number;
  facility_type: "LAS (Loan Against Securities)" | "LAP" | "Project Finance" | "Others";
  facility_type_other?: string;
  co_borrowers?: Array<{
    borrower_id: string;
    order_index?: number;
  }>;
  guarantors?: Array<{
    borrower_id: string;
    guarantee_type?: "personal" | "corporate" | "unconditional" | "limited" | null;
    is_security_provider?: boolean;
    order_index?: number;
  }>;
  security_providers?: Array<{
    borrower_id: string;
    is_guarantor?: boolean;
    guarantee_type?: "personal" | "corporate" | null;
    order_index?: number;
  }>;
  collaterals?: Array<{
    collateral_type: string;
    charge_type?: string;
    property_status?: string;
    address?: string;
    city?: string;
    pincode?: string;
    estimated_value?: number;
    details?: string;
  }>;
  las_securities?: LASSecurityItem[];
};

export async function createWholesaleLoanApplication(
  payload: CreateWholesaleLoanPayload,
): Promise<{ success: boolean; applicationId?: string; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "You must be signed in." };

  if (!payload.application_code?.trim()) {
    return { success: false, error: "Application number is required." };
  }
  if (!payload.primary_borrower_id) {
    return { success: false, error: "Primary borrower is required." };
  }
  if (!payload.requested_amount || payload.requested_amount <= 0) {
    return { success: false, error: "Requested loan amount must be greater than zero." };
  }

  const facilityTypeStr =
    payload.facility_type === "Others" && payload.facility_type_other?.trim()
      ? `Others: ${payload.facility_type_other.trim()}`
      : payload.facility_type;

  // 1. Insert into loan_applications
  const applicationInsertData: Record<string, unknown> = {
    application_code: payload.application_code.trim(),
    borrower_id: payload.primary_borrower_id,
    requested_amount: payload.requested_amount,
    purpose: payload.purpose?.trim() || null,
    tenure_months: payload.tenure_months || null,
    facility_type: facilityTypeStr || null,
    created_by: user.id,
  };

  const { data: application, error: appError } = await supabase
    .from("loan_applications")
    .insert(applicationInsertData)
    .select("id")
    .single();

  if (appError || !application) {
    // If tenure_months or facility_type columns fail because migration 0011 not run yet, retry without them
    if (appError?.message?.includes("column") || appError?.code === "42703") {
      delete applicationInsertData.tenure_months;
      delete applicationInsertData.facility_type;
      const { data: retryApp, error: retryError } = await supabase
        .from("loan_applications")
        .insert(applicationInsertData)
        .select("id")
        .single();
      if (retryError || !retryApp) {
        return {
          success: false,
          error: retryError?.message ?? "Failed to create loan application.",
        };
      }
      return processPartiesAndFinish(retryApp.id, payload, supabase);
    }

    return {
      success: false,
      error:
        appError?.code === "23505"
          ? "That application number is already in use."
          : appError?.message ?? "Failed to create loan application.",
    };
  }

  return processPartiesAndFinish(application.id, payload, supabase);
}

async function processPartiesAndFinish(
  applicationId: string,
  payload: CreateWholesaleLoanPayload,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  // 2. Prepare multi-party records
  const partiesToInsert: Array<{
    loan_application_id: string;
    borrower_id: string;
    party_role: "primary_borrower" | "co_borrower" | "guarantor" | "security_provider";
    guarantee_type: string | null;
    is_primary: boolean;
    order_index: number;
    is_guarantor?: boolean;
    is_security_provider?: boolean;
  }> = [];

  // Primary Borrower
  partiesToInsert.push({
    loan_application_id: applicationId,
    borrower_id: payload.primary_borrower_id,
    party_role: "primary_borrower",
    guarantee_type: null,
    is_primary: true,
    order_index: 0,
    is_guarantor: false,
    is_security_provider: false,
  });

  // Co-Borrowers
  if (payload.co_borrowers && payload.co_borrowers.length > 0) {
    payload.co_borrowers.forEach((cb, idx) => {
      if (cb.borrower_id && cb.borrower_id !== payload.primary_borrower_id) {
        partiesToInsert.push({
          loan_application_id: applicationId,
          borrower_id: cb.borrower_id,
          party_role: "co_borrower",
          guarantee_type: null,
          is_primary: false,
          order_index: idx + 1,
          is_guarantor: false,
          is_security_provider: false,
        });
      }
    });
  }

  // Guarantors
  if (payload.guarantors && payload.guarantors.length > 0) {
    payload.guarantors.forEach((g, idx) => {
      if (g.borrower_id) {
        partiesToInsert.push({
          loan_application_id: applicationId,
          borrower_id: g.borrower_id,
          party_role: "guarantor",
          guarantee_type: g.guarantee_type || "personal",
          is_primary: false,
          order_index: idx + 1,
          is_guarantor: true,
          is_security_provider: Boolean(g.is_security_provider),
        });
      }
    });
  }

  // Security Providers (if not already added as guarantor)
  if (payload.security_providers && payload.security_providers.length > 0) {
    payload.security_providers.forEach((sp, idx) => {
      if (sp.borrower_id) {
        const existing = partiesToInsert.find((p) => p.borrower_id === sp.borrower_id);
        if (existing) {
          existing.is_security_provider = true;
          if (sp.is_guarantor) {
            existing.is_guarantor = true;
            existing.guarantee_type = sp.guarantee_type || existing.guarantee_type || "personal";
          }
        } else {
          partiesToInsert.push({
            loan_application_id: applicationId,
            borrower_id: sp.borrower_id,
            party_role: "security_provider",
            guarantee_type: sp.is_guarantor ? (sp.guarantee_type || "personal") : null,
            is_primary: false,
            order_index: (payload.guarantors?.length || 0) + idx + 1,
            is_guarantor: Boolean(sp.is_guarantor),
            is_security_provider: true,
          });
        }
      }
    });
  }

  // Insert parties (resilient if table not yet created)
  try {
    await supabase.from("loan_application_parties").insert(partiesToInsert);
  } catch (err) {
    console.warn("Could not insert loan_application_parties (migration 0011 might be pending):", err);
  }

  // Collaterals & LAS Securities (if any)
  const collateralsToInsert: Array<{
    loan_application_id: string;
    collateral_type: string;
    charge_type: string | null;
    property_status: string | null;
    address: string | null;
    city: string | null;
    pincode: string | null;
    estimated_value: number | null;
    details: string | null;
    pledgor_borrower_id?: string | null;
    pledgor_name?: string | null;
    pledgor_pan?: string | null;
  }> = [];

  if (payload.collaterals && payload.collaterals.length > 0) {
    for (const c of payload.collaterals) {
      collateralsToInsert.push({
        loan_application_id: applicationId,
        collateral_type: c.collateral_type,
        charge_type: c.charge_type || null,
        property_status: c.property_status || null,
        address: c.address || null,
        city: c.city || null,
        pincode: c.pincode || null,
        estimated_value: c.estimated_value || null,
        details: c.details || null,
      });
    }
  }

  if (payload.las_securities && payload.las_securities.length > 0) {
    for (const s of payload.las_securities) {
      collateralsToInsert.push({
        loan_application_id: applicationId,
        collateral_type: "Equity Shares",
        charge_type: "Pledge",
        property_status: "Liquid Securities",
        address: `${s.security_name} (ISIN: ${s.isin})`,
        city: s.pledgor_name,
        pincode: null,
        estimated_value: s.market_value,
        details: JSON.stringify(s),
      });
    }

    // Attempt resilient insert into loan_pledged_securities if table exists
    try {
      const pledgedRows = payload.las_securities.map((s) => ({
        loan_application_id: applicationId,
        security_name: s.security_name,
        isin: s.isin,
        quantity: s.quantity,
        cmp: s.cmp,
        market_value: s.market_value,
        security_cover: s.security_cover,
        loan_value: s.loan_value,
        pledgor_name: s.pledgor_name,
      }));
      await supabase.from("loan_pledged_securities").insert(pledgedRows);
    } catch {
      // ignore if table not created
    }
  }

  if (collateralsToInsert.length > 0) {
    try {
      await supabase.from("loan_collaterals").insert(collateralsToInsert);
    } catch (err) {
      console.warn("Could not insert loan_collaterals (migration 0011 might be pending):", err);
    }
  }

  return { success: true, applicationId };
}


export type LoanOriginationState = { error: string | null };

export async function createLoanApplicationForExistingBorrower(
  _prevState: LoanOriginationState,
  formData: FormData,
): Promise<LoanOriginationState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  const applicationCode = formData.get("application_code") as string;
  const borrowerId = formData.get("borrower_id") as string;
  const requestedAmount = formData.get("requested_amount") as string;

  if (!applicationCode || !borrowerId || !requestedAmount) {
    return { error: "Application number, borrower, and amount are required." };
  }

  const { data: application, error } = await supabase
    .from("loan_applications")
    .insert({
      application_code: applicationCode,
      borrower_id: borrowerId,
      requested_amount: Number(requestedAmount),
      purpose: (formData.get("purpose") as string) || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !application) {
    return {
      error:
        error?.code === "23505"
          ? "That application number is already in use."
          : error?.message ?? "Failed to create loan application.",
    };
  }

  redirect(`/loans/${application.id}`);
}

export async function createBorrowerAndLoanApplication(
  _prevState: LoanOriginationState,
  formData: FormData,
): Promise<LoanOriginationState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  const applicationCode = formData.get("application_code") as string;
  const requestedAmount = formData.get("requested_amount") as string;
  const borrowerType = formData.get("borrower_type") as string;
  const pan = (formData.get("pan") as string) || null;

  if (!applicationCode || !requestedAmount) {
    return { error: "Application number and amount are required." };
  }

  if (!["individual", "corporate", "other"].includes(borrowerType)) {
    return { error: "Select a valid borrower type." };
  }

  const prefix = borrowerType.slice(0, 3).toUpperCase();
  const borrowerCode = `${prefix}-${Date.now().toString(36).toUpperCase()}`;

  const { data: borrower, error: borrowerError } = await supabase
    .from("borrowers")
    .insert({
      borrower_code: borrowerCode,
      
      borrower_type: borrowerType,
      created_by: user.id,
      pan,
    })
    .select("id")
    .single();

  if (borrowerError || !borrower) {
    return {
      error:
        borrowerError?.code === "23505"
          ? "A borrower with this PAN already exists."
          : borrowerError?.message ?? "Failed to create borrower.",
    };
  }

  if (borrowerType === "individual") {
    const fullName = formData.get("full_name") as string;
    if (!fullName) return { error: "Full name is required." };

    const { error } = await supabase.from("individual_profiles").insert({
      borrower_id: borrower.id,
      full_name: fullName,
      pan,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
    });
    if (error) return { error: error.message };
  } else if (borrowerType === "corporate") {
    const legalName = formData.get("legal_name") as string;
    if (!legalName) return { error: "Legal name is required." };

    const { error } = await supabase.from("corporate_profiles").insert({
      borrower_id: borrower.id,
      legal_name: legalName,
      pan,
      gstin: (formData.get("gstin") as string) || null,
    });
    if (error) return { error: error.message };
  } else {
    const entityName = formData.get("entity_name") as string;
    if (!entityName) return { error: "Entity name is required." };

    const { error } = await supabase.from("other_profiles").insert({
      borrower_id: borrower.id,
      entity_name: entityName,
      pan,
    });
    if (error) return { error: error.message };
  }

  const { data: application, error: applicationError } = await supabase
    .from("loan_applications")
    .insert({
      application_code: applicationCode,
      borrower_id: borrower.id,
      requested_amount: Number(requestedAmount),
      purpose: (formData.get("purpose") as string) || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (applicationError || !application) {
    return {
      error:
        applicationError?.code === "23505"
          ? "That application number is already in use."
          : applicationError?.message ?? "Failed to create loan application.",
    };
  }

  redirect(`/loans/${application.id}`);
}

export async function submitLoanApplication(applicationId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from("loan_applications")
    .update({
      status: "submitted",
      submitted_by: user.id,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", applicationId);
}

export async function deleteLoanApplication(
  applicationId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized. Please log in." };
    }

    if (!applicationId) {
      return { success: false, error: "Missing application ID." };
    }

    // 1. Verify existence and retrieve code
    const { data: application, error: fetchErr } = await supabase
      .from("loan_applications")
      .select("id, application_code, status")
      .eq("id", applicationId)
      .maybeSingle();

    if (fetchErr || !application) {
      return { success: false, error: "Loan application not found or already deleted." };
    }

    // 2. Check if a sanctioned loan exists
    const { data: linkedLoan } = await supabase
      .from("loans")
      .select("id, loan_code")
      .eq("loan_application_id", applicationId)
      .maybeSingle();

    if (linkedLoan) {
      return {
        success: false,
        error: `Cannot delete application ${application.application_code}: It has already been sanctioned into active loan facility #${linkedLoan.loan_code}.`,
      };
    }

    // 3. Delete dependent records cleanly
    try {
      await supabase.from("loan_collaterals").delete().eq("loan_application_id", applicationId);
    } catch {
      // ignore if table does not exist
    }

    try {
      await supabase.from("loan_application_parties").delete().eq("loan_application_id", applicationId);
    } catch {
      // ignore if table does not exist
    }

    try {
      await supabase.from("approval_history").delete().eq("loan_application_id", applicationId);
    } catch {
      // ignore if table does not exist
    }

    // 4. Delete the loan application record
    const { error, count } = await supabase
      .from("loan_applications")
      .delete({ count: "exact" })
      .eq("id", applicationId);

    if (error) {
      console.error("Delete loan application error:", error);
      return {
        success: false,
        error:
          error.code === "23503"
            ? "Cannot delete this application because other database records depend on it."
            : `Database error: ${error.message}. (Make sure migration 0012 for DELETE policy has been executed in Supabase).`,
      };
    }

    if (count === 0) {
      return {
        success: false,
        error:
          "Delete failed (0 rows deleted). Please make sure the DELETE policy on table 'loan_applications' has been executed in Supabase (run migration 0012).",
      };
    }

    revalidatePath("/loans");
    revalidatePath("/dashboard");
    revalidatePath(`/loans/${applicationId}`);
    return { success: true, error: null };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    console.error("deleteLoanApplication unexpected error:", err);
    return {
      success: false,
      error: errorObj?.message ?? "An unexpected error occurred while deleting the loan application.",
    };
  }
}

export type UpdateWholesaleLoanPayload = {
  applicationId: string;
  application_code?: string;
  primary_borrower_id?: string;
  requested_amount: number;
  purpose: string;
  tenure_months: number;
  facility_type: "LAS (Loan Against Securities)" | "LAP" | "Project Finance" | "Others";
  facility_type_other?: string;
  co_borrowers?: Array<{
    borrower_id: string;
    order_index?: number;
  }>;
  guarantors?: Array<{
    borrower_id: string;
    guarantee_type?: "personal" | "corporate" | "unconditional" | "limited" | null;
    is_security_provider?: boolean;
    order_index?: number;
  }>;
  security_providers?: Array<{
    borrower_id: string;
    is_guarantor?: boolean;
    guarantee_type?: "personal" | "corporate" | null;
    order_index?: number;
  }>;
  collaterals?: Array<{
    collateral_type: string;
    charge_type?: string;
    property_status?: string;
    address?: string;
    city?: string;
    pincode?: string;
    estimated_value?: number;
    details?: string;
  }>;
  las_securities?: LASSecurityItem[];
};

export async function updateWholesaleLoanApplication(
  payload: UpdateWholesaleLoanPayload
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Unauthorized. Please log in." };
  if (!payload.applicationId) return { success: false, error: "Application ID is required." };

  // 1. Check if booked into an active facility (locked)
  const { data: linkedLoan } = await supabase
    .from("loans")
    .select("id, loan_code")
    .eq("loan_application_id", payload.applicationId)
    .maybeSingle();

  if (linkedLoan) {
    return {
      success: false,
      error: `Cannot edit application: It is already booked into active credit facility #${linkedLoan.loan_code}.`,
    };
  }

  const facilityTypeStr =
    payload.facility_type === "Others" && payload.facility_type_other?.trim()
      ? `Others: ${payload.facility_type_other.trim()}`
      : payload.facility_type;

  // 2. Update loan_applications
  const updateData: Record<string, unknown> = {
    requested_amount: payload.requested_amount,
    purpose: payload.purpose?.trim() || null,
    tenure_months: payload.tenure_months || null,
    facility_type: facilityTypeStr || null,
    updated_at: new Date().toISOString(),
  };

  if (payload.primary_borrower_id) {
    updateData.borrower_id = payload.primary_borrower_id;
  }
  if (payload.application_code?.trim()) {
    updateData.application_code = payload.application_code.trim();
  }

  const { error: appUpdateError } = await supabase
    .from("loan_applications")
    .update(updateData)
    .eq("id", payload.applicationId);

  if (appUpdateError) {
    // If tenure_months or facility_type columns don't exist on live DB, retry without them
    if (appUpdateError.message?.includes("column") || appUpdateError.code === "42703") {
      delete updateData.tenure_months;
      delete updateData.facility_type;
      const { error: retryErr } = await supabase
        .from("loan_applications")
        .update(updateData)
        .eq("id", payload.applicationId);

      if (retryErr) {
        return { success: false, error: retryErr.message };
      }
    } else {
      return { success: false, error: appUpdateError.message };
    }
  }

  // 3. Update multi-party structure (co-borrowers and guarantors)
  try {
    // Remove existing non-primary parties
    await supabase
      .from("loan_application_parties")
      .delete()
      .eq("loan_application_id", payload.applicationId)
      .neq("party_role", "primary_borrower");

    const newParties: Array<{
      loan_application_id: string;
      borrower_id: string;
      party_role: "co_borrower" | "guarantor" | "security_provider";
      guarantee_type: string | null;
      is_primary: boolean;
      order_index: number;
      is_guarantor?: boolean;
      is_security_provider?: boolean;
    }> = [];

    if (payload.co_borrowers) {
      payload.co_borrowers.forEach((cb, idx) => {
        if (cb.borrower_id) {
          newParties.push({
            loan_application_id: payload.applicationId,
            borrower_id: cb.borrower_id,
            party_role: "co_borrower",
            guarantee_type: null,
            is_primary: false,
            order_index: idx + 1,
            is_guarantor: false,
            is_security_provider: false,
          });
        }
      });
    }

    if (payload.guarantors) {
      payload.guarantors.forEach((g, idx) => {
        if (g.borrower_id) {
          newParties.push({
            loan_application_id: payload.applicationId,
            borrower_id: g.borrower_id,
            party_role: "guarantor",
            guarantee_type: g.guarantee_type || "personal",
            is_primary: false,
            order_index: idx + 1,
            is_guarantor: true,
            is_security_provider: Boolean(g.is_security_provider),
          });
        }
      });
    }

    if (payload.security_providers) {
      payload.security_providers.forEach((sp, idx) => {
        if (sp.borrower_id) {
          const existing = newParties.find((p) => p.borrower_id === sp.borrower_id);
          if (existing) {
            existing.is_security_provider = true;
            if (sp.is_guarantor) {
              existing.is_guarantor = true;
              existing.guarantee_type = sp.guarantee_type || existing.guarantee_type || "personal";
            }
          } else {
            newParties.push({
              loan_application_id: payload.applicationId,
              borrower_id: sp.borrower_id,
              party_role: "security_provider",
              guarantee_type: sp.is_guarantor ? (sp.guarantee_type || "personal") : null,
              is_primary: false,
              order_index: (payload.guarantors?.length || 0) + idx + 1,
              is_guarantor: Boolean(sp.is_guarantor),
              is_security_provider: true,
            });
          }
        }
      });
    }

    if (newParties.length > 0) {
      await supabase.from("loan_application_parties").insert(newParties);
    }
  } catch (err) {
    console.warn("Could not sync loan_application_parties:", err);
  }

  // 4. Update Collaterals and LAS Securities
  try {
    // Delete existing collaterals
    await supabase
      .from("loan_collaterals")
      .delete()
      .eq("loan_application_id", payload.applicationId);

    const collateralsToInsert: Array<{
      loan_application_id: string;
      collateral_type: string;
      charge_type: string | null;
      property_status: string | null;
      address: string | null;
      city: string | null;
      pincode: string | null;
      estimated_value: number | null;
      details: string | null;
      pledgor_borrower_id?: string | null;
      pledgor_name?: string | null;
      pledgor_pan?: string | null;
    }> = [];

    if (payload.collaterals && payload.collaterals.length > 0) {
      for (const c of payload.collaterals) {
        collateralsToInsert.push({
          loan_application_id: payload.applicationId,
          collateral_type: c.collateral_type,
          charge_type: c.charge_type || null,
          property_status: c.property_status || null,
          address: c.address || null,
          city: c.city || null,
          pincode: c.pincode || null,
          estimated_value: c.estimated_value || null,
          details: c.details || null,
        });
      }
    }

    if (payload.las_securities && payload.las_securities.length > 0) {
      for (const s of payload.las_securities) {
        collateralsToInsert.push({
          loan_application_id: payload.applicationId,
          collateral_type: "Equity Shares",
          charge_type: "Pledge",
          property_status: "Liquid Securities",
          address: `${s.security_name} (ISIN: ${s.isin})`,
          city: s.pledgor_name,
          pincode: null,
          estimated_value: s.market_value,
          details: JSON.stringify(s),
          pledgor_borrower_id: s.pledgor_borrower_id || null,
          pledgor_name: s.pledgor_name || null,
          pledgor_pan: s.pledgor_pan || null,
        });
      }

      // Sync loan_pledged_securities if table exists
      try {
        await supabase
          .from("loan_pledged_securities")
          .delete()
          .eq("loan_application_id", payload.applicationId);

        const pledgedRows = payload.las_securities.map((s) => ({
          loan_application_id: payload.applicationId,
          security_name: s.security_name,
          isin: s.isin,
          quantity: s.quantity,
          cmp: s.cmp,
          market_value: s.market_value,
          security_cover: s.security_cover,
          loan_value: s.loan_value,
          pledgor_name: s.pledgor_name,
        }));
        await supabase.from("loan_pledged_securities").insert(pledgedRows);
      } catch {
        // ignore
      }
    }

    if (collateralsToInsert.length > 0) {
      await supabase.from("loan_collaterals").insert(collateralsToInsert);
    }
  } catch (err) {
    console.warn("Could not sync loan_collaterals:", err);
  }

  revalidatePath("/loans");
  revalidatePath(`/loans/${payload.applicationId}`);
  revalidatePath(`/loans/${payload.applicationId}/edit`);
  return { success: true };
}
