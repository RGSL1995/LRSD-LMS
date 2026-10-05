import {
  type InstallmentItem,
  type LoanServicingConfig,
  type SmaClassification,
  type InstallmentStatus,
  type DailyLedgerEntry,
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

/**
 * Generates an institutional Bullet Repayment Schedule (LRSD standard).
 *
 * Installment 0: Broken period (disbursement date to 1st of next month)
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
    dueDate: formatDateISO(nextMonthFirst),
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
    const dueDate = new Date(nextMonthFirst.getFullYear(), nextMonthFirst.getMonth() + m, 1);
    const monthName = periodStart.toLocaleDateString("en-US", { month: "short", year: "numeric" });

    const isFinalMonth = m === tenureMonths;
    const principalDue = isFinalMonth ? disbursedAmount : 0;
    const closingPrincipal = isFinalMonth ? 0 : disbursedAmount;

    let interestDue = 0;
    if (dayCountConvention === "actual_365") {
      const monthDays = getDaysDifference(formatDateISO(periodStart), formatDateISO(dueDate));
      interestDue = Math.round((disbursedAmount * (roiPercent / 100) * monthDays) / 365);
    } else {
      interestDue = Math.round((disbursedAmount * roiPercent) / 1200);
    }

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
    dueDate: formatDateISO(nextMonthFirst),
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
    const dueDate = new Date(nextMonthFirst.getFullYear(), nextMonthFirst.getMonth() + m, 1);
    const monthName = periodStart.toLocaleDateString("en-US", { month: "short", year: "numeric" });

    const isMoratorium = m <= actualMoratorium;
    const isFinalMonth = m === tenureMonths;

    let principalDue = 0;
    let interestDue = 0;

    if (dayCountConvention === "actual_365") {
      const monthDays = getDaysDifference(formatDateISO(periodStart), formatDateISO(dueDate));
      interestDue = Math.round((currentPrincipal * (roiPercent / 100) * monthDays) / 365);
    } else {
      interestDue = Math.round(currentPrincipal * r);
    }

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
    const dueDate = new Date(startDate.getFullYear(), startDate.getMonth() + (m - 1), 1);
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

  const dueDate = new Date(item.dueDate);
  const isPastDue = asOfDate.getTime() > dueDate.getTime();

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
  const dueDate = new Date(item.dueDate);
  if (asOfDate.getTime() > dueDate.getTime()) {
    return Math.max(0, Math.floor((asOfDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
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
      const dueDate = new Date(s.dueDate);
      if (asOfDate.getTime() > dueDate.getTime()) {
        const dpd = Math.max(0, Math.floor((asOfDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
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
        // Interest debited
        runningCumulative += debit;
      } else if (credit > 0) {
        // Interest payment received
        runningCumulative -= credit;
      }
    } else if (item.txnType === "Tds") {
      runningCumulative -= credit;
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

/**
 * Calculates Updated As-Actual Monthly EMI Realization Schedule (Image 2).
 */
export function computeActualMonthlySchedule(
  dailyLedger: DailyLedgerEntry[],
  scheduledItems: InstallmentItem[],
  config: LoanServicingConfig
): ActualMonthlyScheduleItem[] {
  const monthMap = new Map<string, {
    brokerPeriod: string;
    debits: number;
    principalRecvd: number;
    interestDue: number;
    interestRecvd: number;
    tdsRecvd: number;
    lastCumulative: number;
    initialPrincipal: number;
  }>();

  // First seed from scheduled items
  for (const s of scheduledItems) {
    const d = new Date(s.dueDate);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthName = d.toLocaleDateString("en-US", { month: "long" });
    const periodLabel = s.installmentNumber === 0 ? "Broken Period" : monthName;

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        brokerPeriod: periodLabel,
        debits: s.principalDue,
        principalRecvd: s.principalPaid,
        interestDue: s.interestDue,
        interestRecvd: s.interestPaid,
        tdsRecvd: 0,
        lastCumulative: s.closingPrincipal,
        initialPrincipal: s.openingPrincipal,
      });
    }
  }

  // Overlay actuals from daily ledger
  for (const entry of dailyLedger) {
    const d = new Date(entry.date);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthName = d.toLocaleDateString("en-US", { month: "long" });

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        brokerPeriod: monthName,
        debits: 0,
        principalRecvd: 0,
        interestDue: 0,
        interestRecvd: 0,
        tdsRecvd: 0,
        lastCumulative: entry.cumulative,
        initialPrincipal: entry.cumulative,
      });
    }

    const data = monthMap.get(monthKey)!;
    if (entry.interestAmount > 0) {
      data.interestDue = (data.interestDue || 0) + entry.interestAmount;
    }
    if (entry.txnType === "Principal") {
      data.principalRecvd += entry.credit;
    }
    if ((entry.txnType === "Interest" || entry.txnType === "Broken Interest" || entry.txnType === "Broken Period") && entry.credit > 0) {
      data.interestRecvd += entry.credit;
    }
    if (entry.txnType === "Tds") {
      data.tdsRecvd += entry.credit;
      data.interestRecvd += entry.credit;
    }
    data.lastCumulative = entry.cumulative;
  }

  const result: ActualMonthlyScheduleItem[] = [];
  let runningOutstanding = config.disbursedAmount;

  const sortedKeys = Array.from(monthMap.keys()).sort();

  for (const key of sortedKeys) {
    const data = monthMap.get(key)!;
    const principalDue = 0;
    const interestDue = Math.round(data.interestDue);
    const principalRecvd = Math.round(data.principalRecvd);
    const interestRecvd = Math.round(data.interestRecvd);

    const overdue = Math.max(0, interestDue - interestRecvd);
    const prepaymentOrOverdue = principalRecvd > 0 ? -principalRecvd : overdue;

    runningOutstanding = Math.max(0, runningOutstanding - principalRecvd);

    result.push({
      periodKey: key,
      brokerPeriod: data.brokerPeriod,
      principal: config.disbursedAmount,
      interestDue,
      principalDue,
      principalRecvd,
      interestRecvd,
      tdsRecvd: data.tdsRecvd,
      overdue,
      prepaymentOrOverdue,
      outstanding: runningOutstanding,
      status: overdue > 0 ? "overdue" : "paid",
      dpd: overdue > 0 ? 30 : 0,
    });
  }

  return result;
}


