"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  type CamApproverItem,
  type CamApprovalStatus,
  type CamAutoData,
  type CamManualData,
} from "./cam-types";
import { getAutoCamPreview, getCamManualData } from "./cam-actions";
import { sendCamApprovalEmail } from "@/lib/email/cam-approval-email";

/**
 * Returns a Supabase client suitable for token-validated guest review.
 * Uses service key if available to bypass RLS for external approvers.
 */
async function getApprovalClient() {
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

function generateCamApprovalToken(approvalId: string, applicationId: string): string {
  const secret = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "lrsd-lms-cam-approval-salt";
  const payload = `${approvalId}.${applicationId}.${Date.now()}`;
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex").slice(0, 24);
  return Buffer.from(`${payload}.${hmac}`, "utf8").toString("base64url");
}

function getBaseAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

/**
 * Loads all configured CAM approvers for a loan application.
 */
export async function getCamApprovers(applicationId: string): Promise<CamApproverItem[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("cam_approvals")
      .select("*")
      .eq("loan_application_id", applicationId)
      .order("order_index", { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map((d) => ({
      id: d.id,
      camDocumentId: d.cam_document_id,
      loanApplicationId: d.loan_application_id,
      approverName: d.approver_name,
      approverEmail: d.approver_email,
      approverRole: d.approver_role || "Credit Committee Member",
      approvalStatus: d.approval_status as CamApprovalStatus,
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
  } catch (err) {
    console.error("[getCamApprovers] Error fetching approvers:", err);
    return [];
  }
}

/**
 * Saves/updates the list of approvers for the CAM.
 */
export async function saveCamApprovers(
  applicationId: string,
  approvers: Array<{
    id?: string;
    approverName: string;
    approverEmail: string;
    approverRole: string;
  }>,
): Promise<{ success: boolean; approvers?: CamApproverItem[]; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  try {
    // 1. Get cam_document_id if exists
    const { data: camDoc } = await supabase
      .from("cam_documents")
      .select("id")
      .eq("loan_application_id", applicationId)
      .maybeSingle();

    const camDocumentId = camDoc?.id || null;

    // 2. Fetch existing records
    const { data: existing } = await supabase
      .from("cam_approvals")
      .select("id, approver_email, approval_token, approval_status, sent_at, decision_at, comments, conditions, digital_signature")
      .eq("loan_application_id", applicationId);

    const existingMap = new Map((existing || []).map((e) => [e.id, e]));

    // 3. Prepare rows to upsert
    const incomingIds = new Set<string>();
    const rowsToUpsert = approvers.map((app, index) => {
      const match = app.id ? existingMap.get(app.id) : null;
      const id = match ? match.id : crypto.randomUUID();
      incomingIds.add(id);

      const token = match?.approval_token || generateCamApprovalToken(id, applicationId);

      return {
        id,
        loan_application_id: applicationId,
        cam_document_id: camDocumentId,
        approver_name: app.approverName.trim(),
        approver_email: app.approverEmail.trim().toLowerCase(),
        approver_role: app.approverRole.trim() || "Credit Committee Member",
        approval_token: token,
        approval_status: match?.approval_status || "pending",
        sent_at: match?.sent_at || null,
        decision_at: match?.decision_at || null,
        comments: match?.comments || null,
        conditions: match?.conditions || null,
        digital_signature: match?.digital_signature || null,
        order_index: index,
        updated_at: new Date().toISOString(),
      };
    });

    // Delete records not in the incoming list
    if (existing && existing.length > 0) {
      const toDelete = existing.filter((e) => !incomingIds.has(e.id)).map((e) => e.id);
      if (toDelete.length > 0) {
        await supabase.from("cam_approvals").delete().in("id", toDelete);
      }
    }

    if (rowsToUpsert.length > 0) {
      const { error: upsertErr } = await supabase
        .from("cam_approvals")
        .upsert(rowsToUpsert, { onConflict: "id" });

      if (upsertErr) {
        if (upsertErr.message?.includes("cam_approvals") || upsertErr.message?.includes("schema cache")) {
          return {
            success: false,
            error: "The 'cam_approvals' database table has not been created yet. Please execute migration 0021_cam_approvals.sql in your Supabase SQL Editor.",
          };
        }
        return { success: false, error: upsertErr.message };
      }
    }

    revalidatePath(`/loans/${applicationId}/cam`);
    const refreshed = await getCamApprovers(applicationId);
    return { success: true, approvers: refreshed };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    const msg = errorObj?.message || "";
    if (msg.includes("cam_approvals") || msg.includes("schema cache")) {
      return {
        success: false,
        error: "The 'cam_approvals' table does not exist in Supabase. Please run migration 0021_cam_approvals.sql in Supabase SQL Editor.",
      };
    }
    return { success: false, error: msg || "Failed to save approvers." };
  }
}

/**
 * Dispatches the CAM Approval Request email to an individual approver.
 */
export async function sendCamApprovalEmailAction(
  applicationId: string,
  approverId: string,
): Promise<{ success: boolean; reviewUrl?: string; error?: string; simulated?: boolean }> {
  try {
    const supabase = await createClient();

    // 1. Fetch approver
    const { data: approver, error: appErr } = await supabase
      .from("cam_approvals")
      .select("*")
      .eq("id", approverId)
      .eq("loan_application_id", applicationId)
      .single();

    if (appErr || !approver) {
      return { success: false, error: "Approver record not found." };
    }

    // 2. Fetch CAM Auto Data & Manual Data for email summary
    const autoData = await getAutoCamPreview(applicationId);
    if (!autoData) {
      return { success: false, error: "Failed to load CAM summary data." };
    }

    const manualData = await getCamManualData(applicationId);

    const baseUrl = getBaseAppUrl();
    const reviewUrl = `${baseUrl}/cam/review/${approver.approval_token}`;

    const highlights: string[] = [];
    if (autoData.securityCoverRatio > 0) {
      highlights.push(`Security Coverage: ${autoData.securityCoverRatio}x (${autoData.totalSecurityMarketValue})`);
    }
    if (manualData.underwritingJustification) {
      const lines = manualData.underwritingJustification
        .split("\n")
        .map((l) => l.trim().replace(/^[-•*]\s*/, ""))
        .filter(Boolean);
      highlights.push(...lines.slice(0, 3));
    }

    // 3. Dispatch Email
    const emailRes = await sendCamApprovalEmail({
      toEmail: approver.approver_email,
      approverName: approver.approver_name,
      approverRole: approver.approver_role || "Credit Committee Member",
      applicationCode: autoData.applicationCode,
      borrowerName: autoData.borrower.name,
      facilityType: autoData.facilityType || "Commercial Facility",
      requestedAmountFormatted: autoData.sanctionAmountText || `₹ ${autoData.requestedAmountNum.toLocaleString("en-IN")}`,
      tenureMonths: autoData.tenureMonths,
      securityCoverRatio: autoData.securityCoverRatio,
      keyHighlights: highlights,
      reviewUrl,
      preparedBy: manualData.preparedBy || "Credit Underwriting Team",
    });

    // 4. Update sent_at timestamp
    await supabase
      .from("cam_approvals")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", approverId);

    revalidatePath(`/loans/${applicationId}/cam`);

    return {
      success: true,
      reviewUrl,
      simulated: emailRes.simulated,
    };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Failed to send approval email." };
  }
}

/**
 * Sends approval requests to ALL configured approvers in the committee.
 */
export async function sendAllCamApprovalEmailsAction(
  applicationId: string,
): Promise<{ success: boolean; sentCount: number; error?: string }> {
  try {
    const approvers = await getCamApprovers(applicationId);
    if (approvers.length === 0) {
      return { success: false, sentCount: 0, error: "No committee approvers configured." };
    }

    let count = 0;
    for (const app of approvers) {
      const res = await sendCamApprovalEmailAction(applicationId, app.id);
      if (res.success) count++;
    }

    return { success: true, sentCount: count };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, sentCount: 0, error: errorObj?.message || "Failed to dispatch emails." };
  }
}

/**
 * Deletes an approver from the CAM approval list.
 */
export async function deleteCamApproverAction(
  approverId: string,
  applicationId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("cam_approvals")
      .delete()
      .eq("id", approverId)
      .eq("loan_application_id", applicationId);

    if (error) return { success: false, error: error.message };

    revalidatePath(`/loans/${applicationId}/cam`);
    return { success: true };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Delete failed." };
  }
}

/**
 * Data payload returned for an approver viewing the CAM via /cam/review/[token].
 */
export type CamReviewData = {
  approver: CamApproverItem;
  autoData: CamAutoData;
  manualData: CamManualData;
  allApprovers: CamApproverItem[];
};

/**
 * Fetches all necessary data to display the Credit Committee Review Portal using the approval token.
 * Does not require staff login.
 */
export async function getCamReviewDataByToken(token: string): Promise<{
  success: boolean;
  data?: CamReviewData;
  error?: string;
}> {
  if (!token || typeof token !== "string") {
    return { success: false, error: "Invalid approval review link." };
  }

  try {
    const supabase = await getApprovalClient();

    // 1. Locate approver record by token
    const { data: approverRow, error: appErr } = await supabase
      .from("cam_approvals")
      .select("*")
      .eq("approval_token", token)
      .maybeSingle();

    if (appErr || !approverRow) {
      return {
        success: false,
        error: "This Credit Committee review link is invalid or has expired. Please contact the Credit Risk department.",
      };
    }

    const applicationId = approverRow.loan_application_id;

    // 2. Fetch CAM Auto Data & Manual Data
    const autoData = await getAutoCamPreview(applicationId);
    if (!autoData) {
      return { success: false, error: "Loan application data could not be retrieved." };
    }

    const manualData = await getCamManualData(applicationId);

    // 3. Fetch all committee members for the Sign-off Matrix
    const { data: allApproversData } = await supabase
      .from("cam_approvals")
      .select("*")
      .eq("loan_application_id", applicationId)
      .order("order_index", { ascending: true });

    const allApprovers: CamApproverItem[] = (allApproversData || []).map((d) => ({
      id: d.id,
      camDocumentId: d.cam_document_id,
      loanApplicationId: d.loan_application_id,
      approverName: d.approver_name,
      approverEmail: d.approver_email,
      approverRole: d.approver_role || "Credit Committee Member",
      approvalStatus: d.approval_status as CamApprovalStatus,
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

    const currentApprover: CamApproverItem = {
      id: approverRow.id,
      camDocumentId: approverRow.cam_document_id,
      loanApplicationId: approverRow.loan_application_id,
      approverName: approverRow.approver_name,
      approverEmail: approverRow.approver_email,
      approverRole: approverRow.approver_role || "Credit Committee Member",
      approvalStatus: approverRow.approval_status as CamApprovalStatus,
      approvalToken: approverRow.approval_token,
      tokenExpiresAt: approverRow.token_expires_at,
      sentAt: approverRow.sent_at,
      decisionAt: approverRow.decision_at,
      comments: approverRow.comments,
      conditions: approverRow.conditions,
      digitalSignature: approverRow.digital_signature,
      ipAddress: approverRow.ip_address,
      orderIndex: approverRow.order_index ?? 0,
      createdAt: approverRow.created_at,
      updatedAt: approverRow.updated_at,
    };

    return {
      success: true,
      data: {
        approver: currentApprover,
        autoData,
        manualData,
        allApprovers,
      },
    };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Failed to load Credit Committee review data." };
  }
}

/**
 * Records the Credit Committee member's approval, conditional approval, or rejection.
 */
export async function submitCamApprovalDecision(
  token: string,
  decision: "approved" | "rejected" | "approved_with_conditions",
  data: {
    comments?: string;
    conditions?: string;
    digitalSignature?: string;
  },
): Promise<{ success: boolean; error?: string }> {
  if (!token) return { success: false, error: "Missing approval token." };

  try {
    const supabase = await getApprovalClient();

    // 1. Verify token
    const { data: approver, error: findErr } = await supabase
      .from("cam_approvals")
      .select("id, loan_application_id, approver_name")
      .eq("approval_token", token)
      .maybeSingle();

    if (findErr || !approver) {
      return { success: false, error: "Invalid or expired review link." };
    }

    const decisionTime = new Date().toISOString();
    const signature = data.digitalSignature?.trim() || approver.approver_name;

    // 2. Update approver record
    const { error: updateErr } = await supabase
      .from("cam_approvals")
      .update({
        approval_status: decision,
        decision_at: decisionTime,
        comments: data.comments?.trim() || null,
        conditions: data.conditions?.trim() || null,
        digital_signature: signature,
        updated_at: decisionTime,
      })
      .eq("id", approver.id);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // 3. Revalidate paths
    revalidatePath(`/cam/review/${token}`);
    revalidatePath(`/loans/${approver.loan_application_id}/cam`);
    revalidatePath(`/loans/${approver.loan_application_id}`);

    return { success: true };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Failed to record approval decision." };
  }
}
