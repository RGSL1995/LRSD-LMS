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
import type { CamAutoData, CamManualData } from "./cam-types";

const FONT = "Times New Roman";
const CELL_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 2, color: "AAAAAA" },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: "AAAAAA" },
  left: { style: BorderStyle.SINGLE, size: 2, color: "AAAAAA" },
  right: { style: BorderStyle.SINGLE, size: 2, color: "AAAAAA" },
};

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
    children: [new TextRun({ text, bold: true, font: FONT, size: 24 })],
  });
}

function subHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, font: FONT, size: 22 })],
  });
}

function bodyText(text: string, opts: { bold?: boolean; italics?: boolean } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text: text || "—", font: FONT, size: 20, ...opts })],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, font: FONT, size: 20 })],
  });
}

function cell(text: string, opts: { bold?: boolean; width?: number; shading?: string } = {}): TableCell {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    borders: CELL_BORDER,
    shading: opts.shading ? { fill: opts.shading } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [
      new Paragraph({
        children: [new TextRun({ text: text || "-", font: FONT, size: 18, bold: opts.bold })],
      }),
    ],
  });
}

function headerRow(labels: string[]): TableRow {
  return new TableRow({
    tableHeader: true,
    children: labels.map((l) => cell(l, { bold: true, shading: "E8E8E8" })),
  });
}

function twoColTable(rows: Array<[string, string]>): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [cell(label, { bold: true, width: 35 }), cell(value)],
        }),
    ),
  });
}

/** Builds the full CAM .docx buffer by combining auto-filled loan data with manually-entered sections. */
export async function buildCamDocx(auto: CamAutoData, manual: CamManualData): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new TextRun({ text: "Credit Approval Memo", bold: true, font: FONT, size: 32 })],
    }),
  );

  // ---- Borrower Summary ----
  children.push(sectionHeading("Borrower Summary"));
  children.push(
    twoColTable([
      ["Borrower's Name", auto.borrower.name],
      ["CIN", auto.borrower.cin],
      ["PAN", auto.borrower.pan],
      ["GSTIN", auto.borrower.gstin],
      ["Address", auto.borrower.address],
      ["Guarantors", auto.guarantorSummaries.join("; ") || "—"],
    ]),
  );

  // ---- Loan Summary ----
  children.push(sectionHeading("Loan Summary"));
  children.push(
    twoColTable([
      ["Loan Type", auto.facilityType],
      ["Sanction Amount", auto.sanctionAmountText],
      ["Tenor", `${auto.tenureMonths} months`],
      ["Purpose", auto.purpose],
    ]),
  );

  if (auto.securities.length > 0) {
    children.push(subHeading("Security"));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          headerRow(["S. No.", "Scrip Name", "Quantity", "Price", "Market Value", "Pledgor"]),
          ...auto.securities.map(
            (s, i) =>
              new TableRow({
                children: [
                  cell(String(i + 1)),
                  cell(s.scripName),
                  cell(s.quantity),
                  cell(s.price),
                  cell(s.marketValue),
                  cell(s.pledgorName || "—"),
                ],
              }),
          ),
          new TableRow({
            children: [
              cell("", {}),
              cell("Total", { bold: true }),
              cell(""),
              cell(""),
              cell(auto.totalSecurityMarketValue, { bold: true }),
              cell(""),
            ],
          }),
        ],
      }),
    );
  }

  // ---- About Company (manual narrative) ----
  if (manual.aboutCompanyText) {
    children.push(sectionHeading(`About ${auto.borrower.name}`));
    for (const para of manual.aboutCompanyText.split(/\n+/).filter(Boolean)) {
      children.push(bodyText(para));
    }
  }

  // ---- Profile of Key Promoters (manual) ----
  if (manual.promoterProfiles.length > 0) {
    children.push(sectionHeading(`Profile of Key Promoters of ${auto.borrower.name}`));
    for (const p of manual.promoterProfiles) {
      children.push(subHeading(`${p.name}${p.din ? ` (DIN: ${p.din})` : ""}`));
      children.push(bodyText(p.text));
    }
  }

  // ---- Per-party sections: KYC, Banking Analysis, Credit Checks, ITR ----
  for (const party of auto.parties) {
    children.push(sectionHeading(`${party.name} (${party.roleLabel})`));

    const partyManual = manual.parties[party.borrowerId];

    // KYC (auto)
    children.push(subHeading("KYC"));
    children.push(twoColTable(Object.entries(party.kyc)));

    // Banking Analysis (manual)
    if (partyManual && partyManual.bankingAnalysis.length > 0) {
      children.push(subHeading("Banking Analysis"));
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            headerRow(["Month", "5th", "15th", "25th", "Month Ending Balance"]),
            ...partyManual.bankingAnalysis.map(
              (r) =>
                new TableRow({
                  children: [cell(r.month), cell(r.day5), cell(r.day15), cell(r.day25), cell(r.monthEndBalance)],
                }),
            ),
          ],
        }),
      );
    }

    // Credit Checks / CIBIL (manual)
    if (partyManual) {
      children.push(subHeading("Credit Checks (CIBIL)"));
      children.push(
        twoColTable([
          ["CIBIL Score / CMR", partyManual.cibilScore],
          ["Overdue", partyManual.cibilOverdue],
          ["DPD", partyManual.cibilDpd],
          ["Enquiries (Last 3 Months)", partyManual.cibilEnquiries3m],
          ["Loans Availed (Last 3 Months)", partyManual.cibilLoans3m],
          ["Remarks", partyManual.cibilRemarks],
        ]),
      );

      if (partyManual.creditFacilities.length > 0) {
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              headerRow(["Type", "Ownership", "Date", "Sanction", "POS", "DPD"]),
              ...partyManual.creditFacilities.map(
                (f) =>
                  new TableRow({
                    children: [
                      cell(f.type),
                      cell(f.ownership),
                      cell(f.date),
                      cell(f.sanction),
                      cell(f.pos),
                      cell(f.dpd),
                    ],
                  }),
              ),
            ],
          }),
        );
      }

      // Individual ITR (manual, individuals only)
      if (!party.isCompany && partyManual.itrData.length > 0) {
        const years = Array.from(
          new Set(partyManual.itrData.flatMap((row) => Object.keys(row.values))),
        );
        children.push(subHeading("Individual ITR (Rs. in Lacs)"));
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              headerRow(["Income Head", ...years]),
              ...partyManual.itrData.map(
                (row) =>
                  new TableRow({
                    children: [cell(row.incomeHead), ...years.map((y) => cell(row.values[y] || "-"))],
                  }),
              ),
            ],
          }),
        );
      }
    }
  }

  // ---- Underwriting Justification (manual) ----
  if (manual.underwritingJustification) {
    children.push(sectionHeading("Underwriting Justification"));
    for (const line of manual.underwritingJustification.split(/\n+/).filter(Boolean)) {
      children.push(bullet(line));
    }
  }

  // ---- Google Search (manual) ----
  if (manual.googleSearchResults.length > 0) {
    children.push(sectionHeading("(Guarantor & Borrower)"));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          headerRow(["Guarantor & Borrower", "Google Search"]),
          ...manual.googleSearchResults.map(
            (g) => new TableRow({ children: [cell(g.partyName), cell(g.result)] }),
          ),
        ],
      }),
    );
  }

  // ---- Risk and Mitigate (manual) ----
  if (manual.risks.length > 0) {
    children.push(sectionHeading("Risk and Mitigate"));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          headerRow(["Risk", "Mitigate"]),
          ...manual.risks.map((r) => new TableRow({ children: [cell(r.risk), cell(r.mitigate)] })),
        ],
      }),
    );
  }

  // ---- Verification (manual) ----
  if (manual.verification.length > 0) {
    children.push(sectionHeading("Verification"));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          headerRow(["Particulars", "Remarks"]),
          ...manual.verification.map(
            (v) => new TableRow({ children: [cell(v.particular), cell(v.remark)] }),
          ),
        ],
      }),
    );
  }

  // ---- Credit Committee Sign-off Matrix ----
  if (auto.approvers && auto.approvers.length > 0) {
    children.push(sectionHeading("Credit Committee Approvals & Sign-Off Matrix"));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          headerRow(["Committee Member", "Role / Designation", "Approval Status", "Decision Date", "Remarks / Conditions"]),
          ...auto.approvers.map((app) => {
            let statusText = "PENDING";
            let statusColor = undefined;
            if (app.approvalStatus === "approved") {
              statusText = "APPROVED (Digital Sign-off)";
              statusColor = "E6F4EA";
            } else if (app.approvalStatus === "approved_with_conditions") {
              statusText = "APPROVED W/ CONDITIONS";
              statusColor = "FEF7E0";
            } else if (app.approvalStatus === "rejected") {
              statusText = "REJECTED";
              statusColor = "FCE8E6";
            }

            const decisionDate = app.decisionAt
              ? new Date(app.decisionAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Awaiting Action";

            const remarks = [
              app.conditions ? `Conditions: ${app.conditions}` : "",
              app.comments ? `Remarks: ${app.comments}` : "",
              app.digitalSignature ? `Signed by: ${app.digitalSignature}` : "",
            ]
              .filter(Boolean)
              .join("\n") || "—";

            return new TableRow({
              children: [
                cell(`${app.approverName}\n(${app.approverEmail})`, { bold: true }),
                cell(app.approverRole || "Credit Committee Member"),
                cell(statusText, { bold: true, shading: statusColor }),
                cell(decisionDate),
                cell(remarks),
              ],
            });
          }),
        ],
      }),
    );
  }

  // ---- Sign-off ----
  children.push(
    new Paragraph({ spacing: { before: 400, after: 100 }, children: [new TextRun({ text: "" })] }),
  );
  children.push(bodyText(`Prepared by - ${manual.preparedBy || "Credit Underwriting Team"}`, { bold: true }));
  children.push(bodyText(`Approved by - ${manual.approvedBy || "Credit Committee"}`, { bold: true }));

  const doc = new Document({
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}
