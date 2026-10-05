"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { verifyPortalToken, generatePortalToken } from "./portal-security";
import {
  uploadDocumentFile,
  getDocumentSignedUrl,
  deleteDocumentFile,
} from "@/lib/storage";
import { VALID_DOCUMENT_CATEGORIES } from "./document-categories";

/**
 * Returns a Supabase client suitable for portal actions.
 * If SUPABASE_SERVICE_ROLE_KEY is set in process.env or .env.local, uses admin privileges
 * to bypass RLS for token-validated requests. Otherwise, falls back to the standard client.
 */
async function getPortalClient() {
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceKey && typeof window === "undefined") {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const envPath = path.resolve(process.cwd(), ".env.local");
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        const match = content.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m);
        if (match && match[1]) {
          serviceKey = match[1].trim().replace(/^['"]|['"]$/g, "");
          process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
        }
      }
    } catch {
      // Fallback
    }
  }

  if (serviceKey && url) {
    return createSupabaseClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return await createClient();
}

export type PortalApplicationDetails = {
  id: string;
  applicationCode: string;
  requestedAmount: number;
  tenureMonths: number;
  purpose: string;
  facilityType: string;
  status: string;
  createdAt: string;
  portalStatus: string;
  borrowerReviewedAt?: string | null;
  borrowerReviewNotes?: string | null;
  primaryBorrower: {
    id: string;
    legalName: string;
    displayName: string;
    pan: string;
    borrowerType: string;
    phone?: string;
    email?: string;
    city?: string;
    address?: string;
    occupationOrBusinessType?: string;
    cin?: string;
    gstin?: string;
  };
  coBorrowers: Array<{
    id: string;
    name: string;
    legalName?: string;
    pan?: string;
    borrowerType?: string;
    phone?: string;
    email?: string;
    city?: string;
    address?: string;
  }>;
  guarantors: Array<{
    id: string;
    name: string;
    legalName?: string;
    pan?: string;
    borrowerType?: string;
    guaranteeType: string;
    isSecurityProvider?: boolean;
    phone?: string;
    email?: string;
    city?: string;
    address?: string;
  }>;
  collaterals: Array<{
    id: string;
    collateralType: string;
    chargeType: string;
    propertyStatus: string;
    estimatedValue: number;
    address?: string;
  }>;
  documents: Array<{
    id: string;
    borrowerId: string;
    stage: string;
    category: string;
    fileName: string;
    storagePath: string;
    fileSize?: number;
    uploadedAt: string;
    uploadedByBorrower: boolean;
  }>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPartyDetails(b: any) {
  if (!b) {
    return {
      id: "",
      legalName: "—",
      displayName: "—",
      pan: "—",
      borrowerType: "corporate",
      phone: "",
      email: "",
      city: "",
      address: "",
      occupationOrBusinessType: "",
      cin: "",
      gstin: "",
    };
  }
  const ind = Array.isArray(b.individual_profiles) ? b.individual_profiles[0] : b.individual_profiles;
  const corp = Array.isArray(b.corporate_profiles) ? b.corporate_profiles[0] : b.corporate_profiles;
  const oth = Array.isArray(b.other_profiles) ? b.other_profiles[0] : b.other_profiles;

  const displayName =
    ind?.full_name ||
    corp?.trade_name ||
    corp?.legal_name ||
    oth?.entity_name ||
    b.borrower_code ||
    "—";
  const legalName =
    corp?.legal_name ||
    ind?.full_name ||
    oth?.entity_name ||
    displayName;

  const phone = ind?.phone || corp?.contact_no || "";
  const email = ind?.email || corp?.contact_email || "";
  const city = ind?.current_city || corp?.registered_office_city || "";
  const address =
    ind?.current_address_line ||
    corp?.registered_office_address ||
    oth?.address ||
    "";
  const occupationOrBusinessType = ind?.occupation || corp?.business_type || oth?.entity_category || "";
  const cin = corp?.cin || "";
  const gstin = corp?.gstin || "";

  return {
    id: b.id || "",
    occupationOrBusinessType,
    cin,
    gstin,
    legalName,
    displayName,
    pan: b.pan || "—",
    borrowerType: b.borrower_type || "corporate",
    phone,
    email,
    city,
    address,
  };
}

/**
 * Generates or retrieves the shareable review link for a loan application.
 * Called by internal lending staff on /loans/[id].
 */
export async function getOrGeneratePortalLink(applicationId: string): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  if (!applicationId) return { success: false, error: "Missing application ID" };

  try {
    const token = generatePortalToken(applicationId);
    const supabase = await getPortalClient();

    // Try updating portal_token if column exists
    try {
      await supabase
        .from("loan_applications")
        .update({
          portal_token: token,
        })
        .eq("id", applicationId);
    } catch {
      // Ignored if column doesn't exist yet
    }

    return { success: true, token };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Failed to generate link" };
  }
}

/**
 * Fetches all details of an application for external borrower review using the token.
 * No employee login required.
 */
export async function getPortalApplicationData(token: string): Promise<{
  success: boolean;
  data?: PortalApplicationDetails;
  error?: string;
}> {
  const { valid, applicationId } = verifyPortalToken(token);
  if (!valid || !applicationId) {
    return {
      success: false,
      error: "This review link is invalid or has expired. Please request a new link from your relationship manager.",
    };
  }

  try {
    const supabase = await getPortalClient();

    // 1. Fetch loan application with schema fallbacks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let app: any = null;

    const { data: appData, error: appErr } = await supabase
      .from("loan_applications")
      .select(`
        id,
        application_code,
        requested_amount,
        purpose,
        status,
        created_at,
        borrower_id,
        facility_type,
        tenure_months,
        portal_status,
        borrower_reviewed_at,
        borrower_review_notes,
        borrowers (
          id,
          borrower_code,
          borrower_type,
          pan,
          individual_profiles ( full_name, phone, email, current_address_line, current_city, current_state, current_pincode, occupation ),
          corporate_profiles ( legal_name, trade_name, cin, gstin, business_type, contact_email, contact_no, registered_office_address, registered_office_city, registered_office_state, registered_office_pincode ),
          other_profiles ( entity_name, entity_category, address )
        )
      `)
      .eq("id", applicationId)
      .maybeSingle();

    if (appData) {
      app = appData;
    } else {
      // Fallback query without new columns if migration 0014 not yet executed
      const { data: fallbackApp, error: fallbackErr } = await supabase
        .from("loan_applications")
        .select(`
          id,
          application_code,
          requested_amount,
          purpose,
          status,
          created_at,
          borrower_id,
          borrowers (
            id,
            borrower_code,
            borrower_type,
            pan,
            individual_profiles ( full_name, phone, email, current_address_line, current_city ),
            corporate_profiles ( legal_name, trade_name, contact_email, contact_no, registered_office_address, registered_office_city ),
            other_profiles ( entity_name, address )
          )
        `)
        .eq("id", applicationId)
        .maybeSingle();

      if (fallbackApp) {
        app = {
          ...fallbackApp,
          facility_type: "Commercial Loan",
          tenure_months: 0,
          portal_status: "pending",
          borrower_reviewed_at: null,
          borrower_review_notes: null,
        };
      } else {
        const detailMsg = appErr?.message || fallbackErr?.message || "Loan application record not found or access denied by database policy.";
        return {
          success: false,
          error: `${detailMsg} Please ensure migration 0014 has been executed in Supabase SQL Editor.`,
        };
      }
    }

    const primaryBorrower = extractPartyDetails(app.borrowers);

    // 2. Fetch parties (Co-Borrowers, Guarantors, Security Providers)
    const coBorrowers: PortalApplicationDetails["coBorrowers"] = [];
    const guarantors: PortalApplicationDetails["guarantors"] = [];

    try {
      const { data: partiesData } = await supabase
        .from("loan_application_parties")
        .select(`
          id,
          party_role,
          guarantee_type,
          is_guarantor,
          is_security_provider,
          borrowers (
            id,
            borrower_code,
            borrower_type,
            pan,
            individual_profiles ( full_name, phone, email, current_address_line, current_city, current_state, occupation ),
            corporate_profiles ( legal_name, trade_name, cin, gstin, business_type, contact_email, contact_no, registered_office_address, registered_office_city, registered_office_state ),
            other_profiles ( entity_name, entity_category, address )
          )
        `)
        .eq("loan_application_id", applicationId);

      (partiesData || []).forEach((p) => {
        const party = extractPartyDetails(p.borrowers);
        if (!party.id) return;

        if (p.party_role === "co_borrower") {
          coBorrowers.push({
            id: party.id,
            name: party.displayName,
            legalName: party.legalName,
            pan: party.pan,
            borrowerType: party.borrowerType,
            phone: party.phone,
            email: party.email,
            city: party.city,
            address: party.address,
          });
        } else if (p.party_role === "guarantor" || p.is_guarantor || p.party_role === "security_provider") {
          guarantors.push({
            id: party.id,
            name: party.displayName,
            legalName: party.legalName,
            pan: party.pan,
            borrowerType: party.borrowerType,
            guaranteeType: p.guarantee_type || (party.borrowerType === "individual" ? "personal" : "corporate"),
            isSecurityProvider: p.is_security_provider || p.party_role === "security_provider",
            phone: party.phone,
            email: party.email,
            city: party.city,
            address: party.address,
          });
        }
      });
    } catch {
      // Table may not have parties yet
    }

    // 3. Fetch Collaterals
    const collaterals: PortalApplicationDetails["collaterals"] = [];
    try {
      const { data: collateralsData } = await supabase
        .from("loan_collaterals")
        .select("id, collateral_type, charge_type, property_status, estimated_value, address")
        .eq("loan_application_id", applicationId);

      (collateralsData || []).forEach((c) => {
        collaterals.push({
          id: c.id,
          collateralType: c.collateral_type,
          chargeType: c.charge_type,
          propertyStatus: c.property_status,
          estimatedValue: Number(c.estimated_value) || 0,
          address: c.address,
        });
      });
    } catch {
      // Collaterals table empty
    }

    // 4. Fetch Documents
    const documents: PortalApplicationDetails["documents"] = [];
    try {
      const { data: docsData } = await supabase
        .from("borrower_documents")
        .select("id, borrower_id, stage, category, file_name, storage_path, file_size, uploaded_at, uploaded_by_borrower")
        .or(`borrower_id.eq.${app.borrower_id},loan_application_id.eq.${applicationId}`)
        .order("uploaded_at", { ascending: false });

      (docsData || []).forEach((d) => {
        documents.push({
          id: d.id,
          borrowerId: d.borrower_id,
          stage: d.stage,
          category: d.category,
          fileName: d.file_name,
          storagePath: d.storage_path,
          fileSize: d.file_size,
          uploadedAt: d.uploaded_at,
          uploadedByBorrower: Boolean(d.uploaded_by_borrower),
        });
      });
    } catch {
      try {
        const { data: fallbackDocs } = await supabase
          .from("borrower_documents")
          .select("id, borrower_id, stage, category, file_name, storage_path, file_size, uploaded_at")
          .eq("borrower_id", app.borrower_id)
          .order("uploaded_at", { ascending: false });

        (fallbackDocs || []).forEach((d) => {
          documents.push({
            id: d.id,
            borrowerId: d.borrower_id,
            stage: d.stage,
            category: d.category,
            fileName: d.file_name,
            storagePath: d.storage_path,
            fileSize: d.file_size,
            uploadedAt: d.uploaded_at,
            uploadedByBorrower: false,
          });
        });
      } catch {
        // Documents empty
      }
    }

    return {
      success: true,
      data: {
        id: app.id,
        applicationCode: app.application_code,
        requestedAmount: Number(app.requested_amount) || 0,
        tenureMonths: Number(app.tenure_months) || 0,
        purpose: app.purpose || "",
        facilityType: app.facility_type || "Commercial Loan",
        status: app.status,
        createdAt: app.created_at,
        portalStatus: app.portal_status || "pending",
        borrowerReviewedAt: app.borrower_reviewed_at,
        borrowerReviewNotes: app.borrower_review_notes,
        primaryBorrower,
        coBorrowers,
        guarantors,
        collaterals,
        documents,
      },
    };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Failed to load application details." };
  }
}

/**
 * Resolves which borrower_id a document upload should be attached to.
 * Defaults to the loan's primary borrower; a co-borrower/guarantor id must
 * actually be a party on this loan application, otherwise a document could
 * be attached to an unrelated borrower record.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveTargetBorrowerId(
  supabase: any,
  applicationId: string,
  primaryBorrowerId: string,
  requestedPartyBorrowerId: string,
): Promise<string> {
  if (!requestedPartyBorrowerId || requestedPartyBorrowerId === primaryBorrowerId) {
    return primaryBorrowerId;
  }

  const { data: partyMatch } = await supabase
    .from("loan_application_parties")
    .select("borrower_id")
    .eq("loan_application_id", applicationId)
    .eq("borrower_id", requestedPartyBorrowerId)
    .maybeSingle();

  return partyMatch ? requestedPartyBorrowerId : primaryBorrowerId;
}

/**
 * Uploads a document submitted by the borrower via the review portal.
 */
export async function uploadPortalDocument(formData: FormData): Promise<{
  success: boolean;
  error?: string;
  document?: PortalApplicationDetails["documents"][number];
}> {
  const token = formData.get("token") as string;
  const stage = (formData.get("stage") as string) || "kyc";
  const category = (formData.get("category") as string) || "other";
  const partyBorrowerId = (formData.get("party_borrower_id") as string) || "";
  const file = formData.get("file") as File | null;

  if (!token) return { success: false, error: "Missing verification token." };
  if (!file || file.size === 0) return { success: false, error: "Please select a file to upload." };
  if (file.size > 50 * 1024 * 1024) return { success: false, error: "File size exceeds 50MB limit." };

  const { valid, applicationId } = verifyPortalToken(token);
  if (!valid || !applicationId) {
    return { success: false, error: "Invalid or expired review token." };
  }

  try {
    const supabase = await getPortalClient();

    // 1. Get borrower ID
    const { data: app } = await supabase
      .from("loan_applications")
      .select("id, borrower_id")
      .eq("id", applicationId)
      .maybeSingle();

    if (!app) return { success: false, error: "Loan application not found." };

    const targetBorrowerId = await resolveTargetBorrowerId(
      supabase,
      applicationId,
      app.borrower_id,
      partyBorrowerId,
    );

    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `portal/${applicationId}/${targetBorrowerId}/${stage}/${category}-${Date.now()}-${sanitizedFileName}`;

    // 2. Upload file (AWS S3 if configured, or Supabase Storage)
    const uploadRes = await uploadDocumentFile({
      storagePath,
      file,
    });

    if (!uploadRes.success) {
      return { success: false, error: uploadRes.error || "Document upload failed." };
    }

    // 3. Insert record in borrower_documents
    const safeCategory = VALID_DOCUMENT_CATEGORIES.includes(category) ? category : "other";

    let docResult: PortalApplicationDetails["documents"][number] | null = null;

    try {
      const { data: doc, error: insertError } = await supabase
        .from("borrower_documents")
        .insert({
          borrower_id: targetBorrowerId,
          loan_application_id: applicationId,
          stage,
          category: safeCategory,
          file_name: file.name,
          storage_path: storagePath,
          content_type: file.type || null,
          file_size: file.size,
          uploaded_by_borrower: true,
        })
        .select("id, borrower_id, stage, category, file_name, storage_path, file_size, uploaded_at, uploaded_by_borrower")
        .single();

      if (insertError) {
        throw insertError;
      }
      docResult = {
        id: doc.id,
        borrowerId: doc.borrower_id,
        stage: doc.stage,
        category: doc.category,
        fileName: doc.file_name,
        storagePath: doc.storage_path,
        fileSize: doc.file_size,
        uploadedAt: doc.uploaded_at,
        uploadedByBorrower: true,
      };
    } catch {
      // Fallback insert without loan_application_id / uploaded_by_borrower
      const { data: fallbackDoc, error: fallbackErr } = await supabase
        .from("borrower_documents")
        .insert({
          borrower_id: targetBorrowerId,
          stage,
          category: safeCategory,
          file_name: file.name,
          storage_path: storagePath,
          content_type: file.type || null,
          file_size: file.size,
        })
        .select("id, borrower_id, stage, category, file_name, storage_path, file_size, uploaded_at")
        .single();

      if (fallbackErr) {
        await deleteDocumentFile(storagePath);
        return { success: false, error: fallbackErr.message };
      }

      docResult = {
        id: fallbackDoc.id,
        borrowerId: fallbackDoc.borrower_id,
        stage: fallbackDoc.stage,
        category: fallbackDoc.category,
        fileName: fallbackDoc.file_name,
        storagePath: fallbackDoc.storage_path,
        fileSize: fallbackDoc.file_size,
        uploadedAt: fallbackDoc.uploaded_at,
        uploadedByBorrower: true,
      };
    }

    // Try updating portal status to documents_uploaded
    try {
      await supabase
        .from("loan_applications")
        .update({ portal_status: "documents_uploaded" })
        .eq("id", applicationId);
    } catch {
      // Ignored
    }

    revalidatePath(`/portal/review/${token}`);
    revalidatePath(`/loans/${applicationId}`);

    return {
      success: true,
      document: docResult,
    };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Upload failed." };
  }
}

/**
 * Removes a document uploaded via the portal.
 */
export async function deletePortalDocument(
  documentId: string,
  storagePath: string,
  token: string,
): Promise<{ success: boolean; error?: string }> {
  const { valid, applicationId } = verifyPortalToken(token);
  if (!valid || !applicationId) {
    return { success: false, error: "Invalid or expired review token." };
  }

  try {
    const supabase = await getPortalClient();

    await deleteDocumentFile(storagePath);
    await supabase.from("borrower_documents").delete().eq("id", documentId);

    revalidatePath(`/portal/review/${token}`);
    revalidatePath(`/loans/${applicationId}`);

    return { success: true };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Delete failed." };
  }
}

/**
 * Generates a signed download URL for a document.
 */
export async function getPortalDocumentUrl(
  storagePath: string,
  token: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
  const { valid } = verifyPortalToken(token);
  if (!valid) return { success: false, error: "Unauthorized access." };

  try {
    const res = await getDocumentSignedUrl(storagePath, 60 * 60);
    if (!res.success || !res.url) {
      return { success: false, error: res.error || "Could not generate download link." };
    }

    return { success: true, url: res.url };
  } catch {
    return { success: false, error: "Failed to create URL." };
  }
}

/**
 * Generates a signed download URL for internal lending employees.
 */
export async function getInternalDocumentUrl(
  storagePath: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const res = await getDocumentSignedUrl(storagePath, 60 * 60);
    if (!res.success || !res.url) {
      return { success: false, error: res.error || "Could not generate download link." };
    }

    return { success: true, url: res.url };
  } catch {
    return { success: false, error: "Failed to create URL." };
  }
}

/**
 * Uploads a document on behalf of a borrower/co-borrower/guarantor, done by
 * an internal lending employee directly from the loan application page
 * (rather than the borrower doing it themselves via the portal link).
 * Writes to the same borrower_documents rows as the portal upload, just
 * tagged uploaded_by_borrower: false so the UI can distinguish the source.
 */
export async function uploadStaffDocument(formData: FormData): Promise<{
  success: boolean;
  error?: string;
  document?: PortalApplicationDetails["documents"][number];
}> {
  const applicationId = formData.get("application_id") as string;
  const stage = (formData.get("stage") as string) || "kyc";
  const category = (formData.get("category") as string) || "other";
  const partyBorrowerId = (formData.get("party_borrower_id") as string) || "";
  const file = formData.get("file") as File | null;

  if (!applicationId) return { success: false, error: "Missing loan application." };
  if (!file || file.size === 0) return { success: false, error: "Please select a file to upload." };
  if (file.size > 50 * 1024 * 1024) return { success: false, error: "File size exceeds 50MB limit." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "You must be signed in." };

  try {
    const { data: app } = await supabase
      .from("loan_applications")
      .select("id, borrower_id")
      .eq("id", applicationId)
      .maybeSingle();

    if (!app) return { success: false, error: "Loan application not found." };

    const targetBorrowerId = await resolveTargetBorrowerId(
      supabase,
      applicationId,
      app.borrower_id,
      partyBorrowerId,
    );

    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `portal/${applicationId}/${targetBorrowerId}/${stage}/${category}-${Date.now()}-${sanitizedFileName}`;

    const uploadRes = await uploadDocumentFile({ storagePath, file });
    if (!uploadRes.success) {
      return { success: false, error: uploadRes.error || "Document upload failed." };
    }

    const safeCategory = VALID_DOCUMENT_CATEGORIES.includes(category) ? category : "other";

    const { data: doc, error: insertError } = await supabase
      .from("borrower_documents")
      .insert({
        borrower_id: targetBorrowerId,
        loan_application_id: applicationId,
        stage,
        category: safeCategory,
        file_name: file.name,
        storage_path: storagePath,
        content_type: file.type || null,
        file_size: file.size,
        uploaded_by: user.id,
        uploaded_by_borrower: false,
      })
      .select("id, borrower_id, stage, category, file_name, storage_path, file_size, uploaded_at, uploaded_by_borrower")
      .single();

    if (insertError) {
      await deleteDocumentFile(storagePath);
      return { success: false, error: insertError.message };
    }

    revalidatePath(`/loans/${applicationId}`);

    return {
      success: true,
      document: {
        id: doc.id,
        borrowerId: doc.borrower_id,
        stage: doc.stage,
        category: doc.category,
        fileName: doc.file_name,
        storagePath: doc.storage_path,
        fileSize: doc.file_size,
        uploadedAt: doc.uploaded_at,
        uploadedByBorrower: false,
      },
    };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Upload failed." };
  }
}

/**
 * Finalizes the borrower's review, records confirmation and notes,
 * and notifies the internal underwriting team.
 */
export async function confirmPortalReview(
  token: string,
  notes: string,
): Promise<{ success: boolean; error?: string }> {
  const { valid, applicationId } = verifyPortalToken(token);
  if (!valid || !applicationId) {
    return { success: false, error: "Invalid or expired review token." };
  }

  try {
    const supabase = await getPortalClient();

    try {
      await supabase
        .from("loan_applications")
        .update({
          portal_status: "confirmed",
          borrower_reviewed_at: new Date().toISOString(),
          borrower_review_notes: notes.trim(),
        })
        .eq("id", applicationId);
    } catch {
      // Ignored if column missing
    }

    revalidatePath(`/portal/review/${token}`);
    revalidatePath(`/loans/${applicationId}`);

    return { success: true };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Submission failed." };
  }
}
