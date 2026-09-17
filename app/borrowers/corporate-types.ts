export type ExtractedCorporateProfile = {
  legal_name?: string;
  trade_name?: string;
  cin?: string;
  pan?: string;
  gstin?: string;
  incorporation_date?: string;
  business_type?: "public" | "private_limited" | "llp" | "partnership" | "other";
  is_registered?: boolean;
  ownership_type?: string;
  website?: string;
  contact_no?: string;
  contact_email?: string;
  landline?: string;
  corporate_office_address?: string;
  corporate_office_city?: string;
  corporate_office_state?: string;
  corporate_office_pincode?: string;
  registered_office_address?: string;
  registered_office_city?: string;
  registered_office_state?: string;
  registered_office_pincode?: string;
  about?: string;
};

export type ExtractedHighlights = {
  paid_up_capital?: string | null;
  authorized_capital?: string | null;
  sum_of_charges?: string | null;
  company_status?: string | null;
  active_compliance?: string | null;
  listing_status?: string | null;
  last_agm_date?: string | null;
  lei?: string | null;
};

export type ExtractedAssociate = {
  full_name: string;
  din?: string | null;
  associate_role: "director" | "promoter" | "authorised_signatory" | "key_management" | "shareholder" | "guarantor";
  designation?: string;
  appointment_date?: string | null;
  original_appointment_date?: string | null;
  cessation_date?: string | null;
  shareholding_percent?: number | null;
  email?: string | null;
  phone?: string | null;
  is_active?: boolean;
};

export type ExtractedFinancialStatement = {
  statementType: "standalone" | "consolidated";
  financialYearEnding: string;
  fields: Record<string, number | null>;
};

export type ExtractedGroupEntity = {
  entity_name: string;
  relationship_type: "holding_company" | "subsidiary" | "joint_venture" | "associate_entity" | "sister_concern";
  percentage_holding?: number | null;
  cin_or_registration?: string | null;
  city?: string | null;
  status?: string | null;
};

export type ExtractedOpenCharge = {
  charge_id: string;
  status: string;
  date: string;
  filing_date: string;
  holder_name: string;
  amount_crore: number;
  property_type: string;
  sl_no?: string | null;
};

export type ExtractedStructure = {
  as_of_date?: string | null;
  promoter_percent?: number | null;
  public_percent?: number | null;
  total_shareholders?: number | null;
  total_equity_shares?: number | null;
  major_shareholders: Array<{
    name: string;
    shareholding_percent: number;
    shares_count?: number | null;
  }>;
};

export type ExtractedPeerComparison = {
  industry?: string | null;
  segment?: string | null;
  closest_peers: Array<{
    name: string;
    city: string;
    revenue_crore: number;
  }>;
};

export type ExtractedComplianceChecks = {
  roc_name_removal?: string | null;
  bifr_history?: string | null;
  cdr_history?: string | null;
  suit_filed_cases?: string | null;
  epfo_establishments: Array<{
    id: string;
    name: string;
    city: string;
  }>;
};

export type ExtractedGstFiling = {
  returnType: string;
  financialYear: string;
  taxPeriod: string;
  dueDate?: string;
  filingDate?: string;
  status: string;
};

export type ExtractedGstin = {
  gstin: string;
  state?: string;
  status?: string;
  latestReturn?: string;
  latestFilingDate?: string;
  financialYear?: string;
  taxPeriod?: string;
  dateOfRegistration?: string;
  centreJurisdiction?: string;
  stateJurisdiction?: string;
  taxpayerType?: string;
  natureOfBusiness?: string;
  legalName?: string;
  tradeName?: string;
  filings?: ExtractedGstFiling[];
};

export type ExtractedRptItem = {
  partyName: string;
  category: "company" | "individual";
  relationship: string;
  transactionType: string;
  amountCrore: number | null;
  amountInr: number;
  financialYear: string;
  isMaterial: boolean;
};

export type ExtractedCorporateData = {
  profile: ExtractedCorporateProfile;
  highlights: ExtractedHighlights;
  associates: ExtractedAssociate[];
  financials: ExtractedFinancialStatement[];
  groupStructure: ExtractedGroupEntity[];
  structure: ExtractedStructure;
  openCharges: ExtractedOpenCharge[];
  peerComparison: ExtractedPeerComparison;
  complianceChecks: ExtractedComplianceChecks;
  gstins: ExtractedGstin[];
  rpt: ExtractedRptItem[];
};
