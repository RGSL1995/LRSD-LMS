import * as XLSX from "xlsx";

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

// Matches "31 Mar, 2025" -> "2025-03-31"
function parseReportDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2})\s+([A-Za-z]{3}).*?(\d{4})$/);
  if (!match) return null;
  const [, day, monAbbr, year] = match;
  const month = MONTHS[monAbbr.toLowerCase()];
  if (!month) return null;
  return `${year}-${month}-${day.padStart(2, "0")}`;
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").trim();
    if (!cleaned || cleaned === "-") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeLabel(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLowerCase() : "";
}

const FIELD_LABELS: Record<string, string> = {
  share_capital: "share capital",
  reserves_and_surplus: "reserves and surplus",
  total_equity: "total equity",
  long_term_borrowings: "long term borrowings",
  short_term_borrowings: "short term borrowings",
  trade_payables: "trade payables",
  total_liabilities: "total equity and liabilities",
  trade_receivables: "trade receivables",
  inventories: "inventories",
  cash_and_bank_balances: "cash and bank balances",
  total_assets: "total assets",
  net_revenue: "net revenue",
  total_operating_cost: "total operating cost",
  ebitda: "operating profit ( ebitda )",
  depreciation_and_amortization: "depreciation and amortization expense",
  finance_costs: "finance costs",
  profit_before_tax: "profit before tax",
  income_tax: "income tax",
  profit_after_tax: "profit for the period",
  ebitda_margin_percent: "ebitda margin (%)",
  net_margin_percent: "net margin (%)",
  return_on_equity_percent: "return on equity (%)",
  debt_to_equity: "debt / equity",
  current_ratio: "current ratio",
  interest_coverage_ratio: "interest coverage ratio",
};

export type ParsedFinancialStatement = {
  statementType: "standalone" | "consolidated";
  financialYearEnding: string;
  fields: Record<string, number | null>;
};

const SHEET_NAMES: Record<"standalone" | "consolidated", string> = {
  standalone: "Standalone Financial Data",
  consolidated: "Consolidated Financial Data",
};

function parseSheet(
  rows: unknown[][],
  statementType: "standalone" | "consolidated",
): ParsedFinancialStatement | null {
  if (rows.length === 0) return null;

  const headerRow = rows[0];
  let lastDateCol = -1;
  let financialYearEnding: string | null = null;

  for (let col = headerRow.length - 1; col >= 0; col--) {
    const date = parseReportDate(headerRow[col]);
    if (date) {
      lastDateCol = col;
      financialYearEnding = date;
      break;
    }
  }

  if (lastDateCol === -1 || !financialYearEnding) return null;

  const labelToRow = new Map<string, number>();
  rows.forEach((row, index) => {
    const label = normalizeLabel(row[0]);
    if (label && !labelToRow.has(label)) {
      labelToRow.set(label, index);
    }
  });

  const fields: Record<string, number | null> = {};
  for (const [field, label] of Object.entries(FIELD_LABELS)) {
    const rowIndex = labelToRow.get(label);
    fields[field] = rowIndex !== undefined ? coerceNumber(rows[rowIndex][lastDateCol]) : null;
  }

  return { statementType, financialYearEnding, fields };
}

export function parseFinancialReport(buffer: Buffer): ParsedFinancialStatement[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const results: ParsedFinancialStatement[] = [];

  for (const statementType of ["standalone", "consolidated"] as const) {
    const sheetName = SHEET_NAMES[statementType];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
    const parsed = parseSheet(rows, statementType);
    if (parsed) results.push(parsed);
  }

  return results;
}
