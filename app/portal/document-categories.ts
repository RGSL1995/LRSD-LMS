// Shared document category definitions for the loan application's document
// collection - used both by the borrower-facing review portal and by the
// internal staff uploader on the loan application page, so the two stay
// in sync (one source of truth for categories, mandatory-doc rules, etc).

// Four groups. Each maps to one of the two DB `stage` values (the
// document_stage enum only has 'kyc' | 'financial') but the categories
// within give the finer breakdown the underwriting team asked for.
export const DOCUMENT_GROUPS = {
  kyc: {
    label: "1. KYC",
    dbStage: "kyc" as const,
    items: [
      { value: "pan_card", label: "PAN Card" },
      { value: "aadhaar_masked", label: "Aadhaar Card (Masked)" },
      { value: "passport", label: "Passport" },
      { value: "driving_license", label: "Driving License" },
    ],
  },
  net_worth: {
    label: "2. Net Worth Certificate",
    dbStage: "financial" as const,
    items: [
      { value: "net_worth_certificate", label: "Net Worth Certificate (Corporate / Individual)" },
    ],
  },
  financial: {
    label: "3. Financials",
    dbStage: "financial" as const,
    items: [{ value: "itr_signed_stamped", label: "Income Tax Return (Signed & Stamped)" }],
  },
  corporate: {
    label: "4. Corporate",
    dbStage: "kyc" as const,
    items: [
      { value: "moa", label: "Memorandum of Association (MOA)" },
      { value: "aoa", label: "Articles of Association (AOA)" },
      { value: "gst_certificate", label: "GST Certificate" },
      { value: "mca_documents", label: "MCA Master Data / Incorporation Documents" },
      { value: "lei_certificate", label: "Legal Entity Identifier (LEI) Certificate" },
    ],
  },
} as const;

export type DocumentGroupKey = keyof typeof DOCUMENT_GROUPS;
export type CategoryItem = { readonly value: string; readonly label: string };

export const ALL_CATEGORY_LABELS: readonly CategoryItem[] = [
  ...DOCUMENT_GROUPS.kyc.items,
  ...DOCUMENT_GROUPS.net_worth.items,
  ...DOCUMENT_GROUPS.financial.items,
  ...DOCUMENT_GROUPS.corporate.items,
];

// All four corporate documents are mandatory when the applicant is a corporate entity.
export const CORPORATE_REQUIRED = ["moa", "aoa", "gst_certificate", "mca_documents", "lei_certificate"] as const;

// Full allowlist accepted by the upload server actions (portal + staff).
// Includes legacy categories from the pre-4-group borrower-documents flow
// so old links/integrations don't break.
export const VALID_DOCUMENT_CATEGORIES = [
  ...ALL_CATEGORY_LABELS.map((c) => c.value),
  "identity_proof",
  "address_proof",
  "photograph",
  "company_incorporation_docs",
  "shareholder_director_list",
  "itr_or_form16",
  "salary_slips",
  "bank_statement",
  "balance_sheet_pl",
  "other",
];
