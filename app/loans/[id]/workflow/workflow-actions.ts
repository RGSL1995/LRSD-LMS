"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { WorkflowAction } from "./workflow-types";

export async function transitionLoanWorkflow(
  applicationId: string,
  expectedVersion: number,
  action: WorkflowAction,
  note: string,
): Promise<{ success: boolean; error?: string }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(applicationId)) {
    return { success: false, error: "Invalid application." };
  }
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0 ||
      !["advance", "send_back", "complete"].includes(action) ||
      typeof note !== "string" || note.length > 2000) {
    return { success: false, error: "Invalid workflow request." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sign in to update this application." };

  const { error } = await supabase.rpc("transition_loan_workflow", {
    p_application_id: applicationId,
    p_expected_version: expectedVersion,
    p_action: action,
    p_note: note.trim() || null,
  });
  if (error) return { success: false, error: error.message };

  revalidatePath(`/loans/${applicationId}`);
  revalidatePath("/loans");
  return { success: true };
}
