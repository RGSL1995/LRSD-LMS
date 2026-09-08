"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import { unwrapRelation } from "@/lib/utils";

export type BorrowerLookup = {
  id: string;
  borrower_code: string;
  borrower_type: "individual" | "corporate" | "other";
  displayName: string;
};

export async function findBorrowerByPan(pan: string): Promise<BorrowerLookup | null> {
  const supabase = await createClient();
  const cleanPan = pan.trim().toUpperCase();

  const { data: borrower } = await supabase
    .from("borrowers")
    .select(
      `id, borrower_code, borrower_type,
       individual_profiles ( full_name ),
       corporate_profiles ( legal_name ),
       other_profiles ( entity_name )`,
    )
    .ilike("pan", cleanPan)
    .maybeSingle();

  if (borrower) {
    const ind = unwrapRelation<{ full_name: string }>(borrower.individual_profiles);
    const corp = unwrapRelation<{ legal_name: string }>(borrower.corporate_profiles);
    const oth = unwrapRelation<{ entity_name: string }>(borrower.other_profiles);

    const displayName =
      ind?.full_name ??
      corp?.legal_name ??
      oth?.entity_name ??
      borrower.borrower_code;

    return {
      id: borrower.id,
      borrower_code: borrower.borrower_code,
      borrower_type: borrower.borrower_type,
      displayName,
    };
  }

  // Fallback: check profile tables directly in case borrowers.pan was not populated
  const { data: ind } = await supabase
    .from("individual_profiles")
    .select("borrower_id, full_name, borrowers ( id, borrower_code, borrower_type )")
    .ilike("pan", cleanPan)
    .maybeSingle();

  if (ind && ind.borrowers) {
    const b = ind.borrowers as unknown as { id: string; borrower_code: string; borrower_type: "individual" | "corporate" | "other" };
    return {
      id: b.id,
      borrower_code: b.borrower_code,
      borrower_type: b.borrower_type,
      displayName: ind.full_name || b.borrower_code,
    };
  }

  const { data: corp } = await supabase
    .from("corporate_profiles")
    .select("borrower_id, legal_name, borrowers ( id, borrower_code, borrower_type )")
    .ilike("pan", cleanPan)
    .maybeSingle();

  if (corp && corp.borrowers) {
    const b = corp.borrowers as unknown as { id: string; borrower_code: string; borrower_type: "individual" | "corporate" | "other" };
    return {
      id: b.id,
      borrower_code: b.borrower_code,
      borrower_type: b.borrower_type,
      displayName: corp.legal_name || b.borrower_code,
    };
  }

  const { data: oth } = await supabase
    .from("other_profiles")
    .select("borrower_id, entity_name, borrowers ( id, borrower_code, borrower_type )")
    .ilike("pan", cleanPan)
    .maybeSingle();

  if (oth && oth.borrowers) {
    const b = oth.borrowers as unknown as { id: string; borrower_code: string; borrower_type: "individual" | "corporate" | "other" };
    return {
      id: b.id,
      borrower_code: b.borrower_code,
      borrower_type: b.borrower_type,
      displayName: oth.entity_name || b.borrower_code,
    };
  }

  return null;
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
