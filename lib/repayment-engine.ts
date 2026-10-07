import {
  type InstallmentItem,
  type LoanServicingConfig,
  type SmaClassification,
  type InstallmentStatus,
  type DailyLedgerEntry,
  type AccruedInterestEntry,
  type RepaymentTransaction,
  type ActualMonthlyScheduleItem,
  type LedgerTxnType,
} from "@/app/loans/[id]/repayment/repayment-types";

/**
 * Calculates exact day difference between two YYYY-MM-DD date strings
 */
export function getDaysDifference(fromDateStr: string, toDateStr: string): number {
  const from = new Date(fromDateStr);
  const to = new Date(toDateStr);
  const diffTime = to.getTime() - from.getTime();
  return Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
}


/**
 * Formats a Date object to YYYY-MM-DD
 */
export function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Master Schedule Generator: Dispatches to the appropriate calculation model based on repayment mode.
 */
export function generateSchedule(config: LoanServicingConfig): InstallmentItem[] {
  switch (config.repaymentMode) {
    case "bullet":
      return generateBulletSchedule(config);
    case "moratorium_emi":
      return generateMoratoriumSchedule(config, "emi");
    case "moratorium_equal_principal":
      return generateMoratoriumSchedule(config, "equal_principal");
    case "emi":
    default:
      return generateEmiSchedule(config);
  }
}

/** Interest posted at month-end and payable on the following month's 7th. */
export function calculateInterestForDueMonth(
  dueDate: string,
  principal: number,
  roiPercent: number,
  dayCountConvention: "actual_365" | "30_360",
): number {
  const [year, month] = dueDate.split("-").map(Number);
  if (!year || !month || principal <= 0 || roiPercent <= 0) return 0;
  if (dayCountConvention === "30_360") {
    return Math.round((principal * roiPercent) / 1200);
  }
  const periodStart = formatDateISO(new Date(year, month - 2, 1));
  const periodEnd = formatDateISO(new Date(year, month - 1, 1));
  const days = getDaysDifference(periodStart, periodEnd);
  return Math.round((principal * (roiPercent / 100) * days) / 365);
}

/**
 * Generates an institutional Bullet Repayment Schedule (LRSD standard).
 *
 * Installment 0: Broken period (disbursement date to 1st of next month, due on the 7th)
 * Installments 1 to N-1: Monthly interest servicing (Principal due = 0)
 * Installment N: Final monthly interest + 100% Principal bullet repayment
 */
export function generateBulletSchedule(config: LoanServicingConfig): InstallmentItem[] {
  const {
    disbursementDate,
    disbursedAmount,
    roiPercent,
    tenureMonths,
    dayCountConvention,
  } = config;

  if (!disbursedAmount || disbursedAmount <= 0) return [];

  const disbDate = new Date(disbursementDate);
  const schedules: InstallmentItem[] = [];

  // 1. Calculate broken period to 1st of next month
  const nextMonthFirst = new Date(disbDate.getFullYear(), disbDate.getMonth() + 1, 1);
  const brokenDays = Math.max(1, getDaysDifference(disbursementDate, formatDateISO(nextMonthFirst)));

  let brokenInterest = 0;
  if (dayCountConvention === "actual_365") {
    brokenInterest = Math.round((disbursedAmount * (roiPercent / 100) * brokenDays) / 365);
  } else {
    brokenInterest = Math.round((disbursedAmount * (roiPercent / 1200) * brokenDays) / 30);
  }

  // Add broken period installment (Installment 0)
  schedules.push({
    installmentNumber: 0,
    dueDate: formatDateISO(new Date(disbDate.getFullYear(), disbDate.getMonth() + 1, 7)),
    periodLabel: `Broken Period (${brokenDays} Days)`,
    openingPrincipal: disbursedAmount,
    principalDue: 0,
    interestDue: brokenInterest,
    totalDue: brokenInterest,
    closingPrincipal: disbursedAmount,
    principalPaid: 0,
    interestPaid: 0,
    penalInterestDue: 0,
    penalInterestPaid: 0,
    bouncingChargesDue: 0,
    bouncingChargesPaid: 0,
    totalPaid: 0,
    totalBalance: brokenInterest,
    status: "scheduled",
    dpd: 0,
  });

  // 2. Monthly installments (1 to tenureMonths)
  for (let m = 1; m <= tenureMonths; m++) {
    const periodStart = new Date(nextMonthFirst.getFullYear(), nextMonthFirst.getMonth() + (m - 1), 1);
    const dueDate = new Date(nextMonthFirst.getFullYear(), nextMonthFirst.getMonth() + m, 7);
    const monthName = periodStart.toLocaleDateString("en-US", { month: "short", year: "numeric" });

    const isFinalMonth = m === tenureMonths;
    const principalDue = isFinalMonth ? disbursedAmount : 0;
    const closingPrincipal = isFinalMonth ? 0 : disbursedAmount;

    const interestDue = calculateInterestForDueMonth(
      formatDateISO(dueDate), disbursedAmount, roiPercent, dayCountConvention,
    );

    const totalDue = principalDue + interestDue;
    const periodLabel = isFinalMonth
      ? `${monthName} (Final Bullet & Interest)`
      : `${monthName} (Monthly Interest)`;

    schedules.push({
      installmentNumber: m,
      dueDate: formatDateISO(dueDate),
      periodLabel,
      openingPrincipal: disbursedAmount,
      principalDue,
      interestDue,
      totalDue,
      closingPrincipal,
      principalPaid: 0,
      interestPaid: 0,
      penalInterestDue: 0,
      penalInterestPaid: 0,
      bouncingChargesDue: 0,
      bouncingChargesPaid: 0,
      totalPaid: 0,
      totalBalance: totalDue,
      status: "scheduled",
      dpd: 0,
    });
  }

  return schedules;
}

/**
 * Generates Principal Moratorium Schedule
 *
 * Example: Tenure = 36 months, Moratorium = 24 months.
 * - Months 1 to 24: Interest-only servicing every month (Principal due = 0).
 * - Months 25 to 36 (Remaining 12 months):
 *   - If mode === 'emi': Reducing balance EMI across remaining 12 months.
 *   - If mode === 'equal_principal': Equal principal (Principal / 12) each month + monthly interest.
 */
export function generateMoratoriumSchedule(
  config: LoanServicingConfig,
  postMoratoriumType: "emi" | "equal_principal" = "emi",
): InstallmentItem[] {
  const {
    disbursementDate,
    disbursedAmount,
    roiPercent,
    tenureMonths,
    moratoriumMonths = 0,
    dayCountConvention,
  } = config;

  if (!disbursedAmount || disbursedAmount <= 0) return [];

  const actualMoratorium = Math.min(moratoriumMonths, Math.max(0, tenureMonths - 1));
  const remainingMonths = tenureMonths - actualMoratorium;

  const disbDate = new Date(disbursementDate);
  const schedules: InstallmentItem[] = [];

  // 1. Broken period (Installment 0)
  const nextMonthFirst = new Date(disbDate.getFullYear(), disbDate.getMonth() + 1, 1);
  const brokenDays = Math.max(1, getDaysDifference(disbursementDate, formatDateISO(nextMonthFirst)));

  let brokenInterest = 0;
  if (dayCountConvention === "actual_365") {
    brokenInterest = Math.round((disbursedAmount * (roiPercent / 100) * brokenDays) / 365);
  } else {
    brokenInterest = Math.round((disbursedAmount * (roiPercent / 1200) * brokenDays) / 30);
  }

  schedules.push({
    installmentNumber: 0,
    dueDate: formatDateISO(new Date(disbDate.getFullYear(), disbDate.getMonth() + 1, 7)),
    periodLabel: `Broken Period (${brokenDays} Days)`,
    openingPrincipal: disbursedAmount,
    principalDue: 0,
    interestDue: brokenInterest,
    totalDue: brokenInterest,
    closingPrincipal: disbursedAmount,
    principalPaid: 0,
    interestPaid: 0,
    penalInterestDue: 0,
    penalInterestPaid: 0,
    bouncingChargesDue: 0,
    bouncingChargesPaid: 0,
    totalPaid: 0,
    totalBalance: brokenInterest,
    status: "scheduled",
    dpd: 0,
  });

  // Calculate post-moratorium EMI if applicable
  const r = roiPercent / 1200;
  const postMoratoriumEmi =
    remainingMonths > 0 && r > 0
      ? Math.round(
          disbursedAmount * ((r * Math.pow(1 + r, remainingMonths)) / (Math.pow(1 + r, remainingMonths) - 1))
        )
      : Math.round(disbursedAmount / Math.max(1, remainingMonths));

  const equalPrincipalPerMonth = Math.round(disbursedAmount / Math.max(1, remainingMonths));

  let currentPrincipal = disbursedAmount;

  for (let m = 1; m <= tenureMonths; m++) {
    const periodStart = new Date(nextMonthFirst.getFullYear(), nextMonthFirst.getMonth() + (m - 1), 1);
    const dueDate = new Date(nextMonthFirst.getFullYear(), nextMonthFirst.getMonth() + m, 7);
    const monthName = periodStart.toLocaleDateString("en-US", { month: "short", year: "numeric" });

    const isMoratorium = m <= actualMoratorium;
    const isFinalMonth = m === tenureMonths;

    let principalDue = 0;
    const interestDue = calculateInterestForDueMonth(
      formatDateISO(dueDate), currentPrincipal, roiPercent, dayCountConvention,
    );

    if (isMoratorium) {
      // During moratorium: Interest only, zero principal
      principalDue = 0;
    } else {
      // Post moratorium: Amortize principal
      if (postMoratoriumType === "emi") {
        principalDue = isFinalMonth
          ? currentPrincipal
          : Math.min(currentPrincipal, Math.max(0, postMoratoriumEmi - interestDue));
      } else {
        // Equal principal
        principalDue = isFinalMonth ? currentPrincipal : Math.min(currentPrincipal, equalPrincipalPerMonth);
      }
    }

    const totalDue = principalDue + interestDue;
    const closingPrincipal = isFinalMonth ? 0 : Math.max(0, currentPrincipal - principalDue);

    const periodLabel = isMoratorium
      ? `${monthName} (Moratorium: Interest Only)`
      : isFinalMonth
      ? `${monthName} (Final Settlement)`
      : `${monthName} (Principal + Interest)`;

    schedules.push({
      installmentNumber: m,
      dueDate: formatDateISO(dueDate),
      periodLabel,
      openingPrincipal: currentPrincipal,
      principalDue,
      interestDue,
      totalDue,
      closingPrincipal,
      principalPaid: 0,
      interestPaid: 0,
      penalInterestDue: 0,
      penalInterestPaid: 0,
      bouncingChargesDue: 0,
      bouncingChargesPaid: 0,
      totalPaid: 0,
      totalBalance: totalDue,
      status: "scheduled",
      dpd: 0,
    });

    currentPrincipal = closingPrincipal;
  }

  return schedules;
}

/**
 * Generates standard Reducing Balance EMI Amortization Schedule.
 */
export function generateEmiSchedule(config: LoanServicingConfig): InstallmentItem[] {
  const {
    disbursementDate,
    disbursedAmount,
    roiPercent,
    tenureMonths,
  } = config;

  if (!disbursedAmount || disbursedAmount <= 0 || !tenureMonths || tenureMonths <= 0) return [];

  const r = roiPercent / 1200;
  const n = tenureMonths;

  // EMI formula: P * r * (1+r)^n / ((1+r)^n - 1)
  const emi = Math.round(
    disbursedAmount * ((r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1))
  );

  const disbDate = new Date(disbursementDate);
  const startDate = new Date(disbDate.getFullYear(), disbDate.getMonth() + 1, 1);
  const schedules: InstallmentItem[] = [];

  let currentPrincipal = disbursedAmount;

  for (let m = 1; m <= tenureMonths; m++) {
    const dueDate = new Date(startDate.getFullYear(), startDate.getMonth() + (m - 1), 7);
    const monthLabel = dueDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });

    const interestDue = Math.round(currentPrincipal * r);
    const isFinalMonth = m === tenureMonths;
    const principalDue = isFinalMonth ? currentPrincipal : Math.min(currentPrincipal, emi - interestDue);
    const totalDue = principalDue + interestDue;
    const closingPrincipal = isFinalMonth ? 0 : Math.max(0, currentPrincipal - principalDue);

    schedules.push({
      installmentNumber: m,
      dueDate: formatDateISO(dueDate),
      periodLabel: `${monthLabel} (EMI)`,
      openingPrincipal: currentPrincipal,
      principalDue,
      interestDue,
      totalDue,
      closingPrincipal,
      principalPaid: 0,
      interestPaid: 0,
      penalInterestDue: 0,
      penalInterestPaid: 0,
      bouncingChargesDue: 0,
      bouncingChargesPaid: 0,
      totalPaid: 0,
      totalBalance: totalDue,
      status: "scheduled",
      dpd: 0,
    });

    currentPrincipal = closingPrincipal;
  }

  return schedules;
}

/**
 * Evaluates installment status based on due date and payments made
 */
export function evaluateInstallmentStatus(
  item: InstallmentItem,
  asOfDate: Date = new Date(),
): InstallmentStatus {
  const totalDue = item.totalDue + item.penalInterestDue + item.bouncingChargesDue;
  const totalPaid = item.principalPaid + item.interestPaid + item.penalInterestPaid + item.bouncingChargesPaid;

  if (totalPaid >= totalDue && totalDue > 0) {
    return "paid";
  }

  const isPastDue = formatDateISO(asOfDate) > item.dueDate;

  if (isPastDue) {
    return totalPaid > 0 ? "partially_paid" : "overdue";
  }

  if (totalPaid > 0) {
    return "partially_paid";
  }

  return "scheduled";
}

/**
 * Calculates individual Installment Days Past Due (DPD) relative to its due date.
 * - If fully paid: DPD from due date at time of payment (0 if on time / in advance, else days difference).
 * - If unpaid or partially paid: DPD from due date relative to asOfDate.
 */
export function calculateInstallmentDpd(
  item: InstallmentItem,
  asOfDate: Date = new Date(),
): number {
  const totalDue = item.totalDue + item.penalInterestDue + item.bouncingChargesDue;
  const totalPaid = item.principalPaid + item.interestPaid + item.penalInterestPaid + item.bouncingChargesPaid;
  const isFullyPaid = totalPaid >= totalDue && totalDue > 0;

  if (isFullyPaid) {
    if (item.paidDate) {
      const due = new Date(item.dueDate);
      const paid = new Date(item.paidDate);
      if (paid.getTime() > due.getTime()) {
        return Math.max(0, Math.floor((paid.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
      }
    }
    return 0;
  }

  // Unpaid or partially paid installment
  const asOfISO = formatDateISO(asOfDate);
  if (asOfISO > item.dueDate) {
    return getDaysDifference(item.dueDate, asOfISO);
  }

  return 0;
}

/**
 * Calculates Days Past Due (DPD) and RBI SMA / NPA Classification
 */
export function calculateDpdAndSma(
  schedules: InstallmentItem[],
  asOfDate: Date = new Date(),
): { dpd: number; smaClass: SmaClassification; oldestOverdueDate?: string } {
  let maxDpd = 0;
  let oldestOverdueDate: string | undefined;

  for (const s of schedules) {
    const totalDue = s.totalDue + s.penalInterestDue + s.bouncingChargesDue;
    const totalPaid = s.principalPaid + s.interestPaid + s.penalInterestPaid + s.bouncingChargesPaid;

    if (totalPaid < totalDue) {
      const asOfISO = formatDateISO(asOfDate);
      if (asOfISO > s.dueDate) {
        const dpd = getDaysDifference(s.dueDate, asOfISO);
        if (dpd > maxDpd) {
          maxDpd = dpd;
          oldestOverdueDate = s.dueDate;
        }
      }
    }
  }

  let smaClass: SmaClassification = "Standard";
  if (maxDpd > 90) {
    smaClass = "NPA";
  } else if (maxDpd > 60) {
    smaClass = "SMA-2";
  } else if (maxDpd > 30) {
    smaClass = "SMA-1";
  } else if (maxDpd > 0) {
    smaClass = "SMA-0";
  }

  return { dpd: maxDpd, smaClass, oldestOverdueDate };
}

/**
 * Standard Institutional Payment Waterfall Allocation
 */
export function allocatePaymentWaterfall(
  schedules: InstallmentItem[],
  paymentAmount: number,
  asOfDate: Date = new Date(),
): {
  updatedSchedules: InstallmentItem[];
  allocatedCharges: number;
  allocatedPenal: number;
  allocatedInterest: number;
  allocatedPrincipal: number;
  unallocatedAmount: number;
} {
  let remaining = paymentAmount;
  let totalAllocatedCharges = 0;
  let totalAllocatedPenal = 0;
  let totalAllocatedInterest = 0;
  let totalAllocatedPrincipal = 0;

  const updatedSchedules: InstallmentItem[] = JSON.parse(JSON.stringify(schedules));

  // Step 1: Allocate to unpaid charges & penal interest across all overdue/due installments
  for (const s of updatedSchedules) {
    if (remaining <= 0) break;

    // 1.1 Bouncing charges
    const chargesDue = Math.max(0, s.bouncingChargesDue - s.bouncingChargesPaid);
    if (chargesDue > 0) {
      const pay = Math.min(remaining, chargesDue);
      s.bouncingChargesPaid += pay;
      totalAllocatedCharges += pay;
      remaining -= pay;
    }

    if (remaining <= 0) break;

    // 1.2 Penal interest
    const penalDue = Math.max(0, s.penalInterestDue - s.penalInterestPaid);
    if (penalDue > 0) {
      const pay = Math.min(remaining, penalDue);
      s.penalInterestPaid += pay;
      totalAllocatedPenal += pay;
      remaining -= pay;
    }
  }

  // Step 2: Allocate to regular interest across installments in chronological order
  for (const s of updatedSchedules) {
    if (remaining <= 0) break;

    const interestDue = Math.max(0, s.interestDue - s.interestPaid);
    if (interestDue > 0) {
      const pay = Math.min(remaining, interestDue);
      s.interestPaid += pay;
      totalAllocatedInterest += pay;
      remaining -= pay;
    }
  }

  // Step 3: Allocate to scheduled principal dues in chronological order
  for (const s of updatedSchedules) {
    if (remaining <= 0) break;

    const principalDue = Math.max(0, s.principalDue - s.principalPaid);
    if (principalDue > 0) {
      const pay = Math.min(remaining, principalDue);
      s.principalPaid += pay;
      totalAllocatedPrincipal += pay;
      remaining -= pay;
    }
  }

  // Step 4: If excess remains, apply as advance principal payment to the last or upcoming principal
  if (remaining > 0) {
    for (let i = updatedSchedules.length - 1; i >= 0; i--) {
      const s = updatedSchedules[i];
      const principalBalance = Math.max(0, s.principalDue - s.principalPaid);
      if (principalBalance > 0) {
        const pay = Math.min(remaining, principalBalance);
        s.principalPaid += pay;
        totalAllocatedPrincipal += pay;
        remaining -= pay;
        if (remaining <= 0) break;
      }
    }
  }

  // Update totalPaid, totalBalance, status, and DPD for each schedule
  for (const s of updatedSchedules) {
    s.totalPaid = s.principalPaid + s.interestPaid + s.penalInterestPaid + s.bouncingChargesPaid;
    const totalDue = s.totalDue + s.penalInterestDue + s.bouncingChargesDue;
    s.totalBalance = Math.max(0, totalDue - s.totalPaid);
    s.status = evaluateInstallmentStatus(s, asOfDate);
    s.dpd = calculateInstallmentDpd(s, asOfDate);
  }

  return {
    updatedSchedules,
    allocatedCharges: totalAllocatedCharges,
    allocatedPenal: totalAllocatedPenal,
    allocatedInterest: totalAllocatedInterest,
    allocatedPrincipal: totalAllocatedPrincipal,
    unallocatedAmount: remaining,
  };
}

/**
 * Calculates daily running interest ledger segments (Image 1).
 * Takes raw transactions and computes cumulative principal, days between events, and exact interest accrual.
 */
export function computeDailyInterestLedger(
  rawEntries: Array<{
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
  }>,
  roiPercent: number,
  dayCountConvention: "actual_365" | "30_360" = "actual_365"
): DailyLedgerEntry[] {
  if (!rawEntries || rawEntries.length === 0) return [];

  // Normalize dates: valueDate is effective calculation date, txnDate is booking date
  const normalized = rawEntries.map((item) => {
    const valueDate = item.valueDate || item.date || item.txnDate || formatDateISO(new Date());
    const txnDate = item.txnDate || item.date || item.valueDate || formatDateISO(new Date());
    return {
      ...item,
      valueDate,
      txnDate,
      date: valueDate, // standard date is value date
    };
  });

  // Sort chronologically by effective valueDate, secondary by txnDate
  const sorted = [...normalized].sort((a, b) => {
    const valDiff = new Date(a.valueDate).getTime() - new Date(b.valueDate).getTime();
    if (valDiff !== 0) return valDiff;
    return new Date(a.txnDate).getTime() - new Date(b.txnDate).getTime();
  });

  let runningCumulative = 0;
  const ledger: DailyLedgerEntry[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    const debit = Number(item.debit) || 0;
    const credit = Number(item.credit) || 0;

    // Determine balance effect
    if (item.txnType === "Disbursement") {
      runningCumulative += debit;
    } else if (item.txnType === "Principal" || item.txnType === "Collection") {
      runningCumulative -= credit;
    } else if (item.txnType === "Interest" || item.txnType === "Broken Interest" || item.txnType === "Broken Period") {
      if (debit > 0) {
        // Month-end interest is temporarily added to cumulative principal.
        runningCumulative += debit;
      }
      // Interest receipts settle accrued interest and do not reduce principal.
    } else if (item.txnType === "Interest Offset") {
      runningCumulative -= credit;
    } else if (item.txnType === "Tds") {
      // TDS is a payment of accrued interest, not a principal repayment.
    } else if (item.txnType === "Penal" || item.txnType === "Charges") {
      if (debit > 0) runningCumulative += debit;
      if (credit > 0) runningCumulative -= credit;
    } else {
      runningCumulative += debit - credit;
    }

    ledger.push({
      id: item.id || `ledger_${i}_${Date.now()}`,
      txnType: item.txnType,
      date: item.valueDate,
      txnDate: item.txnDate,
      valueDate: item.valueDate,
      narration: item.narration,
      debit,
      credit,
      cumulative: Math.max(0, runningCumulative),
      days: 0,
      interestAmount: 0,
      referenceNumber: item.referenceNumber,
      bankName: item.bankName,
      targetDueDate: item.targetDueDate,
      sourceReceiptNumber: item.sourceReceiptNumber,
    });
  }

  // Compute days & daily segment interest across balance-bearing periods using valueDate
  for (let i = 0; i < ledger.length; i++) {
    const current = ledger[i];
    const isPrincipalBearer =
      current.txnType === "Disbursement" ||
      current.txnType === "Principal" ||
      current.txnType === "Collection" ||
      (i === ledger.length - 1 && current.cumulative > 0);

    if (current.cumulative > 0 && isPrincipalBearer) {
      const curDate = new Date(current.valueDate);
      const curMonthFirst = new Date(curDate.getFullYear(), curDate.getMonth(), 1);
      const nextMonthFirst = new Date(curDate.getFullYear(), curDate.getMonth() + 1, 1);
      const nextMonthFirstStr = formatDateISO(nextMonthFirst);

      let startDateStr = current.valueDate;
      let nextDateStr: string | null = null;

      if (i + 1 < ledger.length) {
        const nextEntry = ledger[i + 1];
        const nextDate = new Date(nextEntry.valueDate);

        // If next entry is in a later month or is an interest debit for the current month-end, cap current segment to 1st of next month (broken period)
        if (
          nextDate.getFullYear() > curDate.getFullYear() ||
          nextDate.getMonth() > curDate.getMonth() ||
          nextEntry.txnType === "Interest" ||
          nextEntry.txnType === "Broken Interest" ||
          nextEntry.txnType === "Broken Period"
        ) {
          nextDateStr = nextMonthFirstStr;
        } else {
          nextDateStr = nextEntry.valueDate;
        }
      } else {
        // Active / latest running balance
        // If this latest row is an interest collection in month M (e.g. 08/10), the principal has been outstanding for the full month M since 01/10
        if (current.txnType !== "Disbursement" && current.txnType !== "Principal") {
          startDateStr = formatDateISO(curMonthFirst);
        }
        nextDateStr = nextMonthFirstStr;
      }

      if (nextDateStr) {
        const days = Math.max(0, getDaysDifference(startDateStr, nextDateStr));
        current.days = days;
        if (days > 0) {
          if (dayCountConvention === "actual_365") {
            current.interestAmount = Math.round(((current.cumulative * (roiPercent / 100) * days) / 365) * 100) / 100;
          } else {
            current.interestAmount = Math.round(((current.cumulative * (roiPercent / 1200) * days) / 30) * 100) / 100;
          }
        }
      }
    }
  }

  return ledger;
}

function dateParts(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function monthKey(value: string): string {
  const { year, month } = dateParts(value);
  return `${year}-${String(month).padStart(2, "0")}`;
}

function firstOfNextMonth(value: string): string {
  const { year, month } = dateParts(value);
  return formatDateISO(new Date(year, month, 1));
}

function lastOfMonth(value: string): string {
  const { year, month } = dateParts(value);
  return formatDateISO(new Date(year, month, 0));
}

function seventhOfNextMonth(value: string): string {
  const { year, month } = dateParts(value);
  return formatDateISO(new Date(year, month, 7));
}

function seventhOfSameMonth(value: string): string {
  const { year, month } = dateParts(value);
  return formatDateISO(new Date(year, month - 1, 7));
}

/** Late receipts are charged in the receipt month's closing debit, due on the next 7th. */
export function calculateLateInterestByPostingMonth(
  transactions: RepaymentTransaction[],
  roiPercent: number,
  dayCountConvention: "actual_365" | "30_360" = "actual_365",
): Map<string, number> {
  const charges = new Map<string, number>();
  const groups = new Map<string, { paymentDate: string; dueDate: string; amount: number }>();
  for (const payment of transactions || []) {
    if (payment.status !== "cleared" || payment.allocatedInterest <= 0) continue;
    const paymentDate = payment.paymentDate;
    const dueDate = payment.targetDueDate || seventhOfSameMonth(paymentDate);
    if (getDaysDifference(dueDate, paymentDate) <= 0) continue;
    const groupKey = `${paymentDate}|${dueDate}`;
    const group = groups.get(groupKey) || { paymentDate, dueDate, amount: 0 };
    group.amount += payment.allocatedInterest;
    groups.set(groupKey, group);
  }

  for (const group of groups.values()) {
    const dpd = getDaysDifference(group.dueDate, group.paymentDate);
    const charge = dayCountConvention === "actual_365"
      ? (group.amount * (roiPercent / 100) * dpd) / 365
      : (group.amount * (roiPercent / 1200) * dpd) / 30;
    const postingMonth = monthKey(group.paymentDate);
    charges.set(postingMonth, (charges.get(postingMonth) || 0) + charge);
  }
  return new Map([...charges].map(([month, amount]) => [month, Math.round(amount)]));
}

/**
 * Creates derived month-end interest debit/offset rows. Interest is computed
 * only on disbursed principal and principal movements; accrued interest and
 * interest receipts never become part of the principal calculation base.
 */
export function createMonthEndInterestEntries(
  rawEntries: DailyLedgerEntry[],
  transactions: RepaymentTransaction[],
  roiPercent: number,
  dayCountConvention: "actual_365" | "30_360" = "actual_365",
  asOfDate: Date = new Date(),
): DailyLedgerEntry[] {
  const sourceEntries = (rawEntries || []).filter((entry) => !entry.systemGenerated);
  const principalEvents = sourceEntries
    .filter((entry) =>
      entry.txnType === "Disbursement" ||
      entry.txnType === "Principal" ||
      entry.txnType === "Collection"
    )
    .map((entry) => ({
      ...entry,
      valueDate: entry.valueDate || entry.date || entry.txnDate,
    }))
    .filter((entry) => Boolean(entry.valueDate))
    .sort((a, b) => a.valueDate.localeCompare(b.valueDate) || (a.txnDate || "").localeCompare(b.txnDate || ""));

  if (principalEvents.length === 0 || roiPercent <= 0) return [];

  const lateInterestByMonth = calculateLateInterestByPostingMonth(transactions, roiPercent, dayCountConvention);

  const asOf = formatDateISO(asOfDate);
  const firstEvent = principalEvents[0].valueDate;
  const { year: startYear, month: startMonth } = dateParts(firstEvent);
  let monthCursor = new Date(startYear, startMonth - 1, 1);
  const generated: DailyLedgerEntry[] = [];

  // A manually posted interest debit needs the same non-cash offset as an
  // automatic month-end debit, or it would inflate the principal basis.
  for (const entry of sourceEntries.filter((item) =>
    ["Interest", "Broken Interest", "Broken Period"].includes(item.txnType) && Number(item.debit) > 0
  )) {
    const valueDate = entry.valueDate || entry.date || entry.txnDate;
    if (!valueDate || valueDate > asOf) continue;
    const hasOffset = sourceEntries.some((item) =>
      item.txnType === "Interest Offset" &&
      (item.valueDate || item.date || item.txnDate) === valueDate &&
      Number(item.credit) === Number(entry.debit)
    );
    if (hasOffset) continue;
    generated.push({
      id: `system-offset-${entry.id}`,
      txnType: "Interest Offset",
      date: valueDate,
      txnDate: entry.txnDate || valueDate,
      valueDate,
      narration: "Interest offset (non-cash assumption)",
      debit: 0,
      credit: Number(entry.debit),
      cumulative: 0,
      days: 0,
      interestAmount: 0,
      systemGenerated: true,
      action: "Auto: principal balance offset",
    });
  }

  while (monthCursor.getTime() <= asOfDate.getTime()) {
    const periodStart = formatDateISO(monthCursor);
    const { year, month } = dateParts(periodStart);
    const periodEnd = formatDateISO(new Date(year, month, 1));
    const postingDate = lastOfMonth(periodStart);
    if (postingDate > asOf) break;

    let balance = 0;
    for (const event of principalEvents) {
      if (event.valueDate >= periodStart) break;
      if (event.txnType === "Disbursement") balance += Number(event.debit) || 0;
      else balance = Math.max(0, balance - (Number(event.credit) || 0));
    }
    const periodEvents = principalEvents.filter((event) => event.valueDate >= periodStart && event.valueDate < periodEnd);
    let cursor = periodStart < firstEvent ? firstEvent : periodStart;
    let unroundedInterest = 0;

    for (const event of periodEvents) {
      const eventDate = event.valueDate;
      const days = getDaysDifference(cursor, eventDate);
      if (days > 0 && balance > 0) {
        unroundedInterest += dayCountConvention === "actual_365"
          ? (balance * (roiPercent / 100) * days) / 365
          : (balance * (roiPercent / 1200) * days) / 30;
      }

      if (event.txnType === "Disbursement") balance += Number(event.debit) || 0;
      else balance = Math.max(0, balance - (Number(event.credit) || 0));
      cursor = eventDate;
    }

    const remainingDays = getDaysDifference(cursor, periodEnd);
    if (remainingDays > 0 && balance > 0) {
      unroundedInterest += dayCountConvention === "actual_365"
        ? (balance * (roiPercent / 100) * remainingDays) / 365
        : (balance * (roiPercent / 1200) * remainingDays) / 30;
    }

    const regularInterest = Math.round(unroundedInterest);
    const lateInterest = lateInterestByMonth.get(monthKey(periodStart)) || 0;
    const totalInterest = regularInterest + lateInterest;
    const alreadyPosted = sourceEntries.some((entry) =>
      ["Interest", "Broken Interest", "Broken Period"].includes(entry.txnType) &&
      entry.debit > 0 &&
      monthKey(entry.valueDate || entry.date || entry.txnDate) === monthKey(postingDate)
    );

    if (totalInterest > 0 && !alreadyPosted) {
      const interestStart = periodStart < firstEvent ? firstEvent : periodStart;
      const dayCount = getDaysDifference(interestStart, periodEnd);
      const narration = lateInterest > 0
        ? `Month-end interest debit (includes ${lateInterest.toFixed(2)} late interest)`
        : "Month-end interest debit";
      generated.push({
        id: `system-interest-${monthKey(periodStart)}-debit`,
        txnType: "Interest",
        date: postingDate,
        txnDate: postingDate,
        valueDate: postingDate,
        narration,
        debit: totalInterest,
        credit: 0,
        cumulative: Math.max(0, balance + totalInterest),
        days: dayCount,
        interestAmount: totalInterest,
        lateInterestAmount: lateInterest,
        systemGenerated: true,
        action: "Auto: month-end debit and accrued transfer",
      });
      generated.push({
        id: `system-interest-${monthKey(periodStart)}-offset`,
        txnType: "Interest Offset",
        date: postingDate,
        txnDate: postingDate,
        valueDate: postingDate,
        narration: "Month-end interest offset (non-cash assumption)",
        debit: 0,
        credit: totalInterest,
        cumulative: Math.max(0, balance),
        days: 0,
        interestAmount: 0,
        lateInterestAmount: 0,
        systemGenerated: true,
        action: "Auto: principal balance offset",
      });
    }

    monthCursor = new Date(year, month, 1);
  }

  return generated;
}

/** Derives the accrued-interest subledger from month-end transfers and cleared receipts. */
export function buildAccruedInterestLedger(
  postings: DailyLedgerEntry[],
  transactions: RepaymentTransaction[],
  roiPercent: number,
  dayCountConvention: "actual_365" | "30_360" = "actual_365",
  asOfDate: Date = new Date(),
): AccruedInterestEntry[] {
  type Lot = { id: string; date: string; dueDate: string; original: number; remaining: number; referenceNumber?: string; maxDpd: number; lateInterest: number };
  const lots: Lot[] = [];
  const events: Array<{ date: string; priority: number; kind: "debit" | "receipt"; posting?: DailyLedgerEntry; payment?: RepaymentTransaction }> = [];

  for (const posting of postings.filter((entry) =>
    ["Interest", "Broken Interest", "Broken Period"].includes(entry.txnType) && entry.debit > 0
  )) {
    const date = posting.valueDate || posting.date;
    events.push({ date, priority: 0, kind: "debit", posting });
  }
  for (const payment of (transactions || []).filter((entry) => entry.status === "cleared" && entry.allocatedInterest > 0)) {
    events.push({ date: payment.paymentDate, priority: 1, kind: "receipt", payment });
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.priority - b.priority);

  const ledger: AccruedInterestEntry[] = [];
  let balance = 0;
  for (const event of events) {
    if (event.kind === "debit" && event.posting) {
      const posting = event.posting;
      const dueDate = seventhOfNextMonth(event.date);
      const lot: Lot = {
        id: posting.id,
        date: event.date,
        dueDate,
        original: posting.debit,
        remaining: posting.debit,
        referenceNumber: posting.referenceNumber,
        maxDpd: 0,
        lateInterest: 0,
      };
      lots.push(lot);
      balance += posting.debit;
      ledger.push({
        id: `${posting.id}-accrued`,
        date: event.date,
        txnType: "Interest Transfer",
        narration: posting.narration,
        txnDate: posting.txnDate,
        valueDate: event.date,
        debit: posting.debit,
        credit: 0,
        cumulative: balance,
        dueDate,
        dpd: 0,
        lateInterest: 0,
        lateChargeIncluded: posting.lateInterestAmount || 0,
        referenceNumber: posting.referenceNumber,
      });
      continue;
    }

    if (!event.payment) continue;
    const payment = event.payment;
    let remainingReceipt = payment.allocatedInterest;
    let totalLateInterest = 0;
    let maxDpd = 0;
    const targetDueDate = payment.targetDueDate;
    const orderedLots = [
      ...lots.filter((lot) => lot.remaining > 0 && targetDueDate && lot.dueDate === targetDueDate),
      ...lots.filter((lot) => lot.remaining > 0 && (!targetDueDate || lot.dueDate !== targetDueDate)),
    ];

    for (const lot of orderedLots) {
      if (remainingReceipt <= 0) break;
      const applied = Math.min(remainingReceipt, lot.remaining);
      const dpd = Math.max(0, getDaysDifference(lot.dueDate, payment.paymentDate));
      const lateInterest = dpd > 0
        ? Math.round(dayCountConvention === "actual_365"
          ? (applied * (roiPercent / 100) * dpd / 365)
          : (applied * (roiPercent / 1200) * dpd / 30))
        : 0;
      lot.remaining -= applied;
      lot.maxDpd = Math.max(lot.maxDpd, dpd);
      lot.lateInterest += lateInterest;
      remainingReceipt -= applied;
      totalLateInterest += lateInterest;
      maxDpd = Math.max(maxDpd, dpd);
    }

    const appliedReceipt = payment.allocatedInterest - remainingReceipt;
    balance = Math.max(0, balance - appliedReceipt);
    ledger.push({
      id: `receipt-${payment.id}-accrued`,
      date: payment.paymentDate,
      txnType: "Payment Receipt",
      narration: `Interest receipt${payment.receiptNumber ? ` ${payment.receiptNumber}` : ""}`,
      txnDate: payment.paymentDate,
      valueDate: payment.paymentDate,
      debit: 0,
      credit: appliedReceipt,
      cumulative: balance,
      dueDate: targetDueDate,
      dpd: maxDpd,
      lateInterest: totalLateInterest,
      referenceNumber: payment.referenceNumber,
      paymentMode: payment.paymentMode,
      repaymentId: payment.id.startsWith("manual-") ? undefined : payment.id,
      sourceLedgerEntryId: payment.id.startsWith("manual-") ? payment.id.slice("manual-".length) : undefined,
    });
  }

  const currentDate = formatDateISO(asOfDate);
  for (const row of ledger) {
    if (row.txnType !== "Interest Transfer") continue;
    const lot = lots.find((item) => `${item.id}-accrued` === row.id);
    if (!lot) continue;
    row.dpd = lot.remaining > 0 ? Math.max(lot.maxDpd, getDaysDifference(lot.dueDate, currentDate)) : lot.maxDpd;
    row.lateInterest = lot.lateInterest;
    row.outstanding = lot.remaining;
  }

  return ledger;
}

export function getAccruedInterestBalance(entries: AccruedInterestEntry[]): number {
  return entries.length ? entries[entries.length - 1].cumulative : 0;
}

/**
 * Calculates Updated As-Actual Monthly EMI Realization Schedule (Image 2).
 */
export function computeActualMonthlySchedule(
  dailyLedger: DailyLedgerEntry[],
  scheduledItems: InstallmentItem[],
  config: LoanServicingConfig,
  accruedInterestLedger: AccruedInterestEntry[] = [],
  asOfDate: Date = new Date(),
  transactions: RepaymentTransaction[] = [],
): ActualMonthlyScheduleItem[] {
  type Period = {
    dueDate?: string;
    brokenPeriod: boolean;
    scheduledInterestDue: number;
    scheduledInterestPaid: number;
    postedInterestDue: number;
    postedLateCharge: number;
    projectedLateCharge: number;
    postedInterestOpen: number;
    postedDpd: number;
    hasPostedInterest: boolean;
    principalDue: number;
    scheduledPrincipalPaid: number;
    principalReceived: number;
    tdsReceived: number;
  };
  const periods = new Map<string, Period>();
  const ensurePeriod = (key: string): Period => {
    let period = periods.get(key);
    if (!period) {
      period = {
        brokenPeriod: false,
        scheduledInterestDue: 0,
        scheduledInterestPaid: 0,
        postedInterestDue: 0,
        postedLateCharge: 0,
        projectedLateCharge: 0,
        postedInterestOpen: 0,
        postedDpd: 0,
        hasPostedInterest: false,
        principalDue: 0,
        scheduledPrincipalPaid: 0,
        principalReceived: 0,
        tdsReceived: 0,
      };
      periods.set(key, period);
    }
    return period;
  };

  for (const installment of scheduledItems) {
    const period = ensurePeriod(installment.dueDate.slice(0, 7));
    period.dueDate = installment.dueDate;
    period.brokenPeriod ||= installment.installmentNumber === 0;
    period.scheduledInterestDue += installment.interestDue;
    period.scheduledInterestPaid += installment.interestPaid;
    period.principalDue += installment.principalDue;
    period.scheduledPrincipalPaid += installment.principalPaid;
  }

  for (const [postingMonth, charge] of calculateLateInterestByPostingMonth(
    transactions, config.roiPercent, config.dayCountConvention,
  )) {
    const dueMonth = firstOfNextMonth(`${postingMonth}-01`);
    const period = ensurePeriod(dueMonth.slice(0, 7));
    period.dueDate ||= seventhOfNextMonth(`${postingMonth}-01`);
    period.projectedLateCharge += charge;
  }

  // Principal receipts appear in the running ledger on their actual value date.
  for (const entry of dailyLedger) {
    if ((entry.txnType === "Principal" || entry.txnType === "Collection") && entry.credit > 0) {
      ensurePeriod(entry.valueDate.slice(0, 7)).principalReceived += entry.credit;
    }
  }

  // An interest debit belongs to the month in which it is due (the 7th), and
  // its settled amount comes from the accrued account's remaining debit lot.
  for (const entry of accruedInterestLedger) {
    if (entry.txnType === "Interest Transfer") {
      const dueDate = entry.dueDate || seventhOfNextMonth(entry.date);
      const period = ensurePeriod(dueDate.slice(0, 7));
      period.dueDate = dueDate;
      period.hasPostedInterest = true;
      period.postedInterestDue += entry.debit;
      period.postedLateCharge += entry.lateChargeIncluded || 0;
      period.postedInterestOpen += entry.outstanding ?? entry.debit;
      period.postedDpd = Math.max(period.postedDpd, entry.dpd);
    } else if (entry.txnType === "Payment Receipt" && entry.paymentMode === "TDS Credit" && entry.dueDate) {
      ensurePeriod(entry.dueDate.slice(0, 7)).tdsReceived += entry.credit;
    }
  }

  const asOf = formatDateISO(asOfDate);
  const sortedLedger = [...dailyLedger].sort((a, b) => a.valueDate.localeCompare(b.valueDate));
  let ledgerIndex = 0;
  let principalOutstanding = 0;

  return [...periods.keys()].sort().map((key) => {
    const period = periods.get(key)!;
    const [year, month] = key.split("-").map(Number);
    const monthEnd = formatDateISO(new Date(year, month, 0));
    while (ledgerIndex < sortedLedger.length && sortedLedger[ledgerIndex].valueDate <= monthEnd) {
      principalOutstanding = sortedLedger[ledgerIndex].cumulative;
      ledgerIndex++;
    }

    const lateInterestDue = Math.round(period.hasPostedInterest ? period.postedLateCharge : period.projectedLateCharge);
    const regularInterestDue = Math.round(period.hasPostedInterest
      ? period.postedInterestDue - period.postedLateCharge
      : period.scheduledInterestDue);
    const interestDue = regularInterestDue + lateInterestDue;
    const openInterest = Math.max(0, Math.round(
      period.hasPostedInterest
        ? period.postedInterestOpen
        : interestDue - period.scheduledInterestPaid,
    ));
    const interestRecvd = Math.max(0, interestDue - openInterest);
    const principalDue = Math.round(period.principalDue);
    const principalRecvd = Math.round(period.principalReceived);
    const principalStillDue = Math.max(0, period.principalDue - period.scheduledPrincipalPaid);
    const dueDate = period.dueDate || formatDateISO(new Date(year, month - 1, 7));
    const overdue = dueDate < asOf ? Math.round(openInterest + principalStillDue) : 0;
    const unpaid = openInterest + principalStillDue;
    const status: InstallmentStatus = unpaid <= 0 && interestDue + principalDue + principalRecvd > 0
      ? "paid"
      : dueDate < asOf
        ? interestRecvd + period.scheduledPrincipalPaid > 0 ? "partially_paid" : "overdue"
        : interestRecvd + period.scheduledPrincipalPaid > 0 ? "partially_paid" : "scheduled";
    const monthName = new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });

    return {
      periodKey: key,
      brokerPeriod: period.brokenPeriod ? `Broken period · ${monthName}` : monthName,
      dueDate,
      principal: config.disbursedAmount,
      interestDue,
      regularInterestDue,
      lateInterestDue,
      principalDue,
      principalRecvd,
      interestRecvd,
      tdsRecvd: Math.round(period.tdsReceived),
      openInterest,
      overdue,
      prepaymentOrOverdue: principalRecvd > principalDue ? -(principalRecvd - principalDue) : overdue,
      outstanding: Math.max(0, principalOutstanding),
      status,
      dpd: Math.max(period.postedDpd, overdue > 0 ? getDaysDifference(dueDate, asOf) : 0),
    };
  });
}
