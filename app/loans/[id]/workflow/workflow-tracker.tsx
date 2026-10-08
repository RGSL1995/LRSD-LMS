"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { transitionLoanWorkflow } from "./workflow-actions";
import { WORKFLOW_STAGES, type LoanWorkflow, type WorkflowAction } from "./workflow-types";

function stageLabel(stage: number) {
  return WORKFLOW_STAGES[stage - 1]?.label || "Unknown stage";
}

export function WorkflowTracker({
  applicationId,
  workflow,
}: {
  applicationId: string;
  workflow: LoanWorkflow;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const current = workflow.currentStage;

  function run(action: WorkflowAction) {
    setMessage(null);
    startTransition(async () => {
      const result = await transitionLoanWorkflow(applicationId, workflow.version, action, note);
      if (!result.success) {
        setMessage(result.error || "Unable to update the workflow.");
        return;
      }
      setNote("");
      router.refresh();
    });
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-xs" aria-label="Loan origination workflow">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">Loan origination</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {workflow.error ? "Stage data is not available yet" : workflow.completed ? "Disbursement confirmed" : `Current stage: ${stageLabel(current)}`}
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          {workflow.error ? "Setup required" : workflow.completed ? "Complete" : `${current} of ${WORKFLOW_STAGES.length}`}
        </span>
      </div>

      {workflow.error && (
        <p role="alert" className="border-b bg-amber-50 px-5 py-3 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
          {workflow.error} The stage layout is shown below; actions will be available after setup.
        </p>
      )}
      <div className="overflow-x-auto px-4 py-5">
            <ol className="flex min-w-[1280px] items-start" aria-label="Workflow stages">
              {WORKFLOW_STAGES.map((stage, index) => {
                const number = index + 1;
                const done = !workflow.error && (number < current || (number === 12 && workflow.completed));
                const active = !workflow.error && number === current && !workflow.completed;
                return (
                  <li key={stage.key} className="relative flex min-w-0 flex-1 flex-col items-center px-1 text-center">
                    {index > 0 && (
                      <span aria-hidden className={`absolute right-1/2 top-[14px] z-0 h-0.5 w-full ${number <= current ? "bg-primary" : "bg-border"}`} />
                    )}
                    <span className={`relative z-10 flex size-7 items-center justify-center rounded-full border-2 bg-card text-xs font-semibold ${
                      done ? "border-primary bg-primary text-primary-foreground" :
                      active ? "border-primary text-primary" : "border-border text-muted-foreground"
                    }`} aria-label={`${stage.label}: ${done ? "complete" : active ? "current" : "upcoming"}`}>
                      {done ? <Check className="size-4" /> : active ? <span className="size-2.5 rounded-full bg-primary" /> : number}
                    </span>
                    <span className={`mt-2 max-w-28 text-[11px] leading-tight ${active ? "font-semibold text-foreground" : done ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                      {stage.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

      {!workflow.error && (
          <div className="grid gap-4 border-t px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
            <div>
              <h3 className="text-sm font-medium">{workflow.completed ? "Workflow complete" : stageLabel(current)}</h3>
              {workflow.importedBasis && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  Imported from: {workflow.importedBasis}. Confirm earlier stages against the case file.
                </p>
              )}
              {!workflow.completed && current === 7 && (
                <Link href={`/loans/${applicationId}/cam`} className="mt-2 inline-flex text-xs font-medium text-primary hover:underline">Open Credit Appraisal Memo</Link>
              )}
              {!workflow.completed && current === 8 && (
                <Link href={`/loans/${applicationId}/sanction`} className="mt-2 inline-flex text-xs font-medium text-primary hover:underline">Open sanction letter</Link>
              )}
              {!workflow.completed && current === 12 && !workflow.hasDisbursement && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Record the first tranche {workflow.activeFacilityId ? <Link className="text-primary hover:underline" href={`/loans/active/${workflow.activeFacilityId}`}>on the active facility</Link> : "on an active facility"} before confirming disbursement.
                </p>
              )}
              {workflow.events.length > 0 && (
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer font-medium text-muted-foreground">Stage history ({workflow.events.length})</summary>
                  <ol className="mt-2 max-h-48 space-y-2 overflow-y-auto border-l pl-3">
                    {workflow.events.map((event) => (
                      <li key={event.id}>
                        <span className="font-medium">{stageLabel(event.fromStage)} → {stageLabel(event.toStage)}</span>
                        <span className="ml-1 text-muted-foreground">· {event.action.replace("_", " ")} by {event.actorName} · {new Date(event.createdAt).toLocaleString("en-IN")}</span>
                        {event.note && <p className="mt-0.5 text-muted-foreground">{event.note}</p>}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </div>

            {!workflow.completed && (
              <div className="space-y-2">
                <label htmlFor="workflow-note" className="text-xs font-medium">Decision note <span className="font-normal text-muted-foreground">(required to send back)</span></label>
                <Textarea
                  id="workflow-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={2000}
                  placeholder="Add context for the next team..."
                  className="min-h-16 resize-y text-xs"
                  disabled={pending}
                />
                {message && <p role="alert" className="text-xs text-destructive">{message}</p>}
                <div className="flex flex-wrap gap-2">
                  {current > 1 && !workflow.hasDisbursement && (
                    <Button type="button" size="sm" variant="outline" disabled={pending || !note.trim()} onClick={() => run("send_back")}>
                      <ArrowLeft className="size-3.5" /> Send back
                    </Button>
                  )}
                  {current < 12 ? (
                    <Button type="button" size="sm" disabled={pending} onClick={() => run("advance")}>
                      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRight className="size-3.5" />}
                      {current === 11 ? "Approve OPS check" : `Complete ${stageLabel(current)}`}
                    </Button>
                  ) : (
                    <Button type="button" size="sm" disabled={pending || !workflow.hasDisbursement} onClick={() => run("complete")}>
                      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                      Confirm disbursement
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
      )}
    </section>
  );
}
