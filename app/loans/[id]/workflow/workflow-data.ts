import { createClient } from "@/lib/supabase/server";
import type { LoanWorkflow, WorkflowAction } from "./workflow-types";

export async function getLoanWorkflow(applicationId: string): Promise<LoanWorkflow> {
  const empty: LoanWorkflow = {
    currentStage: 1,
    completed: false,
    importedBasis: null,
    version: 0,
    updatedAt: null,
    hasDisbursement: false,
    activeFacilityId: null,
    events: [],
  };
  const supabase = await createClient();
  const { data: workflow, error } = await supabase
    .from("loan_workflows")
    .select("current_stage, completed, imported_basis, version, updated_at")
    .eq("loan_application_id", applicationId)
    .maybeSingle();

  if (error) {
    return { ...empty, error: error.code === "42P01" || error.code === "PGRST205"
      ? "The loan workflow database migration has not been applied yet."
      : "The loan workflow could not be loaded." };
  }

  const [{ data: events }, { data: loan }] = await Promise.all([
    supabase
      .from("loan_workflow_events")
      .select("id, from_stage, to_stage, action, actor_id, note, created_at")
      .eq("loan_application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("loans")
      .select("id, loan_disbursements(id)")
      .eq("loan_application_id", applicationId)
      .maybeSingle(),
  ]);

  const actorIds = [...new Set((events || []).map((event) => event.actor_id))];
  const { data: profiles } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] as Array<{ id: string; full_name: string }> };
  const names = new Map((profiles || []).map((profile) => [profile.id, profile.full_name]));

  return {
    currentStage: workflow?.current_stage ?? 1,
    completed: workflow?.completed ?? false,
    importedBasis: workflow?.imported_basis ?? null,
    version: workflow?.version ?? 0,
    updatedAt: workflow?.updated_at ?? null,
    hasDisbursement: Array.isArray(loan?.loan_disbursements) && loan.loan_disbursements.length > 0,
    activeFacilityId: loan?.id || null,
    events: (events || []).map((event) => ({
      id: event.id,
      fromStage: event.from_stage,
      toStage: event.to_stage,
      action: event.action as WorkflowAction,
      actorName: names.get(event.actor_id) || "Employee",
      note: event.note,
      createdAt: event.created_at,
    })),
  };
}
