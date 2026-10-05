// Shared types for the Credit Appraisal Memo (CAM) feature.
//
// A CAM mixes two kinds of content:
//  - Auto-filled: pulled live from the loan application / borrower / parties
//    / collateral / corporate financials tables already in the system.
//  - Manual: entered by the credit team (CIBIL, banking analysis, Google
//    search checks, litigation, underwriting judgment, risk & mitigation,
//    verification remarks) - stored in cam_documents / cam_party_credit_data.

export type CamBankingRow = {
  month: string;
  day5: string;
  day15: string;
  day25: string;
  monthEndBalance: string;
};

export type CamCreditFacilityRow = {
  type: string;
  ownership: string;
  date: string;
  sanction: string;
  pos: string;
  dpd: string;
};

export type CamItrRow = {
  incomeHead: string;
  values: Record<string, string>; // financial year -> amount
};

export type CamPartyManualData = {
  borrowerId: string;
  cibilScore: string;
  cibilOverdue: string;
  cibilDpd: string;
  cibilEnquiries3m: string;
  cibilLoans3m: string;
  cibilRemarks: string;
  bankingAnalysis: CamBankingRow[];
  creditFacilities: CamCreditFacilityRow[];
  itrData: CamItrRow[];
};

export type CamRisk = { risk: string; mitigate: string };
export type CamGoogleSearchResult = { partyName: string; result: string };
export type CamVerificationItem = { particular: string; remark: string };
export type CamPromoterProfile = { name: string; din: string; text: string };

export type CamManualData = {
  aboutCompanyText: string;
  promoterProfiles: CamPromoterProfile[];
  underwritingJustification: string; // one bullet per line
  risks: CamRisk[];
  googleSearchResults: CamGoogleSearchResult[];
  verification: CamVerificationItem[];
  preparedBy: string;
  approvedBy: string;
  status: "draft" | "finalized";
  parties: Record<string, CamPartyManualData>; // keyed by borrower_id
};

export function emptyCamPartyData(borrowerId: string): CamPartyManualData {
  return {
    borrowerId,
    cibilScore: "",
    cibilOverdue: "",
    cibilDpd: "",
    cibilEnquiries3m: "",
    cibilLoans3m: "",
    cibilRemarks: "",
    bankingAnalysis: [],
    creditFacilities: [],
    itrData: [],
  };
}

export function emptyCamManualData(): CamManualData {
  return {
    aboutCompanyText: "",
    promoterProfiles: [],
    underwritingJustification: "",
    risks: [],
    googleSearchResults: [],
    verification: [],
    preparedBy: "",
    approvedBy: "",
    status: "draft",
    parties: {},
  };
}

// ---- Auto-filled data compiled from the loan application ----

export type CamCorporateFinancialRow = {
  financialYear: string;
  netRevenue: string;
  ebitda: string;
  ebitdaMargin: string;
  pat: string;
  netMargin: string;
  totalEquity: string;
  debtToEquity: string;
  currentRatio: string;
  interestCoverageRatio: string;
};

export type CamAutoParty = {
  borrowerId: string;
  name: string;
  roleLabel: string; // "Borrower", "Guarantor-1", etc.
  isCompany: boolean;
  pan?: string;
  cin?: string;
  email?: string;
  phone?: string;
  address?: string;
  kyc: Record<string, string>; // ordered label -> value, rendered as a KYC table
};

export type CamAutoData = {
  applicationId: string;
  applicationCode: string;
  facilityType: string;
  requestedAmountNum: number;
  sanctionAmountText: string;
  tenureMonths: number;
  purpose: string;
  borrower: {
    name: string;
    cin: string;
    pan: string;
    gstin: string;
    address: string;
    tradeName?: string;
  };
  guarantorSummaries: string[]; // "Mr. X, Role (Guarantor-1)"
  securities: Array<{
    id?: string;
    scripName: string;
    quantity: string;
    quantityNum?: number;
    price: string;
    priceNum?: number;
    marketValue: string;
    marketValueNum?: number;
    isin?: string;
    pledgorName?: string;
    pledgorBorrowerId?: string;
  }>;
  totalSecurityMarketValueNum: number;
  totalSecurityMarketValue: string;
  securityCoverRatio: number;
  ltvPercent: number;
  marginCallThreshold: string;
  liquidationThreshold: string;
  corporateFinancials: CamCorporateFinancialRow[];
  parties: CamAutoParty[]; // borrower + guarantors, for KYC + manual data alignment
  approvers?: CamApproverItem[];
};

export type CamApprovalStatus = "pending" | "approved" | "rejected" | "approved_with_conditions";

export type CamApproverItem = {
  id: string;
  camDocumentId?: string | null;
  loanApplicationId: string;
  approverName: string;
  approverEmail: string;
  approverRole: string;
  approvalStatus: CamApprovalStatus;
  approvalToken: string;
  tokenExpiresAt?: string | null;
  sentAt?: string | null;
  decisionAt?: string | null;
  comments?: string | null;
  conditions?: string | null;
  digitalSignature?: string | null;
  ipAddress?: string | null;
  orderIndex: number;
  createdAt?: string;
  updatedAt?: string;
};

