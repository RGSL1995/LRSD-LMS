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
  type AccruedInterestEntry,
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
  updateAccruedReceiptAction,
  deleteAccruedReceiptAction,
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
  Trash2,
  Pencil,
  Download,
  PlusCircle,
  Copy,
} from "lucide-react";

interface RepaymentClientProps {
  applicationId: string;
  initialSummary: LoanServicingSummary;
}

type TabKey = "actual_schedule" | "daily_ledger" | "accrued_interest" | "schedule" | "transactions" | "simulator" | "statement";

function normalizeDueDateToSeventh(dateValue: string): string {
  const [year, month] = dateValue.split("-");
  return year && month ? `${year}-${month}-07` : dateValue;
}

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

  // Full 30-day and 31-day estimated monthly interest on active cumulative principal
  const fullMonth30dInterest = Math.round((activeCumulativePrincipal * (summary.config.roiPercent / 100) * 30) / 365);

  // Intelligent suggested collection / due amount
  const suggestedDueAmount =
    summary.accruedInterestOutstanding > 0
      ? summary.accruedInterestOutstanding
      : latestSegmentAccruedInterest > 0
      ? latestSegmentAccruedInterest
      : summary.nextDueAmount > 0
      ? summary.nextDueAmount
      : fullMonth30dInterest;

  // Latest pending due amount (overdue or upcoming installment due)
  
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
    targetDueDate: string;
  }

  const [isAddLedgerOpen, setIsAddLedgerOpen] = useState(false);
  const [ledgerRows, setLedgerRows] = useState<LedgerRowDraft[]>([]);

  const createDefaultLedgerRow = (prefillCredit: number = 0, defaultType: LedgerTxnType = "Other"): LedgerRowDraft => {
    const today = new Date().toISOString().split("T")[0];
    const initialCredit = prefillCredit > 0 ? prefillCredit : suggestedDueAmount;
    const initialDebit =
      defaultType === "Disbursement"
        ? (prefillCredit || activeCumulativePrincipal)
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
          ? "Accrued interest receipt"
          : "Ledger adjustment",
      debit: defaultType === "Disbursement" ? initialDebit : 0,
      credit:
        defaultType === "Collection" || defaultType === "Principal" || defaultType === "Interest"
          ? initialCredit
          : defaultType === "Tds"
          ? Math.round(initialCredit * 0.1)
          : 0,
      autoSplitTds: false,
      tdsRatePercent: 10,
      referenceNumber: "",
      bankName: "",
      targetDueDate: summary.accruedInterestLedger.find((entry) => entry.txnType === "Interest Transfer" && (entry.outstanding || 0) > 0)?.dueDate || selectedDueDate,
    };
  };

  // Helper to open Add Daily Ledger Modal with latest due prefilled and editable
  const openAddLedgerModal = () => {
    setActionMessage(null);
    setLedgerRows([createDefaultLedgerRow(0, "Other")]);
    setIsAddLedgerOpen(true);
  };

  const addAnotherLedgerRow = () => {
    setLedgerRows((prev) => [...prev, createDefaultLedgerRow(0, "Other")]);
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
          updated.autoSplitTds = false;
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
            updated.narration = "Accrued interest receipt";
            updated.debit = 0;
            updated.credit = summary.accruedInterestOutstanding;
          } else if (updates.txnType === "Tds") {
            updated.narration = "TDS Assets";
            updated.credit = Math.round(suggestedDueAmount * 0.1);
            updated.debit = 0;
          } else {
            updated.narration = `${updates.txnType} adjustment`;
            updated.debit = 0;
            updated.credit = 0;
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
  const [editingAccruedReceipt, setEditingAccruedReceipt] = useState<AccruedInterestEntry | null>(null);
  const [receiptEditDate, setReceiptEditDate] = useState("");
  const [receiptEditDueDate, setReceiptEditDueDate] = useState("");
  const [receiptEditAmount, setReceiptEditAmount] = useState(0);
  const [receiptEditReference, setReceiptEditReference] = useState("");
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
    if (!paymentDate || !selectedDueDate) {
      setActionMessage({ text: "Select the payment and due dates.", isError: true });
      return;
    }
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
      if ((Number(row.debit) || 0) <= 0 && (Number(row.credit) || 0) <= 0) {
        setActionMessage({ text: `Entry #${i + 1}: Enter a debit or credit amount.`, isError: true });
        return;
      }
      if ((Number(row.debit) || 0) > 0 && (Number(row.credit) || 0) > 0) {
        setActionMessage({ text: `Entry #${i + 1}: Use one side of the entry, debit or credit.`, isError: true });
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
          targetDueDate: row.credit > 0 && ["Interest", "Broken Interest", "Broken Period", "Tds"].includes(row.txnType)
            ? normalizeDueDateToSeventh(row.targetDueDate)
            : undefined,
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

  const openEditAccruedReceipt = (entry: AccruedInterestEntry) => {
    const transaction = summary.transactions.find((item) => item.id === entry.repaymentId);
    setActionMessage(null);
    setEditingAccruedReceipt(entry);
    setReceiptEditDate(transaction?.paymentDate || entry.date);
    setReceiptEditDueDate(entry.dueDate || transaction?.targetDueDate || "");
    setReceiptEditAmount(transaction?.amount || entry.credit);
    setReceiptEditReference(transaction?.referenceNumber || entry.referenceNumber || "");
  };

  const handleUpdateAccruedReceipt = () => {
    if (!editingAccruedReceipt) return;
    setActionMessage(null);
    startTransition(async () => {
      const result = await updateAccruedReceiptAction(
        applicationId,
        editingAccruedReceipt.repaymentId,
        editingAccruedReceipt.sourceLedgerEntryId,
        {
          paymentDate: receiptEditDate,
          targetDueDate: receiptEditDueDate,
          amount: Number(receiptEditAmount),
          referenceNumber: receiptEditReference || undefined,
        },
      );
      if (result.success) {
        setEditingAccruedReceipt(null);
        window.location.reload();
      } else {
        setActionMessage({ text: result.error || "Failed to update receipt.", isError: true });
      }
    });
  };

  const handleDeleteAccruedReceipt = (entry: AccruedInterestEntry) => {
    if (!confirm("Delete this receipt? Its accrued-interest debit will become outstanding again.")) return;
    setActionMessage(null);
    startTransition(async () => {
      const result = await deleteAccruedReceiptAction(applicationId, entry.repaymentId, entry.sourceLedgerEntryId);
      if (result.success) {
        window.location.reload();
      } else {
        setActionMessage({ text: result.error || "Failed to delete receipt.", isError: true });
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
      case "Interest Offset":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30">Interest Offset</span>;
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
                setActionMessage(null);
                const targetDue = summary.nextDueAmount || summary.schedules.find((s) => s.status !== "paid")?.totalDue || 0;
                setGrossDueInput(targetDue);
                if (tdsMode === "net_of_tds") {
                  const tds = Math.round(targetDue * (tdsRatePercent / 100));
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
          onClick={() => setActiveTab("accrued_interest")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
            activeTab === "accrued_interest"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          }`}
        >
          <Receipt className="size-4" />
          3. Accrued Interest Account ({summary.accruedInterestLedger.length})
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
          4. Projected Amortization Schedule ({summary.schedules.length})
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
          5. Payment History & Receipts ({summary.transactions.length})
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
          6. Schedule Config & Calculator
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
          7. Statement of Account
        </button>
      </div>

      {/* UPDATED EMI SCHEDULE - AS ACTUAL */}
      {activeTab === "actual_schedule" && (
        <Card className="border shadow-xs">
          <CardHeader className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <FileSpreadsheet className="size-4 text-primary" />
                Updated EMI Schedule · As Actual
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                Monthly dues and receipts. Posted interest is grouped by its due date on the 7th.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setActiveTab("daily_ledger")} className="h-8 text-xs">Daily ledger</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setActiveTab("accrued_interest")} className="h-8 text-xs">Accrued interest</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 gap-3 border-b px-5 py-4 text-xs sm:grid-cols-4">
              <div><span className="block text-muted-foreground">Periods</span><strong className="mt-1 block text-sm">{summary.actualSchedules.length}</strong></div>
              <div><span className="block text-muted-foreground">Interest received</span><strong className="mt-1 block text-sm">₹{formatINR(summary.totalInterestPaid, 2)}</strong></div>
              <div><span className="block text-muted-foreground">Accrued interest open</span><strong className="mt-1 block text-sm">₹{formatINR(summary.accruedInterestOutstanding, 2)}</strong></div>
              <div><span className="block text-muted-foreground">Principal outstanding</span><strong className="mt-1 block text-sm">₹{formatINR(summary.currentPrincipalOutstanding, 2)}</strong></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Period</th>
                    <th className="px-4 py-3 font-medium">Due date</th>
                    <th className="px-4 py-3 text-right font-medium">Regular interest</th>
                    <th className="px-4 py-3 text-right font-medium">Late charge</th>
                    <th className="px-4 py-3 text-right font-medium">Total interest due</th>
                    <th className="px-4 py-3 text-right font-medium">Interest received</th>
                    <th className="px-4 py-3 text-right font-medium">Interest open</th>
                    <th className="px-4 py-3 text-right font-medium">Principal due</th>
                    <th className="px-4 py-3 text-right font-medium">Principal received</th>
                    <th className="px-4 py-3 text-right font-medium">Principal outstanding</th>
                    <th className="px-4 py-3 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {summary.actualSchedules.length === 0 ? (
                    <tr><td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">No schedule periods are available yet.</td></tr>
                  ) : summary.actualSchedules.map((row) => (
                    <tr key={row.periodKey} className="hover:bg-muted/20">
                      <td className="whitespace-nowrap px-4 py-3 font-medium">{row.brokerPeriod}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{row.dueDate ? formatDateDDMMYYYY(row.dueDate) : "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono">{row.regularInterestDue > 0 ? `₹${formatINR(row.regularInterestDue, 2)}` : "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-amber-700 dark:text-amber-400">{row.lateInterestDue > 0 ? `₹${formatINR(row.lateInterestDue, 2)}` : "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-medium">{row.interestDue > 0 ? `₹${formatINR(row.interestDue, 2)}` : "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono">{row.interestRecvd > 0 ? `₹${formatINR(row.interestRecvd, 2)}` : "—"}</td>
                      <td className={`whitespace-nowrap px-4 py-3 text-right font-mono ${row.overdue > 0 ? "font-semibold text-destructive" : ""}`}>{row.openInterest > 0 ? `₹${formatINR(row.openInterest, 2)}` : "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono">{row.principalDue > 0 ? `₹${formatINR(row.principalDue, 2)}` : "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono">{row.principalRecvd > 0 ? `₹${formatINR(row.principalRecvd, 2)}` : "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold">₹{formatINR(row.outstanding, 2)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        {renderInstallmentStatus(row.status)}
                        {row.dpd > 0 && <span className="ml-1 text-[10px] text-muted-foreground">· {row.dpd} DPD</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t px-5 py-3 text-xs text-muted-foreground">
              Future regular interest uses the schedule until it is posted. A late receipt adds its charge to the closing debit for that receipt month, due on the next 7th.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ACCRUED INTEREST ACCOUNT */}
      {activeTab === "accrued_interest" && (
        <Card className="shadow-xs border">
          <CardContent className="p-0">
            <div id="accrued-interest-account" className="p-4 pt-6 space-y-3">
              {actionMessage?.isError && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{actionMessage.text}</p>}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold">Accrued Interest Account</h3>
                  <p className="text-xs text-muted-foreground">
                    Month-end interest transfers are debits; borrower receipts are credits. Interest is due on the 7th.
                  </p>
                </div>
                <div className="flex flex-wrap gap-4 text-xs">
                  <span>Outstanding: <strong>₹{formatINR(summary.accruedInterestOutstanding, 2)}</strong></span>
                  <span>Late charge awaiting month-end: <strong>₹{formatINR(summary.lateInterestCarryForward, 2)}</strong></span>
                </div>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/70 border-b border-border text-[11px] font-bold">
                      <th className="p-2.5 border-r">Date</th>
                      <th className="p-2.5 border-r">Txn Type</th>
                      <th className="p-2.5 border-r min-w-48">Narration</th>
                      <th className="p-2.5 border-r">Txn Date</th>
                      <th className="p-2.5 border-r">Value Date</th>
                      <th className="p-2.5 border-r text-right">Debit</th>
                      <th className="p-2.5 border-r text-right">Credit</th>
                      <th className="p-2.5 border-r text-right">Cumulative</th>
                      <th className="p-2.5 border-r">Due Date</th>
                      <th className="p-2.5 border-r text-center">DPD</th>
                      <th className="p-2.5 text-right">Late Interest</th>
                      <th className="p-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono">
                    {summary.accruedInterestLedger.length === 0 ? (
                      <tr><td colSpan={12} className="p-5 text-center text-muted-foreground font-sans">No accrued-interest postings yet.</td></tr>
                    ) : summary.accruedInterestLedger.map((entry) => (
                      <tr key={entry.id} className="hover:bg-muted/30">
                        <td className="p-2.5 border-r whitespace-nowrap">{formatDateDDMMYYYY(entry.date)}</td>
                        <td className="p-2.5 border-r font-sans">{entry.txnType}</td>
                        <td className="p-2.5 border-r font-sans">{entry.narration}</td>
                        <td className="p-2.5 border-r whitespace-nowrap">{formatDateDDMMYYYY(entry.txnDate)}</td>
                        <td className="p-2.5 border-r whitespace-nowrap">{formatDateDDMMYYYY(entry.valueDate)}</td>
                        <td className="p-2.5 border-r text-right">{entry.debit > 0 ? formatINR(entry.debit, 2) : ""}</td>
                        <td className="p-2.5 border-r text-right">{entry.credit > 0 ? formatINR(entry.credit, 2) : ""}</td>
                        <td className="p-2.5 border-r text-right font-bold">{formatINR(entry.cumulative, 2)}</td>
                        <td className="p-2.5 border-r whitespace-nowrap">{entry.dueDate ? formatDateDDMMYYYY(entry.dueDate) : ""}</td>
                        <td className={`p-2.5 border-r text-center ${entry.dpd > 0 ? "text-amber-700 font-bold" : "text-muted-foreground"}`}>{entry.dpd || 0}</td>
                        <td className="p-2.5 text-right">{entry.lateInterest > 0 ? formatINR(entry.lateInterest, 2) : ""}</td>
                        <td className="p-2.5 text-center font-sans whitespace-nowrap">
                          {entry.txnType === "Payment Receipt" && (entry.repaymentId || entry.sourceLedgerEntryId) && (
                            <div className="flex justify-center gap-1">
                              <button type="button" onClick={() => openEditAccruedReceipt(entry)} disabled={isPending} title="Edit receipt" aria-label="Edit receipt" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="size-3.5" /></button>
                              <button type="button" onClick={() => handleDeleteAccruedReceipt(entry)} disabled={isPending} title="Delete receipt" aria-label="Delete receipt" className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-3.5" /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                  DAY-COUNT ACCRUAL ({summary.config.dayCountConvention === "actual_365" ? "ACTUAL / 365" : "30 / 360"})
                </span>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Table className="size-4 text-indigo-600" />
                  Daily Running Interest & Transaction Segment Ledger
                </CardTitle>
              </div>
              <CardDescription className="text-xs mt-1">
                Value-dated principal movements and month-end interest at {summary.config.roiPercent}% p.a.; interest transfers are due on the 7th.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveTab("accrued_interest")}
                className="h-8 text-xs"
              >
                Manage receipts
              </Button>
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
                    <th className="p-3 border-r w-28">Date</th>
                    <th className="p-3 border-r w-28">Txn Type</th>
                    <th className="p-3 border-r min-w-40">Narration</th>
                    <th className="p-3 border-r w-28">Txn Date</th>
                    <th className="p-3 border-r w-28">Value Date</th>
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
                      <td colSpan={11} className="p-8 text-center text-muted-foreground font-sans text-xs">
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
                          <td className="p-3 border-r whitespace-nowrap text-foreground font-mono">
                            {formatDateDDMMYYYY(entry.date || valueDisplayDate)}
                          </td>
                          <td className="p-3 border-r font-sans">{renderTxnTypeBadge(entry.txnType)}</td>
                          <td className="p-3 border-r font-sans text-foreground">
                            <div className="font-medium">{entry.narration || "-"}</div>
                            {(entry.referenceNumber || entry.bankName) && (
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {[entry.referenceNumber, entry.bankName].filter(Boolean).join(" • ")}
                              </div>
                            )}
                          </td>
                          <td className="p-3 border-r whitespace-nowrap text-foreground font-mono">
                            {formatDateDDMMYYYY(txnDisplayDate)}
                          </td>
                          <td className="p-3 border-r whitespace-nowrap text-indigo-950 dark:text-indigo-200 bg-indigo-50/40 dark:bg-indigo-950/20 font-semibold font-mono">
                            {formatDateDDMMYYYY(valueDisplayDate)}
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
                            {entry.systemGenerated || entry.sourceReceiptNumber ? (
                              <span className="text-[10px] font-semibold text-muted-foreground">
                                {entry.sourceReceiptNumber ? "Recorded receipt" : entry.action || "Auto"}
                              </span>
                            ) : <div className="flex items-center justify-center gap-1">
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
                            </div>}
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
                      <td colSpan={5} className="p-3 border-r text-right font-sans font-bold">
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

      {/* RECORD COLLECTION */}
      {isRecordPaymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border bg-card shadow-xl">
            <div className="flex items-start justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-base font-semibold">Record collection</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Apply a borrower receipt to loan dues.</p>
              </div>
              <button type="button" onClick={() => setIsRecordPaymentOpen(false)} aria-label="Close" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">✕</button>
            </div>

            <div className="space-y-5 overflow-y-auto px-5 py-4 text-sm">
              {actionMessage?.isError && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{actionMessage.text}</p>}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Payment date</label>
                  <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Due date (7th)</label>
                  <Input type="date" value={selectedDueDate} onChange={(e) => setSelectedDueDate(normalizeDueDateToSeventh(e.target.value))} className="h-9 text-sm" />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-xs">
                <span className="text-muted-foreground">Days past due</span>
                {renderDpdBadge(modalCalculatedDpd)}
              </div>

              <div className="space-y-3 border-t pt-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">TDS treatment</label>
                  <select
                    value={tdsMode}
                    onChange={(e) => {
                      const mode = e.target.value as "net_of_tds" | "gross_no_tds";
                      setTdsMode(mode);
                      if (mode === "net_of_tds") {
                        const tds = Math.round(grossDueInput * (tdsRatePercent / 100));
                        setCustomTdsAmount(tds);
                        setPaymentAmount(grossDueInput - tds);
                      } else {
                        setCustomTdsAmount(0);
                        setPaymentAmount(grossDueInput);
                      }
                    }}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="gross_no_tds">No TDS</option>
                    <option value="net_of_tds">TDS deducted</option>
                  </select>
                </div>
                {isTdsEnabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Gross interest (₹)</label>
                      <Input type="number" min="0" value={grossDueInput} onChange={(e) => handleGrossChange(Number(e.target.value) || 0)} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">TDS rate (%)</label>
                      <Input
                        type="number"
                        min="0"
                        max="99"
                        value={tdsRatePercent}
                        onChange={(e) => {
                          const rate = Math.max(0, Math.min(99, Number(e.target.value) || 0));
                          setTdsRatePercent(rate);
                          const tds = Math.round(grossDueInput * (rate / 100));
                          setCustomTdsAmount(tds);
                          setPaymentAmount(grossDueInput - tds);
                        }}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Amount received in bank (₹)</label>
                  <Input type="number" min="0" value={paymentAmount} onChange={(e) => handleNetChange(Number(e.target.value) || 0)} className="h-9 text-sm" />
                </div>
                {isTdsEnabled && <p className="text-xs text-muted-foreground">TDS credit: ₹{formatINR(effectiveTdsAmount, 2)} · Gross receipt: ₹{formatINR(effectiveGrossAmount, 2)}</p>}
              </div>

              <div className="grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Collection mode</label>
                  <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as PaymentMethod)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="RTGS">RTGS</option>
                    <option value="NEFT">NEFT</option>
                    <option value="NACH">NACH</option>
                    <option value="PDC">PDC</option>
                    <option value="Cheque">Cheque</option>
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Internal Transfer">Internal Transfer</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Payment type</label>
                  <select value={paymentType} onChange={(e) => setPaymentType(e.target.value as PaymentType)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="regular_installment">Regular installment</option>
                    <option value="part_prepayment">Part prepayment</option>
                    <option value="cash_top_up">Cash top up</option>
                    <option value="foreclosure">Foreclosure</option>
                    <option value="penal_settlement">Penal settlement</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">UTR / reference</label>
                  <Input value={refNumber} onChange={(e) => setRefNumber(e.target.value)} placeholder="Optional" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Bank</label>
                  <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Optional" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium">Notes</label>
                  <Input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Optional" className="h-9 text-sm" />
                </div>
              </div>

              <div className="rounded-md border bg-muted/30 p-3 text-xs">
                <div className="mb-2 font-medium">Receipt allocation</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                  <span>Accrued interest</span><span className="text-right font-medium text-foreground">₹{formatINR(liveAllocation.allocatedInterest, 2)}</span>
                  <span>Principal</span><span className="text-right font-medium text-foreground">₹{formatINR(liveAllocation.allocatedPrincipal, 2)}</span>
                  <span>Other dues</span><span className="text-right font-medium text-foreground">₹{formatINR(liveAllocation.allocatedPenal + liveAllocation.allocatedCharges, 2)}</span>
                  <span>Accrued balance after receipt</span><span className="text-right font-medium text-foreground">₹{formatINR(Math.max(0, summary.accruedInterestOutstanding - liveAllocation.allocatedInterest), 2)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-5 py-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsRecordPaymentOpen(false)}>Cancel</Button>
              <Button type="button" size="sm" onClick={handleRecordPayment} disabled={isPending}>
                {isPending && <Loader2 className="mr-2 size-3.5 animate-spin" />}
                Record collection
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ADD LEDGER TRANSACTION */}
      {isAddLedgerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border bg-card shadow-xl">
            <div className="flex items-start justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-base font-semibold">Add ledger transaction</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">For ledger adjustments. Record borrower payments through Record Collection.</p>
              </div>
              <button type="button" onClick={() => setIsAddLedgerOpen(false)} aria-label="Close" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">✕</button>
            </div>

            <div className="space-y-3 overflow-y-auto px-5 py-4">
              {actionMessage?.isError && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{actionMessage.text}</p>}
              {ledgerRows.map((row, index) => {
                const isInterestReceipt = ["Interest", "Broken Interest", "Broken Period", "Tds"].includes(row.txnType) && row.credit > 0;
                const canSplitTds = ["Interest", "Broken Interest", "Broken Period"].includes(row.txnType) && row.credit > 0;
                const rowTdsAmount = row.autoSplitTds ? Math.round(row.credit * (row.tdsRatePercent / 100)) : 0;
                return (
                  <div key={row.id} className="rounded-lg border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold">Entry {index + 1}</span>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => duplicateLedgerRow(row.id)} title="Duplicate entry" aria-label="Duplicate entry" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Copy className="size-3.5" /></button>
                        {ledgerRows.length > 1 && <button type="button" onClick={() => removeLedgerRow(row.id)} title="Remove entry" aria-label="Remove entry" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="size-3.5" /></button>}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Transaction type</label>
                        <select value={row.txnType} onChange={(e) => updateLedgerRow(row.id, { txnType: e.target.value as LedgerTxnType })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                          <option value="Other">Other adjustment</option>
                          <option value="Disbursement">Disbursement</option>
                          <option value="Collection">Principal collection</option>
                          <option value="Interest">Interest debit / receipt</option>
                          <option value="Broken Interest">Broken period interest</option>
                          <option value="Tds">TDS credit</option>
                          <option value="Penal">Penal interest</option>
                          <option value="Charges">Charges</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Transaction date</label>
                        <Input type="date" value={row.txnDate} onChange={(e) => updateLedgerRow(row.id, { txnDate: e.target.value })} className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Value date</label>
                        <Input type="date" value={row.valueDate} onChange={(e) => updateLedgerRow(row.id, { valueDate: e.target.value })} className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Narration</label>
                        <Input value={row.narration} onChange={(e) => updateLedgerRow(row.id, { narration: e.target.value })} className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Debit (₹)</label>
                        <Input type="number" min="0" value={row.debit || ""} onChange={(e) => updateLedgerRow(row.id, { debit: Number(e.target.value) || 0 })} placeholder="0" className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Credit (₹)</label>
                        <Input type="number" min="0" value={row.credit || ""} onChange={(e) => updateLedgerRow(row.id, { credit: Number(e.target.value) || 0 })} placeholder="0" className="h-9 text-sm" />
                      </div>
                      {isInterestReceipt && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Interest due date (7th)</label>
                          <Input type="date" value={row.targetDueDate} onChange={(e) => updateLedgerRow(row.id, { targetDueDate: normalizeDueDateToSeventh(e.target.value) })} className="h-9 text-sm" />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">UTR / reference</label>
                        <Input value={row.referenceNumber} onChange={(e) => updateLedgerRow(row.id, { referenceNumber: e.target.value })} placeholder="Optional" className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Bank</label>
                        <Input value={row.bankName} onChange={(e) => updateLedgerRow(row.id, { bankName: e.target.value })} placeholder="Optional" className="h-9 text-sm" />
                      </div>
                    </div>
                    {canSplitTds && (
                      <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3 text-xs">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={row.autoSplitTds} onChange={(e) => updateLedgerRow(row.id, { autoSplitTds: e.target.checked })} />
                          Split TDS from interest receipt
                        </label>
                        {row.autoSplitTds && (
                          <>
                            <Input type="number" min="0" max="100" value={row.tdsRatePercent} onChange={(e) => updateLedgerRow(row.id, { tdsRatePercent: Number(e.target.value) || 0 })} className="h-8 w-20 text-xs" />
                            <span className="text-muted-foreground">TDS ₹{formatINR(rowTdsAmount, 2)} · Bank ₹{formatINR(row.credit - rowTdsAmount, 2)}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <Button type="button" variant="outline" size="sm" onClick={addAnotherLedgerRow} className="w-full border-dashed"><Plus className="mr-2 size-3.5" />Add another entry</Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
              <p className="text-xs text-muted-foreground">
                {ledgerRows.length} {ledgerRows.length === 1 ? "entry" : "entries"} · Debit ₹{formatINR(ledgerRows.reduce((sum, row) => sum + (Number(row.debit) || 0), 0), 2)} · Credit ₹{formatINR(ledgerRows.reduce((sum, row) => sum + (Number(row.credit) || 0), 0), 2)}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAddLedgerOpen(false)}>Cancel</Button>
                <Button type="button" size="sm" onClick={handleAddLedgerTxns} disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 size-3.5 animate-spin" />}
                  Save {ledgerRows.length === 1 ? "entry" : "entries"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT ACCRUED INTEREST RECEIPT */}
      {editingAccruedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-base font-semibold">Edit accrued receipt</h3>
              <button type="button" onClick={() => setEditingAccruedReceipt(null)} aria-label="Close" className="rounded p-1 text-muted-foreground hover:bg-muted">✕</button>
            </div>
            <div className="space-y-4 px-5 py-4 text-sm">
              {actionMessage?.isError && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{actionMessage.text}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label className="text-xs font-medium">Payment date</label><Input type="date" value={receiptEditDate} onChange={(e) => setReceiptEditDate(e.target.value)} className="h-9 text-sm" /></div>
                <div className="space-y-1.5"><label className="text-xs font-medium">Due date (7th)</label><Input type="date" value={receiptEditDueDate} onChange={(e) => setReceiptEditDueDate(normalizeDueDateToSeventh(e.target.value))} className="h-9 text-sm" /></div>
              </div>
              <div className="space-y-1.5"><label className="text-xs font-medium">Receipt amount (₹)</label><Input type="number" min="0.01" step="0.01" value={receiptEditAmount} onChange={(e) => setReceiptEditAmount(Number(e.target.value) || 0)} disabled={summary.transactions.some((item) => item.id === editingAccruedReceipt.repaymentId && item.allocatedPrincipal + item.allocatedPenal + item.allocatedCharges > 0)} className="h-9 text-sm" /></div>
              <div className="space-y-1.5"><label className="text-xs font-medium">UTR / reference</label><Input value={receiptEditReference} onChange={(e) => setReceiptEditReference(e.target.value)} placeholder="Optional" className="h-9 text-sm" /></div>
              {editingAccruedReceipt.repaymentId && (() => {
                const tx = summary.transactions.find((item) => item.id === editingAccruedReceipt.repaymentId);
                return tx && (tx.allocatedPrincipal > 0 || tx.allocatedPenal > 0 || tx.allocatedCharges > 0)
                  ? <p className="text-xs text-muted-foreground">This receipt also settles other dues. Its amount cannot be changed here.</p>
                  : null;
              })()}
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingAccruedReceipt(null)}>Cancel</Button>
              <Button type="button" size="sm" onClick={handleUpdateAccruedReceipt} disabled={isPending}>{isPending && <Loader2 className="mr-2 size-3.5 animate-spin" />}Save receipt</Button>
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
