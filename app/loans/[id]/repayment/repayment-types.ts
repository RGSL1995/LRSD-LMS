// TypeScript type definitions for Loan Repayment Schedule & Servicing

export type InstallmentStatus =
  | "scheduled"
  | "due"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "waived";

export type RepaymentMode =
  | "bullet" // Interest-only for 1..N-1, Full bullet principal in final month N
  | "moratorium_emi" // Interest-only during M months moratorium, then Reducing Balance EMI for remaining months
  | "moratorium_equal_principal" // Interest-only during M months moratorium, then Equal Principal (P / remaining_months) + monthly interest
  | "emi"; // Standard Reducing Balance EMI from Month 1

export type PaymentMethod =
  | "NACH"
  | "PDC"
  | "NEFT"
  | "RTGS"
  | "Cheque"
  | "UPI"
  | "Cash"
  | "Internal Transfer"
  | "TDS Credit";

export type PaymentType =
  | "regular_installment"
  | "part_prepayment"
  | "foreclosure"
  | "penal_settlement"
  | "cash_top_up"
  | "charge_fee"
  | "disbursement"
  | "tds_credit"
  | "interest_debit";

export type LedgerTxnType =
  | "Disbursement"
  | "Principal"
  | "Collection"
  | "Interest"
  | "Interest Offset"
  | "Broken Interest"
  | "Broken Period"
  | "Tds"
  | "Penal"
  | "Charges"
  | "Other";

export type PaymentStatus = "cleared" | "bounced" | "pending" | "reversed";

export type SmaClassification = "Standard" | "SMA-0" | "SMA-1" | "SMA-2" | "NPA";

export interface InstallmentItem {
  id?: string;
  installmentNumber: number;
  dueDate: string; // YYYY-MM-DD
  periodLabel: string;
  openingPrincipal: number;
  principalDue: number;
  interestDue: number;
  totalDue: number;
  closingPrincipal: number;

  principalPaid: number;
  interestPaid: number;
  penalInterestDue: number;
  penalInterestPaid: number;
  bouncingChargesDue: number;
  bouncingChargesPaid: number;

  totalPaid: number;
  totalBalance: number;
  status: InstallmentStatus;
  dpd?: number; // Days Past Due from due date
  paidDate?: string;
  paymentMode?: string;
  remarks?: string;
}

/**
 * Image 1: Daily Running Interest & Transaction Segment Ledger
 */
export interface DailyLedgerEntry {
  id: string;
  loanApplicationId?: string;
  txnType: LedgerTxnType;
  date: string; // YYYY-MM-DD (legacy / value date representation)
  txnDate: string; // YYYY-MM-DD (Booking / Transaction Date)
  valueDate: string; // YYYY-MM-DD (Effective Value Date for day counts & interest accrual)
  narration: string; // e.g. "RTGS", "Collection", "Interest Debited", "TDS Assets", "Payment Received"
  debit: number;
  credit: number;
  cumulative: number; // Running principal / balance
  days: number; // Number of days to next date or month-end
  interestAmount: number; // Daily segment interest calculated: cumulative * roi% * (days / 365)
  lateInterestAmount?: number;
  referenceNumber?: string;
  bankName?: string;
  targetDueDate?: string;
  sourceReceiptNumber?: string;
  /** Present only for derived month-end entries; these are never persisted as source transactions. */
  systemGenerated?: boolean;
  action?: string;
  createdAt?: string;
}

export interface AccruedInterestEntry {
  id: string;
  date: string;
  txnType: "Interest Transfer" | "Payment Receipt";
  narration: string;
  txnDate: string;
  valueDate: string;
  debit: number;
  credit: number;
  cumulative: number;
  outstanding?: number;
  dueDate?: string;
  dpd: number;
  lateInterest: number;
  /** Late charge already included in this month's interest transfer. */
  lateChargeIncluded?: number;
  referenceNumber?: string;
  paymentMode?: PaymentMethod;
  repaymentId?: string;
  sourceLedgerEntryId?: string;
}

/**
 * Image 2: Updated EMI Schedule - As Actual (Monthly realized schedule)
 */
export interface ActualMonthlyScheduleItem {
  periodKey: string; // e.g. "2026-06"
  brokerPeriod: string; // e.g. "Broker Period", "June", "July", "August"
  dueDate?: string;
  principal: number; // Base / Sanctioned active principal
  interestDue: number; // Posted accrued interest, or projected interest before posting
  regularInterestDue: number;
  lateInterestDue: number;
  principalDue: number; // Scheduled principal due (0 for bullet / moratorium)
  principalRecvd: number; // Principal payments value-dated in this month
  interestRecvd: number; // Interest applied against this due month (TDS + Cash)
  openInterest: number;
  tdsRecvd?: number; // TDS deducted
  overdue: number; // Unpaid dues
  prepaymentOrOverdue: number; // Prepayment (negative) or Overdue (positive)
  outstanding: number; // Closing outstanding balance at period end
  status: InstallmentStatus;
  dpd: number;
}

export interface RepaymentTransaction {
  id: string;
  receiptNumber: string;
  paymentDate: string;
  targetDueDate?: string; // Target installment due date
  dpd?: number; // Days past due at time of repayment
  amount: number;
  allocatedPrincipal: number;
  allocatedInterest: number;
  allocatedPenal: number;
  allocatedCharges: number;
  paymentMode: PaymentMethod;
  referenceNumber?: string;
  bankName?: string;
  paymentType: PaymentType;
  status: PaymentStatus;
  bouncedDate?: string;
  bounceReason?: string;
  notes?: string;
  createdAt: string;
}

export interface LoanServicingConfig {
  disbursementDate: string;
  disbursedAmount: number;
  repaymentMode: RepaymentMode;
  roiPercent: number;
  tenureMonths: number;
  tenureDays: number;
  moratoriumMonths: number; // e.g., 24 months of moratorium in a 36-month loan
  dayCountConvention: "actual_365" | "30_360";
  penalInterestRate: number; // e.g. 2.0% p.a.
  bouncingChargeAmount: number; // e.g. Rs. 1,000
}

export interface LoanServicingSummary {
  applicationId: string;
  applicationCode: string;
  borrowerName: string;
  borrowerType: string;
  borrowerPan?: string;

  disbursedAmount: number;
  currentPrincipalOutstanding: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  totalPenalPaid: number;
  totalChargesPaid: number;
  totalCollected: number;

  totalOverdue: number;
  overduePrincipal: number;
  overdueInterest: number;
  overduePenal: number;
  overdueCharges: number;

  nextDueDate?: string;
  nextDueAmount: number;
  dpd: number; // Days Past Due
  smaClass: SmaClassification;

  config: LoanServicingConfig;
  schedules: InstallmentItem[];
  actualSchedules: ActualMonthlyScheduleItem[];
  dailyLedger: DailyLedgerEntry[];
  accruedInterestLedger: AccruedInterestEntry[];
  accruedInterestOutstanding: number;
  lateInterestCarryForward: number;
  transactions: RepaymentTransaction[];
}

export interface RecordPaymentInput {
  paymentDate: string;
  targetDueDate?: string;
  dpd?: number;
  amount: number; // Net amount received in bank / cash
  isTdsDeducted?: boolean; // Whether TDS was deducted by borrower (e.g. 10% under Sec 194A)
  tdsRatePercent?: number; // e.g. 10
  tdsAmount?: number; // e.g. ₹20,000
  grossInterestAmount?: number; // e.g. ₹200,000 (amount + tdsAmount)
  paymentMode: PaymentMethod;
  paymentType: PaymentType;
  txnType?: LedgerTxnType;
  narration?: string;
  referenceNumber?: string;
  bankName?: string;
  notes?: string;
}

export interface AccruedReceiptEditInput {
  paymentDate: string;
  targetDueDate: string;
  amount: number;
  referenceNumber?: string;
}

export interface AddLedgerTxnInput {
  txnType: LedgerTxnType;
  date?: string; // fallback YYYY-MM-DD
  txnDate?: string; // YYYY-MM-DD (Booking / Transaction Date)
  valueDate?: string; // YYYY-MM-DD (Effective Value Date)
  narration: string;
  debit?: number;
  credit?: number;
  referenceNumber?: string;
  bankName?: string;
  targetDueDate?: string; // Due date for an accrued-interest receipt
  // TDS automatic twin entry
  autoSplitTds?: boolean;
  tdsRatePercent?: number;
  tdsAmount?: number;
  netCreditAmount?: number;
}
