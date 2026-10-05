"use client";

import { useState, useTransition } from "react";
import {
  type CamReviewData,
  submitCamApprovalDecision,
} from "@/app/loans/[id]/cam/cam-approval-actions";
import { generateCamDocument } from "@/app/loans/[id]/cam/cam-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileDown,
  Building2,
  Clock,
  Landmark,
  Layers,
  FileText,
  UserCheck,
  Percent,
  TrendingUp,
  Loader2,
  Check,
  Users,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CamReviewClientProps {
  initialData: CamReviewData;
  token: string;
}

export function CamReviewClient({ initialData, token }: CamReviewClientProps) {
  const [data, setData] = useState<CamReviewData>(initialData);
  const [decision, setDecision] = useState<"approved" | "approved_with_conditions" | "rejected">(
    initialData.approver.approvalStatus === "rejected"
      ? "rejected"
      : initialData.approver.approvalStatus === "approved_with_conditions"
        ? "approved_with_conditions"
        : "approved",
  );
  const [conditions, setConditions] = useState(initialData.approver.conditions || "");
  const [comments, setComments] = useState(initialData.approver.comments || "");
  const [signatureName, setSignatureName] = useState(
    initialData.approver.digitalSignature || initialData.approver.approverName,
  );

  const [isSubmitting, startSubmitTransition] = useTransition();
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(
    initialData.approver.approvalStatus !== "pending",
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDownloading, startDownloadTransition] = useTransition();

  const { approver, autoData, manualData, allApprovers } = data;

  const handleDecisionSubmit = () => {
    setSubmitError(null);
    if (decision === "approved_with_conditions" && !conditions.trim()) {
      setSubmitError("Please specify the conditions required for approval.");
      return;
    }

    startSubmitTransition(async () => {
      const res = await submitCamApprovalDecision(token, decision, {
        comments,
        conditions: decision === "approved_with_conditions" ? conditions : undefined,
        digitalSignature: signatureName,
      });

      if (res.success) {
        setSubmitSuccess(true);
        // Optimistically update local state
        setData((prev) => ({
          ...prev,
          approver: {
            ...prev.approver,
            approvalStatus: decision,
            decisionAt: new Date().toISOString(),
            comments,
            conditions: decision === "approved_with_conditions" ? conditions : null,
            digitalSignature: signatureName,
          },
          allApprovers: prev.allApprovers.map((a) =>
            a.id === prev.approver.id
              ? {
                  ...a,
                  approvalStatus: decision,
                  decisionAt: new Date().toISOString(),
                  comments,
                  conditions: decision === "approved_with_conditions" ? conditions : null,
                  digitalSignature: signatureName,
                }
              : a,
          ),
        }));
      } else {
        setSubmitError(res.error || "Failed to submit decision. Please try again.");
      }
    });
  };

  const handleDownloadDocx = () => {
    startDownloadTransition(async () => {
      const res = await generateCamDocument(autoData.applicationId);
      if (res.success && res.url) {
        window.open(res.url, "_blank");
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50/80 dark:bg-slate-950 pb-24">
      {/* Top Banner Header */}
      <header className="border-b bg-card px-4 sm:px-8 py-4 sticky top-0 z-20 shadow-xs">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Credit Committee Review Portal
                </span>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {autoData.applicationCode}
                </Badge>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-foreground">
                {autoData.borrower.name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadDocx}
              disabled={isDownloading}
              className="text-xs h-8 gap-1.5 shadow-xs"
            >
              {isDownloading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FileDown className="size-3.5 text-primary" />
              )}
              Download CAM (.docx)
            </Button>

            {approver.approvalStatus === "approved" ? (
              <Badge className="bg-emerald-600 text-white text-xs px-2.5 py-1 gap-1">
                <CheckCircle2 className="size-3.5" /> Approved
              </Badge>
            ) : approver.approvalStatus === "approved_with_conditions" ? (
              <Badge className="bg-amber-500 text-white text-xs px-2.5 py-1 gap-1">
                <AlertTriangle className="size-3.5" /> Approved w/ Conditions
              </Badge>
            ) : approver.approvalStatus === "rejected" ? (
              <Badge className="bg-rose-600 text-white text-xs px-2.5 py-1 gap-1">
                <XCircle className="size-3.5" /> Rejected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs px-2.5 py-1 text-amber-600 border-amber-500/30 bg-amber-50 dark:bg-amber-950/30">
                Action Required (Pending)
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 pt-6 space-y-6">
        {/* Approver Welcome & Status Alert */}
        <div className="p-4 rounded-xl border bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">
                Reviewing as: <strong className="text-primary">{approver.approverName}</strong>
              </span>
              <Badge variant="secondary" className="text-[10px]">
                {approver.approverRole}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Please review the credit memorandum and record your formal decision for this facility.
            </p>
          </div>
          {approver.decisionAt && (
            <div className="text-xs text-muted-foreground text-left sm:text-right">
              Decision Recorded:{" "}
              <strong className="text-foreground">
                {new Date(approver.decisionAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </strong>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* DECISION ACTION PANEL (Sticky or Top Position) */}
        {/* ========================================================= */}
        <Card className="border-primary/30 shadow-md bg-card">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="size-4 text-primary" />
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Credit Decision &amp; Formal Sign-Off
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-[11px] font-mono">
                {approver.approverEmail}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-4 space-y-4">
            {submitSuccess && (
              <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  <span>
                    Your decision (<strong>{approver.approvalStatus.replace(/_/g, " ").toUpperCase()}</strong>) has been recorded in the Credit Committee register.
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setSubmitSuccess(false)}
                  className="text-xs text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 h-7"
                >
                  Change Decision
                </Button>
              </div>
            )}

            {submitError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {!submitSuccess && (
              <div className="space-y-4">
                {/* Decision Option Buttons */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Select Decision *</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setDecision("approved")}
                      className={cn(
                        "p-3 rounded-lg border text-left transition-all flex items-start gap-2.5",
                        decision === "approved"
                          ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-600 text-emerald-900 dark:text-emerald-200"
                          : "border-border hover:bg-muted/40 text-muted-foreground",
                      )}
                    >
                      <div
                        className={cn(
                          "size-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0",
                          decision === "approved" ? "border-emerald-600 bg-emerald-600 text-white" : "border-muted-foreground",
                        )}
                      >
                        {decision === "approved" && <Check className="size-3.5" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground">Approve CAM</div>
                        <div className="text-[11px] text-muted-foreground">Sanction facility as proposed</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDecision("approved_with_conditions")}
                      className={cn(
                        "p-3 rounded-lg border text-left transition-all flex items-start gap-2.5",
                        decision === "approved_with_conditions"
                          ? "border-amber-600 bg-amber-50/50 dark:bg-amber-950/30 ring-1 ring-amber-600 text-amber-900 dark:text-amber-200"
                          : "border-border hover:bg-muted/40 text-muted-foreground",
                      )}
                    >
                      <div
                        className={cn(
                          "size-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0",
                          decision === "approved_with_conditions"
                            ? "border-amber-600 bg-amber-600 text-white"
                            : "border-muted-foreground",
                        )}
                      >
                        {decision === "approved_with_conditions" && <Check className="size-3.5" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground">Approve w/ Conditions</div>
                        <div className="text-[11px] text-muted-foreground">Sanction subject to covenants</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDecision("rejected")}
                      className={cn(
                        "p-3 rounded-lg border text-left transition-all flex items-start gap-2.5",
                        decision === "rejected"
                          ? "border-rose-600 bg-rose-50/50 dark:bg-rose-950/30 ring-1 ring-rose-600 text-rose-900 dark:text-rose-200"
                          : "border-border hover:bg-muted/40 text-muted-foreground",
                      )}
                    >
                      <div
                        className={cn(
                          "size-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0",
                          decision === "rejected" ? "border-rose-600 bg-rose-600 text-white" : "border-muted-foreground",
                        )}
                      >
                        {decision === "rejected" && <Check className="size-3.5" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground">Reject CAM</div>
                        <div className="text-[11px] text-muted-foreground">Decline credit proposal</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Conditional Requirements Box */}
                {decision === "approved_with_conditions" && (
                  <div className="space-y-1.5 p-3 rounded-lg bg-amber-500/5 border border-amber-500/30">
                    <Label className="text-xs font-semibold text-amber-900 dark:text-amber-300">
                      Pre-Disbursement / Post-Disbursement Conditions *
                    </Label>
                    <Textarea
                      value={conditions}
                      onChange={(e) => setConditions(e.target.value)}
                      placeholder="e.g. 1. Minimum cover of 2.25x to be maintained at all times. 2. ROC charge creation within 30 days."
                      className="text-xs min-h-[70px] bg-background"
                    />
                  </div>
                )}

                {/* General Remarks / Notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Committee Remarks / Feedback (Optional)</Label>
                  <Textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Enter any additional observations, committee minutes, or rationale..."
                    className="text-xs min-h-[60px]"
                  />
                </div>

                {/* Digital Signature Confirmation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Digital Sign-Off Name *</Label>
                    <Input
                      value={signatureName}
                      onChange={(e) => setSignatureName(e.target.value)}
                      placeholder="Full Name of Approver"
                      className="text-xs h-9"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleDecisionSubmit}
                    disabled={isSubmitting || !signatureName.trim()}
                    className={cn(
                      "h-9 font-semibold text-xs gap-1.5 shadow-sm",
                      decision === "approved"
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : decision === "approved_with_conditions"
                          ? "bg-amber-600 hover:bg-amber-700 text-white"
                          : "bg-rose-600 hover:bg-rose-700 text-white",
                    )}
                  >
                    {isSubmitting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3.5" />
                    )}
                    Confirm &amp; Record {decision.replace(/_/g, " ").toUpperCase()} Decision
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ========================================================= */}
        {/* FACILITY SUMMARY CARD */}
        {/* ========================================================= */}
        <Card className="shadow-xs border-border/80">
          <CardHeader className="pb-3 border-b">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Facility Terms</span>
            <CardTitle className="text-base mt-0.5">Wholesale Commercial Proposal Summary</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="space-y-0.5">
                <span className="text-muted-foreground">Sanction Amount</span>
                <p className="text-base font-bold font-mono text-primary">{autoData.sanctionAmountText}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-muted-foreground">Facility Type</span>
                <p className="font-semibold text-foreground">{autoData.facilityType}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-muted-foreground">Tenure</span>
                <p className="font-semibold text-foreground flex items-center gap-1">
                  <Clock className="size-3 text-muted-foreground" /> {autoData.tenureMonths} Months
                </p>
              </div>
              <div className="space-y-0.5">
                <span className="text-muted-foreground">Security Cover</span>
                <p className="text-base font-bold font-mono text-emerald-600">
                  {autoData.securityCoverRatio > 0 ? `${autoData.securityCoverRatio}x Cover` : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ========================================================= */}
        {/* PLEDGED SECURITIES SCHEDULE (if LAS) */}
        {/* ========================================================= */}
        {autoData.securities && autoData.securities.length > 0 && (
          <Card className="shadow-xs border-border/80">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Landmark className="size-4 text-primary" />
                  <CardTitle className="text-base font-bold">Pledged Securities &amp; Collateral Valuation</CardTitle>
                </div>
                <Badge variant="outline" className="font-mono text-xs text-primary font-bold">
                  Total Market Val: {autoData.totalSecurityMarketValue}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                      <th className="p-2.5">Scrip / Company</th>
                      <th className="p-2.5">ISIN</th>
                      <th className="p-2.5 text-right">Quantity</th>
                      <th className="p-2.5 text-right">CMP (₹)</th>
                      <th className="p-2.5 text-right">Market Value</th>
                      <th className="p-2.5">Pledgor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {autoData.securities.map((s, idx) => (
                      <tr key={idx} className="hover:bg-muted/10">
                        <td className="p-2.5 font-semibold text-foreground">{s.scripName}</td>
                        <td className="p-2.5 font-mono text-muted-foreground">{s.isin || "—"}</td>
                        <td className="p-2.5 font-mono text-right">{s.quantity}</td>
                        <td className="p-2.5 font-mono text-right">{s.price}</td>
                        <td className="p-2.5 font-mono font-bold text-right text-primary">{s.marketValue}</td>
                        <td className="p-2.5 text-muted-foreground">{s.pledgorName || "Primary Borrower"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ========================================================= */}
        {/* UNDERWRITING JUSTIFICATION & RISKS */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Underwriting Justifications */}
          <Card className="shadow-xs border-border/80">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <CardTitle className="text-sm font-bold">Underwriting Rationale &amp; Strengths</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {manualData.underwritingJustification ? (
                <ul className="space-y-1.5 text-xs text-foreground">
                  {manualData.underwritingJustification
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean)
                    .map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <span>{item.replace(/^[-•*]\s*/, "")}</span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground italic">Standard underwriting rationale recorded.</p>
              )}
            </CardContent>
          </Card>

          {/* Key Risks & Mitigants */}
          <Card className="shadow-xs border-border/80">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" />
                <CardTitle className="text-sm font-bold">Key Risks &amp; Mitigations</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {manualData.risks && manualData.risks.length > 0 ? (
                manualData.risks.map((r, i) => (
                  <div key={i} className="p-2.5 rounded-lg border bg-muted/20 space-y-1 text-xs">
                    <div className="font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-rose-500" /> Risk: {r.risk}
                    </div>
                    <div className="text-emerald-800 dark:text-emerald-300 pl-3">
                      Mitigation: {r.mitigate}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic">No exceptional risk flags noted.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ========================================================= */}
        {/* CREDIT COMMITTEE SIGN-OFF MATRIX */}
        {/* ========================================================= */}
        <Card className="shadow-xs border-border/80">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <CardTitle className="text-base font-bold">Credit Committee Approval Matrix</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs font-medium">
                {allApprovers.filter((a) => a.approvalStatus === "approved" || a.approvalStatus === "approved_with_conditions").length} of {allApprovers.length} Approved
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="divide-y">
              {allApprovers.map((app) => {
                const isCurrent = app.id === approver.id;
                return (
                  <div key={app.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground">{app.approverName}</span>
                        {isCurrent && (
                          <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                            You
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-[10px]">
                          {app.approverRole}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">{app.approverEmail}</p>
                      {app.conditions && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-300 italic pt-1">
                          Condition: {app.conditions}
                        </p>
                      )}
                      {app.comments && (
                        <p className="text-[11px] text-muted-foreground pt-0.5">
                          Remarks: {app.comments}
                        </p>
                      )}
                    </div>

                    <div className="text-left sm:text-right shrink-0 space-y-1">
                      {app.approvalStatus === "approved" ? (
                        <Badge className="bg-emerald-600 text-white text-xs gap-1">
                          <CheckCircle2 className="size-3" /> Approved
                        </Badge>
                      ) : app.approvalStatus === "approved_with_conditions" ? (
                        <Badge className="bg-amber-500 text-white text-xs gap-1">
                          <AlertTriangle className="size-3" /> Approved w/ Conditions
                        </Badge>
                      ) : app.approvalStatus === "rejected" ? (
                        <Badge className="bg-rose-600 text-white text-xs gap-1">
                          <XCircle className="size-3" /> Rejected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Pending Review
                        </Badge>
                      )}
                      {app.decisionAt && (
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(app.decisionAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
