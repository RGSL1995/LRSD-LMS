"use deliberate";
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  saveSanctionManualData,
  generateSanctionDocument,
} from "./sanction-actions";
import {
  type SanctionAutoData,
  type SanctionManualData,
  emptySanctionManualData,
} from "./sanction-types";
import { convertNumberToIndianWords } from "./number-to-words";
import {
  Loader2,
  Save,
  FileDown,
  Plus,
  Trash2,
  ShieldCheck,
  Building2,
  Scale,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Eye,
  Check,
  Landmark,
  FileCheck,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";

interface SanctionFormClientProps {
  applicationId: string;
  autoData: SanctionAutoData;
  initialManualData: SanctionManualData;
}

type TabType =
  | "header_addressee"
  | "commercial_terms"
  | "security_valuation"
  | "triggers_cash_topup"
  | "conditions"
  | "regulatory_signoff"
  | "preview";

export function SanctionFormClient({
  applicationId,
  autoData,
  initialManualData,
}: SanctionFormClientProps) {
  const [manual, setManual] = useState<SanctionManualData>(initialManualData);
  const [activeTab, setActiveTab] = useState<TabType>("header_addressee");
  const [isSaving, startSaveTransition] = useTransition();
  const [isGenerating, startGenerateTransition] = useTransition();
  const [saveMessage, setSaveMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const handleAmountChange = (valStr: string) => {
    const clean = Number(valStr.replace(/,/g, "")) || 0;
    const formatted = clean > 0 ? `Rs. ${clean.toLocaleString("en-IN")}/-` : "Rs. 0/-";
    const inWords = convertNumberToIndianWords(clean);

    setManual((prev) => ({
      ...prev,
      sanctionedAmount: clean,
      sanctionedAmountText: formatted,
      sanctionedAmountInWords: inWords,
    }));
  };

  const handleSave = () => {
    setSaveMessage(null);
    startSaveTransition(async () => {
      const res = await saveSanctionManualData(applicationId, manual);
      if (res.success) {
        setSaveMessage({ text: "Sanction Letter terms saved successfully!" });
        setTimeout(() => setSaveMessage(null), 4000);
      } else {
        setSaveMessage({ text: res.error || "Failed to save data.", isError: true });
      }
    });
  };

  const handleGenerate = () => {
    setGenerateError(null);
    startGenerateTransition(async () => {
      const saveRes = await saveSanctionManualData(applicationId, manual);
      if (!saveRes.success) {
        setGenerateError(saveRes.error || "Failed to save before generating.");
        return;
      }
      const res = await generateSanctionDocument(applicationId);
      if (!res.success || !res.url) {
        setGenerateError(res.error || "Failed to generate Sanction Letter DOCX.");
        return;
      }
      window.open(res.url, "_blank", "noopener,noreferrer");
    });
  };

  const tabs: Array<{ id: TabType; label: string; icon: React.ReactNode }> = [
    { id: "header_addressee", label: "1. Header & Addressee", icon: <Building2 className="size-4" /> },
    { id: "commercial_terms", label: "2. Commercial Terms", icon: <TrendingUp className="size-4" /> },
    { id: "security_valuation", label: "3. Security & Valuation", icon: <Scale className="size-4" /> },
    { id: "triggers_cash_topup", label: "4. Triggers & Top-Up", icon: <AlertTriangle className="size-4" /> },
    { id: "conditions", label: "5. Conditions (CPs & CSs)", icon: <ShieldCheck className="size-4" /> },
    { id: "regulatory_signoff", label: "6. Regulatory & Sign-Off", icon: <Landmark className="size-4" /> },
    { id: "preview", label: "👁️ Live Sanction Preview", icon: <Eye className="size-4" /> },
  ];

  // Calculate monthly repayment schedule for preview & Annexure 1
  const amount = manual.sanctionedAmount || autoData.requestedAmountNum || 50000000;
  const roi = manual.roiPercent || 16.0;
  const tenureMonths = manual.tenureMonths || 12;
  const monthlyInterest = Math.round((amount * roi) / 1200);

  const formatINR = (val: number) => val.toLocaleString("en-IN", { maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="rounded-xl border bg-gradient-to-r from-red-950 via-slate-900 to-indigo-950 p-5 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold tracking-wider bg-white/10 text-white px-2.5 py-1 rounded-md border border-white/20">
                {manual.sanctionLetterRef || autoData.applicationCode}
              </span>
              <span className="text-xs bg-red-500/20 text-red-200 px-2.5 py-1 rounded-md border border-red-400/30 font-semibold">
                LRSD Institutional Format
              </span>
              <span className="text-xs bg-emerald-500/20 text-emerald-200 px-2.5 py-1 rounded-md border border-emerald-400/30 font-medium">
                {manual.facilityType}
              </span>
              <span className="text-xs bg-white/10 text-slate-200 px-2.5 py-1 rounded-md border border-white/10">
                Tenor: {manual.tenureDays} Days ({manual.tenureMonths}M)
              </span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              {autoData.borrower.name}
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl line-clamp-1">
              Sanction Letter with respect to term Loan Facility of {manual.sanctionedAmountText} ({manual.sanctionedAmountInWords})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-2 px-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Sanction Amount</span>
                <span className="font-bold text-white">{manual.sanctionedAmountText}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-2 px-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">ROI (% p.a.)</span>
                <span className="font-bold text-amber-300">{manual.roiPercent}% p.a.</span>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto lg:ml-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-9 gap-1.5 text-xs"
              >
                {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Save Draft
              </Button>
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="bg-red-600 hover:bg-red-500 text-white h-9 gap-1.5 text-xs font-semibold shadow-sm"
              >
                {isGenerating ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />}
                Download Sanction (.docx)
              </Button>
              <Link href={`/loans/${applicationId}/repayment`}>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white h-9 gap-1.5 text-xs font-semibold shadow-sm"
                >
                  <Calendar className="size-3.5" />
                  Repayment Schedule
                  <ArrowRight className="size-3" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {saveMessage && (
          <div
            className={`mt-3 p-2 px-3 rounded text-xs flex items-center gap-2 ${
              saveMessage.isError
                ? "bg-destructive/20 text-destructive-foreground border border-destructive/30"
                : "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30"
            }`}
          >
            <CheckCircle2 className="size-3.5 shrink-0" />
            {saveMessage.text}
          </div>
        )}

        {generateError && (
          <div className="mt-3 p-2 px-3 rounded text-xs bg-destructive/20 text-destructive-foreground border border-destructive/30 flex items-center gap-2">
            <AlertTriangle className="size-3.5 shrink-0" />
            {generateError}
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto gap-1 border-b pb-2 text-xs no-scrollbar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: Header & Addressee */}
      {activeTab === "header_addressee" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                Letterhead & Document Identification
              </CardTitle>
              <CardDescription className="text-xs">
                Configure sanction reference number, issue date, and addressee borrower metadata.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Sanction Letter Reference</label>
                  <Input
                    value={manual.sanctionLetterRef}
                    onChange={(e) => setManual({ ...manual, sanctionLetterRef: e.target.value })}
                    className="h-8 text-xs font-mono font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Dated (Issue Date)</label>
                  <Input
                    type="date"
                    value={manual.sanctionDate}
                    onChange={(e) => setManual({ ...manual, sanctionDate: e.target.value })}
                    className="h-8 text-xs font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Validity (Days)</label>
                  <Input
                    type="number"
                    value={manual.validityDays}
                    onChange={(e) => setManual({ ...manual, validityDays: Number(e.target.value) || 30 })}
                    className="h-8 text-xs font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Borrower Legal Name</label>
                  <Input
                    value={autoData.borrower.name}
                    disabled
                    className="h-8 text-xs font-medium bg-muted/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Borrower Short Name / Code</label>
                  <Input
                    value={manual.borrowerShortName}
                    onChange={(e) => setManual({ ...manual, borrowerShortName: e.target.value })}
                    placeholder="e.g. ORIANA"
                    className="h-8 text-xs font-medium"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">Borrower Registered Address</label>
                  <Textarea
                    value={autoData.borrower.address || ""}
                    disabled
                    rows={2}
                    className="text-xs font-medium bg-muted/30"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: Commercial Terms */}
      {activeTab === "commercial_terms" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" />
                Loan Facility & Commercials (Points 4 – 14)
              </CardTitle>
              <CardDescription className="text-xs">
                Sanctioned facility amount, interest rate, legal/processing fees, tenure, and repayment terms.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Sanctioned Amount (₹)</label>
                  <Input
                    type="number"
                    value={manual.sanctionedAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className="h-8 text-xs font-bold text-primary font-mono"
                  />
                  <span className="text-[11px] text-muted-foreground block">
                    {manual.sanctionedAmountInWords}
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Facility Type</label>
                  <Input
                    value={manual.facilityType}
                    onChange={(e) => setManual({ ...manual, facilityType: e.target.value })}
                    className="h-8 text-xs font-medium"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">Permitted Purpose</label>
                  <Textarea
                    value={manual.permittedPurpose}
                    onChange={(e) => setManual({ ...manual, permittedPurpose: e.target.value })}
                    rows={2}
                    className="text-xs font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Rate of Interest (% p.a.)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={manual.roiPercent}
                    onChange={(e) => {
                      const r = Number(e.target.value) || 16.0;
                      setManual({
                        ...manual,
                        roiPercent: r,
                        interestRateText: `${r.toFixed(2)}% per annum compounded and payable at monthly rests.`,
                      });
                    }}
                    className="h-8 text-xs font-medium font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Rate of Interest Clause Text</label>
                  <Input
                    value={manual.interestRateText}
                    onChange={(e) => setManual({ ...manual, interestRateText: e.target.value })}
                    className="h-8 text-xs font-medium"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">Legal & Processing Fees Clause</label>
                  <Textarea
                    value={manual.legalFeesText}
                    onChange={(e) => setManual({ ...manual, legalFeesText: e.target.value })}
                    rows={2}
                    className="text-xs font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Tenure (Days)</label>
                    <Input
                      type="number"
                      value={manual.tenureDays}
                      onChange={(e) => {
                        const d = Number(e.target.value) || 365;
                        setManual({
                          ...manual,
                          tenureDays: d,
                          paymentDatePrincipalText: `Bullet payment at the end of ${d} days from the date of first disbursement.`,
                        });
                      }}
                      className="h-8 text-xs font-medium font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Tenure (Months)</label>
                    <Input
                      type="number"
                      value={manual.tenureMonths}
                      onChange={(e) => setManual({ ...manual, tenureMonths: Number(e.target.value) || 12 })}
                      className="h-8 text-xs font-medium font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Repayment Mode</label>
                  <Input
                    value={manual.repaymentMode}
                    onChange={(e) => setManual({ ...manual, repaymentMode: e.target.value })}
                    className="h-8 text-xs font-medium"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">Schedule of Disbursement</label>
                  <Input
                    value={manual.disbursementSchedule}
                    onChange={(e) => setManual({ ...manual, disbursementSchedule: e.target.value })}
                    className="h-8 text-xs font-medium"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">Penal Charge Clause (2% p.a.)</label>
                  <Textarea
                    value={manual.penalChargeText}
                    onChange={(e) => setManual({ ...manual, penalChargeText: e.target.value })}
                    rows={2}
                    className="text-xs font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Cheque/NACH Bouncing Charges</label>
                  <Input
                    value={manual.bouncingChargesText}
                    onChange={(e) => setManual({ ...manual, bouncingChargesText: e.target.value })}
                    className="h-8 text-xs font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Balance Transfer / Pre-payment</label>
                  <Input
                    value={manual.prepaymentChargesText}
                    onChange={(e) => setManual({ ...manual, prepaymentChargesText: e.target.value })}
                    className="h-8 text-xs font-medium"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: Security & Valuation */}
      {activeTab === "security_valuation" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Scale className="size-4 text-primary" />
                Security Cover & Valuation Clauses (Points 15 – 19)
              </CardTitle>
              <CardDescription className="text-xs">
                Minimum collateral cover ratio, personal guarantee names, valuation method, and event of default conditions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Security Cover Ratio (e.g. 2.5x)</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={manual.securityCoverRatio}
                    onChange={(e) => {
                      const c = Number(e.target.value) || 2.5;
                      setManual({
                        ...manual,
                        securityCoverRatio: c,
                        securityCoverText: `${c}x of the Sanctioned Amount of Loan Facility, which shall be maintained during the entire loan tenure.`,
                      });
                    }}
                    className="h-8 text-xs font-medium font-mono"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">Security Cover Clause Text</label>
                  <Input
                    value={manual.securityCoverText}
                    onChange={(e) => setManual({ ...manual, securityCoverText: e.target.value })}
                    className="h-8 text-xs font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Pledge of Equity Shares Clause</label>
                <Textarea
                  value={manual.securityPledgeText}
                  onChange={(e) => setManual({ ...manual, securityPledgeText: e.target.value })}
                  rows={2}
                  className="text-xs font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Personal Guarantors (Full Names)</label>
                <Input
                  value={manual.personalGuaranteeNames}
                  onChange={(e) => setManual({ ...manual, personalGuaranteeNames: e.target.value })}
                  placeholder="e.g. Anirudh Saraswat, Praveen Kumar, Rupal Gupta"
                  className="h-8 text-xs font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Valuation Clause (Lower of 6-mo avg or CMP)</label>
                <Textarea
                  value={manual.valuationClauseText}
                  onChange={(e) => setManual({ ...manual, valuationClauseText: e.target.value })}
                  rows={2}
                  className="text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Promoter Group Holding Minimum (Default: 51%)</label>
                  <Input
                    value={manual.promoterHoldingText}
                    onChange={(e) => setManual({ ...manual, promoterHoldingText: e.target.value })}
                    className="h-8 text-xs font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Promoter Pledge Limit Maximum (Default: 25%)</label>
                  <Input
                    value={manual.promoterPledgeLimitText}
                    onChange={(e) => setManual({ ...manual, promoterPledgeLimitText: e.target.value })}
                    className="h-8 text-xs font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Security Monitoring Clause</label>
                <Textarea
                  value={manual.securityMonitoringText}
                  onChange={(e) => setManual({ ...manual, securityMonitoringText: e.target.value })}
                  rows={2}
                  className="text-xs font-medium"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: Triggers & Cash Top-Up */}
      {activeTab === "triggers_cash_topup" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <AlertTriangle className="size-4 text-primary" />
                Triggers & Cash Top-Up Schedule (Points 20 – 22)
              </CardTitle>
              <CardDescription className="text-xs">
                Specify margin call thresholds, 2-day cure periods, pledge invocation/sale triggers, and cash top-up repayment percentages.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Trigger for Top-Up (2.50x & 2.10x triggers)</label>
                <Textarea
                  value={manual.topUpTriggerText}
                  onChange={(e) => setManual({ ...manual, topUpTriggerText: e.target.value })}
                  rows={3}
                  className="text-xs font-medium font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Trigger for Sale (Pledge Invocation / Private Sale)</label>
                <Textarea
                  value={manual.saleTriggerText}
                  onChange={(e) => setManual({ ...manual, saleTriggerText: e.target.value })}
                  rows={4}
                  className="text-xs font-medium font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Trigger for Cash Top-Up Conditions</label>
                <Textarea
                  value={manual.cashTopUpTriggerText}
                  onChange={(e) => setManual({ ...manual, cashTopUpTriggerText: e.target.value })}
                  rows={3}
                  className="text-xs font-medium"
                />
              </div>

              {/* Cash Top-Up Tier Table Editor */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">Cash Top-Up Trigger Table</label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() =>
                      setManual({
                        ...manual,
                        cashTopUpTiers: [
                          ...manual.cashTopUpTiers,
                          { priceDecline: "Stock prices fall by X%", repaymentPercent: "X% loan to be repaid" },
                        ],
                      })
                    }
                  >
                    <Plus className="size-3" /> Add Tier
                  </Button>
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="p-2 text-left font-semibold">Price Decline Threshold</th>
                        <th className="p-2 text-left font-semibold">% Loan Repayment Required</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {manual.cashTopUpTiers.map((tier, idx) => (
                        <tr key={idx}>
                          <td className="p-1.5">
                            <Input
                              value={tier.priceDecline}
                              onChange={(e) =>
                                setManual({
                                  ...manual,
                                  cashTopUpTiers: manual.cashTopUpTiers.map((t, i) =>
                                    i === idx ? { ...t, priceDecline: e.target.value } : t,
                                  ),
                                })
                              }
                              className="h-7 text-xs font-medium"
                            />
                          </td>
                          <td className="p-1.5">
                            <Input
                              value={tier.repaymentPercent}
                              onChange={(e) =>
                                setManual({
                                  ...manual,
                                  cashTopUpTiers: manual.cashTopUpTiers.map((t, i) =>
                                    i === idx ? { ...t, repaymentPercent: e.target.value } : t,
                                  ),
                                })
                              }
                              className="h-7 text-xs font-bold font-mono text-primary"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setManual({
                                  ...manual,
                                  cashTopUpTiers: manual.cashTopUpTiers.filter((_, i) => i !== idx),
                                })
                              }
                              className="text-destructive hover:text-destructive/80 p-1"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 5: Conditions (CPs & CSs) */}
      {activeTab === "conditions" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                Conditions Precedent, Conditions Subsequent & PDCs (Points 23 – 25)
              </CardTitle>
              <CardDescription className="text-xs">
                Pre-disbursement documentation checklist, post-disbursement monitoring, and PDC/NACH mandate clauses.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Pre-Disbursement Conditions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">
                    Pre-Disbursement Conditions (CPs - Point 23)
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() =>
                      setManual({
                        ...manual,
                        preDisbursementConditions: [...manual.preDisbursementConditions, ""],
                      })
                    }
                  >
                    <Plus className="size-3" /> Add Condition
                  </Button>
                </div>
                <div className="space-y-2">
                  {manual.preDisbursementConditions.map((cond, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-xs font-bold text-muted-foreground pt-1.5 w-5 shrink-0">
                        {idx + 1}.
                      </span>
                      <Textarea
                        value={cond}
                        onChange={(e) =>
                          setManual({
                            ...manual,
                            preDisbursementConditions: manual.preDisbursementConditions.map((c, i) =>
                              i === idx ? e.target.value : c,
                            ),
                          })
                        }
                        rows={2}
                        className="text-xs flex-1"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setManual({
                            ...manual,
                            preDisbursementConditions: manual.preDisbursementConditions.filter((_, i) => i !== idx),
                          })
                        }
                        className="text-destructive hover:text-destructive/80 p-1.5 mt-1"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Post-Disbursement Conditions */}
              <div className="space-y-2 pt-3 border-t">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">
                    Post-Disbursement Conditions (CSs - Point 24)
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() =>
                      setManual({
                        ...manual,
                        postDisbursementConditions: [...manual.postDisbursementConditions, ""],
                      })
                    }
                  >
                    <Plus className="size-3" /> Add Condition
                  </Button>
                </div>
                <div className="space-y-2">
                  {manual.postDisbursementConditions.map((cond, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-xs font-bold text-muted-foreground pt-1.5 w-5 shrink-0">
                        {idx + 1}.
                      </span>
                      <Textarea
                        value={cond}
                        onChange={(e) =>
                          setManual({
                            ...manual,
                            postDisbursementConditions: manual.postDisbursementConditions.map((c, i) =>
                              i === idx ? e.target.value : c,
                            ),
                          })
                        }
                        rows={2}
                        className="text-xs flex-1"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setManual({
                            ...manual,
                            postDisbursementConditions: manual.postDisbursementConditions.filter((_, i) => i !== idx),
                          })
                        }
                        className="text-destructive hover:text-destructive/80 p-1.5 mt-1"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* PDCs & NACH Mandate */}
              <div className="space-y-1 pt-3 border-t">
                <label className="text-xs font-bold text-foreground">
                  Post Dated Cheques / NACH Mandate (Point 25)
                </label>
                <Textarea
                  value={manual.pdcNachText}
                  onChange={(e) => setManual({ ...manual, pdcNachText: e.target.value })}
                  rows={3}
                  className="text-xs font-medium"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 6: Regulatory & Sign-Off */}
      {activeTab === "regulatory_signoff" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Landmark className="size-4 text-primary" />
                Regulatory Clauses, Jurisdiction & Sign-Off (Points 26 – 28)
              </CardTitle>
              <CardDescription className="text-xs">
                RBI SMA/NPA classification clause, legal jurisdiction, and authorized signatory blocks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Classification of Loan Account Clause (RBI SMA/NPA - Point 26)</label>
                <Textarea
                  value={manual.classificationClauseText}
                  onChange={(e) => setManual({ ...manual, classificationClauseText: e.target.value })}
                  rows={3}
                  className="text-xs font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Execution of Documents Clause (Point 27)</label>
                <Textarea
                  value={manual.executionClauseText}
                  onChange={(e) => setManual({ ...manual, executionClauseText: e.target.value })}
                  rows={2}
                  className="text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Jurisdiction (Point 28)</label>
                  <Input
                    value={manual.jurisdiction}
                    onChange={(e) => setManual({ ...manual, jurisdiction: e.target.value })}
                    className="h-8 text-xs font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Lender Company Name</label>
                  <Input
                    value={manual.lenderName}
                    onChange={(e) => setManual({ ...manual, lenderName: e.target.value })}
                    className="h-8 text-xs font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Lender Authorized Signatory Designation</label>
                  <Input
                    value={manual.authorizedSignatoryLender}
                    onChange={(e) => setManual({ ...manual, authorizedSignatoryLender: e.target.value })}
                    className="h-8 text-xs font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Document Status</label>
                  <select
                    value={manual.status}
                    onChange={(e) => setManual({ ...manual, status: e.target.value as any })}
                    className="h-8 w-full rounded-md border border-input bg-background px-3 text-xs font-medium"
                  >
                    <option value="draft">Draft</option>
                    <option value="issued">Issued to Borrower</option>
                    <option value="accepted">Accepted by Borrower</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 7: Live Sanction Letter Preview */}
      {activeTab === "preview" && (
        <Card className="shadow-lg border">
          <CardHeader className="pb-3 border-b bg-muted/30 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                Live Sanction Letter Preview (LRSD Securities Institutional Template)
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time rendering of all 7 pages, legal clauses, repayment schedule, and RBI classification annexures.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="bg-red-600 hover:bg-red-500 text-white gap-1.5 text-xs h-8 shadow-xs font-semibold"
            >
              {isGenerating ? <Loader2 className="size-3 animate-spin" /> : <FileDown className="size-3" />}
              Export DOCX
            </Button>
          </CardHeader>
          <CardContent className="p-6 sm:p-10 space-y-6 font-serif bg-white text-slate-900 rounded-b-lg text-xs leading-relaxed max-w-4xl mx-auto shadow-inner">
            {/* Letterhead Header */}
            <div className="text-center border-b pb-4 space-y-1 font-sans">
              <h1 className="text-xl font-bold tracking-tight text-red-800">
                LRSD SECURITIES PRIVATE LIMITED
              </h1>
              <p className="text-[11px] text-slate-600">
                Regd. Office: 208 & 210, Jain Bhawan, 18/12, W.E.A. Karol Bagh, New Delhi-110005
              </p>
              <p className="text-[11px] text-slate-600">
                Corporate Office: Unit No. 27-01 & 02, Silver Tower, Wave One, Sector-18, Noida-201301 (U.P.)
              </p>
              <p className="text-[10px] text-slate-500">
                CIN: U65923DL2015PTC275014 | Email: rgsl1995@gmail.com, admin@rgslgroup.com | Ph: 0120-5109188/011-45805607 | www.lrsdindia.com
              </p>
              <div className="pt-2">
                <span className="font-bold underline text-sm text-slate-900 uppercase tracking-wide">
                  Sanction Letter
                </span>
              </div>
            </div>

            {/* Date & Addressee */}
            <div className="space-y-3 font-sans">
              <div className="font-bold text-slate-800">
                Dated- {new Date(manual.sanctionDate).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
              </div>
              <div className="space-y-0.5">
                <div className="font-bold">To,</div>
                <div className="font-bold text-slate-900">{autoData.borrower.name}</div>
                <div className="text-slate-600 whitespace-pre-line text-[11px]">
                  {autoData.borrower.address || "Registered Office Address / Principal Place of Business"}
                </div>
              </div>
            </div>

            {/* Subject Line */}
            <div className="font-bold underline text-center py-2 text-[13px] font-sans">
              Sanction Letter with respect to term Loan Facility of {manual.sanctionedAmountText} ({manual.sanctionedAmountInWords})
            </div>

            {/* Main Terms & Conditions 28-point Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-black text-[11px]">
                <thead>
                  <tr className="bg-slate-100 border border-black font-sans font-bold">
                    <th className="border border-black p-2 text-center w-12">S. No.</th>
                    <th className="border border-black p-2 text-left w-48">Particulars</th>
                    <th className="border border-black p-2 text-left">Terms and conditions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black">
                  {/* 1. Borrower */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">1.</td>
                    <td className="border border-black p-2 font-bold">Borrower</td>
                    <td className="border border-black p-2 font-semibold">
                      {autoData.borrower.name} ({manual.borrowerShortName})
                      {autoData.borrower.pan && <span className="block text-[10px] text-slate-500 font-normal">PAN: {autoData.borrower.pan}</span>}
                    </td>
                  </tr>

                  {/* 2. Security Provider / Guarantor(s) */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">2.</td>
                    <td className="border border-black p-2 font-bold">Security Provider/ Guarantor(s)</td>
                    <td className="border border-black p-2 space-y-1">
                      {autoData.guarantors && autoData.guarantors.length > 0 ? (
                        <>
                          {autoData.guarantors.map((g, i) => (
                            <div key={i} className="font-semibold">
                              {g.name} (Guarantor-{i + 1})
                            </div>
                          ))}
                          <div className="italic text-[10px] text-slate-600">
                            ({autoData.guarantors.map((_, i) => `Guarantor-${i + 1}`).join(", ")} are hereinafter collectively referred to as &quot;Guarantors&quot;)
                          </div>
                        </>
                      ) : (
                        <div className="font-semibold">{manual.personalGuaranteeNames}</div>
                      )}
                    </td>
                  </tr>

                  {/* 3. Lender */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">3.</td>
                    <td className="border border-black p-2 font-bold">Lender</td>
                    <td className="border border-black p-2 font-semibold">{manual.lenderName} (LRSD)</td>
                  </tr>

                  {/* 4. Loan Facility */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">4.</td>
                    <td className="border border-black p-2 font-bold">Loan Facility</td>
                    <td className="border border-black p-2 font-semibold">{manual.facilityType}</td>
                  </tr>

                  {/* 5. Permitted Purpose */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">5.</td>
                    <td className="border border-black p-2 font-bold">Permitted Purpose</td>
                    <td className="border border-black p-2">{manual.permittedPurpose}</td>
                  </tr>

                  {/* 6. Sanctioned Amount */}
                  <tr className="border border-black bg-slate-50/50">
                    <td className="border border-black p-2 text-center font-bold">6.</td>
                    <td className="border border-black p-2 font-bold">Sanctioned Amount/ Loan Facility</td>
                    <td className="border border-black p-2 font-bold text-slate-900">
                      Up to {manual.sanctionedAmountText} ({manual.sanctionedAmountInWords})
                    </td>
                  </tr>

                  {/* 7. Rate of Interest */}
                  <tr className="border border-black bg-slate-50/50">
                    <td className="border border-black p-2 text-center font-bold">7.</td>
                    <td className="border border-black p-2 font-bold">Rate of Interest</td>
                    <td className="border border-black p-2 font-bold text-slate-900">{manual.interestRateText}</td>
                  </tr>

                  {/* 8. Legal Fees */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">8.</td>
                    <td className="border border-black p-2 font-bold">Legal Fees</td>
                    <td className="border border-black p-2">{manual.legalFeesText}</td>
                  </tr>

                  {/* 9. Tenure */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">9.</td>
                    <td className="border border-black p-2 font-bold">Tenure of Loan Facility</td>
                    <td className="border border-black p-2 space-y-1">
                      <div>
                        This Loan Facility shall be advanced for a period of {manual.tenureDays} days from the date of the first disbursement (Tenure) and shall be repaid in {manual.repaymentMode}, meaning the total loan amount shall be repaid at the end of the loan tenure. Interest on the availed loan facility shall be payable on a monthly basis, as detailed in <em>Annexure I</em>. The Tenure shall exclude any broken period during which interest would be charged to the Borrower.
                      </div>
                      <div className="italic text-[10px] text-slate-600">
                        The Lender reserves the right to demand or recall the Loan Facility, along with any accrued interest, in the event of any default or under circumstances deemed appropriate by the Lender.
                      </div>
                    </td>
                  </tr>

                  {/* 10. Schedule of Disbursement */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">10.</td>
                    <td className="border border-black p-2 font-bold">Schedule of Disbursement</td>
                    <td className="border border-black p-2">{manual.disbursementSchedule}</td>
                  </tr>

                  {/* 11. Penal Charge */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">11.</td>
                    <td className="border border-black p-2 font-bold">Penal Charge</td>
                    <td className="border border-black p-2 space-y-1">
                      <div>{manual.penalChargeText}</div>
                      <div className="pl-3 space-y-0.5 text-[10.5px]">
                        <div>a. If any interest is payable by the Borrower to Lender for the said Loan Facility, is not paid on the due date as per the terms of payment of interest,</div>
                        <div>b. When any installment of principal amount payable by the Borrower to Lender for the said Loan Facility, is not paid on the due date as per the terms of re-payment of principal amount,</div>
                        <div>c. On Contravention of any terms of sanction of Loan Facility, as mentioned in this Sanction Letter, or Loan Agreement or any document related to this term Loan Facility, whether at the time of sanction of Loan Facility or in future, (without prejudice to any other rights/remedies of the Lender)</div>
                      </div>
                    </td>
                  </tr>

                  {/* 12. Cheque/NACH */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">12.</td>
                    <td className="border border-black p-2 font-bold">Cheque/ NACH Bouncing Charges</td>
                    <td className="border border-black p-2">{manual.bouncingChargesText}</td>
                  </tr>

                  {/* 13. Prepayment */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">13.</td>
                    <td className="border border-black p-2 font-bold">Balance Transfer/ Pre-payment Charges</td>
                    <td className="border border-black p-2">{manual.prepaymentChargesText}</td>
                  </tr>

                  {/* 14. Payment Date */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">14.</td>
                    <td className="border border-black p-2 font-bold">Payment Date</td>
                    <td className="border border-black p-2 space-y-0.5">
                      <div><strong>Principal:</strong> {manual.paymentDatePrincipalText}</div>
                      <div><strong>Interest:</strong> {manual.paymentDateInterestText}</div>
                    </td>
                  </tr>

                  {/* 15. Security Cover */}
                  <tr className="border border-black bg-slate-50/50">
                    <td className="border border-black p-2 text-center font-bold">15.</td>
                    <td className="border border-black p-2 font-bold">Security Cover</td>
                    <td className="border border-black p-2 font-bold text-slate-900">{manual.securityCoverText}</td>
                  </tr>

                  {/* 16. Security */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">16.</td>
                    <td className="border border-black p-2 font-bold">Security</td>
                    <td className="border border-black p-2 space-y-1">
                      <div className="font-semibold">Loan Facility shall be secured by way of the following securities in favour of the Lender:</div>
                      <ul className="list-disc pl-4 space-y-1 text-[10.5px]">
                        <li>{manual.securityPledgeText}</li>
                        <li>Personal Guarantee by {manual.personalGuaranteeNames} along with their net worth certificate duly signed by the practicing-chartered accountant.</li>
                        <li>{manual.valuationClauseText}</li>
                        <li>Post Dated Cheques of the Borrower and Guarantor(s).</li>
                        <li>Demand Promissory Note of the Borrower and Guarantor(s).</li>
                      </ul>
                    </td>
                  </tr>

                  {/* 17. Key Terms & Conditions */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">17.</td>
                    <td className="border border-black p-2 font-bold">Key Terms & Conditions</td>
                    <td className="border border-black p-2 space-y-1">
                      <ul className="list-disc pl-4 space-y-1 text-[10.5px]">
                        <li>Min {manual.securityCoverRatio}x cover against pledge of listed shares. The loan facility shall be extended to {autoData.borrower.name}.</li>
                        <li>Valuation of shares to be done at lower of Six months average or Current Market Price (CMP).</li>
                        <li>Acceptance of further pledge of shares or any other security acceptable to the Lender to recoup the margin shortfall over and above the initial pledge, if situation may arise in future, shall be at the sole discretion of Lender. However, the borrower would have the option to prepay in part to maintain sanctioned security cover.</li>
                        <li>The Facility shall be additionally secured by an unconditional, irrevocable and continuing Personal Guarantee of {manual.personalGuaranteeNames} for the due repayment of the Facility along with interest, charges, costs and all other monies payable under the Facility documents. The guarantee shall remain valid till full and final repayment of the Facility and shall be enforceable at the sole discretion of Lender.</li>
                        <li>The Borrower/s agrees to pay the processing fees upfront at the time of acceptance of sanction letter and the processing fees paid shall be non-refundable and non-adjustable.</li>
                        <li>Interest will be due and payable on the 1st (first) day of the subsequent month.</li>
                      </ul>
                    </td>
                  </tr>

                  {/* 18. Event of Default */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">18.</td>
                    <td className="border border-black p-2 font-bold">Event of Default conditions</td>
                    <td className="border border-black p-2 space-y-1">
                      <ul className="list-disc pl-4 space-y-1 text-[10.5px]">
                        <li>{manual.promoterHoldingText}</li>
                        <li>{manual.promoterPledgeLimitText}</li>
                        <li>In case, security cover falls below the stipulated {manual.securityCoverRatio}x, Lender will have the right to sell shares without any prior notice or intimation.</li>
                      </ul>
                    </td>
                  </tr>

                  {/* 19. Security Monitoring */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">19.</td>
                    <td className="border border-black p-2 font-bold">Security Monitoring</td>
                    <td className="border border-black p-2 space-y-1">
                      <div>The price of pledged shares for the purpose of creation of security, ongoing monitoring, calculation of top up trigger, sale trigger shall be calculated based on lower of:</div>
                      <ol className="list-decimal pl-4 space-y-0.5 text-[10.5px]">
                        <li>Daily closing price of the underlying script on NSE</li>
                        <li>Daily closing price of the underlying script on BSE</li>
                        <li>Average price of the last 6 months on NSE</li>
                        <li>Average price of the last 6 months on BSE</li>
                      </ol>
                    </td>
                  </tr>

                  {/* 20. Trigger for Top up */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">20.</td>
                    <td className="border border-black p-2 font-bold">Trigger for Top up</td>
                    <td className="border border-black p-2 whitespace-pre-line text-[10.5px]">
                      {manual.topUpTriggerText}
                    </td>
                  </tr>

                  {/* 21. Trigger for Sale */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">21.</td>
                    <td className="border border-black p-2 font-bold">Trigger for Sale</td>
                    <td className="border border-black p-2 whitespace-pre-line text-[10.5px]">
                      {manual.saleTriggerText}
                    </td>
                  </tr>

                  {/* 22. Trigger for Cash top up */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">22.</td>
                    <td className="border border-black p-2 font-bold">Trigger for Cash top up</td>
                    <td className="border border-black p-2 space-y-2">
                      <div className="whitespace-pre-line text-[10.5px]">{manual.cashTopUpTriggerText}</div>
                      <div className="overflow-x-auto pt-1">
                        <table className="w-full border-collapse border border-black text-[10px]">
                          <thead>
                            <tr className="bg-slate-100 border border-black font-bold">
                              <th className="border border-black p-1 text-left">Cash top trigger (Price decline from date of drawdown)</th>
                              <th className="border border-black p-1 text-center w-36">% Repayment</th>
                            </tr>
                          </thead>
                          <tbody>
                            {manual.cashTopUpTiers.map((tier, idx) => (
                              <tr key={idx} className="border border-black">
                                <td className="border border-black p-1">{tier.priceDecline}</td>
                                <td className="border border-black p-1 text-center font-bold">{tier.repaymentPercent}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>

                  {/* 23. Pre-Disbursement Conditions */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">23.</td>
                    <td className="border border-black p-2 font-bold">Pre-Disbursement Conditions</td>
                    <td className="border border-black p-2 space-y-1">
                      <div className="font-semibold">The following conditions that need to be complied by the Borrower before the disbursement of Loan Facility:</div>
                      <ul className="list-disc pl-4 space-y-1 text-[10.5px]">
                        {manual.preDisbursementConditions.map((cond, idx) => (
                          <li key={idx}>{cond}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>

                  {/* 24. Post-Disbursement Conditions */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">24.</td>
                    <td className="border border-black p-2 font-bold">Post-Disbursement Conditions</td>
                    <td className="border border-black p-2 space-y-1">
                      <ul className="list-disc pl-4 space-y-1 text-[10.5px]">
                        {manual.postDisbursementConditions.map((cond, idx) => (
                          <li key={idx}>{cond}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>

                  {/* 25. Post Dated Cheques */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">25.</td>
                    <td className="border border-black p-2 font-bold">Post Dated Cheques/ NACH mandate (PDCs)</td>
                    <td className="border border-black p-2 whitespace-pre-line text-[10.5px]">
                      {manual.pdcNachText}
                    </td>
                  </tr>

                  {/* 26. Classification of Loan Account */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">26.</td>
                    <td className="border border-black p-2 font-bold">Classification of Loan Account</td>
                    <td className="border border-black p-2 text-[10.5px]">
                      {manual.classificationClauseText}
                    </td>
                  </tr>

                  {/* 27. Execution of Documents */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">27.</td>
                    <td className="border border-black p-2 font-bold">Execution of Documents</td>
                    <td className="border border-black p-2 text-[10.5px]">
                      {manual.executionClauseText}
                    </td>
                  </tr>

                  {/* 28. Jurisdiction */}
                  <tr className="border border-black">
                    <td className="border border-black p-2 text-center font-bold">28.</td>
                    <td className="border border-black p-2 font-bold">Jurisdiction</td>
                    <td className="border border-black p-2 font-bold">{manual.jurisdiction}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Post-Table Notice */}
            <div className="text-[11px] text-justify space-y-2 pt-2">
              <p>
                Please note that this Sanction Letter has been provided for your acceptance and the disbursement of the said Loan Facility will strictly be contingent on sanction of Loan Facility and execution of all deeds/documents, and we reserve the right for refusal, if the terms and conditions as agreed, are not being complied. This sanction communication is being sent to you in duplicate. You are requested to return to us the duplicate copy along with the Annexure/s duly signed by all the Parties, as a token of having accepted the terms and conditions detailed above. This document also serves as an indicative term sheet; any changes to the terms will be incorporated into the Final Term sheet and loan documentation.
              </p>
            </div>

            {/* Vernacular Declaration */}
            <div className="space-y-3 pt-3 border-t">
              <div className="font-bold underline text-[12px] uppercase">Vernacular Declaration</div>
              <div className="space-y-1">
                <div className="font-bold text-[11px]">English</div>
                <p className="text-[11px] text-justify">
                  The Borrower and the Guarantors confirm that the terms & conditions and nature of this Sanction Letter have been read out and explained in the language, they communicate and speak and understand and they have understood the entire meaning of all the clauses.
                </p>
              </div>
              <div className="space-y-1">
                <div className="font-bold text-[11px]">Hindi</div>
                <p className="text-[11px] text-justify">
                  उधारकर्ता और गारंटर यह पुष्टि करते हैं कि इस मंजूरी पत्र के सभी नियम, शर्तें एवं प्रकृति उन्हें स्पष्ट रूप से पढ़कर समझाई गई हैं। उन्होंने इसे सुना, समझा और अपनी भाषा में संवाद किया तथा वे इस मंजूरी पत्र की समस्त शर्तों और प्रावधानों को भली-भांति समझते हैं और स्वीकार करते हैं।
                </p>
              </div>
            </div>

            {/* Signatures */}
            <div className="space-y-4 pt-4 border-t">
              <div className="font-bold text-xs">Signed by the Lender & Acceptance by Borrower and Guarantor(s):</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-black p-4 rounded text-center space-y-6">
                  <div className="font-bold text-xs">For {manual.lenderName.toUpperCase()}</div>
                  <div className="pt-6 border-t border-dashed border-slate-400 text-[10px] font-bold">
                    {manual.authorizedSignatoryLender}
                  </div>
                </div>
                <div className="border border-black p-4 rounded text-center space-y-6">
                  <div className="font-bold text-xs">For {autoData.borrower.name.toUpperCase()}</div>
                  <div className="pt-6 border-t border-dashed border-slate-400 text-[10px] font-bold">
                    AUTHORISED SIGNATORY (Borrower)
                  </div>
                </div>
              </div>

              {autoData.guarantors && autoData.guarantors.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {autoData.guarantors.map((g, i) => (
                    <div key={i} className="border border-black p-3 rounded text-center space-y-4">
                      <div className="text-[10px] italic text-slate-600">Guarantor-{i + 1}</div>
                      <div className="font-bold text-xs">{g.name}</div>
                      <div className="pt-4 border-t border-dashed border-slate-400 text-[10px]">
                        Signature ({g.name})
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ANNEXURE 1: Repayment Schedule */}
            <div className="pt-8 border-t-2 border-slate-900 space-y-3">
              <div className="text-center space-y-1">
                <div className="font-bold underline text-sm tracking-wide">ANNEXURE-1</div>
                <div className="font-bold text-xs">Repayment Schedule</div>
              </div>
              <p className="text-[11px] text-justify">
                The Loan Facility shall be repayable in one Bullet Repayment Mode i.e., Single Tranche at the maturity of Loan Tenure ({tenureMonths} Months). However, the Borrower shall pay the interest on monthly rests, as and when due on monthly basis.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-black text-[10.5px]">
                  <thead>
                    <tr className="bg-slate-100 border border-black font-bold">
                      <th className="border border-black p-1 text-center w-10">S.No.</th>
                      <th className="border border-black p-1 text-center w-28">Date / Month</th>
                      <th className="border border-black p-1 text-right">Amount</th>
                      <th className="border border-black p-1 text-right">EMI / Outflow</th>
                      <th className="border border-black p-1 text-right">Interest @{roi}%</th>
                      <th className="border border-black p-1 text-right">Principal</th>
                      <th className="border border-black p-1 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border border-black">
                      <td className="border border-black p-1 text-center font-bold">0</td>
                      <td className="border border-black p-1 font-bold">Broken Period</td>
                      <td className="border border-black p-1 text-right">{formatINR(amount)}</td>
                      <td className="border border-black p-1 text-right">{formatINR(monthlyInterest)}</td>
                      <td className="border border-black p-1 text-right">{formatINR(monthlyInterest)}</td>
                      <td className="border border-black p-1 text-right">0</td>
                      <td className="border border-black p-1 text-right font-bold">{formatINR(amount)}</td>
                    </tr>
                    {Array.from({ length: tenureMonths }).map((_, idx) => {
                      const m = idx + 1;
                      const curDate = new Date(manual.sanctionDate || new Date());
                      curDate.setMonth(curDate.getMonth() + m);
                      const monthLabel = curDate.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
                      const isFinal = m === tenureMonths;
                      const principalPaid = isFinal ? amount : 0;
                      const outflow = isFinal ? monthlyInterest + amount : monthlyInterest;
                      const bal = isFinal ? 0 : amount;

                      return (
                        <tr key={m} className={`border border-black ${isFinal ? "bg-slate-50 font-bold" : ""}`}>
                          <td className="border border-black p-1 text-center">{m}</td>
                          <td className="border border-black p-1 text-center font-medium">{monthLabel}</td>
                          <td className="border border-black p-1 text-right">{formatINR(amount)}</td>
                          <td className="border border-black p-1 text-right font-semibold">{formatINR(outflow)}</td>
                          <td className="border border-black p-1 text-right">{formatINR(monthlyInterest)}</td>
                          <td className="border border-black p-1 text-right">{isFinal ? formatINR(principalPaid) : "0"}</td>
                          <td className="border border-black p-1 text-right">{isFinal ? "—" : formatINR(bal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] italic text-slate-500">
                Note: The repayment schedule is subject to change in the event of disbursement by the Lender or any prepayment/balance transfer made by the Borrower or any change in disbursement schedule.
              </p>
            </div>

            {/* ANNEXURE 2: RBI Classification */}
            <div className="pt-8 border-t-2 border-slate-900 space-y-3">
              <div className="text-center space-y-1">
                <div className="font-bold text-xs uppercase">Annexure</div>
                <div className="font-bold underline text-sm tracking-wide">CLASSIFICATION OF LOAN ACCOUNT</div>
              </div>
              <p className="text-[11px] text-justify">
                The Borrower understands and agrees that upon occurrence of Event of Default under this Agreement, the Lender shall have an unqualified right to classify the account of the Borrower as special mention account (SMA) or a non-performing asset (&quot;NPA&quot;) or otherwise in accordance with the applicable guidelines, circulars, notifications, rules and regulations issued by the RBI or any other Authority. A scenario of SMA/NPA classification has been illustrated below and also uploaded/available at LRSD INDIA website:
              </p>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-black text-[10.5px]">
                  <thead>
                    <tr className="bg-slate-100 border border-black font-bold">
                      <th className="border border-black p-2 text-left w-1/2">
                        Classification & Upgradation of Special mention accounts (SMA)/ Non-Performing Asset (NPA)
                      </th>
                      <th className="border border-black p-2 text-left w-1/2">
                        Basis of Classification: Principal or Interest wholly or partly overdue
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border border-black">
                      <td className="border border-black p-2 align-top text-[10px] leading-relaxed">
                        Principal or interest or any other payment remains overdue then Borrower loan account shall reflect the asset wholly or partly classification (SMA/ NPA) status of an account at the day-end of that calendar date.
                        <br /><br />
                        Loan accounts classified as NPAs may be upgraded as &apos;Standard&apos; asset only if entire arrears of interest and principal are paid by the Borrower.
                      </td>
                      <td className="border border-black p-0 align-top">
                        <table className="w-full border-collapse text-[10px]">
                          <tbody>
                            <tr className="border-b border-black">
                              <td className="p-1.5 font-bold w-1/3">SMA Sub-Categories</td>
                              <td className="p-1.5 font-semibold">0 Up to 30 days</td>
                            </tr>
                            <tr className="border-b border-black">
                              <td className="p-1.5 font-bold">SMA-1</td>
                              <td className="p-1.5">More than 30 days and up to 60 days</td>
                            </tr>
                            <tr className="border-b border-black">
                              <td className="p-1.5 font-bold">SMA-2</td>
                              <td className="p-1.5">More than 60 days and up to 90 days</td>
                            </tr>
                            <tr>
                              <td className="p-1.5 font-bold text-red-700">NPA</td>
                              <td className="p-1.5 font-bold text-red-700">More than 90 days</td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="text-[10px] text-justify space-y-1 italic text-slate-600">
                <p>
                  Example: If due date of a loan account is March 31, 2026, and full dues are not received before the lending institution runs the day-end process for this date, the date of overdue shall be March 31, 2026. If it continues to remain overdue, then this account shall get tagged as SMA-1 upon running day-end process on April 30, 2026 i.e. upon completion of 30 days of being continuously overdue. Accordingly, the date of SMA-1 classification for that account shall be April 30, 2026.
                </p>
                <p>
                  Similarly, if the account continues to remain overdue, it shall get tagged as SMA-2 upon running day-end process on May 30, 2026 and if continues to remain overdue further, it shall get classified as NPA upon running day-end process on June 29, 2026.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Floating Bottom Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t">
        <div className="text-xs text-muted-foreground">
          {saveMessage && <span className="font-medium text-emerald-600">{saveMessage.text}</span>}
          {generateError && <span className="text-destructive">{generateError}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/loans/${applicationId}/cam`}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9">
              <ArrowLeft className="size-3.5" /> Back to CAM
            </Button>
          </Link>
          <Button variant="outline" onClick={handleSave} disabled={isSaving} className="gap-1.5 text-xs h-9">
            {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save Draft
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating} className="gap-1.5 text-xs h-9 bg-red-600 hover:bg-red-500 text-white font-semibold">
            {isGenerating ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />}
            Generate & Download Sanction (.docx)
          </Button>
          <Link href={`/loans/${applicationId}/repayment`}>
            <Button className="gap-1.5 text-xs h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
              <Calendar className="size-3.5" />
              Proceed to Repayment
              <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
