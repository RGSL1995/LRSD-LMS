"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type BorrowerFormState = { error: string | null };
export type CreateBorrowerState = { error: string | null; borrowerId: string | null };

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
  _prevState: CreateBorrowerState,
  formData: FormData,
): Promise<CreateBorrowerState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in.", borrowerId: null };
  }

  const borrowerType = formData.get("borrower_type") as string;

  if (!["individual", "corporate", "other"].includes(borrowerType)) {
    return { error: "Select a valid borrower type.", borrowerId: null };
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
    return {
      error: borrowerError?.message ?? "Failed to create borrower.",
      borrowerId: null,
    };
  }

  if (borrowerType === "individual") {
    const fullName = formData.get("full_name") as string;
    if (!fullName) {
      return { error: "Full name is required for an individual borrower.", borrowerId: null };
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

    if (error) return { error: error.message, borrowerId: null };
  } else if (borrowerType === "corporate") {
    const legalName = formData.get("legal_name") as string;
    if (!legalName) {
      return { error: "Legal name is required for a corporate borrower.", borrowerId: null };
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

    if (error) return { error: error.message, borrowerId: null };
  } else {
    const entityName = formData.get("entity_name") as string;
    if (!entityName) {
      return { error: "Entity name is required.", borrowerId: null };
    }

    const { error } = await supabase.from("other_profiles").insert({
      borrower_id: borrower.id,
      entity_name: entityName,
      entity_category: str(formData, "entity_category"),
      registration_number: str(formData, "registration_number"),
      pan: str(formData, "pan"),
      address: str(formData, "address"),
    });

    if (error) return { error: error.message, borrowerId: null };
  }

  revalidatePath("/borrowers");
  return { error: null, borrowerId: borrower.id };
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
  try {
    const supabase = await createClient();
    const borrowerId = formData.get("borrower_id") as string;

    if (!borrowerId) {
      return { error: "Borrower ID is required." };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be signed in to delete a borrower." };
    }

    // Check if borrower has linked loan applications
    const { data: linkedApps, error: appCheckError } = await supabase
      .from("loan_applications")
      .select("id")
      .eq("borrower_id", borrowerId)
      .limit(1);

    if (appCheckError) {
      return { error: `Validation check failed: ${appCheckError.message}` };
    }

    if (linkedApps && linkedApps.length > 0) {
      return {
        error: "This borrower cannot be deleted because they have existing loan applications.",
      };
    }

    // Check if borrower has linked loans
    const { data: linkedLoans, error: loanCheckError } = await supabase
      .from("loans")
      .select("id")
      .eq("borrower_id", borrowerId)
      .limit(1);

    if (loanCheckError) {
      return { error: `Validation check failed: ${loanCheckError.message}` };
    }

    if (linkedLoans && linkedLoans.length > 0) {
      return {
        error: "This borrower cannot be deleted because they have active or closed loans.",
      };
    }

    // Retrieve storage paths for any documents to clean up storage
    const { data: docs } = await supabase
      .from("borrower_documents")
      .select("storage_path")
      .eq("borrower_id", borrowerId);

    if (docs && docs.length > 0) {
      const paths = docs.map((d) => d.storage_path).filter(Boolean);
      if (paths.length > 0) {
        await supabase.storage.from("borrower-documents").remove(paths);
      }
    }

    // Explicitly delete child relations in case RLS or cascades are restricted
    await supabase.from("borrower_documents").delete().eq("borrower_id", borrowerId);
    await supabase.from("corporate_financials").delete().eq("borrower_id", borrowerId);
    await supabase.from("borrower_contacts").delete().eq("borrower_id", borrowerId);
    await supabase.from("corporate_associates").delete().eq("borrower_id", borrowerId);
    await supabase.from("individual_profiles").delete().eq("borrower_id", borrowerId);
    await supabase.from("corporate_profiles").delete().eq("borrower_id", borrowerId);
    await supabase.from("other_profiles").delete().eq("borrower_id", borrowerId);

    const { error, count } = await supabase
      .from("borrowers")
      .delete({ count: "exact" })
      .eq("id", borrowerId);

    if (error) {
      console.error("Delete borrower database error:", error);
      return {
        error:
          error.code === "23503"
            ? "This borrower cannot be deleted because they have linked loan records."
            : `Database error: ${error.message}`,
      };
    }

    if (count === 0) {
      return {
        error:
          "Delete failed: 0 rows deleted. If RLS is enabled in your Supabase project, make sure you ran the SQL policy for DELETE on table 'borrowers'.",
      };
    }
  } catch (err: unknown) {
    const errorObj = err as { message?: string; digest?: string };
    if (errorObj?.message === "NEXT_REDIRECT" || errorObj?.digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    console.error("deleteBorrower unexpected error:", err);
    return { error: errorObj?.message ?? "An unexpected error occurred during deletion." };
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

export async function deleteBorrowerContact(formData: FormData) {
  const supabase = await createClient();
  const contactId = formData.get("contact_id") as string;
  const borrowerId = formData.get("borrower_id") as string;

  await supabase.from("borrower_contacts").delete().eq("id", contactId);

  if (borrowerId) {
    revalidatePath(`/borrowers/${borrowerId}`);
  }
}

export async function getBorrowerContacts(borrowerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("borrower_contacts")
    .select("*")
    .eq("borrower_id", borrowerId)
    .order("created_at", { ascending: true });

  return data ?? [];
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

export async function deleteCorporateAssociate(formData: FormData) {
  const supabase = await createClient();
  const associateId = formData.get("associate_id") as string;
  const borrowerId = formData.get("borrower_id") as string;

  await supabase.from("corporate_associates").delete().eq("id", associateId);

  if (borrowerId) {
    revalidatePath(`/borrowers/${borrowerId}`);
  }
}

export async function getCorporateAssociates(borrowerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("corporate_associates")
    .select("*")
    .eq("borrower_id", borrowerId)
    .order("created_at", { ascending: true });

  return data ?? [];
}
