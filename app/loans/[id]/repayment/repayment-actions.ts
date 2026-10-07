"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  generateSchedule,
  generateBulletSchedule,
  generateEmiSchedule,
  generateMoratoriumSchedule,
  allocatePaymentWaterfall,
  calculateDpdAndSma,
  calculateInstallmentDpd,
  calculateInterestForDueMonth,
  computeDailyInterestLedger,
  createMonthEndInterestEntries,
  calculateLateInterestByPostingMonth,
  buildAccruedInterestLedger,
  getAccruedInterestBalance,
  computeActualMonthlySchedule,
  evaluateInstallmentStatus,
  formatDateISO,
  getDaysDifference,
} from "@/lib/repayment-engine";
import {
  type LoanServicingSummary,
  type LoanServicingConfig,
  type InstallmentItem,
  type RepaymentTransaction,
  type RecordPaymentInput,
  type DailyLedgerEntry,
  type AccruedInterestEntry,
  type ActualMonthlyScheduleItem,
  type AddLedgerTxnInput,
  type AccruedReceiptEditInput,
  type LedgerTxnType,
} from "./repayment-types";

function unwrapRelation<T>(val: T | T[] | null | undefined): T | null {
  if (!val) return null;
  return Array.isArray(val) ? val[0] ?? null : val;
}

function dueOnSeventhOfMonth(dateValue: string): string {
  const [year, month] = dateValue.split("-").map(Number);
  return formatDateISO(new Date(year, month - 1, 7));
}

function seventhAfterMonthEnd(dateValue: string): string {
  const [year, month] = dateValue.split("-").map(Number);
  return formatDateISO(new Date(year, month, 7));
}

function isAccruedReceiptLedgerEntry(entry: { txnType: LedgerTxnType; credit?: number }): boolean {
  return ["Interest", "Broken Interest", "Broken Period", "Tds"].includes(entry.txnType) && Number(entry.credit) > 0;
}


/**
 * Loads the complete Loan Servicing and Repayment summary for a loan application.
 */
export async function getLoanServicingSummary(
  applicationId: string,
): Promise<LoanServicingSummary | null> {
  const supabase = await createClient();

  // 1. Fetch loan application and borrower
  const { data: app, error: appError } = await supabase
    .from("loan_applications")
    .select(`
      id,
      application_code,
      facility_type,
      requested_amount,
      tenure_months,
      purpose,
      borrowers (
        id,
        borrower_code,
        borrower_type,
        pan,
        individual_profiles (
          full_name,
          phone,
          email,
          current_address_line,
          current_city
        ),
        corporate_profiles (
          legal_name,
          trade_name,
          cin,
          gstin
        ),
        other_profiles (
          entity_name
        )
      )
    `)
    .eq("id", applicationId)
    .maybeSingle();

  if (appError || !app) {
    console.error("Failed to load loan application for repayment summary:", appError);
    return null;
  }

  const primary = unwrapRelation(app.borrowers as any);
  const primaryCorp = primary ? unwrapRelation(primary.corporate_profiles as any) : null;
  const primaryInd = primary ? unwrapRelation(primary.individual_profiles as any) : null;
  const primaryOth = primary ? unwrapRelation(primary.other_profiles as any) : null;
  const borrowerName = primaryCorp?.legal_name || primaryInd?.full_name || primaryOth?.entity_name || primary?.borrower_code || "Borrower";

  // 2. Fetch Sanction letter if available (to sync commercial terms)
  let sanctionDoc: any = null;
  try {
    const { data } = await supabase
      .from("sanction_documents")
      .select("*")
      .eq("loan_application_id", applicationId)
      .maybeSingle();
    sanctionDoc = data;
  } catch {
    // Table might not exist yet
  }

  // 3. Fetch Servicing Config
  let existingConfig: any = null;
  try {
    const { data } = await supabase
      .from("loan_servicing_configs")
      .select("*")
      .eq("loan_application_id", applicationId)
      .maybeSingle();
    existingConfig = data;
  } catch {
    // Table might not exist yet
  }

  const requestedAmountNum = Number(app.requested_amount) || 50000000;
  const sanctionAmountNum = sanctionDoc?.sanctioned_amount ? Number(sanctionDoc.sanctioned_amount) : requestedAmountNum;
  const tenureMonths = existingConfig?.tenure_months || sanctionDoc?.tenure_months || app.tenure_months || 12;

  const rawConfig = sanctionDoc?.raw_data || {};
  const roiPercent = existingConfig?.roi_percent
    ? Number(existingConfig.roi_percent)
    : rawConfig.roiPercent
    ? Number(rawConfig.roiPercent)
    : 16.0;

  const config: LoanServicingConfig = {
    disbursementDate: existingConfig?.disbursement_date || sanctionDoc?.sanction_date || formatDateISO(new Date()),
    disbursedAmount: existingConfig?.disbursed_amount ? Number(existingConfig.disbursed_amount) : sanctionAmountNum,
    repaymentMode: (existingConfig?.repayment_mode as any) || "bullet",
    roiPercent,
    tenureMonths,
    tenureDays: existingConfig?.tenure_days || tenureMonths * 30 || 365,
    moratoriumMonths: existingConfig?.moratorium_months || 0,
    dayCountConvention: (existingConfig?.day_count_convention as any) || "actual_365",
    penalInterestRate: existingConfig?.penal_interest_rate ? Number(existingConfig.penal_interest_rate) : 2.0,
    bouncingChargeAmount: existingConfig?.bouncing_charge_amount ? Number(existingConfig.bouncing_charge_amount) : 1000.0,
  };

  const now = new Date();

  // 4. Fetch Installment Schedules
  let schedulesData: any[] | null = null;
  try {
    const { data, error } = await supabase
      .from("loan_schedules")
      .select("*")
      .eq("loan_application_id", applicationId)
      .order("installment_number", { ascending: true });
    if (!error) {
      schedulesData = data;
    }
  } catch {
    // Table might not exist yet
  }

  let schedules: InstallmentItem[] = [];

  if (!schedulesData || schedulesData.length === 0) {
    // Generate default initial schedule dynamically
    schedules = generateSchedule(config);
  } else {
    schedules = schedulesData.map((s) => {
      const pPaid = Number(s.principal_paid) || 0;
      const iPaid = Number(s.interest_paid) || 0;
      const penPaid = Number(s.penal_interest_paid) || 0;
      const chgPaid = Number(s.bouncing_charges_paid) || 0;
      const totalPaid = pPaid + iPaid + penPaid + chgPaid;

      const pDue = Number(s.principal_due) || 0;
      const normalizedDueDate = dueOnSeventhOfMonth(s.due_date);
      const correctFutureInterest =
        s.installment_number > 0 &&
        (config.repaymentMode === "bullet" || config.repaymentMode === "moratorium_emi" || config.repaymentMode === "moratorium_equal_principal") &&
        s.status !== "paid" && s.status !== "waived";
      const iDue = correctFutureInterest
        ? calculateInterestForDueMonth(
            normalizedDueDate,
            Number(s.opening_principal) || config.disbursedAmount,
            config.roiPercent,
            config.dayCountConvention,
          )
        : Number(s.interest_due) || 0;
      const penDue = Number(s.penal_interest_due) || 0;
      const chgDue = Number(s.bouncing_charges_due) || 0;
      const totalDue = correctFutureInterest ? pDue + iDue : Number(s.total_due) || pDue + iDue;
      const grandDue = totalDue + penDue + chgDue;

      const item: InstallmentItem = {
        id: s.id,
        installmentNumber: s.installment_number,
        dueDate: s.status === "paid" || s.status === "waived" ? s.due_date : normalizedDueDate,
        periodLabel: s.period_label || `Installment ${s.installment_number}`,
        openingPrincipal: Number(s.opening_principal) || 0,
        principalDue: pDue,
        interestDue: iDue,
        totalDue,
        closingPrincipal: Number(s.closing_principal) || 0,
        principalPaid: pPaid,
        interestPaid: iPaid,
        penalInterestDue: penDue,
        penalInterestPaid: penPaid,
        bouncingChargesDue: chgDue,
        bouncingChargesPaid: chgPaid,
        totalPaid,
        totalBalance: Math.max(0, grandDue - totalPaid),
        status: s.status,
        paidDate: s.paid_date || undefined,
        paymentMode: s.payment_mode || undefined,
        remarks: s.remarks || undefined,
      };

      item.status = evaluateInstallmentStatus(item, now);
      item.dpd = calculateInstallmentDpd(item, now);
      return item;
    });
  }

  // 5. Fetch Transactions / Receipts
  let repaymentsData: any[] | null = null;
  try {
    const { data, error } = await supabase
      .from("loan_repayments")
      .select("*")
      .eq("loan_application_id", applicationId)
      .order("payment_date", { ascending: false });
    if (!error) {
      repaymentsData = data;
    }
  } catch {
    // Table might not exist yet
  }

  const transactions: RepaymentTransaction[] = (repaymentsData || []).map((r) => {
    // Determine target due date and DPD for this transaction
    let targetDueDate = r.target_due_date || undefined;

    if (!targetDueDate) {
      // Find matching schedule or closest due date
      const matchedSchedule = schedules.find((s) => s.dueDate === r.payment_date) ||
        schedules.slice().reverse().find((s) => s.dueDate <= r.payment_date) ||
        schedules[0];
      targetDueDate = dueOnSeventhOfMonth(matchedSchedule?.dueDate || r.payment_date);
    }

    targetDueDate = dueOnSeventhOfMonth(targetDueDate);
    const dpd = r.payment_date > targetDueDate ? getDaysDifference(targetDueDate, r.payment_date) : 0;

    return {
      id: r.id,
      receiptNumber: r.receipt_number,
      paymentDate: r.payment_date,
      targetDueDate,
      dpd: dpd || 0,
      amount: Number(r.amount) || 0,
      allocatedPrincipal: Number(r.allocated_principal) || 0,
      allocatedInterest: Number(r.allocated_interest) || 0,
      allocatedPenal: Number(r.allocated_penal) || 0,
      allocatedCharges: Number(r.allocated_charges) || 0,
      paymentMode: r.payment_mode,
      referenceNumber: r.reference_number || undefined,
      bankName: r.bank_name || undefined,
      paymentType: r.payment_type,
      status: r.status,
      bouncedDate: r.bounced_date || undefined,
      bounceReason: r.bounce_reason || undefined,
      notes: r.notes || undefined,
      createdAt: r.created_at,
    };
  });


  // 6. Build Daily Running Interest & Transaction Segment Ledger (Image 1 & Image 2)
  let rawLedgerEntries: Array<{
    id?: string;
    txnType: LedgerTxnType;
    date?: string;
    txnDate?: string;
    valueDate?: string;
    narration: string;
    debit?: number;
    credit?: number;
    referenceNumber?: string;
    bankName?: string;
    targetDueDate?: string;
    sourceReceiptNumber?: string;
  }> = [];

  const rawConfigJson = existingConfig?.raw_data || {};
  const hasCustomLedger = Boolean(
    rawConfigJson.daily_ledger && Array.isArray(rawConfigJson.daily_ledger) && rawConfigJson.daily_ledger.length > 0
  );

  if (hasCustomLedger) {
    rawLedgerEntries = rawConfigJson.daily_ledger;
  } else {
    // Derive initial ledger from disbursements and repayments
    rawLedgerEntries.push({
      id: "disb_initial",
      txnType: "Disbursement",
      date: config.disbursementDate,
      txnDate: config.disbursementDate,
      valueDate: config.disbursementDate,
      narration: "RTGS (Disbursement)",
      debit: config.disbursedAmount,
      credit: 0,
    });

    for (const tx of transactions) {
      if (tx.status === "cleared") {
        if (tx.allocatedPrincipal > 0) {
          rawLedgerEntries.push({
            id: `repay_${tx.id}_p`,
            txnType: "Principal",
            date: tx.paymentDate,
            txnDate: tx.paymentDate,
            valueDate: tx.paymentDate,
            narration: tx.notes || "Collection",
            debit: 0,
            credit: tx.allocatedPrincipal,
            referenceNumber: tx.referenceNumber,
            bankName: tx.bankName,
          });
        }
      }
    }
  }

  const manualInterestReceipts: RepaymentTransaction[] = (rawLedgerEntries as DailyLedgerEntry[])
    .filter((entry) =>
      isAccruedReceiptLedgerEntry(entry) &&
      !entry.sourceReceiptNumber &&
      !transactions.some((tx) =>
        tx.status === "cleared" &&
        tx.paymentDate === (entry.valueDate || entry.date || entry.txnDate) &&
        tx.allocatedInterest === Number(entry.credit) &&
        (tx.referenceNumber || "") === (entry.referenceNumber || "")
      )
    )
    .map((entry) => ({
      id: `manual-${entry.id}`,
      receiptNumber: `LEDGER-${entry.id}`,
      paymentDate: entry.valueDate || entry.date || entry.txnDate,
      targetDueDate: dueOnSeventhOfMonth(entry.targetDueDate || entry.valueDate || entry.date || entry.txnDate || formatDateISO(now)),
      amount: Number(entry.credit),
      allocatedPrincipal: 0,
      allocatedInterest: Number(entry.credit),
      allocatedPenal: 0,
      allocatedCharges: 0,
      paymentMode: entry.txnType === "Tds" ? "TDS Credit" as const : "Internal Transfer" as const,
      referenceNumber: entry.referenceNumber,
      bankName: entry.bankName,
      paymentType: "regular_installment" as const,
      status: "cleared" as const,
      createdAt: entry.txnDate || entry.date || formatDateISO(now),
    }));
  const accruedReceipts = [...transactions, ...manualInterestReceipts];

  // Cash interest and TDS settle the accrued account. They are kept in the
  // source JSON for historical reconciliation but are not running-ledger rows.
  const runningLedgerEntries = rawLedgerEntries.filter((entry) => !isAccruedReceiptLedgerEntry(entry));

  const monthEndEntries = createMonthEndInterestEntries(
    runningLedgerEntries as DailyLedgerEntry[],
    accruedReceipts,
    config.roiPercent,
    config.dayCountConvention,
    now,
  );
  const ledgerWithPostings = computeDailyInterestLedger(
    [...runningLedgerEntries, ...monthEndEntries],
    config.roiPercent,
    config.dayCountConvention,
  );
  const generatedById = new Map(monthEndEntries.map((entry) => [entry.id, entry]));
  const closedInterestMonths = new Set(
    monthEndEntries.filter((entry) => entry.txnType === "Interest").map((entry) => entry.valueDate.slice(0, 7)),
  );
  const dailyLedger = ledgerWithPostings.map((entry) => {
    const generated = generatedById.get(entry.id);
    if (generated) return { ...entry, ...generated };
    if (closedInterestMonths.has(entry.valueDate.slice(0, 7))) {
      return { ...entry, days: 0, interestAmount: 0 };
    }
    return entry;
  });

  // Add posted late-interest charges to the installment whose due date follows
  // the month-end debit. The baseline monthly interest projection remains intact.
  for (const posting of monthEndEntries) {
    if (posting.txnType !== "Interest" || !posting.lateInterestAmount) continue;
    const dueDate = seventhAfterMonthEnd(posting.valueDate);
    const installment = schedules.find((item) => item.dueDate === dueDate);
    if (!installment) continue;
    installment.interestDue += posting.lateInterestAmount;
    installment.totalDue += posting.lateInterestAmount;
    installment.totalBalance += posting.lateInterestAmount;
    installment.status = evaluateInstallmentStatus(installment, now);
    installment.dpd = calculateInstallmentDpd(installment, now);
  }

  const accruedInterestLedger: AccruedInterestEntry[] = buildAccruedInterestLedger(
    dailyLedger.filter((entry) => ["Interest", "Broken Interest", "Broken Period"].includes(entry.txnType) && entry.debit > 0),
    accruedReceipts,
    config.roiPercent,
    config.dayCountConvention,
    now,
  );
  const accruedInterestOutstanding = getAccruedInterestBalance(accruedInterestLedger);
  const asOfISO = formatDateISO(now);
  const lateInterestCarryForward = [...calculateLateInterestByPostingMonth(
    accruedReceipts, config.roiPercent, config.dayCountConvention,
  )].reduce((total, [month, charge]) => {
    const [year, monthNumber] = month.split("-").map(Number);
    const monthEnd = formatDateISO(new Date(year, monthNumber, 0));
    return total + (monthEnd > asOfISO ? charge : 0);
  }, 0);
  const actualSchedules = computeActualMonthlySchedule(dailyLedger, schedules, config, accruedInterestLedger, now, accruedReceipts);

  // 7. Compute aggregations & KPIs (Syncing with Daily Ledger when active)
  let totalPrincipalPaid = 0;
  let totalInterestPaid = 0;
  let totalPenalPaid = 0;
  let totalChargesPaid = 0;

  let overduePrincipal = 0;
  let overdueInterest = 0;
  let overduePenal = 0;
  let overdueCharges = 0;

  let nextDueDate: string | undefined;
  let nextDueAmount = 0;

  if (hasCustomLedger && dailyLedger.length > 0) {
    // Derive live summary from running ledger
    let totalInterestDebited = 0;
    for (const entry of dailyLedger) {
      if (entry.txnType === "Principal" || entry.txnType === "Collection") {
        totalPrincipalPaid += entry.credit || 0;
      } else if (entry.txnType === "Interest" || entry.txnType === "Broken Interest" || entry.txnType === "Broken Period") {
        totalInterestDebited += entry.debit || 0;
        totalInterestPaid += entry.credit || 0;
      } else if (entry.txnType === "Interest Offset") {
        // Same-date non-cash credit offsets the principal-basis interest debit.
      } else if (entry.txnType === "Tds") {
        totalInterestPaid += entry.credit || 0;
      } else if (entry.txnType === "Penal") {
        totalPenalPaid += entry.credit || 0;
      } else if (entry.txnType === "Charges") {
        totalChargesPaid += entry.credit || 0;
      }
    }

    overdueInterest = Math.max(0, totalInterestDebited - totalInterestPaid);

    const latestLedgerEntry = dailyLedger[dailyLedger.length - 1];
    if (overdueInterest > 0) {
      nextDueAmount = overdueInterest;
      nextDueDate = dailyLedger.find((e) => e.txnType === "Interest" && e.debit > 0 && e.debit > e.credit)?.valueDate || latestLedgerEntry?.valueDate;
    } else {
      // Next due is the active accrued segment interest
      nextDueAmount = latestLedgerEntry?.interestAmount || (schedules.find((s) => s.status !== "paid")?.interestDue || 0);
      if (latestLedgerEntry?.valueDate) {
        const curDate = new Date(latestLedgerEntry.valueDate);
        const nextMonth7th = new Date(curDate.getFullYear(), curDate.getMonth() + 1, 7);
        nextDueDate = formatDateISO(nextMonth7th);
      } else {
        nextDueDate = schedules[0]?.dueDate;
      }
    }
  } else {
    // Schedule-based derivation
    for (const s of schedules) {
      totalPrincipalPaid += s.principalPaid;
      totalInterestPaid += s.interestPaid;
      totalPenalPaid += s.penalInterestPaid;
      totalChargesPaid += s.bouncingChargesPaid;

      const isPast = formatDateISO(now) > s.dueDate;
      if (isPast && s.status !== "paid" && s.status !== "waived") {
        overduePrincipal += Math.max(0, s.principalDue - s.principalPaid);
        overdueInterest += Math.max(0, s.interestDue - s.interestPaid);
        overduePenal += Math.max(0, s.penalInterestDue - s.penalInterestPaid);
        overdueCharges += Math.max(0, s.bouncingChargesDue - s.bouncingChargesPaid);
      } else if (!isPast && !nextDueDate && (s.status === "scheduled" || s.status === "partially_paid")) {
        nextDueDate = s.dueDate;
        nextDueAmount = s.totalBalance;
      }
    }
  }

  const openAccruedTransfers = accruedInterestLedger.filter(
    (entry) => entry.txnType === "Interest Transfer" && (entry.outstanding || 0) > 0,
  );
  if (accruedInterestLedger.length > 0) {
    overdueInterest = openAccruedTransfers
      .filter((entry) => Boolean(entry.dueDate && entry.dueDate < formatDateISO(now)))
      .reduce((total, entry) => total + (entry.outstanding || 0), 0);
    if (openAccruedTransfers.length > 0) {
      nextDueDate = openAccruedTransfers
        .map((entry) => entry.dueDate)
        .filter((date): date is string => Boolean(date))
        .sort()[0];
      nextDueAmount = accruedInterestOutstanding;
    }
  }

  if (accruedInterestLedger.length > 0) {
    totalInterestPaid = accruedInterestLedger
      .filter((entry) => entry.txnType === "Payment Receipt")
      .reduce((total, entry) => total + entry.credit, 0);
  }

  const latestEntry = dailyLedger.length > 0 ? dailyLedger[dailyLedger.length - 1] : null;
  const currentPrincipalOutstanding = latestEntry ? latestEntry.cumulative : Math.max(0, config.disbursedAmount - totalPrincipalPaid);
  const totalCollected = totalPrincipalPaid + totalInterestPaid + totalPenalPaid + totalChargesPaid;
  const totalOverdue = overduePrincipal + overdueInterest + overduePenal + overdueCharges;

  const scheduleDelinquency = calculateDpdAndSma(schedules, now);
  const nonInterestDpd = schedules.reduce((days, schedule) => {
    const unpaidOther =
      Math.max(0, schedule.principalDue - schedule.principalPaid) +
      Math.max(0, schedule.penalInterestDue - schedule.penalInterestPaid) +
      Math.max(0, schedule.bouncingChargesDue - schedule.bouncingChargesPaid);
    return unpaidOther > 0 && schedule.dueDate < asOfISO
      ? Math.max(days, getDaysDifference(schedule.dueDate, asOfISO))
      : days;
  }, 0);
  const accruedDpd = openAccruedTransfers.reduce((days, entry) => Math.max(days, entry.dpd), 0);
  const dpd = accruedInterestLedger.length > 0
    ? Math.max(nonInterestDpd, accruedDpd)
    : scheduleDelinquency.dpd;
  const smaClass = dpd > 90 ? "NPA" : dpd > 60 ? "SMA-2" : dpd > 30 ? "SMA-1" : dpd > 0 ? "SMA-0" : "Standard";

  return {
    applicationId,
    applicationCode: app.application_code,
    borrowerName,
    borrowerType: primary?.borrower_type || "corporate",
    borrowerPan: primary?.pan || undefined,

    disbursedAmount: config.disbursedAmount,
    currentPrincipalOutstanding,
    totalPrincipalPaid,
    totalInterestPaid,
    totalPenalPaid,
    totalChargesPaid,
    totalCollected,

    totalOverdue,
    overduePrincipal,
    overdueInterest,
    overduePenal,
    overdueCharges,

    nextDueDate,
    nextDueAmount,
    dpd,
    smaClass,

    config,
    schedules,
    actualSchedules,
    dailyLedger,
    accruedInterestLedger,
    accruedInterestOutstanding,
    lateInterestCarryForward,
    transactions,
  };
}


/**
 * Creates or resets the loan repayment schedule in the database.
 */
export async function generateOrResetScheduleAction(
  applicationId: string,
  config: LoanServicingConfig,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  try {
    // 1. Generate schedule rows based on mode and moratorium
    const items = generateSchedule(config);

    // 2. Delete existing schedules
    await supabase.from("loan_schedules").delete().eq("loan_application_id", applicationId);

    // 3. Insert newly generated schedules
    const rowsToInsert = items.map((item) => ({
      loan_application_id: applicationId,
      installment_number: item.installmentNumber,
      due_date: item.dueDate,
      period_label: item.periodLabel,
      opening_principal: item.openingPrincipal,
      principal_due: item.principalDue,
      interest_due: item.interestDue,
      total_due: item.totalDue,
      closing_principal: item.closingPrincipal,
      principal_paid: 0,
      interest_paid: 0,
      penal_interest_due: 0,
      penal_interest_paid: 0,
      bouncing_charges_due: 0,
      bouncing_charges_paid: 0,
      status: "scheduled",
    }));

    const { error: insertError } = await supabase.from("loan_schedules").insert(rowsToInsert);
    if (insertError) return { success: false, error: insertError.message };

    // 4. Upsert config
    const { error: configError } = await supabase.from("loan_servicing_configs").upsert(
      {
        loan_application_id: applicationId,
        disbursement_date: config.disbursementDate,
        disbursed_amount: config.disbursedAmount,
        repayment_mode: config.repaymentMode,
        roi_percent: config.roiPercent,
        tenure_months: config.tenureMonths,
        tenure_days: config.tenureDays,
        moratorium_months: config.moratoriumMonths || 0,
        day_count_convention: config.dayCountConvention,
        penal_interest_rate: config.penalInterestRate,
        bouncing_charge_amount: config.bouncingChargeAmount,
        schedule_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "loan_application_id" },
    );

    if (configError) return { success: false, error: configError.message };

    revalidatePath(`/loans/${applicationId}/repayment`);
    return { success: true };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Failed to generate schedule." };
  }
}

/**
 * Records an incoming payment collection with automatic waterfall allocation across dues.
 * If TDS was deducted by borrower (e.g. 10% under Sec 194A), it credits the full gross amount
 * to the borrower's schedule, creates an audit receipt for the net cash receipt and auto-creates
 * the TDS Asset Credit entry.
 */
export async function recordPaymentAction(
  applicationId: string,
  input: RecordPaymentInput,
): Promise<{ success: boolean; receiptNumber?: string; tdsReceiptNumber?: string; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  try {
    const summary = await getLoanServicingSummary(applicationId);
    if (!summary || summary.schedules.length === 0) {
      return { success: false, error: "No active schedule found for this loan." };
    }

    const netAmount = Number(input.amount) || 0;
    const tdsAmount = input.isTdsDeducted || (input.tdsAmount && input.tdsAmount > 0)
      ? Number(input.tdsAmount) || 0
      : 0;
    const grossTotalPayment = netAmount + tdsAmount;

    // 1. Run Waterfall Allocation on Gross Credit (Net Cash + TDS Asset)
    const allocation = allocatePaymentWaterfall(summary.schedules, grossTotalPayment);
    if (netAmount <= 0 || tdsAmount < 0 || allocation.unallocatedAmount > 0) {
      return { success: false, error: "Enter a positive collection amount within the outstanding loan dues." };
    }
    if (tdsAmount > allocation.allocatedInterest) {
      return { success: false, error: "TDS cannot exceed the interest portion of this collection." };
    }

    // 2. Update each schedule row in DB
    for (const s of allocation.updatedSchedules) {
      if (s.id) {
        await supabase
          .from("loan_schedules")
          .update({
            principal_paid: s.principalPaid,
            interest_paid: s.interestPaid,
            penal_interest_paid: s.penalInterestPaid,
            bouncing_charges_paid: s.bouncingChargesPaid,
            status: s.status,
            paid_date: s.status === "paid" ? input.paymentDate : null,
            payment_mode: input.paymentMode,
            updated_at: new Date().toISOString(),
          })
          .eq("id", s.id);
      }
    }

    // 3. Generate unique receipt number (e.g. LRSD/REC/2026/0481)
    const receiptYear = new Date(input.paymentDate).getFullYear();
    const receiptNumber = `LRSD/REC/${receiptYear}/${Date.now().toString().slice(-4)}`;

    // Determine target installment due date and DPD
    const oldestPendingSchedule = summary.schedules.find(
      (s) => s.status === "overdue" || s.status === "due" || s.status === "partially_paid"
    ) || summary.schedules[0];

    const targetDueDate = dueOnSeventhOfMonth(input.targetDueDate || oldestPendingSchedule?.dueDate || input.paymentDate);
    const dpd = input.paymentDate > targetDueDate
      ? getDaysDifference(targetDueDate, input.paymentDate)
      : 0;

    let baseNotes = input.notes || "";
    if (tdsAmount > 0) {
      baseNotes += ` [Net Bank: ₹${netAmount.toLocaleString("en-IN")} | TDS ${input.tdsRatePercent || 10}%: ₹${tdsAmount.toLocaleString("en-IN")}]`;
    }
    const formattedNotes = `${baseNotes} [Due Date: ${targetDueDate} | DPD: ${dpd}d]`.trim();

    // 4. Insert main payment transaction record (Net Bank / Cash receipt)
    const insertPayload: any = {
      loan_application_id: applicationId,
      receipt_number: receiptNumber,
      payment_date: input.paymentDate,
      target_due_date: targetDueDate,
      dpd: dpd,
      amount: netAmount,
      allocated_principal: allocation.allocatedPrincipal,
      allocated_interest: Math.max(0, allocation.allocatedInterest - tdsAmount),
      allocated_penal: allocation.allocatedPenal,
      allocated_charges: allocation.allocatedCharges,
      payment_mode: input.paymentMode,
      payment_type: input.paymentType,
      reference_number: input.referenceNumber,
      bank_name: input.bankName,
      status: "cleared",
      notes: formattedNotes,
      created_by: user.id,
    };

    let { error: txError } = await supabase.from("loan_repayments").insert(insertPayload);
    if (txError && txError.message?.includes("column")) {
      delete insertPayload.target_due_date;
      delete insertPayload.dpd;
      const res = await supabase.from("loan_repayments").insert(insertPayload);
      txError = res.error;
    }

    if (txError) return { success: false, error: txError.message };

    // 5. If TDS was deducted, auto-create a TDS Asset Credit Transaction
    let tdsReceiptNumber: string | undefined;
    if (tdsAmount > 0) {
      tdsReceiptNumber = `LRSD/TDS/${receiptYear}/${(Date.now() + 1).toString().slice(-4)}`;
      const tdsPayload: any = {
        loan_application_id: applicationId,
        receipt_number: tdsReceiptNumber,
        payment_date: input.paymentDate,
        target_due_date: targetDueDate,
        dpd: 0,
        amount: tdsAmount,
        allocated_principal: 0,
        allocated_interest: tdsAmount,
        allocated_penal: 0,
        allocated_charges: 0,
        payment_mode: "TDS Credit",
        payment_type: "tds_credit",
        reference_number: `TDS-${input.referenceNumber || receiptNumber}`,
        bank_name: "Income Tax Dept (Form 16A)",
        status: "cleared",
        notes: `Automated TDS Asset Credit (${input.tdsRatePercent || 10}% under Sec 194A) for Receipt ${receiptNumber}`,
        created_by: user.id,
      };

      const { error: tdsErr } = await supabase.from("loan_repayments").insert(tdsPayload);
      if (tdsErr) {
        console.warn("Failed to create TDS receipt record:", tdsErr.message);
        tdsReceiptNumber = undefined;
      }
    }

    // 6. Only principal and other non-interest movements affect the running
    // ledger. Interest and TDS receipts are represented by the accrued account.
    if (summary.dailyLedger && summary.dailyLedger.length > 0) {
      const currentLedger = summary.dailyLedger.filter((entry) => !entry.systemGenerated);
      const newEntries: DailyLedgerEntry[] = [];

      const paymentEntry = (txnType: LedgerTxnType, credit: number, narration: string, idSuffix: string, referenceNumber?: string): DailyLedgerEntry => ({
        id: `ledger_${Date.now()}_${idSuffix}`,
        txnType,
        date: input.paymentDate,
        txnDate: input.paymentDate,
        valueDate: input.paymentDate,
        narration,
        debit: 0,
        credit,
        cumulative: 0,
        days: 0,
        interestAmount: 0,
        referenceNumber,
        bankName: input.bankName,
        targetDueDate,
        sourceReceiptNumber: receiptNumber,
      });

      if (allocation.allocatedPrincipal > 0) {
        newEntries.push(paymentEntry("Principal", allocation.allocatedPrincipal, input.narration || "Principal payment received", "principal", input.referenceNumber));
      }
      if (allocation.allocatedPenal > 0) {
        newEntries.push(paymentEntry("Penal", allocation.allocatedPenal, "Penal interest receipt", "penal", input.referenceNumber));
      }
      if (allocation.allocatedCharges > 0) {
        newEntries.push(paymentEntry("Charges", allocation.allocatedCharges, "Charge receipt", "charges", input.referenceNumber));
      }

      if (newEntries.length > 0) {
        const updatedRaw = [...currentLedger, ...newEntries];
        const recalculated = computeDailyInterestLedger(
          updatedRaw,
          summary.config.roiPercent,
          summary.config.dayCountConvention,
        );
        await saveDailyLedgerAction(applicationId, recalculated);
      }
    }

    revalidatePath(`/loans/${applicationId}/repayment`);
    return { success: true, receiptNumber, tdsReceiptNumber };

  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Failed to record payment." };
  }
}


/**
 * Rebuilds schedule payment columns from the surviving cleared receipts.
 * The booked due amounts stay intact; each receipt keeps its stored split
 * between interest, principal, penalties and charges.
 */
async function rebuildSchedulePayments(applicationId: string): Promise<void> {
  const supabase = await createClient();
  const summary = await getLoanServicingSummary(applicationId);
  if (!summary) throw new Error("Loan not found.");

  const schedules = summary.schedules.map((item) => ({
    ...item,
    principalPaid: 0,
    interestPaid: 0,
    penalInterestPaid: 0,
    bouncingChargesPaid: 0,
    totalPaid: 0,
    paidDate: undefined as string | undefined,
  }));
  const receipts = summary.transactions
    .filter((item) => item.status === "cleared")
    .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate) || a.createdAt.localeCompare(b.createdAt));

  for (const receipt of receipts) {
    const apply = (amount: number, dueField: "principalDue" | "interestDue" | "penalInterestDue" | "bouncingChargesDue", paidField: "principalPaid" | "interestPaid" | "penalInterestPaid" | "bouncingChargesPaid") => {
      let remaining = amount;
      for (const item of schedules) {
        if (remaining <= 0) break;
        if (item.status === "waived") continue;
        const available = Math.max(0, item[dueField] - item[paidField]);
        const applied = Math.min(remaining, available);
        if (applied > 0) {
          item[paidField] += applied;
          item.paidDate = receipt.paymentDate;
          remaining -= applied;
        }
      }
      const finalPayable = schedules.slice().reverse().find((item) => item.status !== "waived");
      if (remaining > 0 && finalPayable) {
        finalPayable[paidField] += remaining;
        finalPayable.paidDate = receipt.paymentDate;
      }
    };
    apply(receipt.allocatedCharges, "bouncingChargesDue", "bouncingChargesPaid");
    apply(receipt.allocatedPenal, "penalInterestDue", "penalInterestPaid");
    apply(receipt.allocatedInterest, "interestDue", "interestPaid");
    apply(receipt.allocatedPrincipal, "principalDue", "principalPaid");
  }

  for (const item of schedules) {
    if (!item.id) continue;
    item.totalPaid = item.principalPaid + item.interestPaid + item.penalInterestPaid + item.bouncingChargesPaid;
    item.totalBalance = Math.max(0, item.totalDue + item.penalInterestDue + item.bouncingChargesDue - item.totalPaid);
    item.status = item.status === "waived" ? "waived" : evaluateInstallmentStatus(item, new Date());
    const { error } = await supabase.from("loan_schedules").update({
      principal_paid: item.principalPaid,
      interest_paid: item.interestPaid,
      penal_interest_paid: item.penalInterestPaid,
      bouncing_charges_paid: item.bouncingChargesPaid,
      status: item.status,
      paid_date: item.status === "paid" ? item.paidDate || null : null,
      updated_at: new Date().toISOString(),
    }).eq("id", item.id).eq("loan_application_id", applicationId);
    if (error) throw new Error(error.message);
  }
}

async function changeStoredReceiptLedgerRows(
  applicationId: string,
  receipt: RepaymentTransaction,
  mode: "update" | "delete",
  replacement?: AccruedReceiptEditInput,
  relatedReceipts: RepaymentTransaction[] = [],
): Promise<void> {
  const supabase = await createClient();
  const { data: configRow, error: loadError } = await supabase
    .from("loan_servicing_configs")
    .select("raw_data")
    .eq("loan_application_id", applicationId)
    .maybeSingle();
  if (loadError) throw new Error(loadError.message);
  const rawData = configRow?.raw_data || {};
  if (!Array.isArray(rawData.daily_ledger)) return;

  const receiptNumbers = new Set([receipt.receiptNumber, ...relatedReceipts.map((item) => item.receiptNumber)]);
  const nextEntries = (rawData.daily_ledger as DailyLedgerEntry[]).flatMap((entry) => {
    const storedInterestReceipt = [receipt, ...relatedReceipts].some((item) =>
      isAccruedReceiptLedgerEntry(entry) &&
      (entry.valueDate || entry.date) === item.paymentDate &&
      Number(entry.credit) === Number(item.allocatedInterest) &&
      (entry.referenceNumber || "") === (item.referenceNumber || "") &&
      /interest payment received|tds assets/i.test(entry.narration || "")
    );
    const linked = Boolean(entry.sourceReceiptNumber && receiptNumbers.has(entry.sourceReceiptNumber));
    const legacy = entry.id === `repay_${receipt.id}_p` || entry.id === `repay_${receipt.id}_i`;
    if (isAccruedReceiptLedgerEntry(entry) && (linked || legacy || storedInterestReceipt)) return [];
    if (mode === "delete" && (linked || legacy)) return [];
    if (mode === "update" && replacement && (linked || legacy) && ["Principal", "Collection"].includes(entry.txnType)) {
      return [{
        ...entry,
        date: replacement.paymentDate,
        txnDate: replacement.paymentDate,
        valueDate: replacement.paymentDate,
        referenceNumber: replacement.referenceNumber,
      }];
    }
    return [entry];
  });
  const { error: saveError } = await supabase
    .from("loan_servicing_configs")
    .update({ raw_data: { ...rawData, daily_ledger: nextEntries } })
    .eq("loan_application_id", applicationId);
  if (saveError) throw new Error(saveError.message);
}

/** Edits a borrower receipt in the accrued-interest account. */
export async function updateAccruedReceiptAction(
  applicationId: string,
  repaymentId: string | undefined,
  sourceLedgerEntryId: string | undefined,
  input: AccruedReceiptEditInput,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be signed in." };
  if (!input.paymentDate || !input.targetDueDate || !Number.isFinite(input.amount) || input.amount <= 0) {
    return { success: false, error: "Enter a payment date, due date, and positive amount." };
  }

  try {
    const dueDate = dueOnSeventhOfMonth(input.targetDueDate);
    if (sourceLedgerEntryId) {
      const { data: configRow, error: loadError } = await supabase
        .from("loan_servicing_configs").select("raw_data")
        .eq("loan_application_id", applicationId).maybeSingle();
      if (loadError) throw new Error(loadError.message);
      const rawData = configRow?.raw_data || {};
      const entries: DailyLedgerEntry[] = Array.isArray(rawData.daily_ledger) ? rawData.daily_ledger : [];
      const index = entries.findIndex((entry) => entry.id === sourceLedgerEntryId && isAccruedReceiptLedgerEntry(entry));
      if (index < 0) return { success: false, error: "Receipt not found." };
      const updated = [...entries];
      updated[index] = {
        ...updated[index],
        date: input.paymentDate,
        txnDate: input.paymentDate,
        valueDate: input.paymentDate,
        credit: input.amount,
        targetDueDate: dueDate,
        referenceNumber: input.referenceNumber,
      };
      const { error } = await supabase.from("loan_servicing_configs")
        .update({ raw_data: { ...rawData, daily_ledger: updated } })
        .eq("loan_application_id", applicationId);
      if (error) throw new Error(error.message);
    } else if (repaymentId) {
      const summary = await getLoanServicingSummary(applicationId);
      const receipt = summary?.transactions.find((item) => item.id === repaymentId && item.status === "cleared");
      if (!receipt || receipt.allocatedInterest <= 0) return { success: false, error: "Interest receipt not found." };
      if (
        receipt.allocatedPrincipal + receipt.allocatedPenal + receipt.allocatedCharges === 0 &&
        input.amount > summary!.accruedInterestOutstanding + receipt.allocatedInterest
      ) {
        return { success: false, error: "Receipt amount exceeds the accrued interest available to settle." };
      }
      if (
        (receipt.allocatedPrincipal > 0 || receipt.allocatedPenal > 0 || receipt.allocatedCharges > 0) &&
        input.amount !== receipt.amount
      ) return { success: false, error: "The amount of a mixed principal and interest receipt cannot be changed here." };

      const { error } = await supabase.from("loan_repayments").update({
        payment_date: input.paymentDate,
        target_due_date: dueDate,
        dpd: Math.max(0, getDaysDifference(dueDate, input.paymentDate)),
        amount: input.amount,
        allocated_interest: receipt.allocatedPrincipal + receipt.allocatedPenal + receipt.allocatedCharges > 0
          ? receipt.allocatedInterest
          : input.amount,
        reference_number: input.referenceNumber || null,
        updated_at: new Date().toISOString(),
      }).eq("id", repaymentId).eq("loan_application_id", applicationId);
      if (error) throw new Error(error.message);
      await changeStoredReceiptLedgerRows(applicationId, receipt, "update", input);
      await rebuildSchedulePayments(applicationId);
    } else {
      return { success: false, error: "Receipt not found." };
    }
    revalidatePath(`/loans/${applicationId}/repayment`);
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update receipt." };
  }
}

/** Deletes a borrower receipt and reopens its accrued-interest debit. */
export async function deleteAccruedReceiptAction(
  applicationId: string,
  repaymentId?: string,
  sourceLedgerEntryId?: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  try {
    if (sourceLedgerEntryId) {
      const { data: configRow, error: loadError } = await supabase
        .from("loan_servicing_configs").select("raw_data")
        .eq("loan_application_id", applicationId).maybeSingle();
      if (loadError) throw new Error(loadError.message);
      const rawData = configRow?.raw_data || {};
      const entries: DailyLedgerEntry[] = Array.isArray(rawData.daily_ledger) ? rawData.daily_ledger : [];
      if (!entries.some((entry) => entry.id === sourceLedgerEntryId && isAccruedReceiptLedgerEntry(entry))) {
        return { success: false, error: "Receipt not found." };
      }
      const { error } = await supabase.from("loan_servicing_configs")
        .update({ raw_data: { ...rawData, daily_ledger: entries.filter((entry) => entry.id !== sourceLedgerEntryId) } })
        .eq("loan_application_id", applicationId);
      if (error) throw new Error(error.message);
    } else if (repaymentId) {
      const summary = await getLoanServicingSummary(applicationId);
      const receipt = summary?.transactions.find((item) => item.id === repaymentId && item.status === "cleared");
      if (!receipt || receipt.allocatedInterest <= 0) return { success: false, error: "Interest receipt not found." };
      const companions = receipt.paymentMode === "TDS Credit"
        ? []
        : (summary?.transactions || []).filter((item) =>
            item.paymentMode === "TDS Credit" &&
            (item.notes || "").includes(`for Receipt ${receipt.receiptNumber}`)
          );
      const ids = [receipt.id, ...companions.map((item) => item.id)];
      const { error } = await supabase.from("loan_repayments").delete()
        .eq("loan_application_id", applicationId).in("id", ids);
      if (error) throw new Error(error.message);
      await changeStoredReceiptLedgerRows(
        applicationId, receipt, "delete", undefined,
        companions,
      );
      await rebuildSchedulePayments(applicationId);
    } else {
      return { success: false, error: "Receipt not found." };
    }
    revalidatePath(`/loans/${applicationId}/repayment`);
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete receipt." };
  }
}

/**
 * Handles Cheque / NACH bounce event: marks transaction bounced and adds penalty charges.
 */
export async function recordChequeBounceAction(
  applicationId: string,
  paymentId: string,
  bounceReason: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  try {
    // 1. Fetch the transaction
    const { data: tx, error: txError } = await supabase
      .from("loan_repayments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (txError || !tx) return { success: false, error: "Transaction not found." };
    if (tx.status === "bounced") return { success: false, error: "Transaction is already bounced." };

    // 2. Mark transaction bounced
    await supabase
      .from("loan_repayments")
      .update({
        status: "bounced",
        bounce_reason: bounceReason,
        bounced_date: formatDateISO(new Date()),
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId);

    // 3. Add bouncing charge (₹1,000) and revert schedule balances
    const summary = await getLoanServicingSummary(applicationId);
    if (summary && summary.schedules.length > 0) {
      // Find oldest active installment and apply ₹1,000 bounce charge
      const target = summary.schedules.find((s) => s.status !== "waived") || summary.schedules[0];
      if (target && target.id) {
        await supabase
          .from("loan_schedules")
          .update({
            bouncing_charges_due: target.bouncingChargesDue + (summary.config.bouncingChargeAmount || 1000),
            penal_interest_due: target.penalInterestDue + Math.round((Number(tx.amount) * 0.02) / 12),
            updated_at: new Date().toISOString(),
          })
          .eq("id", target.id);
      }
    }

    revalidatePath(`/loans/${applicationId}/repayment`);
    return { success: true };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Failed to record bounce." };
  }
}

/**
 * Saves the customized daily running interest ledger entries in database.
 */
export async function saveDailyLedgerAction(
  applicationId: string,
  entries: DailyLedgerEntry[],
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  try {
    let rawData: any = {};
    try {
      const { data: existing, error: selectErr } = await supabase
        .from("loan_servicing_configs")
        .select("*")
        .eq("loan_application_id", applicationId)
        .maybeSingle();

      if (!selectErr && existing) {
        rawData = existing.raw_data || {};
      }
    } catch {
      // Column might not exist yet in schema cache
    }

    const visibleEntries = entries.filter((entry) => !entry.systemGenerated);
    const visibleIds = new Set(visibleEntries.map((entry) => entry.id));
    const retainedAccruedReceipts: DailyLedgerEntry[] = Array.isArray(rawData.daily_ledger)
      ? rawData.daily_ledger.filter((entry: DailyLedgerEntry) =>
          isAccruedReceiptLedgerEntry(entry) && !visibleIds.has(entry.id)
        )
      : [];
    rawData.daily_ledger = [...visibleEntries, ...retainedAccruedReceipts];

    const { error: upsertErr } = await supabase
      .from("loan_servicing_configs")
      .upsert(
        {
          loan_application_id: applicationId,
          raw_data: rawData,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "loan_application_id" }
      );

    if (upsertErr) {
      if (upsertErr.message?.includes("raw_data") || upsertErr.message?.includes("schema cache")) {
        console.warn("raw_data column missing in loan_servicing_configs. Migration 0023 is required.");
        return {
          success: false,
          error: "Database column missing: Please run this SQL in Supabase SQL editor: ALTER TABLE loan_servicing_configs ADD COLUMN IF NOT EXISTS raw_data jsonb DEFAULT '{}'::jsonb;",
        };
      }
      return { success: false, error: upsertErr.message };
    }

    revalidatePath(`/loans/${applicationId}/repayment`);
    return { success: true };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Failed to save daily ledger." };
  }
}

/**
 * Adds a new transaction entry to the daily ledger (Disbursement, Collection, TDS, Interest, etc.)
 * Supports auto-splitting Net received + TDS Assets entry.
 */
export async function addDailyLedgerTxnAction(
  applicationId: string,
  input: AddLedgerTxnInput,
): Promise<{ success: boolean; error?: string }> {
  return addDailyLedgerTxnBatchAction(applicationId, [input]);
}

/**
 * Adds multiple transaction entries to the daily ledger in a single batch.
 */
export async function addDailyLedgerTxnBatchAction(
  applicationId: string,
  inputs: AddLedgerTxnInput[],
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const summary = await getLoanServicingSummary(applicationId);
    if (!summary) return { success: false, error: "Loan not found." };
    if (!inputs || inputs.length === 0) return { success: false, error: "No entries provided." };

    const currentLedger = (summary.dailyLedger || []).filter((entry) => !entry.systemGenerated);
    const newEntries: DailyLedgerEntry[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const vDate = input.valueDate || input.date || input.txnDate || formatDateISO(new Date());
      const tDate = input.txnDate || input.date || input.valueDate || formatDateISO(new Date());
      if (input.autoSplitTds && !["Interest", "Broken Interest", "Broken Period"].includes(input.txnType)) {
        return { success: false, error: `Entry #${i + 1}: TDS split is only available for interest receipts.` };
      }
      if (input.autoSplitTds && (Number(input.debit) > 0 || Number(input.tdsAmount) > Number(input.credit))) {
        return { success: false, error: `Entry #${i + 1}: Invalid interest receipt or TDS amount.` };
      }

      if (input.autoSplitTds && input.tdsAmount && input.tdsAmount > 0) {
        // 1. Add TDS Assets credit entry
        newEntries.push({
          id: `ledger_${Date.now()}_${i}_tds`,
          txnType: "Tds",
          date: vDate,
          txnDate: tDate,
          valueDate: vDate,
          narration: `TDS Assets (${input.tdsRatePercent || 10}%)`,
          debit: 0,
          credit: Number(input.tdsAmount) || 0,
          cumulative: 0,
          days: 0,
          interestAmount: 0,
          referenceNumber: input.referenceNumber ? `TDS-${input.referenceNumber}` : undefined,
          targetDueDate: input.targetDueDate,
        });

        // 2. Add Net Bank Receipt entry
        const netCredit = input.netCreditAmount !== undefined ? input.netCreditAmount : ((input.credit || 0) - (input.tdsAmount || 0));
        newEntries.push({
          id: `ledger_${Date.now()}_${i}_net`,
          txnType: input.txnType,
          date: vDate,
          txnDate: tDate,
          valueDate: vDate,
          narration: input.narration || "Payment Received",
          debit: 0,
          credit: Math.max(0, netCredit),
          cumulative: 0,
          days: 0,
          interestAmount: 0,
          referenceNumber: input.referenceNumber,
          bankName: input.bankName,
          targetDueDate: input.targetDueDate,
        });
      } else {
        newEntries.push({
          id: `ledger_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          txnType: input.txnType,
          date: vDate,
          txnDate: tDate,
          valueDate: vDate,
          narration: input.narration,
          debit: Number(input.debit) || 0,
          credit: Number(input.credit) || 0,
          cumulative: 0,
          days: 0,
          interestAmount: 0,
          referenceNumber: input.referenceNumber,
          bankName: input.bankName,
          targetDueDate: input.targetDueDate,
        });
      }
    }

    const updatedRaw = [...currentLedger, ...newEntries];
    const recalculated = computeDailyInterestLedger(updatedRaw, summary.config.roiPercent, summary.config.dayCountConvention);

    const saveRes = await saveDailyLedgerAction(applicationId, recalculated);
    if (!saveRes.success) return saveRes;

    return { success: true, count: newEntries.length };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Failed to add ledger transactions." };
  }
}

/**
 * Updates an existing entry in the daily ledger.
 */
export async function updateDailyLedgerTxnAction(
  applicationId: string,
  entryId: string,
  input: Partial<AddLedgerTxnInput> & { id?: string },
): Promise<{ success: boolean; error?: string }> {
  try {
    const summary = await getLoanServicingSummary(applicationId);
    if (!summary) return { success: false, error: "Loan not found." };

    const currentLedger = (summary.dailyLedger || []).filter((entry) => !entry.systemGenerated);
    const entryIndex = currentLedger.findIndex((e) => e.id === entryId);
    if (entryIndex === -1) {
      return { success: false, error: "Ledger entry not found." };
    }
    if (currentLedger[entryIndex].sourceReceiptNumber) {
      return { success: false, error: "Recorded collections must be corrected through the collection record." };
    }

    const oldEntry = currentLedger[entryIndex];
    const vDate = input.valueDate || input.date || oldEntry.valueDate || oldEntry.date;
    const tDate = input.txnDate || input.date || oldEntry.txnDate || oldEntry.date;

    const updatedEntry: DailyLedgerEntry = {
      ...oldEntry,
      txnType: input.txnType !== undefined ? input.txnType : oldEntry.txnType,
      date: vDate,
      txnDate: tDate,
      valueDate: vDate,
      narration: input.narration !== undefined ? input.narration : oldEntry.narration,
      debit: input.debit !== undefined ? Number(input.debit) || 0 : oldEntry.debit,
      credit: input.credit !== undefined ? Number(input.credit) || 0 : oldEntry.credit,
      referenceNumber: input.referenceNumber !== undefined ? input.referenceNumber : oldEntry.referenceNumber,
      bankName: input.bankName !== undefined ? input.bankName : oldEntry.bankName,
      targetDueDate: input.targetDueDate !== undefined ? input.targetDueDate : oldEntry.targetDueDate,
    };

    const updatedList = [...currentLedger];
    updatedList[entryIndex] = updatedEntry;

    const recalculated = computeDailyInterestLedger(
      updatedList,
      summary.config.roiPercent,
      summary.config.dayCountConvention,
    );

    const saveRes = await saveDailyLedgerAction(applicationId, recalculated);
    if (!saveRes.success) return saveRes;

    return { success: true };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Failed to update ledger entry." };
  }
}

/**
 * Deletes an entry from the daily ledger.
 */
export async function deleteDailyLedgerTxnAction(
  applicationId: string,
  entryId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const summary = await getLoanServicingSummary(applicationId);
    if (!summary) return { success: false, error: "Loan not found." };

    const currentLedger = (summary.dailyLedger || []).filter((entry) => !entry.systemGenerated);
    if (currentLedger.some((entry) => entry.id === entryId && entry.sourceReceiptNumber)) {
      return { success: false, error: "Recorded collections must be corrected through the collection record." };
    }
    const filtered = currentLedger.filter((e) => e.id !== entryId);
    const recalculated = computeDailyInterestLedger(filtered, summary.config.roiPercent, summary.config.dayCountConvention);

    return await saveDailyLedgerAction(applicationId, recalculated);
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    return { success: false, error: errorObj?.message || "Failed to delete transaction." };
  }
}
