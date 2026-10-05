"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteDocumentFile } from "@/lib/storage";

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

    // Ingest any additional extracted records from PDF if available
    const extractedRaw = formData.get("extracted_json") as string | null;
    if (extractedRaw) {
      try {
        const extracted = JSON.parse(extractedRaw);
        // Financials
        if (Array.isArray(extracted.financials) && extracted.financials.length > 0) {
          const finRows = extracted.financials.map((s: { statementType: string; financialYearEnding: string; fields: Record<string, number | null> }) => ({
            borrower_id: borrower.id,
            statement_type: s.statementType,
            financial_year_ending: s.financialYearEnding,
            created_by: user.id,
            ...s.fields,
          }));
          await supabase.from("corporate_financials").upsert(finRows, { onConflict: "borrower_id,statement_type,financial_year_ending" });
        }
        // Associates / Directors
        if (Array.isArray(extracted.associates) && extracted.associates.length > 0) {
          const assocRows = extracted.associates.map((a: { full_name: string; din?: string; associate_role: string; shareholding_percent?: number }) => ({
            borrower_id: borrower.id,
            associate_role: a.associate_role,
            full_name: a.full_name,
            din: a.din || null,
            shareholding_percent: a.shareholding_percent ?? null,
          }));
          await supabase.from("corporate_associates").insert(assocRows);
        }
        // Group Structure
        if (Array.isArray(extracted.groupStructure) && extracted.groupStructure.length > 0) {
          const subRows = extracted.groupStructure.map((sub: { entity_name: string; relationship_type: string; percentage_holding?: number; cin_or_registration?: string }) => ({
            borrower_id: borrower.id,
            entity_name: sub.entity_name,
            relationship_type: sub.relationship_type,
            percentage_holding: sub.percentage_holding ?? null,
            cin_or_registration: sub.cin_or_registration ?? null,
          }));
          await supabase.from("corporate_group_structure").insert(subRows);
        }
        // Related Party Transactions (RPT)
        if (Array.isArray(extracted.rpt) && extracted.rpt.length > 0) {
          const rptRows = extracted.rpt.map((item: { partyName: string; category: string; relationship: string; transactionType: string; amountCrore: number | null; amountInr: number; financialYear: string; isMaterial: boolean }) => {
            let txType: "loan_given" | "loan_taken" | "sales_of_goods_services" | "purchase_of_goods_services" | "corporate_guarantee" | "director_remuneration" | "advances_given" | "advances_received" | "other" = "other";
            const typeLower = (item.transactionType || "").toLowerCase();
            const relLower = (item.relationship || "").toLowerCase();
            if (typeLower.includes("revenue") || typeLower.includes("sales")) {
              txType = "sales_of_goods_services";
            } else if (typeLower.includes("expense") || typeLower.includes("purchase")) {
              if (item.category === "individual" || relLower.includes("key management") || relLower.includes("personnel") || relLower.includes("director")) {
                txType = "director_remuneration";
              } else {
                txType = "purchase_of_goods_services";
              }
            } else if (typeLower.includes("loan given")) {
              txType = "loan_given";
            } else if (typeLower.includes("loan taken")) {
              txType = "loan_taken";
            } else if (typeLower.includes("advance given")) {
              txType = "advances_given";
            } else if (typeLower.includes("advance received")) {
              txType = "advances_received";
            } else if (typeLower.includes("guarantee")) {
              txType = "corporate_guarantee";
            }

            const desc = item.amountCrore !== null
              ? `₹${item.amountCrore} Cr (${item.transactionType}) from MCA / Corporate report`
              : `Amount undisclosed (****) in MCA / Corporate report`;

            return {
              borrower_id: borrower.id,
              related_party_name: item.partyName,
              relationship_nature: item.relationship,
              transaction_type: txType,
              amount: item.amountInr || 0,
              financial_year: item.financialYear || "FY 2024-25",
              description: desc,
              is_material: Boolean(item.isMaterial),
            };
          });
          const { error: rptErr } = await supabase.from("related_party_transactions").insert(rptRows);
          if (rptErr) {
            console.error("Error inserting related_party_transactions during createBorrower:", rptErr);
          }
        }
        // GST Records
        if (Array.isArray(extracted.gstins) && extracted.gstins.length > 0) {
          const monthsMap: Record<string, string> = {
            jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
            jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
          };
          const gstRows: Array<{
            borrower_id: string;
            gstin: string;
            financial_year: string;
            return_type: "gstr_1" | "gstr_3b" | "gstr_9" | "annual_aggregate";
            period_month: string;
            taxable_turnover: number;
            igst_amount: number;
            cgst_amount: number;
            sgst_amount: number;
            total_tax_paid: number;
            filing_date: string | null;
          }> = [];

          for (const g of extracted.gstins) {
            if (!Array.isArray(g.filings)) continue;
            for (const f of g.filings) {
              let returnType: "gstr_1" | "gstr_3b" | "gstr_9" | "annual_aggregate" = "gstr_3b";
              const rUpper = (f.returnType || "").toUpperCase();
              if (rUpper.includes("GSTR1") || rUpper.includes("GSTR-1")) {
                returnType = "gstr_1";
              } else if (rUpper.includes("GSTR3B") || rUpper.includes("GSTR-3B")) {
                returnType = "gstr_3b";
              } else if (rUpper.includes("GSTR9") || rUpper.includes("GSTR-9")) {
                returnType = "gstr_9";
              }

              let parsedFilingDate: string | null = null;
              if (f.filingDate) {
                const dm = f.filingDate.match(/(\d{1,2})\s+([A-Za-z]{3}),?\s+(\d{4})/);
                if (dm) {
                  const day = dm[1].padStart(2, "0");
                  const month = monthsMap[dm[2].toLowerCase()] || "01";
                  parsedFilingDate = `${dm[3]}-${month}-${day}`;
                }
              }

              gstRows.push({
                borrower_id: borrower.id,
                gstin: g.gstin,
                financial_year: f.financialYear,
                return_type: returnType,
                period_month: f.taxPeriod,
                taxable_turnover: 0,
                igst_amount: 0,
                cgst_amount: 0,
                sgst_amount: 0,
                total_tax_paid: 0,
                filing_date: parsedFilingDate,
              });
            }
          }
          if (gstRows.length > 0) {
            for (let i = 0; i < gstRows.length; i += 100) {
              const { error: gstErr } = await supabase.from("corporate_gst_records").insert(gstRows.slice(i, i + 100));
              if (gstErr) {
                console.error("Error inserting corporate_gst_records batch during createBorrower:", gstErr);
              }
            }
          }
        }
      } catch (parseErr) {
        console.warn("Failed to parse extracted_json during createBorrower:", parseErr);
      }
    }
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
      await Promise.allSettled(paths.map((p) => deleteDocumentFile(p)));
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
