// Shared types for the Institutional Loan Sanction Letter (LRSD Securities Pvt Ltd format).

export type SanctionSecurityItem = {
  scripName: string;
  isin?: string;
  quantity: string;
  price: string;
  marketValue: string;
  pledgorName?: string;
};

export type SanctionAutoData = {
  applicationId: string;
  applicationCode: string;
  facilityType: string;
  requestedAmountNum: number;
  sanctionAmountText: string;
  sanctionAmountInWords: string;
  tenureMonths: number;
  purpose: string;
  borrower: {
    id?: string;
    name: string;
    cin?: string;
    pan?: string;
    gstin?: string;
    address?: string;
    tradeName?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  guarantors: Array<{
    id?: string;
    name: string;
    roleLabel: string;
    pan?: string;
    cin?: string;
    address?: string;
  }>;
  securities: SanctionSecurityItem[];
  totalSecurityMarketValue: string;
  securityCoverRatio: number;
  ltvPercent: number;
};

export type SanctionCashTopUpTier = {
  priceDecline: string;
  repaymentPercent: string;
};

export type SanctionManualData = {
  sanctionLetterRef: string;
  sanctionDate: string; // YYYY-MM-DD
  validityDays: number;

  // Commercials
  borrowerShortName: string;
  facilityType: string;
  permittedPurpose: string;
  sanctionedAmount: number;
  sanctionedAmountText: string;
  sanctionedAmountInWords: string;
  interestRateText: string;
  roiPercent: number;
  legalFeesText: string;
  tenureMonths: number;
  tenureDays: number;
  repaymentMode: string;
  disbursementSchedule: string;
  penalChargeText: string;
  bouncingChargesText: string;
  prepaymentChargesText: string;
  paymentDatePrincipalText: string;
  paymentDateInterestText: string;

  // Security & LAS terms
  securityCoverRatio: number;
  securityCoverText: string;
  securityPledgeText: string;
  personalGuaranteeNames: string;
  valuationClauseText: string;
  promoterHoldingText: string;
  promoterPledgeLimitText: string;
  securityMonitoringText: string;

  // Triggers
  topUpTriggerText: string;
  saleTriggerText: string;
  cashTopUpTriggerText: string;
  cashTopUpTiers: SanctionCashTopUpTier[];

  // CPs, CSs, PDCs
  preDisbursementConditions: string[];
  postDisbursementConditions: string[];
  pdcNachText: string;
  classificationClauseText: string;
  executionClauseText: string;
  jurisdiction: string;

  // Signatories
  lenderName: string;
  authorizedSignatoryLender: string;

  status: "draft" | "issued" | "accepted";
};

export function emptySanctionManualData(auto?: SanctionAutoData): SanctionManualData {
  const amount = auto?.requestedAmountNum || 50000000;
  const tenureM = auto?.tenureMonths || 12;
  const tenureDays = tenureM * 30 || 365;
  const primaryName = auto?.borrower?.name || "Borrower Company Ltd.";
  const shortName = primaryName.split(" ")[0].toUpperCase();
  const guarantorNamesList = auto?.guarantors && auto.guarantors.length > 0
    ? auto.guarantors.map((g) => g.name).join(", ")
    : "Promoters / Guarantors";
  const scripNamesList = auto?.securities && auto.securities.length > 0
    ? auto.securities.map((s) => s.scripName).join(", ")
    : primaryName;

  const cover = auto?.securityCoverRatio && auto.securityCoverRatio > 0 ? auto.securityCoverRatio : 2.5;

  return {
    sanctionLetterRef: auto?.applicationCode
      ? `LRSD/SANCTION/${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(-2)}/${auto.applicationCode}`
      : `LRSD/SANCTION/${Date.now().toString().slice(-6)}`,
    sanctionDate: new Date().toISOString().split("T")[0],
    validityDays: 30,

    borrowerShortName: shortName,
    facilityType: auto?.facilityType || "Secured Term Loan",
    permittedPurpose:
      auto?.purpose || "Loan Facility shall be utilized for business expansion and working capital needs of the Borrower",
    sanctionedAmount: amount,
    sanctionedAmountText: auto?.sanctionAmountText || "Rs. 50,00,00,000/-",
    sanctionedAmountInWords: auto?.sanctionAmountInWords || "Rupees Fifty Crores Only",
    interestRateText: "16.00% per annum compounded and payable at monthly rests.",
    roiPercent: 16.0,
    legalFeesText:
      "100,000 (Rupees One Lakh only) plus applicable GST payable by the Borrower to the Lender prior to the disbursement of the facility (Legal Fee includes Due diligence and documentation fees)",
    tenureMonths: tenureM,
    tenureDays: tenureDays,
    repaymentMode: "Bullet Repayment Mode",
    disbursementSchedule: "Loan Facility shall be disbursed Upon Execution of Transaction Documents of the said Loan Facility",
    penalChargeText:
      "In case of occurrence of event of default as provided in the transaction documents including the events of default as detailed below a Penal Charge at the rate of 2% p.a., (plus taxes applicable, if any) on the outstanding balance of Loan Facility, shall be levied and payable by the Borrower(s) to the Lender, for the period for which such default event continues.",
    bouncingChargesText:
      "Rs.1,000/- (Rupees One Thousand Only) (plus applicable taxes) for every Cheque/ NACH bounce.",
    prepaymentChargesText: "Allowed with no prepayment penalty (subject to 7 days advance intimation)",
    paymentDatePrincipalText: `Bullet payment at the end of ${tenureDays} days from the date of first disbursement.`,
    paymentDateInterestText: "payable at monthly rests on the 1st (first) day of the subsequent month.",

    securityCoverRatio: cover,
    securityCoverText: `${cover}x of the Sanctioned Amount of Loan Facility, which shall be maintained during the entire loan tenure.`,
    securityPledgeText: `First and Exclusive charge by way of Pledge of Equity Shares of ${cover} times (${cover}x) of the loan amount of ${scripNamesList} held by the Promoter(s)/Guarantor(s), in dematerialized form.`,
    personalGuaranteeNames: guarantorNamesList,
    valuationClauseText: `Valuation of shares of ${scripNamesList} to be done at lower of six months average at NSE/ BSE or Current Market Price (CMP) at these exchanges. Shares to be pledged to LRSD shall not be subject to any statutory or lock in or encumbrance of any kind.`,
    promoterHoldingText: `Total Promoter group holding in ${scripNamesList} falls below 51% without selling our encumbered shares`,
    promoterPledgeLimitText: `Total Promoter Group pledge of shares not to exceed 25% of their own holding in ${scripNamesList}`,
    securityMonitoringText:
      "The price of pledged shares for the purpose of creation of security, ongoing monitoring, calculation of top up trigger, sale trigger shall be calculated based on lower of: 1. Daily closing price of the underlying script on NSE; 2. Daily closing price of the underlying script on BSE; 3. Average price of the last 6 months on NSE; 4. Average price of the last 6 months on BSE.",

    topUpTriggerText: `1. If the security cover falls to or below ${cover}x, the lender shall require the Borrower/ Security Provider to top up the security by shares/ cash within 2 working days from the date of said breach and recoup the security cover of ${cover}x.\n2. If the security cover falls to or below ${(cover * 0.84).toFixed(2)}x, the lender shall require the Borrower/ Security Provider to top up the security by shares/ cash within 2 working days from the date of said breach and recoup the security cover of ${(cover * 0.84).toFixed(2)}x.`,
    saleTriggerText: `1. In case of drop in stipulated security cover provided by pledge of shares, if the Borrower/ Security provider fails to restore the security cover to ${cover} times as acceptable to the Lender within stipulated timelines, Lender will have the right to sell the pledged shares/ security.\n2. In the event security cover drops below ${(cover * 0.8).toFixed(2)}x at any point in time, Lender shall have the right to invoke the pledge and sell the pledged shares/ security without any notice. Notice will be served when cover drops below ${cover}x and ${(cover * 0.84).toFixed(2)}x respectively.\n3. On the occurrence or continuance of any default including but not limited to default in payment of the outstanding dues, Lender shall have the right to sell the pledged shares/ security and adjust the proceeds of such sale to liquidate the dues.\n4. Lender shall dispose of the pledged shares/ security by sale on the stock exchange or an "off market transaction" (disposal through private sale) and all the costs incurred by the Lender for the off-market transaction shall be reimbursed by the Borrower.`,
    cashTopUpTriggerText:
      "1. If there are more than 4 consecutive instances of top up triggered without any release of pledged shares within a period of 3 months.\n2. If the share price of underlying scrip falls as compared to the initial share price at which pledge is created for this facility, then borrower/ security provider to provide cash top up, as detailed in below table. If the share price subsequently recovers, regular share pledge shall be acceptable.",
    cashTopUpTiers: [
      { priceDecline: "Stock prices fall by 30%", repaymentPercent: "25% of loan to be repaid" },
      { priceDecline: "Stock prices fall by 50%", repaymentPercent: "50% loan to be repaid" },
      { priceDecline: "more than 50%", repaymentPercent: "100% of the loan to be repaid" },
    ],

    preDisbursementConditions: [
      "Submission of signed Copy of Sanction Letter along with Board resolution to approving term and condition for the said loan facility.",
      "Undertaking from the Borrower & Guarantor(s) that, they have complied with all the compliance for creation of charge on security and availing of Loan Facility/ies, as per law under Income Tax Act.",
      "Undertaking from the Borrower & Guarantor(s) that, no agreement has been executed or any kind of security interest has been created in respect of the said security, as on date of execution of transaction documents of the said loan facility.",
      "Execution of Pledge agreement and Power of Attorney",
      "CA-Certified Net Worth Certificate of the Guarantor(s).",
      "Personal Guarantee of individual Guarantor(s).",
      "Post Dated Cheques from the Borrower & Guarantor(s), in favour of the Lender for the security of repayment of Principal & Interest.",
      "Pledge Management Report/statement confirming creation of the pledge in favour of the Lender.",
    ],

    postDisbursementConditions: [
      "End use certificate of availed loan facility to be submitted within 30 days of disbursement.",
      "Any other information desired by Lender, for the security of repayment of loan outstanding.",
    ],

    pdcNachText:
      "The Borrower shall deliver post-dated cheques/ NACH Mandate to the Lender for the due repayment of the Loan Facility and monthly interest thereon. Such cheques shall be deemed to have been given for adequate consideration already received by the Borrower and shall not absolve the Borrower from their liability to pay the said sums hereunder until the cheques are duly encashed & realized.\nThe Guarantor(s) shall also deliver their respective post-dated cheques to the Lender for the due repayment of the Loan Facility.",

    classificationClauseText:
      'The Borrower and Guarantors, understands and agrees that upon occurrence of Event of Default under this Agreement, the Lender shall have an unqualified right to classify the account of the Borrower as special mention account (SMA) or a non-performing asset ("NPA") or otherwise in accordance with the applicable guidelines, circulars, notifications, rules and regulations issued by the RBI or any other Authority. A scenario of SMA/NPA classification has been illustrated in Annexure 2.',

    executionClauseText:
      "The Loan Facility shall be sanctioned and will be disbursed post execution of the requisite documents, security documents, submission of required undertaking and Collateral, and creation of requisite charges over the Securities as mentioned in this Sanction Letter as required by the Lender and necessary to concretize the transaction.",

    jurisdiction: "New Delhi",

    lenderName: "LRSD Securities Private Limited",
    authorizedSignatoryLender: "Authorized Signatory (Lender)",

    status: "draft",
  };
}
