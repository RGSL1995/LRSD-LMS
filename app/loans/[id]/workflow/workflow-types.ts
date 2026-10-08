export const WORKFLOW_STAGES = [
  { key: "enquiry", label: "Enquiry" },
  { key: "dde", label: "DDE" },
  { key: "review", label: "Review" },
  { key: "financial_bureau", label: "Financial and Bureau Check" },
  { key: "pd_pending", label: "PD Pending" },
  { key: "pd_done", label: "PD Done" },
  { key: "recommendation", label: "Recommendation" },
  { key: "sanction", label: "Sanction" },
  { key: "post_sanction_documents", label: "Post Sanction Document" },
  { key: "ops_maker", label: "OPS Maker" },
  { key: "ops_checker", label: "OPS Checker" },
  { key: "disbursed", label: "Disbursed" },
] as const;

export type WorkflowAction = "advance" | "send_back" | "complete";

export interface LoanWorkflow {
  currentStage: number;
  completed: boolean;
  importedBasis: string | null;
  version: number;
  updatedAt: string | null;
  hasDisbursement: boolean;
  activeFacilityId: string | null;
  events: Array<{
    id: string;
    fromStage: number;
    toStage: number;
    action: WorkflowAction;
    actorName: string;
    note: string | null;
    createdAt: string;
  }>;
  error?: string;
}
