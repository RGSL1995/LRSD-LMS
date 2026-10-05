import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  Packer,
} from "docx";
import type { SanctionAutoData, SanctionManualData } from "./sanction-types";

const FONT_PRIMARY = "Arial";
const COLOR_PRIMARY = "1E293B"; // Dark slate
const COLOR_MAROON = "8B1D24"; // LRSD Brand Header Maroon
const COLOR_MUTED = "475569";
const BORDER_COLOR = "000000";

const THIN_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
  left: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
  right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
};

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "May 04, 2026";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

/**
 * Creates table cell with consistent padding & borders
 */
function legalCell(
  children: (Paragraph | Table)[],
  opts: {
    widthPercent: number;
    bold?: boolean;
    background?: string;
    colSpan?: number;
  },
): TableCell {
  return new TableCell({
    width: { size: opts.widthPercent, type: WidthType.PERCENTAGE },
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    borders: THIN_BORDER,
    shading: opts.background ? { fill: opts.background } : undefined,
    columnSpan: opts.colSpan,
    children,
  });
}

function cellParagraph(
  text: string,
  opts: {
    bold?: boolean;
    italics?: boolean;
    size?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    color?: string;
    bullet?: boolean;
    spaceAfter?: number;
  } = {},
): Paragraph {
  return new Paragraph({
    alignment: opts.align || AlignmentType.LEFT,
    bullet: opts.bullet ? { level: 0 } : undefined,
    spacing: { after: opts.spaceAfter !== undefined ? opts.spaceAfter : 40, before: 20 },
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        italics: opts.italics,
        color: opts.color || COLOR_PRIMARY,
        font: FONT_PRIMARY,
        size: opts.size || 18, // 9pt
      }),
    ],
  });
}

/**
 * Generate 3-column terms row: [S.No, Particulars, Terms and Conditions]
 */
function termsRow(sNo: string, particulars: string, contents: Paragraph[]): TableRow {
  return new TableRow({
    children: [
      legalCell([cellParagraph(sNo, { align: AlignmentType.CENTER, bold: true })], { widthPercent: 8 }),
      legalCell([cellParagraph(particulars, { bold: true })], { widthPercent: 26 }),
      legalCell(contents, { widthPercent: 66 }),
    ],
  });
}

/**
 * Letterhead of LRSD Securities Private Limited
 */
function createLetterhead(): Paragraph[] {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 30 },
      children: [
        new TextRun({
          text: "LRSD SECURITIES PRIVATE LIMITED",
          bold: true,
          font: FONT_PRIMARY,
          size: 26,
          color: COLOR_MAROON,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 20 },
      children: [
        new TextRun({
          text: "Regd. Office: 208 & 210, Jain Bhawan, 18/12, W.E.A. Karol Bagh, New Delhi-110005",
          font: FONT_PRIMARY,
          size: 15,
          color: COLOR_MUTED,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 20 },
      children: [
        new TextRun({
          text: "Corporate Office: Unit No. 27-01 & 02, Silver Tower, Wave One, Sector-18, Noida-201301 (U.P.)",
          font: FONT_PRIMARY,
          size: 15,
          color: COLOR_MUTED,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: "CIN: U65923DL2015PTC275014 | Email: rgsl1995@gmail.com, admin@rgslgroup.com | Ph: 0120-5109188/011-45805607 | www.lrsdindia.com",
          font: FONT_PRIMARY,
          size: 14,
          color: COLOR_MUTED,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 140 },
      children: [
        new TextRun({
          text: "Sanction Letter",
          bold: true,
          underline: {},
          font: FONT_PRIMARY,
          size: 22,
          color: COLOR_PRIMARY,
        }),
      ],
    }),
  ];
}

/**
 * Signature boxes row (Lender, Borrower, Guarantors)
 */
function createSignatureBlock(auto: SanctionAutoData, manual: SanctionManualData): Table {
  const guarantorNames = auto.guarantors && auto.guarantors.length > 0
    ? auto.guarantors.map((g) => g.name)
    : ["Guarantor 1"];

  const rows: TableRow[] = [
    new TableRow({
      children: [
        legalCell(
          [
            cellParagraph("For " + manual.lenderName.toUpperCase(), { bold: true }),
            cellParagraph("\n\n\n"),
            cellParagraph("____________________________"),
            cellParagraph(manual.authorizedSignatoryLender, { bold: true }),
          ],
          { widthPercent: 50 },
        ),
        legalCell(
          [
            cellParagraph("For " + auto.borrower.name.toUpperCase(), { bold: true }),
            cellParagraph("\n\n\n"),
            cellParagraph("____________________________"),
            cellParagraph("AUTHORISED SIGNATORY (Borrower)", { bold: true }),
          ],
          { widthPercent: 50 },
        ),
      ],
    }),
  ];

  for (let i = 0; i < guarantorNames.length; i += 2) {
    const g1 = guarantorNames[i];
    const g2 = guarantorNames[i + 1];

    rows.push(
      new TableRow({
        children: [
          legalCell(
            [
              cellParagraph(`Guarantor / Security Provider (${i + 1}):`, { italics: true, size: 16 }),
              cellParagraph(g1, { bold: true }),
              cellParagraph("\n\n"),
              cellParagraph("____________________________"),
              cellParagraph(`Signature (${g1})`, { size: 16 }),
            ],
            { widthPercent: 50 },
          ),
          legalCell(
            g2
              ? [
                  cellParagraph(`Guarantor / Security Provider (${i + 2}):`, { italics: true, size: 16 }),
                  cellParagraph(g2, { bold: true }),
                  cellParagraph("\n\n"),
                  cellParagraph("____________________________"),
                  cellParagraph(`Signature (${g2})`, { size: 16 }),
                ]
              : [cellParagraph("")],
            { widthPercent: 50 },
          ),
        ],
      }),
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: THIN_BORDER,
    rows,
  });
}

/**
 * Generate Annexure 1: Repayment Schedule Table
 */
function createAnnexure1Repayment(auto: SanctionAutoData, manual: SanctionManualData): (Paragraph | Table)[] {
  const amount = manual.sanctionedAmount || auto.requestedAmountNum || 50000000;
  const roi = manual.roiPercent || 16.0;
  const tenureMonths = manual.tenureMonths || 12;

  // Monthly interest amount = (Principal * ROI) / (12 * 100)
  const monthlyInterest = Math.round((amount * roi) / 1200);

  const formatINR = (val: number) =>
    val.toLocaleString("en-IN", { maximumFractionDigits: 0 });

  const tableRows: TableRow[] = [];

  // Table Header
  tableRows.push(
    new TableRow({
      tableHeader: true,
      children: [
        legalCell([cellParagraph("S.No.", { bold: true, align: AlignmentType.CENTER })], { widthPercent: 8, background: "F1F5F9" }),
        legalCell([cellParagraph("Date / Month", { bold: true, align: AlignmentType.CENTER })], { widthPercent: 18, background: "F1F5F9" }),
        legalCell([cellParagraph("Amount", { bold: true, align: AlignmentType.RIGHT })], { widthPercent: 18, background: "F1F5F9" }),
        legalCell([cellParagraph("EMI / Outflow", { bold: true, align: AlignmentType.RIGHT })], { widthPercent: 18, background: "F1F5F9" }),
        legalCell([cellParagraph(`Interest @${roi}%`, { bold: true, align: AlignmentType.RIGHT })], { widthPercent: 18, background: "F1F5F9" }),
        legalCell([cellParagraph("Principal", { bold: true, align: AlignmentType.RIGHT })], { widthPercent: 10, background: "F1F5F9" }),
        legalCell([cellParagraph("Balance", { bold: true, align: AlignmentType.RIGHT })], { widthPercent: 10, background: "F1F5F9" }),
      ],
    }),
  );

  // Month 0: Broken Period / Initial Drawdown
  tableRows.push(
    new TableRow({
      children: [
        legalCell([cellParagraph("0", { align: AlignmentType.CENTER })], { widthPercent: 8 }),
        legalCell([cellParagraph("Broken Period", { bold: true })], { widthPercent: 18 }),
        legalCell([cellParagraph(formatINR(amount), { align: AlignmentType.RIGHT })], { widthPercent: 18 }),
        legalCell([cellParagraph(formatINR(monthlyInterest), { align: AlignmentType.RIGHT })], { widthPercent: 18 }),
        legalCell([cellParagraph(formatINR(monthlyInterest), { align: AlignmentType.RIGHT })], { widthPercent: 18 }),
        legalCell([cellParagraph("0", { align: AlignmentType.RIGHT })], { widthPercent: 10 }),
        legalCell([cellParagraph(formatINR(amount), { align: AlignmentType.RIGHT })], { widthPercent: 10 }),
      ],
    }),
  );

  const startDate = manual.sanctionDate ? new Date(manual.sanctionDate) : new Date();

  for (let m = 1; m <= tenureMonths; m++) {
    const curDate = new Date(startDate);
    curDate.setMonth(startDate.getMonth() + m);
    const monthLabel = curDate.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

    const isFinalMonth = m === tenureMonths;
    const principalPaid = isFinalMonth ? amount : 0;
    const totalOutflow = isFinalMonth ? monthlyInterest + amount : monthlyInterest;
    const balance = isFinalMonth ? 0 : amount;

    tableRows.push(
      new TableRow({
        children: [
          legalCell([cellParagraph(String(m), { align: AlignmentType.CENTER })], { widthPercent: 8 }),
          legalCell([cellParagraph(monthLabel, { bold: isFinalMonth })], { widthPercent: 18 }),
          legalCell([cellParagraph(formatINR(amount), { align: AlignmentType.RIGHT })], { widthPercent: 18 }),
          legalCell([cellParagraph(formatINR(totalOutflow), { align: AlignmentType.RIGHT, bold: isFinalMonth })], { widthPercent: 18 }),
          legalCell([cellParagraph(formatINR(monthlyInterest), { align: AlignmentType.RIGHT })], { widthPercent: 18 }),
          legalCell([cellParagraph(isFinalMonth ? formatINR(principalPaid) : "0", { align: AlignmentType.RIGHT, bold: isFinalMonth })], { widthPercent: 10 }),
          legalCell([cellParagraph(isFinalMonth ? "—" : formatINR(balance), { align: AlignmentType.RIGHT })], { widthPercent: 10 }),
        ],
      }),
    );
  }

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      pageBreakBefore: true,
      spacing: { before: 100, after: 40 },
      children: [
        new TextRun({
          text: "ANNEXURE-1",
          bold: true,
          underline: {},
          font: FONT_PRIMARY,
          size: 22,
          color: COLOR_PRIMARY,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "Repayment Schedule",
          bold: true,
          font: FONT_PRIMARY,
          size: 20,
          color: COLOR_PRIMARY,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: `The Loan Facility shall be repayable in one Bullet Repayment Mode i.e., Single Tranche at the maturity of Loan Tenure (${tenureMonths} Months). However, the Borrower shall pay the interest on monthly rests, as and when due on monthly basis.`,
          font: FONT_PRIMARY,
          size: 18,
        }),
      ],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: THIN_BORDER,
      rows: tableRows,
    }),
    new Paragraph({
      spacing: { before: 100, after: 160 },
      children: [
        new TextRun({
          text: "Note: The repayment schedule is subject to change in the event of disbursement by the Lender or any prepayment/balance transfer made by the Borrower or any change in disbursement schedule.",
          italics: true,
          font: FONT_PRIMARY,
          size: 16,
          color: COLOR_MUTED,
        }),
      ],
    }),
  ];
}

/**
 * Generate Annexure 2: RBI Classification of Loan Account (SMA/NPA)
 */
function createAnnexure2Classification(): (Paragraph | Table)[] {
  const smaRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        legalCell(
          [
            cellParagraph("Classification & Upgradation of Special mention accounts (SMA)/ Non-Performing Asset (NPA):", { bold: true }),
            cellParagraph("Principal or interest or any other payment remains overdue then Borrower loan account shall reflect the asset wholly or partly classification (SMA/ NPA) status of an account at the day-end of that calendar date.\nLoan accounts classified as NPAs may be upgraded as 'Standard' asset only if entire arrears of interest and principal are paid by the Borrower.", { size: 16 }),
          ],
          { widthPercent: 50, background: "F8FAFC" },
        ),
        legalCell(
          [
            cellParagraph("Basis of Classification:\nPrincipal or Interest wholly or partly overdue", { bold: true }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: THIN_BORDER,
              rows: [
                new TableRow({
                  children: [
                    legalCell([cellParagraph("SMA Sub-Categories", { bold: true, size: 16 })], { widthPercent: 40 }),
                    legalCell([cellParagraph("0 Up to 30 days", { size: 16 })], { widthPercent: 60 }),
                  ],
                }),
                new TableRow({
                  children: [
                    legalCell([cellParagraph("SMA-1", { bold: true, size: 16 })], { widthPercent: 40 }),
                    legalCell([cellParagraph("More than 30 days and up to 60 days", { size: 16 })], { widthPercent: 60 }),
                  ],
                }),
                new TableRow({
                  children: [
                    legalCell([cellParagraph("SMA-2", { bold: true, size: 16 })], { widthPercent: 40 }),
                    legalCell([cellParagraph("More than 60 days and up to 90 days", { size: 16 })], { widthPercent: 60 }),
                  ],
                }),
                new TableRow({
                  children: [
                    legalCell([cellParagraph("NPA", { bold: true, size: 16 })], { widthPercent: 40 }),
                    legalCell([cellParagraph("More than 90 days", { size: 16 })], { widthPercent: 60 }),
                  ],
                }),
              ],
            }),
          ],
          { widthPercent: 50, background: "F8FAFC" },
        ),
      ],
    }),
  ];

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      pageBreakBefore: true,
      spacing: { before: 100, after: 40 },
      children: [
        new TextRun({
          text: "Annexure",
          bold: true,
          font: FONT_PRIMARY,
          size: 20,
          color: COLOR_PRIMARY,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: "CLASSIFICATION OF LOAN ACCOUNT",
          bold: true,
          underline: {},
          font: FONT_PRIMARY,
          size: 22,
          color: COLOR_PRIMARY,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: 'The Borrower understands and agrees that upon occurrence of Event of Default under this Agreement, the Lender shall have an unqualified right to classify the account of the Borrower as special mention account (SMA) or a non-performing asset ("NPA") or otherwise in accordance with the applicable guidelines, circulars, notifications, rules and regulations issued by the RBI or any other Authority. A scenario of SMA/NPA classification has been illustrated below and also uploaded/available at LRSD INDIA website:',
          font: FONT_PRIMARY,
          size: 18,
        }),
      ],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: THIN_BORDER,
      rows: smaRows,
    }),
    new Paragraph({
      spacing: { before: 120, after: 60 },
      children: [
        new TextRun({
          text: "Example: If due date of a loan account is March 31, 2026, and full dues are not received before the lending institution runs the day-end process for this date, the date of overdue shall be March 31, 2026. If it continues to remain overdue, then this account shall get tagged as SMA-1 upon running day-end process on April 30, 2026 i.e. upon completion of 30 days of being continuously overdue. Accordingly, the date of SMA-1 classification for that account shall be April 30, 2026.",
          italics: true,
          font: FONT_PRIMARY,
          size: 17,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 160 },
      children: [
        new TextRun({
          text: "Similarly, if the account continues to remain overdue, it shall get tagged as SMA-2 upon running day-end process on May 30, 2026 and if continues to remain overdue further, it shall get classified as NPA upon running day-end process on June 29, 2026.",
          italics: true,
          font: FONT_PRIMARY,
          size: 17,
        }),
      ],
    }),
  ];
}

/**
 * Main DOCX Builder
 */
export async function buildSanctionDocx(
  auto: SanctionAutoData,
  manual: SanctionManualData,
): Promise<Buffer> {
  const guarantorList = auto.guarantors && auto.guarantors.length > 0
    ? auto.guarantors
    : [{ name: manual.personalGuaranteeNames || "Guarantor", roleLabel: "Guarantor", pan: "" }];

  const guarantorParagraphs: Paragraph[] = [];
  guarantorList.forEach((g, idx) => {
    guarantorParagraphs.push(
      cellParagraph(`${g.name} (Guarantor-${idx + 1})${g.pan ? ` [PAN: ${g.pan}]` : ""}`, { bold: true }),
    );
  });
  if (guarantorList.length > 1) {
    const labels = guarantorList.map((_, i) => `Guarantor-${i + 1}`).join(", ");
    guarantorParagraphs.push(
      cellParagraph(`(${labels} are hereinafter collectively referred to as "Guarantors")`, { italics: true, size: 16 }),
    );
  }

  // Pre-Disbursement conditions paragraphs
  const preDisbursementParagraphs = [
    cellParagraph("The following conditions that need to be complied by the Borrower before the disbursement of Loan Facility:", { bold: true, spaceAfter: 60 }),
    ...(manual.preDisbursementConditions || []).map((c) => cellParagraph(c, { bullet: true, size: 17 })),
  ];

  // Post-Disbursement conditions paragraphs
  const postDisbursementParagraphs = (manual.postDisbursementConditions || []).map((c) =>
    cellParagraph(c, { bullet: true, size: 17 }),
  );

  // Security Bullets (Row 16)
  const securityBullets = [
    cellParagraph(manual.securityPledgeText || `First and Exclusive charge by way of Pledge of Equity Shares of ${manual.securityCoverRatio}x of the loan amount.`, { bullet: true }),
    cellParagraph(`Personal Guarantee by ${manual.personalGuaranteeNames} along with their net worth certificate duly signed by the practicing-chartered accountant.`, { bullet: true }),
    cellParagraph(manual.valuationClauseText || "Valuation of shares to be done at lower of six months average at NSE/ BSE or Current Market Price (CMP). Shares to be pledged to LRSD shall not be subject to any statutory or lock in or encumbrance of any kind.", { bullet: true }),
    cellParagraph("Post Dated Cheques of the Borrower and Guarantor(s).", { bullet: true }),
    cellParagraph("Demand Promissory Note of the Borrower and Guarantor(s).", { bullet: true }),
  ];

  // Key Terms & Conditions Bullets (Row 17)
  const keyTermsBullets = [
    cellParagraph(`Min ${manual.securityCoverRatio}x cover against pledge of listed shares. The loan facility shall be extended to ${auto.borrower.name}.`, { bullet: true }),
    cellParagraph("Valuation of shares to be done at lower of Six months average or Current Market Price (CMP).", { bullet: true }),
    cellParagraph("Acceptance of further pledge of shares or any other security acceptable to the Lender to recoup the margin shortfall over and above the initial pledge, if situation may arise in future, shall be at the sole discretion of Lender. However, the borrower would have the option to prepay in part to maintain sanctioned security cover.", { bullet: true }),
    cellParagraph(`The Facility shall be additionally secured by an unconditional, irrevocable and continuing Personal Guarantee of ${manual.personalGuaranteeNames} for the due repayment of the Facility along with interest, charges, costs and all other monies payable under the Facility documents. The guarantee shall remain valid till full and final repayment of the Facility and shall be enforceable at the sole discretion of Lender.`, { bullet: true }),
    cellParagraph("The Borrower/s agrees to pay the processing fees upfront at the time of acceptance of sanction letter and the processing fees paid shall be non-refundable and non-adjustable.", { bullet: true }),
    cellParagraph("Interest will be due and payable on the 1st (first) day of the subsequent month.", { bullet: true }),
  ];

  // Event of Default Bullets (Row 18)
  const defaultBullets = [
    cellParagraph(manual.promoterHoldingText || "Total Promoter group holding falls below 51% without selling our encumbered shares", { bullet: true }),
    cellParagraph(manual.promoterPledgeLimitText || "Total Promoter Group pledge of shares not to exceed 25% of their own holding", { bullet: true }),
    cellParagraph(`In case, security cover falls below the stipulated ${manual.securityCoverRatio}x, Lender will have the right to sell shares without any prior notice or intimation.`, { bullet: true }),
  ];

  // Cash Top Up Rows (Row 22)
  const cashTopUpParagraphs: Paragraph[] = [];
  manual.cashTopUpTriggerText.split("\n").forEach((line) => {
    if (line.trim()) cashTopUpParagraphs.push(cellParagraph(line.trim(), { size: 17 }));
  });

  // Cash Top-Up Tier Sub-Table
  const cashTierTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: THIN_BORDER,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          legalCell([cellParagraph("Cash top trigger (Price decline from date of drawdown)", { bold: true, size: 16 })], { widthPercent: 60, background: "F8FAFC" }),
          legalCell([cellParagraph("% Repayment", { bold: true, size: 16, align: AlignmentType.CENTER })], { widthPercent: 40, background: "F8FAFC" }),
        ],
      }),
      ...(manual.cashTopUpTiers || []).map(
        (tier) =>
          new TableRow({
            children: [
              legalCell([cellParagraph(tier.priceDecline, { size: 16 })], { widthPercent: 60 }),
              legalCell([cellParagraph(tier.repaymentPercent, { size: 16, align: AlignmentType.CENTER, bold: true })], { widthPercent: 40 }),
            ],
          }),
      ),
    ],
  });

  // Construct all 28 rows of terms table
  const mainTermsRows: TableRow[] = [
    // Header
    new TableRow({
      tableHeader: true,
      children: [
        legalCell([cellParagraph("S. No.", { bold: true, align: AlignmentType.CENTER })], { widthPercent: 8, background: "F1F5F9" }),
        legalCell([cellParagraph("Particulars", { bold: true })], { widthPercent: 26, background: "F1F5F9" }),
        legalCell([cellParagraph("Terms and conditions", { bold: true })], { widthPercent: 66, background: "F1F5F9" }),
      ],
    }),

    // 1. Borrower
    termsRow("1.", "Borrower", [
      cellParagraph(`${auto.borrower.name} (${manual.borrowerShortName})`, { bold: true }),
      ...(auto.borrower.cin ? [cellParagraph(`CIN: ${auto.borrower.cin}`, { size: 16 })] : []),
      ...(auto.borrower.pan ? [cellParagraph(`PAN: ${auto.borrower.pan}`, { size: 16 })] : []),
    ]),

    // 2. Guarantor(s)
    termsRow("2.", "Security Provider/ Guarantor(s)", guarantorParagraphs),

    // 3. Lender
    termsRow("3.", "Lender", [
      cellParagraph(`${manual.lenderName} (LRSD)`, { bold: true }),
    ]),

    // 4. Loan Facility
    termsRow("4.", "Loan Facility", [
      cellParagraph(manual.facilityType, { bold: true }),
    ]),

    // 5. Permitted Purpose
    termsRow("5.", "Permitted Purpose", [
      cellParagraph(manual.permittedPurpose),
    ]),

    // 6. Sanctioned Amount
    termsRow("6.", "Sanctioned Amount/ Loan Facility", [
      cellParagraph(`Up to ${manual.sanctionedAmountText} (${manual.sanctionedAmountInWords})`, { bold: true }),
    ]),

    // 7. Rate of Interest
    termsRow("7.", "Rate of Interest", [
      cellParagraph(manual.interestRateText, { bold: true }),
    ]),

    // 8. Legal Fees
    termsRow("8.", "Legal Fees", [
      cellParagraph(manual.legalFeesText),
    ]),

    // 9. Tenure of Loan Facility
    termsRow("9.", "Tenure of Loan Facility", [
      cellParagraph(
        `This Loan Facility shall be advanced for a period of ${manual.tenureDays} days from the date of the first disbursement (Tenure) and shall be repaid in ${manual.repaymentMode}, meaning the total loan amount shall be repaid at the end of the loan tenure. Interest on the availed loan facility shall be payable on a monthly basis, as detailed in Annexure I. The Tenure shall exclude any broken period during which interest would be charged to the Borrower.`,
      ),
      cellParagraph(
        "The Lender reserves the right to demand or recall the Loan Facility, along with any accrued interest, in the event of any default or under circumstances deemed appropriate by the Lender.",
        { italics: true, size: 17 },
      ),
    ]),

    // 10. Schedule of Disbursement
    termsRow("10.", "Schedule of Disbursement", [
      cellParagraph(manual.disbursementSchedule),
    ]),

    // 11. Penal Charge
    termsRow("11.", "Penal Charge", [
      cellParagraph(manual.penalChargeText),
      cellParagraph("a. If any interest is payable by the Borrower to Lender for the said Loan Facility, is not paid on the due date as per the terms of payment of interest,", { size: 17 }),
      cellParagraph("b. When any installment of principal amount payable by the Borrower to Lender for the said Loan Facility, is not paid on the due date as per the terms of re-payment of principal amount,", { size: 17 }),
      cellParagraph("c. On Contravention of any terms of sanction of Loan Facility, as mentioned in this Sanction Letter, or Loan Agreement or any document related to this term Loan Facility, whether at the time of sanction of Loan Facility or in future, (without prejudice to any other rights/remedies of the Lender)", { size: 17 }),
    ]),

    // 12. Cheque/NACH Bouncing Charges
    termsRow("12.", "Cheque/ NACH Bouncing Charges", [
      cellParagraph(manual.bouncingChargesText),
    ]),

    // 13. Pre-payment Charges
    termsRow("13.", "Balance Transfer/ Pre-payment Charges", [
      cellParagraph(manual.prepaymentChargesText),
    ]),

    // 14. Payment Date
    termsRow("14.", "Payment Date", [
      cellParagraph(`Principal: ${manual.paymentDatePrincipalText}`, { bold: true }),
      cellParagraph(`Interest: ${manual.paymentDateInterestText}`, { bold: true }),
    ]),

    // 15. Security Cover
    termsRow("15.", "Security Cover", [
      cellParagraph(manual.securityCoverText, { bold: true }),
    ]),

    // 16. Security
    termsRow("16.", "Security", [
      cellParagraph("Loan Facility shall be secured by way of the following securities in favour of the Lender:", { bold: true, spaceAfter: 40 }),
      ...securityBullets,
    ]),

    // 17. Key Terms & Conditions
    termsRow("17.", "Key Terms & Conditions", keyTermsBullets),

    // 18. Event of Default
    termsRow("18.", "Event of Default conditions", defaultBullets),

    // 19. Security Monitoring
    termsRow("19.", "Security Monitoring", [
      cellParagraph("The price of pledged shares for the purpose of creation of security, ongoing monitoring, calculation of top up trigger, sale trigger shall be calculated based on lower of:", { spaceAfter: 40 }),
      cellParagraph("1. Daily closing price of the underlying script on NSE", { size: 17 }),
      cellParagraph("2. Daily closing price of the underlying script on BSE", { size: 17 }),
      cellParagraph("3. Average price of the last 6 months on NSE", { size: 17 }),
      cellParagraph("4. Average price of the last 6 months on BSE", { size: 17 }),
    ]),

    // 20. Trigger for Top up
    termsRow("20.", "Trigger for Top up", [
      ...manual.topUpTriggerText.split("\n").filter(Boolean).map((t) => cellParagraph(t, { size: 17 })),
    ]),

    // 21. Trigger for Sale
    termsRow("21.", "Trigger for Sale", [
      ...manual.saleTriggerText.split("\n").filter(Boolean).map((t) => cellParagraph(t, { size: 17 })),
    ]),

    // 22. Trigger for Cash Top Up
    termsRow("22.", "Trigger for Cash top up", [
      ...cashTopUpParagraphs,
      new Paragraph({ spacing: { before: 60, after: 60 }, children: [] }),
      // Nested tier table
      cashTierTable as any,
    ]),

    // 23. Pre-Disbursement Conditions
    termsRow("23.", "Pre-Disbursement Conditions", preDisbursementParagraphs),

    // 24. Post-Disbursement Conditions
    termsRow("24.", "Post-Disbursement Conditions", [
      cellParagraph("The following conditions that need to be complied by the Borrower post the disbursement of Loan Facility:", { bold: true, spaceAfter: 40 }),
      ...postDisbursementParagraphs,
    ]),

    // 25. Post Dated Cheques / NACH
    termsRow("25.", "Post Dated Cheques/ NACH mandate (PDCs)", [
      ...manual.pdcNachText.split("\n").filter(Boolean).map((p) => cellParagraph(p, { size: 17 })),
    ]),

    // 26. Classification of Loan Account
    termsRow("26.", "Classification of Loan Account", [
      cellParagraph(manual.classificationClauseText),
    ]),

    // 27. Execution of Documents
    termsRow("27.", "Execution of Documents", [
      cellParagraph(manual.executionClauseText),
    ]),

    // 28. Jurisdiction
    termsRow("28.", "Jurisdiction", [
      cellParagraph(manual.jurisdiction || "New Delhi", { bold: true }),
    ]),
  ];

  const mainTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: THIN_BORDER,
    rows: mainTermsRows,
  });

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT_PRIMARY,
            size: 18,
            color: COLOR_PRIMARY,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720, // 0.5 inch
              bottom: 720,
              left: 720,
              right: 720,
            },
          },
        },
        children: [
          // Header / Letterhead
          ...createLetterhead(),

          // Dated & Addressee
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: `Dated- ${formatDisplayDate(manual.sanctionDate)}`,
                bold: true,
                font: FONT_PRIMARY,
                size: 19,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 30 },
            children: [
              new TextRun({
                text: "To,",
                bold: true,
                font: FONT_PRIMARY,
                size: 19,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 20 },
            children: [
              new TextRun({
                text: auto.borrower.name,
                bold: true,
                font: FONT_PRIMARY,
                size: 19,
              }),
            ],
          }),
          ...(auto.borrower.address
            ? [
                new Paragraph({
                  spacing: { after: 120 },
                  children: [
                    new TextRun({
                      text: auto.borrower.address,
                      font: FONT_PRIMARY,
                      size: 18,
                    }),
                  ],
                }),
              ]
            : [
                new Paragraph({
                  spacing: { after: 120 },
                  children: [
                    new TextRun({
                      text: "Registered Office Address / Principal Place of Business",
                      font: FONT_PRIMARY,
                      size: 18,
                    }),
                  ],
                }),
              ]),

          // Subject Line
          new Paragraph({
            spacing: { before: 80, after: 140 },
            children: [
              new TextRun({
                text: `Sanction Letter with respect to term Loan Facility of ${manual.sanctionedAmountText} (${manual.sanctionedAmountInWords})`,
                bold: true,
                underline: {},
                font: FONT_PRIMARY,
                size: 19,
              }),
            ],
          }),

          // Main Terms & Conditions 28-point Table
          mainTable,

          // Post-Table Disclaimer & Return Note
          new Paragraph({
            spacing: { before: 140, after: 100 },
            children: [
              new TextRun({
                text: "Please note that this Sanction Letter has been provided for your acceptance and the disbursement of the said Loan Facility will strictly be contingent on sanction of Loan Facility and execution of all deeds/documents, and we reserve the right for refusal, if the terms and conditions as agreed, are not being complied. This sanction communication is being sent to you in duplicate. You are requested to return to us the duplicate copy along with the Annexure/s duly signed by all the Parties, as a token of having accepted the terms and conditions detailed above. This document also serves as an indicative term sheet; any changes to the terms will be incorporated into the Final Term sheet and loan documentation.",
                font: FONT_PRIMARY,
                size: 18,
              }),
            ],
          }),

          // Vernacular Declaration Header
          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({
                text: "Vernacular Declaration",
                bold: true,
                underline: {},
                font: FONT_PRIMARY,
                size: 19,
              }),
            ],
          }),

          // English Declaration
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: "English",
                bold: true,
                font: FONT_PRIMARY,
                size: 18,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: "The Borrower and the Guarantors confirm that the terms & conditions and nature of this Sanction Letter have been read out and explained in the language, they communicate and speak and understand and they have understood the entire meaning of all the clauses.",
                font: FONT_PRIMARY,
                size: 18,
              }),
            ],
          }),

          // Hindi Declaration
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: "Hindi",
                bold: true,
                font: FONT_PRIMARY,
                size: 18,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 160 },
            children: [
              new TextRun({
                text: "उधारकर्ता और गारंटर यह पुष्टि करते हैं कि इस मंजूरी पत्र के सभी नियम, शर्तें एवं प्रकृति उन्हें स्पष्ट रूप से पढ़कर समझाई गई हैं। उन्होंने इसे सुना, समझा और अपनी भाषा में संवाद किया तथा वे इस मंजूरी पत्र की समस्त शर्तों और प्रावधानों को भली-भांति समझते हैं और स्वीकार करते हैं।",
                font: FONT_PRIMARY,
                size: 18,
              }),
            ],
          }),

          // Signatures Section
          new Paragraph({
            spacing: { before: 80, after: 80 },
            children: [
              new TextRun({
                text: "Signed by the Lender & Acceptance by Borrower and Guarantor(s):",
                bold: true,
                font: FONT_PRIMARY,
                size: 19,
              }),
            ],
          }),
          createSignatureBlock(auto, manual),

          // Annexure 1: Repayment Schedule
          ...createAnnexure1Repayment(auto, manual),

          // Annexure 1 Signature Footer
          createSignatureBlock(auto, manual),

          // Annexure 2: Classification of Loan Account
          ...createAnnexure2Classification(),

          // Annexure 2 Signature Footer
          createSignatureBlock(auto, manual),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
