"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type BorrowerFormState = { error: string | null };

function generateBorrowerCode(borrowerType: string) {
  const prefix = borrowerType.slice(0, 3).toUpperCase();
  const suffix = Date.now().toString(36).toUpperCase();
  return `${prefix}-${suffix}`;
}

function str(formData: FormData, key: string) {
  return (formData.get(key) as string) || null;
}

function num(formData: FormData, key: string) {
  const value = formData.get(key) as string;
  return value ? Number(value) : null;
}

export async function createBorrower(
  _prevState: BorrowerFormState,
  formData: FormData,
): Promise<BorrowerFormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const borrowerType = formData.get("borrower_type") as string;

  if (!["individual", "corporate", "other"].includes(borrowerType)) {
    return { error: "Select a valid borrower type." };
  }

  const { data: borrower, error: borrowerError } = await supabase
    .from("borrowers")
    .insert({
      borrower_code: generateBorrowerCode(borrowerType),
      borrower_type: borrowerType,
      created_by: user.id,
      pan: (formData.get("pan") as string) || null,
    })
    .select("id")
    .single();

  if (borrowerError || !borrower) {
    return { error: borrowerError?.message ?? "Failed to create borrower." };
  }

  if (borrowerType === "individual") {
    const fullName = formData.get("full_name") as string;
    if (!fullName) {
      return { error: "Full name is required for an individual borrower." };
    }

    const { error } = await supabase.from("individual_profiles").insert({
      borrower_id: borrower.id,
      full_name: fullName,
      father_or_husband_name: str(formData, "father_or_husband_name"),
      date_of_birth: str(formData, "date_of_birth"),
      gender: str(formData, "gender"),
      marital_status: str(formData, "marital_status"),
      qualification: str(formData, "qualification"),
      occupation: str(formData, "occupation"),
      pan: str(formData, "pan"),
      aadhaar_number: str(formData, "aadhaar_number"),
      passport_number: str(formData, "passport_number"),
      email: str(formData, "email"),
      phone: str(formData, "phone"),
      landline: str(formData, "landline"),
      monthly_income: num(formData, "monthly_income"),
      current_address_line: str(formData, "current_address_line"),
      current_city: str(formData, "current_city"),
      current_state: str(formData, "current_state"),
      current_pincode: str(formData, "current_pincode"),
      current_residence_type: str(formData, "current_residence_type"),
      current_residence_years: num(formData, "current_residence_years"),
      permanent_address_line: str(formData, "permanent_address_line"),
      permanent_city: str(formData, "permanent_city"),
      permanent_state: str(formData, "permanent_state"),
      permanent_pincode: str(formData, "permanent_pincode"),
      permanent_residence_type: str(formData, "permanent_residence_type"),
      permanent_residence_years: num(formData, "permanent_residence_years"),
      office_name: str(formData, "office_name"),
      office_address: str(formData, "office_address"),
      office_landmark: str(formData, "office_landmark"),
      office_city: str(formData, "office_city"),
      office_pincode: str(formData, "office_pincode"),
      office_landline: str(formData, "office_landline"),
      office_email: str(formData, "office_email"),
    });

    if (error) return { error: error.message };
  } else if (borrowerType === "corporate") {
    const legalName = formData.get("legal_name") as string;
    if (!legalName) {
      return { error: "Legal name is required for a corporate borrower." };
    }

    const { error } = await supabase.from("corporate_profiles").insert({
      borrower_id: borrower.id,
      legal_name: legalName,
      trade_name: str(formData, "trade_name"),
      business_type: str(formData, "business_type"),
      is_registered: formData.get("is_registered") === "on",
      cin: str(formData, "cin"),
      pan: str(formData, "pan"),
      gstin: str(formData, "gstin"),
      incorporation_date: str(formData, "incorporation_date"),
      ownership_type: str(formData, "ownership_type"),
      contact_no: str(formData, "contact_no"),
      contact_email: str(formData, "contact_email"),
      landline: str(formData, "landline"),
      corporate_office_address: str(formData, "corporate_office_address"),
      corporate_office_city: str(formData, "corporate_office_city"),
      corporate_office_state: str(formData, "corporate_office_state"),
      corporate_office_pincode: str(formData, "corporate_office_pincode"),
      registered_office_address: str(formData, "registered_office_address"),
      registered_office_city: str(formData, "registered_office_city"),
      registered_office_state: str(formData, "registered_office_state"),
      registered_office_pincode: str(formData, "registered_office_pincode"),
    });

    if (error) return { error: error.message };
  } else {
    const entityName = formData.get("entity_name") as string;
    if (!entityName) {
      return { error: "Entity name is required." };
    }

    const { error } = await supabase.from("other_profiles").insert({
      borrower_id: borrower.id,
      entity_name: entityName,
      entity_category: str(formData, "entity_category"),
      registration_number: str(formData, "registration_number"),
      pan: str(formData, "pan"),
      address: str(formData, "address"),
    });

    if (error) return { error: error.message };
  }

  revalidatePath("/borrowers");
  redirect(`/borrowers/${borrower.id}`);
}

export async function updateIndividualProfile(
  _prevState: BorrowerFormState,
  formData: FormData,
): Promise<BorrowerFormState> {
  const supabase = await createClient();
  const borrowerId = formData.get("borrower_id") as string;
  const fullName = formData.get("full_name") as string;

  if (!fullName) {
    return { error: "Full name is required." };
  }

  const pan = str(formData, "pan");

  const { error: borrowerError } = await supabase
    .from("borrowers")
    .update({ pan })
    .eq("id", borrowerId);

  if (borrowerError) {
    return {
      error:
        borrowerError.code === "23505"
          ? "Another borrower already uses this PAN."
          : borrowerError.message,
    };
  }

  const { error } = await supabase
    .from("individual_profiles")
    .update({
      full_name: fullName,
      father_or_husband_name: str(formData, "father_or_husband_name"),
      date_of_birth: str(formData, "date_of_birth"),
      gender: str(formData, "gender"),
      marital_status: str(formData, "marital_status"),
      qualification: str(formData, "qualification"),
      occupation: str(formData, "occupation"),
      pan,
      aadhaar_number: str(formData, "aadhaar_number"),
      passport_number: str(formData, "passport_number"),
      email: str(formData, "email"),
      phone: str(formData, "phone"),
      landline: str(formData, "landline"),
      monthly_income: num(formData, "monthly_income"),
      current_address_line: str(formData, "current_address_line"),
      current_city: str(formData, "current_city"),
      current_state: str(formData, "current_state"),
      current_pincode: str(formData, "current_pincode"),
      current_residence_type: str(formData, "current_residence_type"),
      current_residence_years: num(formData, "current_residence_years"),
      permanent_address_line: str(formData, "permanent_address_line"),
      permanent_city: str(formData, "permanent_city"),
      permanent_state: str(formData, "permanent_state"),
      permanent_pincode: str(formData, "permanent_pincode"),
      permanent_residence_type: str(formData, "permanent_residence_type"),
      permanent_residence_years: num(formData, "permanent_residence_years"),
      office_name: str(formData, "office_name"),
      office_address: str(formData, "office_address"),
      office_landmark: str(formData, "office_landmark"),
      office_city: str(formData, "office_city"),
      office_pincode: str(formData, "office_pincode"),
      office_landline: str(formData, "office_landline"),
      office_email: str(formData, "office_email"),
    })
    .eq("borrower_id", borrowerId);

  if (error) return { error: error.message };

  revalidatePath(`/borrowers/${borrowerId}`);
  return { error: null };
}

export async function updateCorporateProfile(
  _prevState: BorrowerFormState,
  formData: FormData,
): Promise<BorrowerFormState> {
  const supabase = await createClient();
  const borrowerId = formData.get("borrower_id") as string;
  const legalName = formData.get("legal_name") as string;

  if (!legalName) {
    return { error: "Legal name is required." };
  }

  const pan = str(formData, "pan");

  const { error: borrowerError } = await supabase
    .from("borrowers")
    .update({ pan })
    .eq("id", borrowerId);

  if (borrowerError) {
    return {
      error:
        borrowerError.code === "23505"
          ? "Another borrower already uses this PAN."
          : borrowerError.message,
    };
  }

  const { error } = await supabase
    .from("corporate_profiles")
    .update({
      legal_name: legalName,
      trade_name: str(formData, "trade_name"),
      business_type: str(formData, "business_type"),
      is_registered: formData.get("is_registered") === "on",
      cin: str(formData, "cin"),
      pan,
      gstin: str(formData, "gstin"),
      incorporation_date: str(formData, "incorporation_date"),
      ownership_type: str(formData, "ownership_type"),
      contact_no: str(formData, "contact_no"),
      contact_email: str(formData, "contact_email"),
      landline: str(formData, "landline"),
      corporate_office_address: str(formData, "corporate_office_address"),
      corporate_office_city: str(formData, "corporate_office_city"),
      corporate_office_state: str(formData, "corporate_office_state"),
      corporate_office_pincode: str(formData, "corporate_office_pincode"),
      registered_office_address: str(formData, "registered_office_address"),
      registered_office_city: str(formData, "registered_office_city"),
      registered_office_state: str(formData, "registered_office_state"),
      registered_office_pincode: str(formData, "registered_office_pincode"),
    })
    .eq("borrower_id", borrowerId);

  if (error) return { error: error.message };

  revalidatePath(`/borrowers/${borrowerId}`);
  return { error: null };
}

export async function updateOtherProfile(
  _prevState: BorrowerFormState,
  formData: FormData,
): Promise<BorrowerFormState> {
  const supabase = await createClient();
  const borrowerId = formData.get("borrower_id") as string;
  const entityName = formData.get("entity_name") as string;

  if (!entityName) {
    return { error: "Entity name is required." };
  }

  const pan = str(formData, "pan");

  const { error: borrowerError } = await supabase
    .from("borrowers")
    .update({ pan })
    .eq("id", borrowerId);

  if (borrowerError) {
    return {
      error:
        borrowerError.code === "23505"
          ? "Another borrower already uses this PAN."
          : borrowerError.message,
    };
  }

  const { error } = await supabase
    .from("other_profiles")
    .update({
      entity_name: entityName,
      entity_category: str(formData, "entity_category"),
      registration_number: str(formData, "registration_number"),
      pan,
      address: str(formData, "address"),
    })
    .eq("borrower_id", borrowerId);

  if (error) return { error: error.message };

  revalidatePath(`/borrowers/${borrowerId}`);
  return { error: null };
}

export async function deleteBorrower(
  _prevState: BorrowerFormState,
  formData: FormData,
): Promise<BorrowerFormState> {
  const supabase = await createClient();
  const borrowerId = formData.get("borrower_id") as string;

  const { error } = await supabase.from("borrowers").delete().eq("id", borrowerId);

  if (error) {
    return {
      error:
        error.code === "23503"
          ? "This borrower cannot be deleted because it has loan applications linked to it."
          : error.message,
    };
  }

  revalidatePath("/borrowers");
  redirect("/borrowers");
}

export async function addBorrowerContact(formData: FormData) {
  const supabase = await createClient();
  const borrowerId = formData.get("borrower_id") as string;

  await supabase.from("borrower_contacts").insert({
    borrower_id: borrowerId,
    contact_name: formData.get("contact_name") as string,
    designation: (formData.get("designation") as string) || null,
    email: (formData.get("email") as string) || null,
    phone: (formData.get("phone") as string) || null,
    is_primary: formData.get("is_primary") === "on",
  });

  revalidatePath(`/borrowers/${borrowerId}`);
}

export async function addCorporateAssociate(formData: FormData) {
  const supabase = await createClient();
  const borrowerId = formData.get("borrower_id") as string;

  await supabase.from("corporate_associates").insert({
    borrower_id: borrowerId,
    associate_role: formData.get("associate_role") as string,
    full_name: formData.get("full_name") as string,
    pan: (formData.get("pan") as string) || null,
    din: (formData.get("din") as string) || null,
    email: (formData.get("email") as string) || null,
    phone: (formData.get("phone") as string) || null,
    shareholding_percent: formData.get("shareholding_percent")
      ? Number(formData.get("shareholding_percent"))
      : null,
  });

  revalidatePath(`/borrowers/${borrowerId}`);
}
