import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { verifyPortalToken } from "@/app/portal/portal-security";
import { uploadDocumentBuffer, deleteDocumentFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

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
      // Ignored
    }
  }

  if (serviceKey && url) {
    return createSupabaseClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return await createClient();
}

const VALID_CATEGORIES = [
  "pan_card",
  "identity_proof",
  "aadhaar_masked",
  "passport",
  "driving_license",
  "address_proof",
  "photograph",
  "company_incorporation_docs",
  "gst_certificate",
  "shareholder_director_list",
  "itr_or_form16",
  "itr_signed_stamped",
  "salary_slips",
  "bank_statement",
  "balance_sheet_pl",
  "net_worth_certificate",
  "moa",
  "aoa",
  "mca_documents",
  "other",
];

export async function POST(req: Request) {
  try {
    let token = req.headers.get("x-token") || "";
    let stage = req.headers.get("x-stage") || "kyc";
    let category = req.headers.get("x-category") || "other";
    let partyBorrowerId = req.headers.get("x-party-id") || "";
    let fileName = decodeURIComponent(req.headers.get("x-filename") || "");
    let contentType = req.headers.get("content-type") || "application/octet-stream";
    let buffer: Buffer | null = null;
    let fileSize = 0;

    // Check if raw binary stream was sent with headers
    if (token && fileName && req.body) {
      const reader = req.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          total += value.length;
        }
      }
      buffer = Buffer.concat(chunks, total);
      fileSize = total;
    } else {
      // Fallback to multipart FormData
      const formData = await req.formData();
      token = (formData.get("token") as string) || "";
      stage = (formData.get("stage") as string) || "kyc";
      category = (formData.get("category") as string) || "other";
      partyBorrowerId = (formData.get("party_borrower_id") as string) || "";
      const file = formData.get("file") as File | null;

      if (file && file.size > 0) {
        fileName = file.name;
        contentType = file.type || "application/octet-stream";
        fileSize = file.size;
        buffer = Buffer.from(await file.arrayBuffer());
      }
    }

    if (!token) {
      return NextResponse.json({ success: false, error: "Missing verification token." }, { status: 400 });
    }

    if (!buffer || buffer.length === 0) {
      return NextResponse.json({ success: false, error: "Please select a file to upload." }, { status: 400 });
    }

    if (fileSize > 50 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "File size exceeds 50MB limit." }, { status: 400 });
    }

    const { valid, applicationId } = verifyPortalToken(token);
    if (!valid || !applicationId) {
      return NextResponse.json({ success: false, error: "Invalid or expired review token." }, { status: 401 });
    }

    const supabase = await getPortalClient();

    // 1. Get borrower ID
    const { data: app } = await supabase
      .from("loan_applications")
      .select("id, borrower_id")
      .eq("id", applicationId)
      .maybeSingle();

    if (!app) {
      return NextResponse.json({ success: false, error: "Loan application not found." }, { status: 404 });
    }

    let targetBorrowerId = app.borrower_id;
    if (partyBorrowerId && partyBorrowerId !== app.borrower_id) {
      const { data: partyMatch } = await supabase
        .from("loan_application_parties")
        .select("borrower_id")
        .eq("loan_application_id", applicationId)
        .eq("borrower_id", partyBorrowerId)
        .maybeSingle();

      if (partyMatch) {
        targetBorrowerId = partyBorrowerId;
      }
    }

    const sanitizedFileName = (fileName || "document.pdf").replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `portal/${applicationId}/${targetBorrowerId}/${stage}/${category}-${Date.now()}-${sanitizedFileName}`;

    // 2. Upload raw binary buffer straight into S3
    const uploadRes = await uploadDocumentBuffer({
      storagePath,
      buffer,
      contentType,
    });

    if (!uploadRes.success) {
      return NextResponse.json({ success: false, error: uploadRes.error || "Storage upload failed." }, { status: 500 });
    }

    // 3. Insert record in borrower_documents
    const safeCategory = VALID_CATEGORIES.includes(category) ? category : "other";

    let docResult = null;

    try {
      const { data: doc, error: insertError } = await supabase
        .from("borrower_documents")
        .insert({
          borrower_id: targetBorrowerId,
          loan_application_id: applicationId,
          stage,
          category: safeCategory,
          file_name: fileName || "document.pdf",
          storage_path: storagePath,
          content_type: contentType || null,
          file_size: fileSize,
          uploaded_by_borrower: true,
        })
        .select("id, borrower_id, stage, category, file_name, storage_path, file_size, uploaded_at, uploaded_by_borrower")
        .single();

      if (insertError) throw insertError;
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
          file_name: fileName || "document.pdf",
          storage_path: storagePath,
          content_type: contentType || null,
          file_size: fileSize,
        })
        .select("id, borrower_id, stage, category, file_name, storage_path, file_size, uploaded_at")
        .single();

      if (fallbackErr) {
        await deleteDocumentFile(storagePath);
        return NextResponse.json({ success: false, error: fallbackErr.message }, { status: 500 });
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

    return NextResponse.json({
      success: true,
      document: docResult,
    });
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return NextResponse.json(
      { success: false, error: errorObj?.message || "Failed to upload document." },
      { status: 500 }
    );
  }
}
