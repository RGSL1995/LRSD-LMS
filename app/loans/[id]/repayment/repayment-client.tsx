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
  type LoanServicingSummary,
  type LoanServicingConfig,
  type InstallmentItem,
  type ActualMonthlyScheduleItem,
  type DailyLedgerEntry,
  type RepaymentTransaction,
  type RecordPaymentInput,
  type AddLedgerTxnInput,
  type LedgerTxnType,
  type PaymentMethod,
  type PaymentType,
  type SmaClassification,
} from "./repayment-types";
import {
  generateOrResetScheduleAction,
  recordPaymentAction,
  recordChequeBounceAction,
  addDailyLedgerTxnAction,
  addDailyLedgerTxnBatchAction,
  updateDailyLedgerTxnAction,
  deleteDailyLedgerTxnAction,
} from "./repayment-actions";
import { allocatePaymentWaterfall, getDaysDifference } from "@/lib/repayment-engine";
import {
  Loader2,
  Plus,
  ArrowLeft,
  Calendar,
  CreditCard,
  Receipt,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  FileSpreadsheet,
  Settings2,
  RefreshCw,
  Building2,
  Layers,
  Sparkles,
  ChevronRight,
  Landmark,
  XCircle,
  HelpCircle,
  FileText,
  Clock,
  ShieldAlert,
  Table,
  Percent,
  Trash2,
  Pencil,
  Download,
  PlusCircle,
  Copy,
  CalendarDays,
  Coins,
  ArrowDownRight,
  ShieldCheck,
} from "lucide-react";

interface RepaymentClientProps {
  applicationId: string;
  initialSummary: LoanServicingSummary;
}

type TabKey = "actual_schedule" | "daily_ledger" | "schedule" | "transactions" | "simulator" | "statement";

export function RepaymentClient({
  applicationId,
  initialSummary,
}: RepaymentClientProps) {
  const [summary, setSummary] = useState<LoanServicingSummary>(initialSummary);
  const [activeTab, setActiveTab] = useState<TabKey>("actual_schedule");

  // Record Payment Dialog state
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [selectedDueDate, setSelectedDueDate] = useState<string>(
    initialSummary.nextDueDate ||
      initialSummary.schedules.find((s) => s.status !== "paid")?.dueDate ||
      initialSummary.schedules[0]?.dueDate ||
      new Date().toISOString().split("T")[0]
  );
  
  // Base default due amount
  const defaultDue = initialSummary.nextDueAmount || initialSummary.schedules[0]?.totalDue || 0;

  // Dynamic Ledger Calculations for smart dues & suggestions
  const latestLedgerEntry = (summary.dailyLedger || [])[summary.dailyLedger.length - 1];
  const activeCumulativePrincipal = latestLedgerEntry ? latestLedgerEntry.cumulative : summary.currentPrincipalOutstanding;
  const latestSegmentAccruedInterest = latestLedgerEntry?.interestAmount || 0;
  
  // Broken Period Calculations (Disbursement Date to 1st of Next Month)
  const disbDateObj = new Date(summary.config.disbursementDate);
  const nextMonthFirstDate = new Date(disbDateObj.getFullYear(), disbDateObj.getMonth() + 1, 1);
  const brokenPeriodDays = Math.max(0, Math.round((nextMonthFirstDate.getTime() - disbDateObj.getTime()) / (1000 * 60 * 60 * 24)));
  const brokenPeriodInterest = summary.config.disbursedAmount > 0 && brokenPeriodDays > 0
    ? Math.round(((summary.config.disbursedAmount * (summary.config.roiPercent / 100) * brokenPeriodDays) / 365) * 100) / 100
    : 0;

  // Segregated breakdown of all ledger transactions
  const brokenInterestDebitedInLedger = (summary.dailyLedger || [])
    .filter((e) => e.txnType === "Broken Interest" || e.txnType === "Broken Period" || (e.txnType === "Interest" && (e.narration || "").toLowerCase().includes("broken")))
    .reduce((acc, c) => acc + (c.debit || 0), 0);

  const regularInterestDebitedInLedger = (summary.dailyLedger || [])
    .filter((e) => (e.txnType === "Interest") && !(e.narration || "").toLowerCase().includes("broken"))
    .reduce((acc, c) => acc + (c.debit || 0), 0);

  const totalDisbursedInLedger = (summary.dailyLedger || [])
    .filter((e) => e.txnType === "Disbursement")
    .reduce((acc, c) => acc + (c.debit || 0), 0);

  const totalPrincipalRepaidInLedger = (summary.dailyLedger || [])
    .filter((e) => e.txnType === "Principal" || e.txnType === "Collection")
    .reduce((acc, c) => acc + (c.credit || 0), 0);

  const totalTdsCreditsInLedger = (summary.dailyLedger || [])
    .filter((e) => e.txnType === "Tds")
    .reduce((acc, c) => acc + (c.credit || 0), 0);

  const totalInterestDebitedInLedger = brokenInterestDebitedInLedger + regularInterestDebitedInLedger;
  const totalInterestCollectedInLedger = (summary.dailyLedger || [])
    .filter((e) => e.txnType === "Interest" || e.txnType === "Broken Interest" || e.txnType === "Broken Period" || e.txnType === "Tds")
    .reduce((acc, c) => acc + (c.credit || 0), 0);
  const overdueUnpaidInterestInLedger = Math.max(0, totalInterestDebitedInLedger - totalInterestCollectedInLedger);

  // Full 30-day and 31-day estimated monthly interest on active cumulative principal
  const fullMonth30dInterest = Math.round((activeCumulativePrincipal * (summary.config.roiPercent / 100) * 30) / 365);
  const fullMonth31dInterest = Math.round((activeCumulativePrincipal * (summary.config.roiPercent / 100) * 31) / 365);
  const dailyInterestAccrualRate = Math.round((activeCumulativePrincipal * (summary.config.roiPercent / 100)) / 365);

  // Intelligent suggested collection / due amount
  const suggestedDueAmount =
    overdueUnpaidInterestInLedger > 0
      ? overdueUnpaidInterestInLedger
      : latestSegmentAccruedInterest > 0
      ? latestSegmentAccruedInterest
      : summary.nextDueAmount > 0
      ? summary.nextDueAmount
      : fullMonth30dInterest;

  // Latest pending due amount (overdue or upcoming installment due)
  const latestPendingDue = suggestedDueAmount;
  
  // TDS Calculation States
  const [tdsMode, setTdsMode] = useState<"net_of_tds" | "gross_no_tds">("net_of_tds");
  const [tdsRatePercent, setTdsRatePercent] = useState<number>(10);
  const [grossDueInput, setGrossDueInput] = useState<number>(defaultDue || suggestedDueAmount);
  const [paymentAmount, setPaymentAmount] = useState<number>(
    suggestedDueAmount > 0 ? Math.round(suggestedDueAmount * 0.9) : 0
  );
  const [customTdsAmount, setCustomTdsAmount] = useState<number>(
    suggestedDueAmount > 0 ? Math.round(suggestedDueAmount * 0.1) : 0
  );
  const [isCustomTds, setIsCustomTds] = useState(false);

  const [paymentMode, setPaymentMode] = useState<PaymentMethod>("NEFT");
  const [paymentType, setPaymentType] = useState<PaymentType>("regular_installment");
  const [refNumber, setRefNumber] = useState<string>("");
  const [bankName, setBankName] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState<string>("");

  // Add Daily Ledger Transaction Modal (Multi-Entry Batch Support)
  interface LedgerRowDraft {
    id: string;
    txnType: LedgerTxnType;
    txnDate: string; // Transaction / Booking Date
    valueDate: string; // Effective Value Date
    narration: string;
    debit: number;
    credit: number;
    autoSplitTds: boolean;
    tdsRatePercent: number;
    referenceNumber: string;
    bankName: string;
  }

  const [isAddLedgerOpen, setIsAddLedgerOpen] = useState(false);
  const [ledgerRows, setLedgerRows] = useState<LedgerRowDraft[]>([]);

  const createDefaultLedgerRow = (prefillCredit: number = 0, defaultType: LedgerTxnType = "Collection"): LedgerRowDraft => {
    const today = new Date().toISOString().split("T")[0];
    const initialCredit = prefillCredit > 0 ? prefillCredit : suggestedDueAmount;
    const initialDebit =
      defaultType === "Disbursement"
        ? (prefillCredit || activeCumulativePrincipal)
        : defaultType === "Interest"
        ? (latestSegmentAccruedInterest || fullMonth30dInterest)
        : 0;

    return {
      id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      txnType: defaultType,
      txnDate: today,
      valueDate: today,
      narration:
        defaultType === "Collection"
          ? "Collection"
          : defaultType === "Disbursement"
          ? "RTGS"
          : defaultType === "Tds"
          ? "TDS Assets"
          : defaultType === "Interest"
          ? "Interest Debit"
          : "Payment Received",
      debit: defaultType === "Disbursement" || defaultType === "Interest" ? initialDebit : 0,
      credit:
        defaultType === "Collection" || defaultType === "Principal"
          ? initialCredit
          : defaultType === "Tds"
          ? Math.round(initialCredit * 0.1)
          : 0,
      autoSplitTds: false,
      tdsRatePercent: 10,
      referenceNumber: "",
      bankName: "",
    };
  };

  // Helper to open Add Daily Ledger Modal with latest due prefilled and editable
  const openAddLedgerModal = () => {
    setLedgerRows([createDefaultLedgerRow(suggestedDueAmount, "Collection")]);
    setIsAddLedgerOpen(true);
  };

  const addAnotherLedgerRow = () => {
    setLedgerRows((prev) => [...prev, createDefaultLedgerRow(0, "Collection")]);
  };

  const updateLedgerRow = (id: string, updates: Partial<LedgerRowDraft>) => {
    setLedgerRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, ...updates };
        // If txnDate changed and valueDate was identical, auto-sync valueDate
        if (updates.txnDate && !updates.valueDate && row.valueDate === row.txnDate) {
          updated.valueDate = updates.txnDate;
        }
        // If txnType changed, update default narration and debit/credit assignments
        if (updates.txnType && updates.txnType !== row.txnType) {
          if (updates.txnType === "Collection") {
            updated.narration = "Collection";
            updated.credit = suggestedDueAmount;
            updated.debit = 0;
          } else if (updates.txnType === "Disbursement") {
            updated.narration = "RTGS";
            updated.debit = activeCumulativePrincipal;
            updated.credit = 0;
          } else if (updates.txnType === "Broken Interest" || updates.txnType === "Broken Period") {
            updated.narration = `Broken Period Interest (${brokenPeriodDays} Days)`;
            updated.debit = brokenPeriodInterest;
            updated.credit = 0;
          } else if (updates.txnType === "Interest") {
            updated.narration = "Interest Debit";
            updated.debit = latestSegmentAccruedInterest > 0 ? latestSegmentAccruedInterest : fullMonth30dInterest;
            updated.credit = 0;
          } else if (updates.txnType === "Tds") {
            updated.narration = "TDS Assets";
            updated.credit = Math.round(suggestedDueAmount * 0.1);
            updated.debit = 0;
          }
        }
        return updated;
      })
    );
  };

  const removeLedgerRow = (id: string) => {
    if (ledgerRows.length <= 1) return;
    setLedgerRows((prev) => prev.filter((r) => r.id !== id));
  };

  const duplicateLedgerRow = (id: string) => {
    const row = ledgerRows.find((r) => r.id === id);
    if (!row) return;
    setLedgerRows((prev) => [
      ...prev,
      {
        ...row,
        id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      },
    ]);
  };

  // Edit Daily Ledger Transaction Modal state
  const [editingLedgerEntry, setEditingLedgerEntry] = useState<DailyLedgerEntry | null>(null);
  const [editTxnType, setEditTxnType] = useState<LedgerTxnType>("Collection");
  const [editTxnDate, setEditTxnDate] = useState<string>("");
  const [editValueDate, setEditValueDate] = useState<string>("");
  const [editNarration, setEditNarration] = useState<string>("");
  const [editDebit, setEditDebit] = useState<number>(0);
  const [editCredit, setEditCredit] = useState<number>(0);
  const [editRef, setEditRef] = useState<string>("");
  const [editBank, setEditBank] = useState<string>("");

  const openEditLedgerModal = (entry: DailyLedgerEntry) => {
    setEditingLedgerEntry(entry);
    setEditTxnType(entry.txnType);
    setEditTxnDate(entry.txnDate || entry.date || new Date().toISOString().split("T")[0]);
    setEditValueDate(entry.valueDate || entry.date || new Date().toISOString().split("T")[0]);
    setEditNarration(entry.narration || "");
    setEditDebit(entry.debit || 0);
    setEditCredit(entry.credit || 0);
    setEditRef(entry.referenceNumber || "");
    setEditBank(entry.bankName || "");
  };

  const handleUpdateLedgerEntry = () => {
    if (!editingLedgerEntry) return;
    if (!editTxnDate || !editValueDate) {
      setActionMessage({ text: "Please select both Transaction Date and Value Date.", isError: true });
      return;
    }

    setActionMessage(null);
    startTransition(async () => {
      const res = await updateDailyLedgerTxnAction(applicationId, editingLedgerEntry.id, {
        txnType: editTxnType,
        txnDate: editTxnDate,
        valueDate: editValueDate,
        date: editValueDate,
        narration: editNarration || editTxnType,
        debit: Number(editDebit) || 0,
        credit: Number(editCredit) || 0,
        referenceNumber: editRef || undefined,
        bankName: editBank || undefined,
      });

      if (res.success) {
        setActionMessage({ text: `Ledger entry updated & running interest recalculated successfully!` });
        setEditingLedgerEntry(null);
        window.location.reload();
      } else {
        setActionMessage({ text: res.error || "Failed to update ledger entry.", isError: true });
      }
    });
  };

  // Config / Simulator state
  const [configForm, setConfigForm] = useState<LoanServicingConfig>(initialSummary.config);

  // Bounce Dialog state
  const [bouncingTx, setBouncingTx] = useState<RepaymentTransaction | null>(null);
  const [bounceReason, setBounceReason] = useState<string>("Insufficient Funds");

  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const formatINR = (val: number, decimals: number = 0) =>
    (val || 0).toLocaleString("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  // Effective TDS calculations for Record Payment Modal
  const isTdsEnabled = tdsMode === "net_of_tds";
  const effectiveTdsAmount = isTdsEnabled
    ? isCustomTds
      ? customTdsAmount
      : Math.round(paymentAmount * (tdsRatePercent / (100 - tdsRatePercent)))
    : 0;
  const effectiveGrossAmount = isTdsEnabled
    ? paymentAmount + effectiveTdsAmount
    : paymentAmount;

  // Compute live waterfall preview for entered total gross credit
  const liveAllocation = allocatePaymentWaterfall(summary.schedules, effectiveGrossAmount || 0);

  // Live DPD calculated for Record Payment Modal
  const modalCalculatedDpd =
    paymentDate && selectedDueDate && paymentDate > selectedDueDate
      ? getDaysDifference(selectedDueDate, paymentDate)
      : 0;

  // Sync Gross -> Net when user edits Gross
  const handleGrossChange = (val: number) => {
    setGrossDueInput(val);
    if (tdsMode === "net_of_tds") {
      const tds = Math.round(val * (tdsRatePercent / 100));
      const net = val - tds;
      setCustomTdsAmount(tds);
      setPaymentAmount(net);
    } else {
      setPaymentAmount(val);
      setCustomTdsAmount(0);
    }
  };

  // Sync Net -> Gross when user edits Net Bank Receipt
  const handleNetChange = (val: number) => {
    setPaymentAmount(val);
    if (tdsMode === "net_of_tds") {
      const gross = Math.round(val / ((100 - tdsRatePercent) / 100));
      const tds = gross - val;
      setGrossDueInput(gross);
      setCustomTdsAmount(tds);
    } else {
      setGrossDueInput(val);
      setCustomTdsAmount(0);
    }
  };

  // Handle Recording a Payment
  const handleRecordPayment = () => {
    if (!paymentAmount || paymentAmount <= 0) {
      setActionMessage({ text: "Please enter a valid payment amount.", isError: true });
      return;
    }

    setActionMessage(null);
    startTransition(async () => {
      const input: RecordPaymentInput = {
        paymentDate,
        targetDueDate: selectedDueDate,
        dpd: modalCalculatedDpd,
        amount: Number(paymentAmount),
        isTdsDeducted: isTdsEnabled,
        tdsRatePercent: isTdsEnabled ? tdsRatePercent : 0,
        tdsAmount: isTdsEnabled ? effectiveTdsAmount : 0,
        grossInterestAmount: effectiveGrossAmount,
        paymentMode,
        paymentType,
        referenceNumber: refNumber || undefined,
        bankName: bankName || undefined,
        notes: paymentNotes || undefined,
      };

      const res = await recordPaymentAction(applicationId, input);
      if (res.success) {
        const tdsMsg = res.tdsReceiptNumber ? ` & TDS Asset Credit: ${res.tdsReceiptNumber}` : "";
        setActionMessage({
          text: `Payment of ₹${formatINR(paymentAmount)} recorded successfully! (Gross Cleared: ₹${formatINR(effectiveGrossAmount)} | DPD: ${modalCalculatedDpd} Days). Receipt: ${res.receiptNumber}${tdsMsg}`,
        });
        setIsRecordPaymentOpen(false);
        window.location.reload();
      } else {
        setActionMessage({ text: res.error || "Failed to record payment.", isError: true });
      }
    });
  };

  // Handle Adding Daily Ledger Transactions (Single or Multiple Batch)
  const handleAddLedgerTxns = () => {
    if (ledgerRows.length === 0) {
      setActionMessage({ text: "Please add at least one transaction entry.", isError: true });
      return;
    }

    for (let i = 0; i < ledgerRows.length; i++) {
      const row = ledgerRows[i];
      if (!row.txnDate || !row.valueDate) {
        setActionMessage({ text: `Entry #${i + 1}: Please select both Transaction Date and Value Date.`, isError: true });
        return;
      }
    }

    setActionMessage(null);
    startTransition(async () => {
      const batchInputs: AddLedgerTxnInput[] = ledgerRows.map((row) => {
        let tdsAmount = 0;
        let netCredit = Number(row.credit) || 0;

        if (row.autoSplitTds && row.credit > 0) {
          tdsAmount = Math.round(row.credit * (row.tdsRatePercent / 100));
          netCredit = row.credit - tdsAmount;
        }

        return {
          txnType: row.txnType,
          txnDate: row.txnDate,
          valueDate: row.valueDate,
          date: row.valueDate,
          narration: row.narration || row.txnType,
          debit: Number(row.debit) || 0,
          credit: Number(row.credit) || 0,
          referenceNumber: row.referenceNumber || undefined,
          bankName: row.bankName || undefined,
          autoSplitTds: row.autoSplitTds,
          tdsRatePercent: row.tdsRatePercent,
          tdsAmount,
          netCreditAmount: netCredit,
        };
      });

      const res = await addDailyLedgerTxnBatchAction(applicationId, batchInputs);
      if (res.success) {
        setActionMessage({
          text: `Successfully added ${res.count || batchInputs.length} transaction entries to Daily Ledger & recalculated interest.`,
        });
        setIsAddLedgerOpen(false);
        window.location.reload();
      } else {
        setActionMessage({ text: res.error || "Failed to add ledger transactions.", isError: true });
      }
    });
  };

  // Handle Deleting a Ledger Entry
  const handleDeleteLedgerEntry = (entryId: string) => {
    if (!confirm("Are you sure you want to delete this ledger entry?")) return;

    setActionMessage(null);
    startTransition(async () => {
      const res = await deleteDailyLedgerTxnAction(applicationId, entryId);
      if (res.success) {
        setActionMessage({ text: "Ledger entry removed and interest recalculated." });
        window.location.reload();
      } else {
        setActionMessage({ text: res.error || "Failed to delete entry.", isError: true });
      }
    });
  };

  // Handle Resetting / Regenerating the Schedule
  const handleRegenerateSchedule = () => {
    setActionMessage(null);
    startTransition(async () => {
      const res = await generateOrResetScheduleAction(applicationId, configForm);
      if (res.success) {
        setActionMessage({ text: "Repayment schedule recalculated & saved successfully!" });
        window.location.reload();
      } else {
        setActionMessage({ text: res.error || "Failed to generate schedule.", isError: true });
      }
    });
  };

  // Handle Marking Transaction as Bounced
  const handleConfirmBounce = () => {
    if (!bouncingTx) return;
    setActionMessage(null);
    startTransition(async () => {
      const res = await recordChequeBounceAction(applicationId, bouncingTx.id, bounceReason);
      if (res.success) {
        setActionMessage({
          text: `Transaction ${bouncingTx.receiptNumber} marked as Bounced. Bounce charge & penal interest applied.`,
        });
        setBouncingTx(null);
        window.location.reload();
      } else {
        setActionMessage({ text: res.error || "Failed to mark bounce.", isError: true });
      }
    });
  };

  // Date Formatter Helper: dd/mm/yyyy
  const formatDateDDMMYYYY = (dateStr?: string | null): string => {
    if (!dateStr) return "-";
    const cleanStr = String(dateStr).split("T")[0].trim();
    const parts = cleanStr.split("-");
    if (parts.length === 3) {
      const [year, month, day] = parts;
      if (year.length === 4) {
        return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
      }
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // SMA Classification Badge Colors
  const renderSmaBadge = (sma: SmaClassification) => {
    switch (sma) {
      case "Standard":
        return <Badge className="bg-emerald-600 text-white font-semibold">Standard (0 DPD)</Badge>;
      case "SMA-0":
        return <Badge className="bg-sky-600 text-white font-semibold">SMA-0 (1-30 DPD)</Badge>;
      case "SMA-1":
        return <Badge className="bg-amber-500 text-slate-950 font-semibold">SMA-1 (31-60 DPD)</Badge>;
      case "SMA-2":
        return <Badge className="bg-orange-600 text-white font-semibold">SMA-2 (61-90 DPD)</Badge>;
      case "NPA":
        return <Badge className="bg-red-600 text-white font-semibold">NPA (&gt;90 DPD)</Badge>;
      default:
        return <Badge variant="outline">Standard</Badge>;
    }
  };

  // DPD Badge Render Helper
  const renderDpdBadge = (dpd?: number, isPaid?: boolean) => {
    const d = dpd ?? 0;
    if (d === 0) {
      return (
        <span className="inline-flex items-center font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/25">
          0 DPD {isPaid ? "(On Time)" : ""}
        </span>
      );
    }
    if (d > 90) {
      return (
        <span className="inline-flex items-center font-mono text-[10px] font-bold text-white bg-rose-600 px-2 py-0.5 rounded shadow-xs">
          +{d} DPD (NPA)
        </span>
      );
    }
    if (d > 60) {
      return (
        <span className="inline-flex items-center font-mono text-[10px] font-bold text-white bg-orange-600 px-2 py-0.5 rounded">
          +{d} DPD (SMA-2)
        </span>
      );
    }
    if (d > 30) {
      return (
        <span className="inline-flex items-center font-mono text-[10px] font-bold text-white bg-amber-600 px-2 py-0.5 rounded">
          +{d} DPD (SMA-1)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center font-mono text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
        +{d} DPD
      </span>
    );
  };

  // Txn Type Badge Helper for Daily Ledger
  const renderTxnTypeBadge = (type: LedgerTxnType) => {
    switch (type) {
      case "Disbursement":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">Disbursement</span>;
      case "Collection":
      case "Principal":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">Collection</span>;
      case "Broken Interest":
      case "Broken Period":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40">⚡ Broken Interest</span>;
      case "Interest":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">Monthly Interest</span>;
      case "Tds":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">Tds</span>;
      case "Penal":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">Penal</span>;
      case "Charges":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">Charges</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">{type}</span>;
    }
  };

  // Installment Status Badge
  const renderInstallmentStatus = (status: string) => {
    switch (status) {
      case "paid":
        return <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]"><CheckCircle2 className="size-3" /> Paid</span>;
      case "partially_paid":
        return <span className="inline-flex items-center gap-1 text-amber-600 font-semibold text-[11px]"><Clock className="size-3" /> Part Paid</span>;
      case "overdue":
        return <span className="inline-flex items-center gap-1 text-red-600 font-bold text-[11px]"><AlertTriangle className="size-3" /> Overdue</span>;
      case "due":
        return <span className="inline-flex items-center gap-1 text-sky-600 font-semibold text-[11px]"><Calendar className="size-3" /> Due Now</span>;
      default:
        return <span className="text-slate-500 text-[11px]">Scheduled</span>;
    }
  };

  // Calculate Ledger Summary Aggregates
  const totalLedgerDebits = (summary.dailyLedger || []).reduce((acc, cur) => acc + (cur.debit || 0), 0);
  const totalLedgerCredits = (summary.dailyLedger || []).reduce((acc, cur) => acc + (cur.credit || 0), 0);
  const totalLedgerInterestAccrued = (summary.dailyLedger || []).reduce((acc, cur) => acc + (cur.interestAmount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="rounded-xl border bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-5 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold tracking-wider bg-white/10 text-white px-2.5 py-1 rounded-md border border-white/20">
                {summary.applicationCode}
              </span>
              <span className="text-xs bg-indigo-500/20 text-indigo-200 px-2.5 py-1 rounded-md border border-indigo-400/30 font-medium">
                {summary.config.repaymentMode === "bullet"
                  ? `Bullet (Full Principal in Month ${summary.config.tenureMonths})`
                  : summary.config.repaymentMode === "moratorium_emi"
                  ? `Moratorium (${summary.config.moratoriumMonths}M) + EMI (${Math.max(1, summary.config.tenureMonths - summary.config.moratoriumMonths)}M)`
                  : summary.config.repaymentMode === "moratorium_equal_principal"
                  ? `Moratorium (${summary.config.moratoriumMonths}M) + Equal Principal (${Math.max(1, summary.config.tenureMonths - summary.config.moratoriumMonths)}M)`
                  : "Reducing Balance EMI"}
              </span>
              <span className="text-xs bg-white/10 text-slate-200 px-2.5 py-1 rounded-md border border-white/10">
                ROI: {summary.config.roiPercent}% p.a. (Actual/365)
              </span>
              <span className="text-xs bg-white/10 text-slate-200 px-2.5 py-1 rounded-md border border-white/10">
                Tenor: {summary.config.tenureMonths}M ({summary.config.tenureDays}D)
              </span>
              {renderSmaBadge(summary.smaClass)}
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              {summary.borrowerName}
            </h2>
            <p className="text-xs text-slate-300 max-w-xl line-clamp-1">
              Disbursed Principal: ₹{formatINR(summary.disbursedAmount)} • DPD: {summary.dpd} Days • Current Outstanding: ₹{formatINR(summary.currentPrincipalOutstanding)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Button
              size="sm"
              onClick={openAddLedgerModal}
              className="bg-indigo-600 hover:bg-indigo-500 text-white h-9 gap-1.5 text-xs font-semibold shadow-sm"
            >
              <PlusCircle className="size-3.5" />
              Add Ledger Txn
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const targetDue = summary.nextDueAmount || summary.schedules.find((s) => s.status !== "paid")?.totalDue || 0;
                setGrossDueInput(targetDue);
                if (tdsMode === "net_of_tds") {
                  const tds = Math.round(targetDue * 0.1);
                  setCustomTdsAmount(tds);
                  setPaymentAmount(targetDue - tds);
                } else {
                  setPaymentAmount(targetDue);
                  setCustomTdsAmount(0);
                }
                setIsRecordPaymentOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white h-9 gap-1.5 text-xs font-semibold shadow-sm"
            >
              <CreditCard className="size-3.5" />
              Record Collection
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("simulator")}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-9 gap-1.5 text-xs"
            >
              <Settings2 className="size-3.5" />
              Configure / Reset
            </Button>
          </div>
        </div>

        {actionMessage && (
          <div
            className={`mt-3 p-2.5 px-3 rounded text-xs flex items-center gap-2 ${
              actionMessage.isError
                ? "bg-destructive/20 text-destructive-foreground border border-destructive/30"
                : "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30"
            }`}
          >
            {actionMessage.isError ? <AlertTriangle className="size-3.5 shrink-0" /> : <CheckCircle2 className="size-3.5 shrink-0" />}
            {actionMessage.text}
          </div>
        )}
      </div>

      {/* Top 4 Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Principal Outstanding */}
        <Card className="shadow-xs border bg-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 text-muted-foreground">
            <span className="text-xs font-medium">Principal Outstanding</span>
            <DollarSign className="size-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-xl font-bold font-mono tracking-tight text-foreground">
              ₹{formatINR(summary.currentPrincipalOutstanding)}
            </div>
            <div className="text-[11px] text-muted-foreground flex justify-between">
              <span>Disbursed: ₹{formatINR(summary.disbursedAmount)}</span>
              <span className="text-emerald-600 font-semibold">
                {summary.disbursedAmount > 0
                  ? `${Math.round(((summary.disbursedAmount - summary.currentPrincipalOutstanding) / summary.disbursedAmount) * 100)}% paid`
                  : "0%"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Total Collections */}
        <Card className="shadow-xs border bg-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 text-muted-foreground">
            <span className="text-xs font-medium">Total Collected</span>
            <Receipt className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
              ₹{formatINR(summary.totalCollected)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Principal: ₹{formatINR(summary.totalPrincipalPaid)} • Interest: ₹{formatINR(summary.totalInterestPaid)}
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Total Overdue */}
        <Card className="shadow-xs border bg-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 text-muted-foreground">
            <span className="text-xs font-medium">Overdue Dues</span>
            <ShieldAlert className={`size-4 ${summary.totalOverdue > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className={`text-xl font-bold font-mono tracking-tight ${summary.totalOverdue > 0 ? "text-destructive" : "text-foreground"}`}>
              ₹{formatINR(summary.totalOverdue)}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <span>DPD: <strong>{summary.dpd} Days</strong></span>
              <span>•</span>
              {renderSmaBadge(summary.smaClass)}
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Next Due Date & Amount */}
        <Card className="shadow-xs border bg-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 text-muted-foreground">
            <span className="text-xs font-medium">Next Upcoming Due</span>
            <Calendar className="size-4 text-indigo-600" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-xl font-bold font-mono tracking-tight text-indigo-600 dark:text-indigo-400">
              {summary.nextDueAmount > 0 ? `₹${formatINR(summary.nextDueAmount)}` : "All Clear"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {summary.nextDueDate ? `Due on ${formatDateDDMMYYYY(summary.nextDueDate)}` : "No pending schedule"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-1 border-b pb-2 text-xs no-scrollbar">
        <button
          onClick={() => setActiveTab("actual_schedule")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
            activeTab === "actual_schedule"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          }`}
        >
          <FileSpreadsheet className="size-4" />
          1. Updated EMI Schedule - As Actual
        </button>
        <button
          onClick={() => setActiveTab("daily_ledger")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
            activeTab === "daily_ledger"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          }`}
        >
          <Table className="size-4" />
          2. Daily Interest & Transaction Ledger ({summary.dailyLedger?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("schedule")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
            activeTab === "schedule"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          }`}
        >
          <Calendar className="size-4" />
          3. Projected Amortization Schedule ({summary.schedules.length})
        </button>
        <button
          onClick={() => setActiveTab("transactions")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
            activeTab === "transactions"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          }`}
        >
          <Receipt className="size-4" />
          4. Payment History & Receipts ({summary.transactions.length})
        </button>
        <button
          onClick={() => setActiveTab("simulator")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
            activeTab === "simulator"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          }`}
        >
          <Settings2 className="size-4" />
          5. Schedule Config & Calculator
        </button>
        <button
          onClick={() => setActiveTab("statement")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
            activeTab === "statement"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          }`}
        >
          <FileText className="size-4" />
          6. Statement of Account
        </button>
      </div>

      {/* TAB 1: UPDATED EMI SCHEDULE - AS ACTUAL (Matches Spreadsheet Image 2) */}
      {activeTab === "actual_schedule" && (
        <Card className="shadow-xs border">
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                  REALIZED SCHEDULE
                </span>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <FileSpreadsheet className="size-4 text-primary" />
                  UPDATED EMI SCHEDULE - AS ACTUAL
                </CardTitle>
              </div>
              <CardDescription className="text-xs mt-1">
                Realized monthly realization rollup computed from daily value-dated tranches, exact day-segment interest accrual, TDS, and principal prepayments.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveTab("daily_ledger")}
                className="h-8 text-xs gap-1"
              >
                <Table className="size-3.5" /> View Daily Segments
              </Button>
              <Button
                size="sm"
                onClick={openAddLedgerModal}
                className="bg-indigo-600 hover:bg-indigo-500 text-white h-8 text-xs gap-1"
              >
                <Plus className="size-3.5" /> Add Ledger Txn
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-muted/70 border-b border-border text-[11px] font-bold text-foreground">
                    <th className="p-3 border-r">Broker Period</th>
                    <th className="p-3 text-right border-r">Principal</th>
                    <th className="p-3 text-right border-r">Interest Due</th>
                    <th className="p-3 text-right border-r">Principal Due</th>
                    <th className="p-3 text-right border-r">Principal Recvd</th>
                    <th className="p-3 text-right border-r">Interest Recived</th>
                    <th className="p-3 text-right border-r bg-red-500/10 text-red-700 dark:text-red-400">Overdue</th>
                    <th className="p-3 text-right border-r bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Prepayment / (Overdue)</th>
                    <th className="p-3 text-right font-bold text-foreground">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono">
                  {(summary.actualSchedules || []).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground font-sans text-xs">
                        No actual schedule records available. Add transactions in the Daily Ledger or configure the loan schedule.
                      </td>
                    </tr>
                  ) : (
                    (summary.actualSchedules || []).map((row, idx) => {
                      const hasOverdue = row.overdue > 0;
                      const hasPrepayment = row.prepaymentOrOverdue < 0;
                      return (
                        <tr
                          key={idx}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="p-3 font-sans font-medium text-foreground border-r whitespace-nowrap">
                            {row.brokerPeriod}
                          </td>
                          <td className="p-3 text-right border-r">
                            {row.principal > 0 ? `₹${formatINR(row.principal, 2)}` : "-"}
                          </td>
                          <td className="p-3 text-right border-r font-semibold text-foreground">
                            {row.interestDue > 0 ? `₹${formatINR(row.interestDue, 2)}` : "-"}
                          </td>
                          <td className="p-3 text-right border-r text-muted-foreground">
                            {row.principalDue > 0 ? `₹${formatINR(row.principalDue, 2)}` : "-"}
                          </td>
                          <td className="p-3 text-right border-r text-emerald-600 font-semibold">
                            {row.principalRecvd > 0 ? `₹${formatINR(row.principalRecvd, 2)}` : "-"}
                          </td>
                          <td className="p-3 text-right border-r text-emerald-600 font-semibold">
                            {row.interestRecvd > 0 ? `₹${formatINR(row.interestRecvd, 2)}` : "-"}
                          </td>
                          <td className={`p-3 text-right border-r font-bold ${
                            hasOverdue
                              ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                              : "text-muted-foreground"
                          }`}>
                            {row.overdue > 0 ? `₹${formatINR(row.overdue, 2)}` : "-"}
                          </td>
                          <td className={`p-3 text-right border-r font-bold ${
                            hasPrepayment
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                              : row.prepaymentOrOverdue > 0
                              ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400"
                              : "text-muted-foreground"
                          }`}>
                            {row.prepaymentOrOverdue !== 0
                              ? `${row.prepaymentOrOverdue < 0 ? "-" : ""}₹${formatINR(Math.abs(row.prepaymentOrOverdue), 2)}`
                              : "-"}
                          </td>
                          <td className="p-3 text-right font-bold text-primary">
                            ₹{formatINR(row.outstanding, 2)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: DAILY RUNNING INTEREST & TRANSACTION SEGMENT LEDGER (Matches Spreadsheet Image 1) */}
      {activeTab === "daily_ledger" && (
        <Card className="shadow-xs border">
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                  DAY-COUNT ACCRUAL (ACTUAL / 365)
                </span>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Table className="size-4 text-indigo-600" />
                  Daily Running Interest & Transaction Segment Ledger
                </CardTitle>
              </div>
              <CardDescription className="text-xs mt-1">
                Value-dated tranches, principal repayments, TDS tax assets, and day segment interest accrual at {summary.config.roiPercent}% p.a.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={openAddLedgerModal}
                className="bg-indigo-600 hover:bg-indigo-500 text-white h-8 text-xs gap-1 font-semibold"
              >
                <Plus className="size-3.5" /> Add Transaction
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-muted/70 border-b border-border text-[11px] font-bold text-foreground">
                    <th className="p-3 border-r w-28">Txn Type</th>
                    <th className="p-3 border-r w-28">Txn Date</th>
                    <th className="p-3 border-r w-28">Value Date</th>
                    <th className="p-3 border-r min-w-40">Narration</th>
                    <th className="p-3 text-right border-r">Debit</th>
                    <th className="p-3 text-right border-r">Credit</th>
                    <th className="p-3 text-right border-r font-bold">Cumulative</th>
                    <th className="p-3 text-center border-r w-16">Days</th>
                    <th className="p-3 text-right border-r font-bold text-indigo-600 dark:text-indigo-400">
                      {summary.config.roiPercent}% Interest
                    </th>
                    <th className="p-3 text-center w-14">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono text-xs">
                  {(summary.dailyLedger || []).length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-muted-foreground font-sans text-xs">
                        No ledger transactions recorded yet. Click &quot;Add Transaction&quot; to disburse funds or record collections.
                      </td>
                    </tr>
                  ) : (
                    (summary.dailyLedger || []).map((entry, idx) => {
                      const isHighlightedCumulative =
                        entry.cumulative > 0 &&
                        (entry.txnType === "Disbursement" || entry.narration?.toLowerCase().includes("payment received") || entry.txnType === "Interest");

                      const txnDisplayDate = entry.txnDate || entry.date;
                      const valueDisplayDate = entry.valueDate || entry.date;

                      return (
                        <tr
                          key={entry.id || idx}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="p-3 border-r font-sans">
                            {renderTxnTypeBadge(entry.txnType)}
                          </td>
                          <td className="p-3 border-r whitespace-nowrap text-foreground font-mono">
                            {formatDateDDMMYYYY(txnDisplayDate)}
                          </td>
                          <td className="p-3 border-r whitespace-nowrap text-indigo-950 dark:text-indigo-200 bg-indigo-50/40 dark:bg-indigo-950/20 font-semibold font-mono">
                            {formatDateDDMMYYYY(valueDisplayDate)}
                          </td>
                          <td className="p-3 border-r font-sans text-foreground">
                            <div className="font-medium">{entry.narration || "-"}</div>
                            {(entry.referenceNumber || entry.bankName) && (
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {[entry.referenceNumber, entry.bankName].filter(Boolean).join(" • ")}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right border-r text-foreground">
                            {entry.debit > 0 ? formatINR(entry.debit, 2) : ""}
                          </td>
                          <td className="p-3 text-right border-r text-foreground">
                            {entry.credit > 0 ? formatINR(entry.credit, 2) : ""}
                          </td>
                          <td className={`p-3 text-right border-r font-bold ${
                            isHighlightedCumulative
                              ? "bg-yellow-200/90 dark:bg-yellow-950/70 text-slate-900 dark:text-yellow-200 font-bold border-l-2 border-r-2 border-yellow-400"
                              : "text-foreground"
                          }`}>
                            {entry.cumulative !== 0 ? formatINR(entry.cumulative, 2) : "-"}
                          </td>
                          <td className="p-3 text-center border-r font-sans font-medium text-muted-foreground">
                            {entry.days > 0
                              ? `${entry.days.toFixed(2)}`
                              : (entry.txnType === "Broken Interest" || entry.txnType === "Broken Period" || (entry.narration && entry.narration.toLowerCase().includes("broken"))) && brokenPeriodDays > 0
                              ? `${brokenPeriodDays.toFixed(2)}`
                              : "-"}
                          </td>
                          <td className="p-3 text-right border-r font-semibold text-indigo-600 dark:text-indigo-400">
                            {entry.interestAmount > 0
                              ? formatINR(entry.interestAmount, 2)
                              : (entry.txnType === "Broken Interest" || entry.txnType === "Broken Period" || (entry.narration && entry.narration.toLowerCase().includes("broken"))) && (entry.debit > 0 || brokenPeriodInterest > 0)
                              ? formatINR(entry.debit > 0 ? entry.debit : brokenPeriodInterest, 2)
                              : entry.interestAmount < 0
                              ? `-${formatINR(Math.abs(entry.interestAmount), 2)}`
                              : ""}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openEditLedgerModal(entry)}
                                disabled={isPending}
                                title="Edit Ledger Entry"
                                className="text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-1 rounded hover:bg-indigo-500/15"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteLedgerEntry(entry.id)}
                                disabled={isPending}
                                title="Delete Ledger Entry"
                                className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded hover:bg-destructive/10"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {/* Summary Total Footer */}
                {(summary.dailyLedger || []).length > 0 && (
                  <tfoot className="bg-muted/80 font-mono text-xs border-t-2 border-border font-bold">
                    <tr>
                      <td colSpan={4} className="p-3 border-r text-right font-sans font-bold">
                        Totals / Summary:
                      </td>
                      <td className="p-3 text-right border-r text-foreground">
                        ₹{formatINR(totalLedgerDebits, 2)}
                      </td>
                      <td className="p-3 text-right border-r text-foreground">
                        ₹{formatINR(totalLedgerCredits, 2)}
                      </td>
                      <td className="p-3 text-right border-r text-primary font-bold">
                        ₹{formatINR(summary.currentPrincipalOutstanding, 2)}
                      </td>
                      <td className="p-3 text-center border-r font-sans text-muted-foreground">
                        {(summary.dailyLedger || []).reduce((acc, c) => acc + (c.days || 0), 0).toFixed(2)}d
                      </td>
                      <td className="p-3 text-right border-r text-indigo-600 dark:text-indigo-400 font-bold">
                        ₹{formatINR(totalLedgerInterestAccrued, 2)}
                      </td>
                      <td className="p-3"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: Amortization Schedule Table */}
      {activeTab === "schedule" && (
        <Card className="shadow-xs border">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Calendar className="size-4 text-primary" />
                Loan Installment Repayment Schedule (Baseline Projection)
              </CardTitle>
              <CardDescription className="text-xs">
                Monthly interest servicing and bullet principal amortization tracker with live DPD.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setIsRecordPaymentOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white h-8 gap-1 text-xs"
            >
              <Plus className="size-3" /> Record Payment
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground">
                    <th className="p-3 text-center w-12">#</th>
                    <th className="p-3">Period / Label</th>
                    <th className="p-3">Due Date</th>
                    <th className="p-3 text-center">DPD</th>
                    <th className="p-3 text-right">Opening Bal</th>
                    <th className="p-3 text-right">Principal</th>
                    <th className="p-3 text-right">Interest</th>
                    <th className="p-3 text-right">Total Due</th>
                    <th className="p-3 text-right">Paid</th>
                    <th className="p-3 text-right font-bold text-foreground">Balance Due</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center w-24">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {summary.schedules.map((item) => {
                    const isOverdue = item.status === "overdue";
                    return (
                      <tr
                        key={item.installmentNumber}
                        className={`hover:bg-muted/30 transition-colors ${
                          isOverdue ? "bg-red-50/40 dark:bg-red-950/20" : item.status === "paid" ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""
                        }`}
                      >
                        <td className="p-3 text-center font-mono font-medium text-muted-foreground">
                          {item.installmentNumber}
                        </td>
                        <td className="p-3 font-medium text-foreground">
                          {item.periodLabel}
                        </td>
                        <td className="p-3 whitespace-nowrap font-mono">
                          {formatDateDDMMYYYY(item.dueDate)}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {renderDpdBadge(item.dpd, item.status === "paid")}
                        </td>
                        <td className="p-3 text-right font-mono">₹{formatINR(item.openingPrincipal)}</td>
                        <td className="p-3 text-right font-mono">₹{formatINR(item.principalDue)}</td>
                        <td className="p-3 text-right font-mono">₹{formatINR(item.interestDue)}</td>
                        <td className="p-3 text-right font-mono font-bold">₹{formatINR(item.totalDue)}</td>
                        <td className="p-3 text-right font-mono text-emerald-600 font-semibold">
                          ₹{formatINR(item.totalPaid)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-primary">
                          ₹{formatINR(item.totalBalance)}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {renderInstallmentStatus(item.status)}
                        </td>
                        <td className="p-3 text-center">
                          {item.totalBalance > 0 ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setGrossDueInput(item.totalBalance);
                                if (tdsMode === "net_of_tds") {
                                  const tds = Math.round(item.totalBalance * 0.1);
                                  setCustomTdsAmount(tds);
                                  setPaymentAmount(item.totalBalance - tds);
                                } else {
                                  setPaymentAmount(item.totalBalance);
                                  setCustomTdsAmount(0);
                                }
                                setSelectedDueDate(item.dueDate);
                                setIsRecordPaymentOpen(true);
                              }}
                              className="h-6 px-2 text-[10px] text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                            >
                              Collect
                            </Button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Cleared</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: Payment History & Receipts */}
      {activeTab === "transactions" && (
        <Card className="shadow-xs border">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Receipt className="size-4 text-emerald-600" />
                Payment Collection Receipts & Audit Log
              </CardTitle>
              <CardDescription className="text-xs">
                History of all received payments, NACH debits, PDCs, and DPD tracking from due date.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setIsRecordPaymentOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white h-8 gap-1 text-xs"
            >
              <Plus className="size-3" /> Record Payment
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {summary.transactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs space-y-2">
                <Receipt className="size-8 mx-auto opacity-40" />
                <p>No payment collections recorded yet.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsRecordPaymentOpen(true)}
                  className="h-8 text-xs"
                >
                  Record First Payment
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground">
                      <th className="p-3">Receipt No</th>
                      <th className="p-3">Payment Date</th>
                      <th className="p-3">Target Due Date</th>
                      <th className="p-3 text-center">Repayment DPD</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="p-3 text-right">Principal</th>
                      <th className="p-3 text-right">Interest</th>
                      <th className="p-3 text-right">Penal/Charges</th>
                      <th className="p-3">Payment Mode</th>
                      <th className="p-3">Reference / UTR</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {summary.transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono font-bold text-foreground">
                          {tx.receiptNumber}
                        </td>
                        <td className="p-3 whitespace-nowrap font-mono">
                          {formatDateDDMMYYYY(tx.paymentDate)}
                        </td>
                        <td className="p-3 whitespace-nowrap text-muted-foreground font-mono">
                          {formatDateDDMMYYYY(tx.targetDueDate)}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {renderDpdBadge(tx.dpd, true)}
                        </td>
                        <td className={`p-3 text-right font-mono font-bold ${
                          tx.paymentMode === "TDS Credit" ? "text-purple-600 dark:text-purple-400" : "text-emerald-600"
                        }`}>
                          ₹{formatINR(tx.amount)}
                        </td>
                        <td className="p-3 text-right font-mono text-muted-foreground">
                          ₹{formatINR(tx.allocatedPrincipal)}
                        </td>
                        <td className="p-3 text-right font-mono text-muted-foreground">
                          ₹{formatINR(tx.allocatedInterest)}
                        </td>
                        <td className="p-3 text-right font-mono text-muted-foreground">
                          ₹{formatINR(tx.allocatedPenal + tx.allocatedCharges)}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                            tx.paymentMode === "TDS Credit"
                              ? "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700"
                              : "bg-muted"
                          }`}>
                            {tx.paymentMode}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-muted-foreground">
                          {tx.referenceNumber || "-"}
                        </td>
                        <td className="p-3 text-center">
                          {tx.status === "cleared" ? (
                            <Badge className="bg-emerald-600 text-white text-[10px]">Cleared</Badge>
                          ) : tx.status === "bounced" ? (
                            <Badge variant="destructive" className="text-[10px]">Bounced</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">{tx.status}</Badge>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {tx.status === "cleared" && tx.paymentMode !== "TDS Credit" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setBouncingTx(tx)}
                              className="h-6 px-2 text-[10px] text-destructive border-destructive/30 hover:bg-destructive/10"
                            >
                              Mark Bounce
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 5: Schedule Config & Calculator */}
      {activeTab === "simulator" && (
        <Card className="shadow-xs border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Settings2 className="size-4 text-primary" />
              Repayment Schedule Configuration & Simulator
            </CardTitle>
            <CardDescription className="text-xs">
              Configure servicing parameters, repayment frequency, moratorium period, and recalculate installments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Disbursement Date</label>
                <Input
                  type="date"
                  value={configForm.disbursementDate}
                  onChange={(e) => setConfigForm({ ...configForm, disbursementDate: e.target.value })}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Disbursed Amount (₹)</label>
                <Input
                  type="number"
                  value={configForm.disbursedAmount}
                  onChange={(e) => setConfigForm({ ...configForm, disbursedAmount: Number(e.target.value) || 0 })}
                  className="h-8 text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Interest Rate (% p.a.)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={configForm.roiPercent}
                  onChange={(e) => setConfigForm({ ...configForm, roiPercent: Number(e.target.value) || 0 })}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Repayment Mode</label>
                <select
                  value={configForm.repaymentMode}
                  onChange={(e) => setConfigForm({ ...configForm, repaymentMode: e.target.value as any })}
                  className="h-8 w-full rounded-md border border-input bg-background px-3 text-xs font-medium"
                >
                  <option value="bullet">Bullet (Monthly Interest + Full Bullet Principal)</option>
                  <option value="moratorium_emi">Moratorium (Interest-Only) + Reducing Balance EMI</option>
                  <option value="moratorium_equal_principal">Moratorium + Equal Principal Installments</option>
                  <option value="emi">Reducing Balance Standard EMI</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Loan Tenor (Months)</label>
                <Input
                  type="number"
                  value={configForm.tenureMonths}
                  onChange={(e) => setConfigForm({ ...configForm, tenureMonths: Number(e.target.value) || 1 })}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Moratorium Period (Months)</label>
                <Input
                  type="number"
                  value={configForm.moratoriumMonths}
                  onChange={(e) => setConfigForm({ ...configForm, moratoriumMonths: Number(e.target.value) || 0 })}
                  className="h-8 text-xs font-mono"
                  disabled={configForm.repaymentMode === "bullet" || configForm.repaymentMode === "emi"}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Day Count Basis</label>
                <select
                  value={configForm.dayCountConvention}
                  onChange={(e) => setConfigForm({ ...configForm, dayCountConvention: e.target.value as any })}
                  className="h-8 w-full rounded-md border border-input bg-background px-3 text-xs font-medium"
                >
                  <option value="actual_365">Actual / 365 Days (Indian Banking Standard)</option>
                  <option value="30_360">30 / 360 Days</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Penal Interest Rate (% p.a.)</label>
                <Input
                  type="number"
                  step="0.5"
                  value={configForm.penalInterestRate}
                  onChange={(e) => setConfigForm({ ...configForm, penalInterestRate: Number(e.target.value) || 0 })}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Bounce Penalty (₹)</label>
                <Input
                  type="number"
                  value={configForm.bouncingChargeAmount}
                  onChange={(e) => setConfigForm({ ...configForm, bouncingChargeAmount: Number(e.target.value) || 0 })}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfigForm(initialSummary.config)}
                className="h-8 text-xs"
              >
                Reset Defaults
              </Button>
              <Button
                size="sm"
                onClick={handleRegenerateSchedule}
                disabled={isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 text-xs font-semibold gap-1.5"
              >
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                Save & Recalculate Schedule
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 6: Statement of Account */}
      {activeTab === "statement" && (
        <Card className="shadow-xs border">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                Statement of Loan Account (SOA)
              </CardTitle>
              <CardDescription className="text-xs">
                Official statement summary with chronological audit of all disbursals, dues, and repayments.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.print()}
              className="h-8 text-xs gap-1"
            >
              <Download className="size-3.5" /> Export / Print SOA
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Account Details Header Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/40 border text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Borrower Name</span>
                <span className="font-bold text-foreground">{summary.borrowerName}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Facility Type</span>
                <span className="font-bold text-foreground">Loan Against Property / Bullet Term Loan</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Sanctioned / Disbursed</span>
                <span className="font-mono font-bold text-foreground">₹{formatINR(summary.disbursedAmount)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Asset Classification</span>
                <div className="mt-0.5">{renderSmaBadge(summary.smaClass)}</div>
              </div>
            </div>

            {/* SOA Chronological Ledger */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground">
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Description / Narration</th>
                    <th className="p-2.5">Ref / UTR</th>
                    <th className="p-2.5 text-right">Debit (Due/Disbursed)</th>
                    <th className="p-2.5 text-right">Credit (Received)</th>
                    <th className="p-2.5 text-right font-bold">Principal Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr className="bg-muted/20">
                    <td className="p-2.5 font-mono">{summary.config.disbursementDate}</td>
                    <td className="p-2.5 font-medium">Loan Disbursement (Initial Tranche)</td>
                    <td className="p-2.5 font-mono text-[11px] text-muted-foreground">-</td>
                    <td className="p-2.5 text-right font-mono font-bold">₹{formatINR(summary.disbursedAmount)}</td>
                    <td className="p-2.5 text-right font-mono text-muted-foreground">-</td>
                    <td className="p-2.5 text-right font-mono font-bold">₹{formatINR(summary.disbursedAmount)}</td>
                  </tr>

                  {summary.transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/30">
                      <td className="p-2.5 font-mono">{tx.paymentDate}</td>
                      <td className="p-2.5">
                        Collection via {tx.paymentMode} ({tx.paymentType.replace(/_/g, " ")})
                        {tx.status === "bounced" && (
                          <span className="text-destructive font-bold ml-1.5">[BOUNCED]</span>
                        )}
                      </td>
                      <td className="p-2.5 font-mono text-[11px] text-muted-foreground">{tx.referenceNumber || "-"}</td>
                      <td className="p-2.5 text-right font-mono text-muted-foreground">-</td>
                      <td className={`p-2.5 text-right font-mono font-semibold ${
                        tx.paymentMode === "TDS Credit" ? "text-purple-600" : "text-emerald-600"
                      }`}>₹{formatINR(tx.amount)}</td>
                      <td className="p-2.5 text-right font-mono">-</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* RECORD PAYMENT MODAL DIALOG WITH INTELLIGENT TDS AUTOMATION */}
      {isRecordPaymentOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border rounded-xl shadow-2xl max-w-xl w-full p-6 space-y-4 text-foreground animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2 text-emerald-600">
                  <CreditCard className="size-4" />
                  Record Loan Collection & TDS Reconciliation
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Verify whether interest received is Net of TDS (e.g. 10% under Sec 194A) or Gross.
                </p>
              </div>
              <button
                onClick={() => setIsRecordPaymentOpen(false)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Date selection & target due date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">Payment Date (Value Date)</label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">Target Installment Due Date</label>
                  <Input
                    type="date"
                    value={selectedDueDate}
                    onChange={(e) => setSelectedDueDate(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              {/* DPD Pill Banner */}
              <div className="flex items-center justify-between p-2 rounded bg-muted/50 border">
                <span className="text-muted-foreground">Computed Repayment DPD:</span>
                {renderDpdBadge(modalCalculatedDpd)}
              </div>

              {/* TDS SELECTION MODE TOGGLE */}
              <div className="p-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-indigo-600" />
                    TDS Deduction Status (Section 194A)
                  </label>
                  <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-medium">
                    Auto-reconciles Form 16A Asset
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTdsMode("net_of_tds");
                      const tds = Math.round(grossDueInput * (tdsRatePercent / 100));
                      setCustomTdsAmount(tds);
                      setPaymentAmount(grossDueInput - tds);
                    }}
                    className={`p-2.5 rounded-md border text-left transition-all ${
                      tdsMode === "net_of_tds"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-background text-foreground border-input hover:bg-muted/50"
                    }`}
                  >
                    <div className="font-bold text-[11px] flex items-center gap-1">
                      <span>✓ Net of TDS Received</span>
                    </div>
                    <p className={`text-[10px] mt-0.5 ${tdsMode === "net_of_tds" ? "text-indigo-100" : "text-muted-foreground"}`}>
                      Borrower deducted {tdsRatePercent}% TDS. Auto-creates TDS Asset entry.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTdsMode("gross_no_tds");
                      setPaymentAmount(grossDueInput);
                      setCustomTdsAmount(0);
                    }}
                    className={`p-2.5 rounded-md border text-left transition-all ${
                      tdsMode === "gross_no_tds"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-background text-foreground border-input hover:bg-muted/50"
                    }`}
                  >
                    <div className="font-bold text-[11px] flex items-center gap-1">
                      <span>✓ Gross Payment (No TDS)</span>
                    </div>
                    <p className={`text-[10px] mt-0.5 ${tdsMode === "gross_no_tds" ? "text-indigo-100" : "text-muted-foreground"}`}>
                      Full gross interest received in bank without tax deduction.
                    </p>
                  </button>
                </div>

                {/* TDS Live Calculator Breakdown */}
                {tdsMode === "net_of_tds" && (
                  <div className="mt-2 pt-2 border-t border-indigo-200 dark:border-indigo-800 grid grid-cols-3 gap-2 text-[11px]">
                    <div className="space-y-1">
                      <span className="text-muted-foreground block text-[10px]">Gross Interest Due (₹)</span>
                      <Input
                        type="number"
                        value={grossDueInput}
                        onChange={(e) => handleGrossChange(Number(e.target.value) || 0)}
                        className="h-7 text-xs font-mono font-bold bg-background"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground block text-[10px]">TDS Rate % / Amount</span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={tdsRatePercent}
                          onChange={(e) => {
                            const r = Number(e.target.value) || 0;
                            setTdsRatePercent(r);
                            const tds = Math.round(grossDueInput * (r / 100));
                            setCustomTdsAmount(tds);
                            setPaymentAmount(grossDueInput - tds);
                          }}
                          className="h-7 w-14 text-xs font-mono text-center bg-background"
                        />
                        <span className="font-bold font-mono text-purple-600 dark:text-purple-400 text-xs">
                          ₹{formatINR(effectiveTdsAmount)}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground block text-[10px]">Net Bank Receipt (₹)</span>
                      <Input
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => handleNetChange(Number(e.target.value) || 0)}
                        className="h-7 text-xs font-mono font-bold text-emerald-600 bg-background"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Mode & Type */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">Bank Collection Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="h-8 w-full rounded-md border border-input bg-background px-3 text-xs font-medium"
                  >
                    <option value="RTGS">RTGS</option>
                    <option value="NEFT">NEFT</option>
                    <option value="NACH">NACH / e-Mandate</option>
                    <option value="PDC">Post Dated Cheque (PDC)</option>
                    <option value="Cheque">Cheque</option>
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Internal Transfer">Internal Transfer</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">Payment Type</label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as any)}
                    className="h-8 w-full rounded-md border border-input bg-background px-3 text-xs font-medium"
                  >
                    <option value="regular_installment">Regular Interest / Installment</option>
                    <option value="part_prepayment">Part-Prepayment (Principal)</option>
                    <option value="cash_top_up">Cash Top-Up (Margin Call)</option>
                    <option value="foreclosure">Full Foreclosure</option>
                    <option value="penal_settlement">Penal Interest Settlement</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">UTR / Cheque Number</label>
                  <Input
                    value={refNumber}
                    onChange={(e) => setRefNumber(e.target.value)}
                    placeholder="e.g. UTR12345678"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">Bank Name</label>
                  <Input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. HDFC Bank"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Notes / Narration</label>
                <Input
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Cleared via RTGS / TDS under Sec 194A"
                  className="h-8 text-xs"
                />
              </div>

              {/* Automatic Double-Entry Summary Callout */}
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-emerald-900 dark:text-emerald-200">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-emerald-600" />
                    Automatic Dues Reconciliation Preview
                  </span>
                  <span>Gross Credit: ₹{formatINR(effectiveGrossAmount)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px] text-center font-mono">
                  <div className="bg-card p-1.5 rounded border">
                    <span className="text-muted-foreground block font-sans text-[9px]">Bank Receipt (Cash)</span>
                    <span className="font-bold text-emerald-600">₹{formatINR(paymentAmount)}</span>
                  </div>
                  <div className="bg-card p-1.5 rounded border">
                    <span className="text-muted-foreground block font-sans text-[9px]">TDS Asset Credit</span>
                    <span className="font-bold text-purple-600 dark:text-purple-400">
                      {isTdsEnabled ? `₹${formatINR(effectiveTdsAmount)}` : "₹0"}
                    </span>
                  </div>
                  <div className="bg-card p-1.5 rounded border">
                    <span className="text-muted-foreground block font-sans text-[9px]">Balance Overdue</span>
                    <span className="font-bold text-primary">₹0.00 (Cleared)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRecordPaymentOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRecordPayment}
                disabled={isPending}
                className="bg-emerald-600 hover:bg-emerald-500 text-white h-8 text-xs font-semibold gap-1"
              >
                {isPending ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                Confirm & Create Receipts
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ADD DAILY LEDGER TRANSACTIONS MODAL DIALOG (MULTI-ENTRY BATCH SUPPORT) */}
      {isAddLedgerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-card border rounded-xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col text-foreground animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/30 rounded-t-xl shrink-0">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <PlusCircle className="size-4" />
                  Add Daily Ledger Transactions (Batch Entry)
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Enter single or multiple ledger movements with independent <strong>Transaction (Booking) Date</strong> and <strong>Value Date</strong>.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  type="button"
                  onClick={addAnotherLedgerRow}
                  className="bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 h-8 text-xs font-semibold gap-1"
                >
                  <Plus className="size-3.5" />
                  Add Another Row
                </Button>
                <button
                  type="button"
                  onClick={() => setIsAddLedgerOpen(false)}
                  className="text-muted-foreground hover:text-foreground text-sm px-2 py-1 rounded hover:bg-muted/80 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Smart Accrual & Dues Guide Banner */}
            <div className="mx-6 mt-4 p-3 rounded-lg bg-gradient-to-r from-indigo-950/40 via-indigo-900/30 to-purple-950/40 border border-indigo-500/30 text-xs space-y-2 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-bold text-indigo-200">
                  <Sparkles className="size-4 text-indigo-400 shrink-0" />
                  <span>Segregated Accrual & Collection Dues Guide:</span>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">
                  Active Principal: <strong className="text-foreground">₹{formatINR(activeCumulativePrincipal, 2)}</strong> @ {summary.config.roiPercent}% (₹{formatINR(dailyInterestAccrualRate, 2)}/day)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                {brokenPeriodDays > 0 && brokenPeriodInterest > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (ledgerRows.length > 0) {
                        const first = ledgerRows[0];
                        updateLedgerRow(first.id, {
                          txnType: "Broken Interest",
                          narration: `Broken Period Interest (${brokenPeriodDays} Days)`,
                          debit: brokenPeriodInterest,
                          credit: 0,
                        });
                      }
                    }}
                    className="inline-flex items-center gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 px-2.5 py-1 rounded-md border border-amber-400/40 transition-colors font-mono font-semibold"
                  >
                    <span>⚡ Broken Period ({brokenPeriodDays}d):</span>
                    <strong className="text-white">₹{formatINR(brokenPeriodInterest, 2)}</strong>
                    <span className="text-[9px] bg-amber-500/40 px-1 py-0.5 rounded ml-1">Use</span>
                  </button>
                )}
                {latestSegmentAccruedInterest > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (ledgerRows.length > 0) {
                        const first = ledgerRows[0];
                        if (first.txnType === "Interest" && first.debit > 0) {
                          updateLedgerRow(first.id, { debit: latestSegmentAccruedInterest });
                        } else {
                          updateLedgerRow(first.id, { credit: latestSegmentAccruedInterest });
                        }
                      }
                    }}
                    className="inline-flex items-center gap-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 px-2.5 py-1 rounded-md border border-indigo-400/40 transition-colors font-mono font-semibold"
                  >
                    <span>🕒 Active Segment ({latestLedgerEntry?.days || 0}d):</span>
                    <strong className="text-white">₹{formatINR(latestSegmentAccruedInterest, 2)}</strong>
                    <span className="text-[9px] bg-indigo-500/30 px-1 py-0.5 rounded ml-1">Use</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (ledgerRows.length > 0) {
                      const first = ledgerRows[0];
                      if (first.txnType === "Interest" && first.debit > 0) {
                        updateLedgerRow(first.id, { debit: fullMonth31dInterest });
                      } else {
                        updateLedgerRow(first.id, { credit: fullMonth31dInterest });
                      }
                    }
                  }}
                  className="inline-flex items-center gap-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 px-2.5 py-1 rounded-md border border-purple-400/40 transition-colors font-mono font-semibold"
                >
                  <span>📅 Full Month (31d):</span>
                  <strong className="text-white">₹{formatINR(fullMonth31dInterest, 2)}</strong>
                  <span className="text-[9px] bg-purple-500/30 px-1 py-0.5 rounded ml-1">Use</span>
                </button>
                {overdueUnpaidInterestInLedger > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (ledgerRows.length > 0) {
                        updateLedgerRow(ledgerRows[0].id, { credit: overdueUnpaidInterestInLedger });
                      }
                    }}
                    className="inline-flex items-center gap-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 px-2.5 py-1 rounded-md border border-rose-400/40 transition-colors font-mono font-semibold"
                  >
                    <span>⚠️ Unpaid Overdue Dues:</span>
                    <strong className="text-white">₹{formatINR(overdueUnpaidInterestInLedger, 2)}</strong>
                    <span className="text-[9px] bg-rose-500/30 px-1 py-0.5 rounded ml-1">Use</span>
                  </button>
                )}
              </div>
            </div>

            {/* Modal Scrollable Rows Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {ledgerRows.map((row, idx) => {
                const isCollectionOrInterest = row.txnType === "Collection" || row.txnType === "Interest" || row.txnType === "Broken Interest" || row.txnType === "Principal";
                const rowTdsAmount = row.autoSplitTds && row.credit > 0 ? Math.round(row.credit * (row.tdsRatePercent / 100)) : 0;
                const rowNetAmount = row.autoSplitTds && row.credit > 0 ? row.credit - rowTdsAmount : row.credit;

                return (
                  <div
                    key={row.id}
                    className="p-4 rounded-xl border bg-card/60 hover:border-indigo-500/40 transition-all space-y-3 shadow-xs"
                  >
                    {/* Row Top Header */}
                    <div className="flex items-center justify-between border-b pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded">
                          #{idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-foreground">
                          {row.narration || row.txnType}
                        </span>
                        {renderTxnTypeBadge(row.txnType)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => duplicateLedgerRow(row.id)}
                          title="Duplicate Entry"
                          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors text-xs flex items-center gap-1"
                        >
                          <Copy className="size-3.5" />
                          <span className="text-[10px] hidden sm:inline">Duplicate</span>
                        </button>
                        {ledgerRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLedgerRow(row.id)}
                            title="Delete Entry"
                            className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Row Form Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      {/* 1. Txn Type */}
                      <div className="space-y-1">
                        <label className="font-semibold text-muted-foreground text-[11px]">Txn Type</label>
                        <select
                          value={row.txnType}
                          onChange={(e) => updateLedgerRow(row.id, { txnType: e.target.value as LedgerTxnType })}
                          className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs font-medium"
                        >
                          <option value="Collection">Collection (Credit)</option>
                          <option value="Disbursement">Disbursement (Debit)</option>
                          <option value="Broken Interest">⚡ Broken Period Interest</option>
                          <option value="Interest">📅 Monthly Interest (Debit / Payment)</option>
                          <option value="Tds">Tds (TDS Asset Credit)</option>
                          <option value="Penal">Penal Interest</option>
                          <option value="Charges">Charges / Fees</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      {/* 2. Transaction Date (Booking Date) */}
                      <div className="space-y-1">
                        <label className="font-semibold text-muted-foreground text-[11px]">
                          Txn Date <span className="text-[10px] font-normal">(Booking)</span>
                        </label>
                        <Input
                          type="date"
                          value={row.txnDate}
                          onChange={(e) => updateLedgerRow(row.id, { txnDate: e.target.value })}
                          className="h-8 text-xs font-mono"
                        />
                      </div>

                      {/* 3. Value Date (Effective Interest Date) */}
                      <div className="space-y-1">
                        <label className="font-semibold text-indigo-600 dark:text-indigo-400 text-[11px]">
                          Value Date <span className="text-[10px] font-normal">(Effective)</span>
                        </label>
                        <Input
                          type="date"
                          value={row.valueDate}
                          onChange={(e) => updateLedgerRow(row.id, { valueDate: e.target.value })}
                          className="h-8 text-xs font-mono font-semibold border-indigo-400/50 bg-indigo-50/20 dark:bg-indigo-950/20"
                        />
                      </div>

                      {/* 4. Narration */}
                      <div className="space-y-1">
                        <label className="font-semibold text-muted-foreground text-[11px]">Narration / Description</label>
                        <Input
                          value={row.narration}
                          onChange={(e) => updateLedgerRow(row.id, { narration: e.target.value })}
                          placeholder="e.g. Collection, RTGS"
                          className="h-8 text-xs"
                        />
                      </div>

                      {/* 5. Debit Amount */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="font-semibold text-muted-foreground text-[11px]">Debit (₹)</label>
                          <div className="flex items-center gap-1">
                            {brokenPeriodDays > 0 && brokenPeriodInterest > 0 && (
                              <button
                                type="button"
                                onClick={() => updateLedgerRow(row.id, { debit: brokenPeriodInterest })}
                                className="text-[9px] text-amber-700 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 px-1 rounded border border-amber-500/30 transition-colors font-mono"
                                title="Fill with broken period interest"
                              >
                                Broken: ₹{formatINR(brokenPeriodInterest)}
                              </button>
                            )}
                            {latestSegmentAccruedInterest > 0 && (
                              <button
                                type="button"
                                onClick={() => updateLedgerRow(row.id, { debit: latestSegmentAccruedInterest })}
                                className="text-[9px] text-indigo-700 dark:text-indigo-300 bg-indigo-500/15 hover:bg-indigo-500/25 px-1 rounded border border-indigo-500/30 transition-colors font-mono"
                                title="Fill with segment accrued interest"
                              >
                                Accrued: ₹{formatINR(latestSegmentAccruedInterest)}
                              </button>
                            )}
                          </div>
                        </div>
                        <Input
                          type="number"
                          value={row.debit || ""}
                          onChange={(e) => updateLedgerRow(row.id, { debit: Number(e.target.value) || 0 })}
                          placeholder="0.00"
                          className="h-8 text-xs font-mono font-bold"
                        />
                      </div>

                      {/* 6. Credit Amount */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="font-semibold text-muted-foreground text-[11px]">Credit (₹)</label>
                          <div className="flex items-center gap-1">
                            {latestSegmentAccruedInterest > 0 && (
                              <button
                                type="button"
                                onClick={() => updateLedgerRow(row.id, { credit: latestSegmentAccruedInterest })}
                                className="text-[9px] text-indigo-700 dark:text-indigo-300 bg-indigo-500/15 hover:bg-indigo-500/25 px-1 rounded border border-indigo-500/30 transition-colors font-mono"
                                title="Fill with segment accrued interest"
                              >
                                Accrued: ₹{formatINR(latestSegmentAccruedInterest)}
                              </button>
                            )}
                            {suggestedDueAmount > 0 && (
                              <button
                                type="button"
                                onClick={() => updateLedgerRow(row.id, { credit: suggestedDueAmount })}
                                className="text-[9px] text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 px-1 rounded border border-emerald-500/30 transition-colors font-mono font-semibold"
                                title="Fill with suggested collection amount"
                              >
                                Due: ₹{formatINR(suggestedDueAmount)}
                              </button>
                            )}
                          </div>
                        </div>
                        <Input
                          type="number"
                          value={row.credit || ""}
                          onChange={(e) => updateLedgerRow(row.id, { credit: Number(e.target.value) || 0 })}
                          placeholder="0.00"
                          className="h-8 text-xs font-mono font-bold text-emerald-600"
                        />
                      </div>

                      {/* 7. Reference / UTR */}
                      <div className="space-y-1">
                        <label className="font-semibold text-muted-foreground text-[11px]">UTR / Ref #</label>
                        <Input
                          value={row.referenceNumber}
                          onChange={(e) => updateLedgerRow(row.id, { referenceNumber: e.target.value })}
                          placeholder="e.g. UTR12345678"
                          className="h-8 text-xs font-mono"
                        />
                      </div>

                      {/* 8. Bank Name */}
                      <div className="space-y-1">
                        <label className="font-semibold text-muted-foreground text-[11px]">Bank Name</label>
                        <Input
                          value={row.bankName}
                          onChange={(e) => updateLedgerRow(row.id, { bankName: e.target.value })}
                          placeholder="e.g. HDFC Bank"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    {/* TDS Auto-Split Checkbox for Collections / Interest */}
                    {isCollectionOrInterest && row.credit > 0 && (
                      <div className="p-2.5 rounded bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 space-y-1.5 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-purple-950 dark:text-purple-200">
                          <input
                            type="checkbox"
                            checked={row.autoSplitTds}
                            onChange={(e) => updateLedgerRow(row.id, { autoSplitTds: e.target.checked })}
                            className="rounded border-purple-300 text-purple-600"
                          />
                          <span>Auto-split 10% TDS Asset credit entry (Gross ₹{formatINR(row.credit)})</span>
                        </label>
                        {row.autoSplitTds && (
                          <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 font-mono">
                            <div className="bg-card/70 p-1.5 rounded border border-purple-200 dark:border-purple-800">
                              <span className="text-muted-foreground block font-sans">TDS Assets Credit (10%):</span>
                              <span className="font-bold text-purple-600">₹{formatINR(rowTdsAmount, 2)}</span>
                            </div>
                            <div className="bg-card/70 p-1.5 rounded border border-emerald-200 dark:border-emerald-800">
                              <span className="text-muted-foreground block font-sans">Net Cash Received (90%):</span>
                              <span className="font-bold text-emerald-600">₹{formatINR(rowNetAmount, 2)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add row trigger button at bottom of list */}
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAnotherLedgerRow}
                  className="border-dashed border-2 hover:border-indigo-500 hover:text-indigo-600 text-xs gap-1.5 h-9 w-full sm:w-auto px-6 font-semibold"
                >
                  <Plus className="size-4" />
                  + Add Another Ledger Entry Row
                </Button>
              </div>
            </div>

            {/* Modal Bottom Footer with Batch Stats & Actions */}
            <div className="border-t p-4 px-6 bg-muted/40 rounded-b-xl flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
              {/* Batch Aggregates Summary */}
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <span className="font-semibold text-muted-foreground">
                  Total Entries: <strong className="text-foreground">{ledgerRows.length}</strong>
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="font-semibold text-muted-foreground">
                  Debits: <strong className="text-foreground">₹{formatINR(ledgerRows.reduce((a, b) => a + (Number(b.debit) || 0), 0), 2)}</strong>
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="font-semibold text-muted-foreground">
                  Credits: <strong className="text-emerald-600">₹{formatINR(ledgerRows.reduce((a, b) => a + (Number(b.credit) || 0), 0), 2)}</strong>
                </span>
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddLedgerOpen(false)}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  type="button"
                  onClick={handleAddLedgerTxns}
                  disabled={isPending}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white h-8 text-xs font-semibold gap-1.5 shadow-sm"
                >
                  {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                  Save {ledgerRows.length > 1 ? `All (${ledgerRows.length}) Entries` : "Entry"} & Recalculate
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT DAILY LEDGER TRANSACTION MODAL DIALOG */}
      {editingLedgerEntry && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 text-foreground animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <Pencil className="size-4" />
                  Edit Daily Ledger Entry
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Update transaction details, dates, or amounts. Cumulative principal and interest will recalculate automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingLedgerEntry(null)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">Txn Type</label>
                  <select
                    value={editTxnType}
                    onChange={(e) => setEditTxnType(e.target.value as LedgerTxnType)}
                    className="h-8 w-full rounded-md border border-input bg-background px-3 text-xs font-medium"
                  >
                    <option value="Collection">Collection (Credit)</option>
                    <option value="Disbursement">Disbursement (Debit)</option>
                    <option value="Broken Interest">⚡ Broken Period Interest</option>
                    <option value="Interest">📅 Monthly Interest (Debit / Payment)</option>
                    <option value="Tds">Tds (TDS Asset Credit)</option>
                    <option value="Penal">Penal Interest</option>
                    <option value="Charges">Charges / Fees</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">Txn Date (Booking)</label>
                  <Input
                    type="date"
                    value={editTxnDate}
                    onChange={(e) => setEditTxnDate(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-indigo-600 dark:text-indigo-400">Value Date (Effective Accrual)</label>
                  <Input
                    type="date"
                    value={editValueDate}
                    onChange={(e) => setEditValueDate(e.target.value)}
                    className="h-8 text-xs font-mono font-semibold border-indigo-400/50 bg-indigo-50/20 dark:bg-indigo-950/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">Narration / Description</label>
                  <Input
                    value={editNarration}
                    onChange={(e) => setEditNarration(e.target.value)}
                    placeholder="e.g. Collection, RTGS, TDS Assets"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-muted-foreground">Debit Amount (₹)</label>
                    <div className="flex items-center gap-1">
                      {brokenPeriodDays > 0 && brokenPeriodInterest > 0 && (
                        <button
                          type="button"
                          onClick={() => setEditDebit(brokenPeriodInterest)}
                          className="text-[9px] text-amber-700 dark:text-amber-300 font-semibold hover:underline"
                          title="Use Broken Period Interest"
                        >
                          Broken: ₹{formatINR(brokenPeriodInterest, 0)}
                        </button>
                      )}
                      {latestSegmentAccruedInterest > 0 && (
                        <button
                          type="button"
                          onClick={() => setEditDebit(Math.round(latestSegmentAccruedInterest * 100) / 100)}
                          className="text-[9px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                          title="Use Accrued Interest"
                        >
                          Accrued: ₹{formatINR(latestSegmentAccruedInterest, 0)}
                        </button>
                      )}
                    </div>
                  </div>
                  <Input
                    type="number"
                    value={editDebit || ""}
                    onChange={(e) => setEditDebit(Number(e.target.value) || 0)}
                    placeholder="0.00"
                    className="h-8 text-xs font-mono font-bold"
                  />
                  <span className="text-[10px] text-muted-foreground">Increases principal balance</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-muted-foreground">Credit Amount (₹)</label>
                    {(suggestedDueAmount > 0 || latestSegmentAccruedInterest > 0) && (
                      <button
                        type="button"
                        onClick={() => setEditCredit(suggestedDueAmount > 0 ? suggestedDueAmount : Math.round(latestSegmentAccruedInterest * 100) / 100)}
                        className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                        title="Use Due/Accrued Amount"
                      >
                        Due: ₹{formatINR(suggestedDueAmount > 0 ? suggestedDueAmount : latestSegmentAccruedInterest, 0)}
                      </button>
                    )}
                  </div>
                  <Input
                    type="number"
                    value={editCredit || ""}
                    onChange={(e) => setEditCredit(Number(e.target.value) || 0)}
                    placeholder="0.00"
                    className="h-8 text-xs font-mono font-bold text-emerald-600"
                  />
                  <span className="text-[10px] text-muted-foreground">Reduces principal balance</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">Reference / UTR</label>
                  <Input
                    value={editRef}
                    onChange={(e) => setEditRef(e.target.value)}
                    placeholder="e.g. UTR12345678"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">Bank Name</label>
                  <Input
                    value={editBank}
                    onChange={(e) => setEditBank(e.target.value)}
                    placeholder="e.g. Axis Bank"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-[11px] text-indigo-900 dark:text-indigo-200 space-y-1">
                <span className="font-bold block flex items-center gap-1">
                  <Sparkles className="size-3 text-indigo-600" />
                  Auto-segment calculation:
                </span>
                <p>
                  Saving these changes will automatically re-sort the chronological ledger by Value Date, adjust days between transactions, and recalculate daily interest at {summary.config.roiPercent}% p.a.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingLedgerEntry(null)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                type="button"
                onClick={handleUpdateLedgerEntry}
                disabled={isPending}
                className="bg-indigo-600 hover:bg-indigo-500 text-white h-8 text-xs font-semibold gap-1.5 shadow-sm"
              >
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                Save Changes & Recalculate
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* BOUNCE TRANSACTION MODAL DIALOG */}
      {bouncingTx && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 text-foreground">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-4" />
                Record Cheque / NACH Bounce
              </h3>
              <button
                onClick={() => setBouncingTx(null)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-muted-foreground">
                Marking receipt <strong>{bouncingTx.receiptNumber}</strong> (₹{formatINR(bouncingTx.amount)}) as Bounced will revert all paid balances and auto-apply ₹1,000 bounce fee + penal interest.
              </p>

              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Bounce Reason</label>
                <select
                  value={bounceReason}
                  onChange={(e) => setBounceReason(e.target.value)}
                  className="h-8 w-full rounded-md border border-input bg-background px-3 text-xs font-medium"
                >
                  <option value="Insufficient Funds">Insufficient Funds</option>
                  <option value="Payment Stopped by Drawer">Payment Stopped by Drawer</option>
                  <option value="Account Closed">Account Closed</option>
                  <option value="Signature Mismatch">Signature Mismatch</option>
                  <option value="Mandate Not Registered">Mandate Not Registered</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBouncingTx(null)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmBounce}
                disabled={isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-8 text-xs font-semibold gap-1"
              >
                {isPending ? <Loader2 className="size-3 animate-spin" /> : <XCircle className="size-3" />}
                Confirm Bounce & Apply Penalty
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
