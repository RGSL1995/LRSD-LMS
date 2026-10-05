export interface LASSecurityItem {
  id: string;
  security_name: string;
  isin: string;
  quantity: number;
  cmp: number;
  market_value: number;
  security_cover: number; // e.g. 2.5
  loan_value: number;
  pledgor_name: string;
  pledgor_borrower_id?: string;
  pledgor_pan?: string;
  is_guarantor?: boolean;
  guarantee_type?: "personal" | "corporate";
}

export interface SecurityProviderOption {
  id: string; // borrower_id or unique identifier
  name: string;
  pan?: string;
  isGuarantor?: boolean;
  guaranteeType?: "personal" | "corporate";
  isSecurityProvider?: boolean;
  isPrimary?: boolean;
}

export interface SecurityProviderGroup {
  providerId: string;
  providerName: string;
  pan?: string;
  isGuarantor?: boolean;
  guaranteeType?: "personal" | "corporate";
  isPrimary?: boolean;
  securities: LASSecurityItem[];
  totalMarketValue: number;
  totalLoanValue: number;
  scripsCount: number;
}

/**
 * Formats a number with Indian comma grouping (lakhs, crores).
 * e.g. 125500 -> "1,25,500"
 * e.g. 25100000 -> "2,51,00,000"
 */
export function formatIndianNumber(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "0";
  return Number(val).toLocaleString("en-IN");
}

/**
 * Calculates overall security cover ratio: Total Market Value / Total Loan Value
 */
export function calculateCoverageRatio(
  totalMarketValue: number,
  totalLoanValue: number
): number {
  if (totalLoanValue <= 0 || totalMarketValue <= 0) return 0;
  return Number((totalMarketValue / totalLoanValue).toFixed(2));
}

export type CoverageStatus = "healthy" | "margin_call" | "surplus" | "zero";

export function getCoverageStatus(ratio: number): {
  status: CoverageStatus;
  label: string;
  colorClass: string;
  description: string;
} {
  if (ratio <= 0) {
    return {
      status: "zero",
      label: "No Cover",
      colorClass: "bg-muted text-muted-foreground border-border",
      description: "No pledged securities recorded.",
    };
  }
  if (ratio < 2.5) {
    return {
      status: "margin_call",
      label: `${ratio}x (Under Cover)`,
      colorClass: "bg-destructive/10 text-destructive border-destructive/30",
      description: "Coverage is below the 2.5x policy minimum. Additional shares required.",
    };
  }
  if (ratio <= 5.0) {
    return {
      status: "healthy",
      label: `${ratio}x (Healthy Cover)`,
      colorClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      description: "Coverage complies with the 2.5x to 5.0x target policy zone.",
    };
  }
  return {
    status: "surplus",
    label: `${ratio}x (Surplus Cover)`,
    colorClass: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
    description: "Coverage exceeds 5.0x. Borrower is eligible to request release of excess shares.",
  };
}
