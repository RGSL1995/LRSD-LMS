export type BorrowerType = "individual" | "corporate" | "other";
export type DocumentStage = "kyc" | "financial";

export const CATEGORY_LABELS: Record<string, string> = {
  pan_card: "PAN Card",
  identity_proof: "Identity Proof (Aadhaar / Passport / Voter ID / DL)",
  address_proof: "Address Proof",
  photograph: "Photograph",
  company_incorporation_docs: "Incorporation Docs (MOA / AOA / INC-22)",
  gst_certificate: "GST Certificate",
  shareholder_director_list: "List of Shareholders & Directors",
  itr_or_form16: "ITR / Form 16",
  salary_slips: "Salary Slips",
  bank_statement: "Bank Statement (last 6 months)",
  balance_sheet_pl: "Balance Sheet & P&L (last 2 years)",
  net_worth_certificate: "Net Worth Certificate",
  other: "Other Document",
};

const KYC_CATEGORIES: Record<BorrowerType, string[]> = {
  individual: ["pan_card", "identity_proof", "address_proof", "photograph"],
  corporate: [
    "pan_card",
    "company_incorporation_docs",
    "gst_certificate",
    "shareholder_director_list",
    "address_proof",
  ],
  other: ["pan_card", "identity_proof", "address_proof"],
};

const FINANCIAL_CATEGORIES: Record<BorrowerType, string[]> = {
  individual: ["itr_or_form16", "salary_slips", "bank_statement"],
  corporate: ["balance_sheet_pl", "bank_statement", "net_worth_certificate", "itr_or_form16"],
  other: ["bank_statement", "itr_or_form16", "other"],
};

export function categoriesFor(stage: DocumentStage, borrowerType: BorrowerType): string[] {
  return stage === "kyc" ? KYC_CATEGORIES[borrowerType] : FINANCIAL_CATEGORIES[borrowerType];
}
