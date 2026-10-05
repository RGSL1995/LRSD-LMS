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

/**
 * Parses financial year ending date from various string, date, or numeric formats.
 * Supports:
 * - "31 Mar, 2025", "31-Mar-2025", "31/03/2025", "31.03.2025", "2025-03-31"
 * - "FY 2024-25", "FY25", "FY 2025", "2025" -> "2025-03-31"
 * - JavaScript Date objects & Excel serial date numbers
 */
export function parseReportDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  // 1. If Date object
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // 2. If Excel serial number (e.g. 45382 ~ 2024-03-31)
  if (typeof value === "number" && value > 30000 && value < 70000) {
    try {
      const parsedDate = XLSX.SSF.parse_date_code(value);
      if (parsedDate && parsedDate.y && parsedDate.m && parsedDate.d) {
        const y = parsedDate.y;
        const m = String(parsedDate.m).padStart(2, "0");
        const d = String(parsedDate.d).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
    } catch {
      // Ignore conversion error
    }
  }

  if (typeof value !== "string") {
    value = String(value);
  }

  const str = (value as string).trim();
  if (!str || str === "-" || str === "NaN") return null;

  // 3. Format: "31 Mar, 2025" or "31-Mar-2025" or "31 Mar 2025" or "31-Mar-25"
  const textDateMatch = str.match(/^(\d{1,2})[\s\-\/\.,]+([A-Za-z]{3,9})[\s\-\/\.,]+(\d{2,4})$/);
  if (textDateMatch) {
    let [, day, monStr, year] = textDateMatch;
    if (year.length === 2) year = `20${year}`;
    const monAbbr = monStr.slice(0, 3).toLowerCase();
    const month = MONTHS[monAbbr];
    if (month) {
      return `${year}-${month}-${day.padStart(2, "0")}`;
    }
  }

  // 4. Format: "31/03/2025" or "31-03-2025" or "31.03.2025"
  const dmyMatch = str.match(/^(\d{1,2})[\-\/\.](\d{1,2})[\-\/\.](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // 5. ISO Format: "2025-03-31"
  const isoMatch = str.match(/^(\d{4})[\-\/\.](\d{1,2})[\-\/\.](\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // 6. Format: "FY 2024-25", "FY25", "FY 2025", "FY2025", "2024-25"
  const fyMatch = str.match(/FY\s*(\d{2,4})(?:[\-\/](\d{2,4}))?/i);
  if (fyMatch) {
    let year = fyMatch[2] || fyMatch[1];
    if (year.length === 2) year = `20${year}`;
    return `${year}-03-31`;
  }

  // 7. Bare 4-digit year e.g. "2025" -> March 31
  const yearOnlyMatch = str.match(/^(20\d{2})$/);
  if (yearOnlyMatch) {
    return `${yearOnlyMatch[1]}-03-31`;
  }

  return null;
}

export function coerceNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").replace(/\(/g, "-").replace(/\)/g, "").trim();
    if (!cleaned || cleaned === "-" || cleaned === "N/A" || cleaned === "NA" || cleaned === "nil") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function normalizeLabel(value: unknown): string {
  return typeof value === "string"
    ? value
        .trim()
        .replace(/[\(\)\[\]\:\,\.\/\\_\-]/g, " ")
        .replace(/\s+/g, " ")
        .toLowerCase()
    : "";
}

/**
 * Synonyms mapping for Indian Corporate Financial Statements (Ind AS, Schedule III, IGAAP)
 */
const FIELD_SYNONYMS: Record<string, string[]> = {
  share_capital: [
    "share capital",
    "equity share capital",
    "paid up capital",
    "paid up share capital",
  ],
  reserves_and_surplus: [
    "reserves and surplus",
    "other equity",
    "reserves & surplus",
    "retained earnings",
    "reserves",
  ],
  total_equity: [
    "total equity",
    "net worth",
    "tangible net worth",
    "shareholders funds",
    "total shareholders funds",
    "equity and reserves",
  ],
  long_term_borrowings: [
    "long term borrowings",
    "non current borrowings",
    "term loans",
    "long term debt",
    "secured loans",
    "unsecured loans long term",
  ],
  short_term_borrowings: [
    "short term borrowings",
    "current borrowings",
    "working capital limit",
    "cash credit",
    "overdraft",
    "short term debt",
  ],
  trade_payables: [
    "trade payables",
    "sundry creditors",
    "creditors",
    "accounts payable",
  ],
  total_liabilities: [
    "total equity and liabilities",
    "total liabilities",
    "total liabilities and equity",
    "total equity & liabilities",
  ],
  trade_receivables: [
    "trade receivables",
    "sundry debtors",
    "debtors",
    "accounts receivable",
  ],
  inventories: [
    "inventories",
    "inventory",
    "stock in trade",
    "closing stock",
    "stocks",
  ],
  cash_and_bank_balances: [
    "cash and bank balances",
    "cash and cash equivalents",
    "bank balances",
    "cash & bank",
    "cash & cash equivalents",
  ],
  total_assets: [
    "total assets",
    "total non current and current assets",
    "total non-current and current assets",
  ],
  net_revenue: [
    "net revenue",
    "revenue from operations",
    "revenue from operations gross",
    "sales",
    "turnover",
    "total income",
    "total revenue",
  ],
  total_operating_cost: [
    "total operating cost",
    "total expenses",
    "operating expenses",
    "cost of sales",
    "total expenditure",
  ],
  ebitda: [
    "operating profit ebitda",
    "operating profit",
    "ebitda",
    "pbitda",
    "profit before interest tax depreciation",
  ],
  depreciation_and_amortization: [
    "depreciation and amortization expense",
    "depreciation and amortization",
    "depreciation",
    "amortization",
  ],
  finance_costs: [
    "finance costs",
    "finance cost",
    "interest expense",
    "borrowing costs",
    "interest",
  ],
  profit_before_tax: [
    "profit before tax",
    "pbt",
    "profit before exceptional items and tax",
  ],
  income_tax: [
    "income tax",
    "tax expense",
    "tax",
    "current tax",
    "provision for tax",
  ],
  profit_after_tax: [
    "profit for the period",
    "profit after tax",
    "pat",
    "net profit",
    "net profit after tax",
    "profit loss for the period",
  ],
  ebitda_margin_percent: [
    "ebitda margin",
    "ebitda margin percent",
    "opm",
    "operating margin",
  ],
  net_margin_percent: [
    "net margin",
    "net margin percent",
    "npm",
    "net profit margin",
  ],
  return_on_equity_percent: [
    "return on equity",
    "return on equity percent",
    "roe",
    "return on net worth",
    "ronw",
  ],
  debt_to_equity: [
    "debt equity",
    "debt to equity",
    "der",
    "debt equity ratio",
    "leverage ratio",
  ],
  current_ratio: [
    "current ratio",
    "cr",
  ],
  interest_coverage_ratio: [
    "interest coverage ratio",
    "icr",
    "iscr",
  ],
};

export type ParsedFinancialStatement = {
  statementType: "standalone" | "consolidated";
  financialYearEnding: string; // YYYY-MM-DD
  fields: Record<string, number | null>;
};

const SHEET_NAME_PATTERNS = {
  standalone: [/standalone/i, /financials/i, /data/i, /sheet1/i, /balance.*sheet/i],
  consolidated: [/consolidat/i, /group/i],
};

/**
 * Parses all available years and financial line items from an Excel sheet.
 */
function parseSheet(
  rows: unknown[][],
  statementType: "standalone" | "consolidated",
): ParsedFinancialStatement[] {
  if (!rows || rows.length === 0) return [];

  // 1. Identify header row containing dates / financial years (search first 5 rows)
  let dateCols: { colIndex: number; dateStr: string }[] = [];

  for (let r = 0; r < Math.min(5, rows.length); r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row)) continue;

    const foundInRow: { colIndex: number; dateStr: string }[] = [];
    for (let c = 1; c < row.length; c++) {
      const date = parseReportDate(row[c]);
      if (date) {
        foundInRow.push({ colIndex: c, dateStr: date });
      }
    }

    if (foundInRow.length > 0) {
      dateCols = foundInRow;
      break;
    }
  }

  if (dateCols.length === 0) return [];

  // 2. Map normalized labels to row indices
  const labelToRow = new Map<string, number>();
  rows.forEach((row, index) => {
    if (!row || !Array.isArray(row)) return;
    const label = normalizeLabel(row[0]);
    if (label && !labelToRow.has(label)) {
      labelToRow.set(label, index);
    }
  });

  // 3. Extract fields for EACH financial year detected in the sheet
  const results: ParsedFinancialStatement[] = [];

  for (const { colIndex, dateStr } of dateCols) {
    const fields: Record<string, number | null> = {};

    for (const [fieldName, synonyms] of Object.entries(FIELD_SYNONYMS)) {
      let matchedValue: number | null = null;

      for (const synonym of synonyms) {
        const normalizedSynonym = normalizeLabel(synonym);
        const rowIndex = labelToRow.get(normalizedSynonym);
        if (rowIndex !== undefined && rows[rowIndex]) {
          const val = coerceNumber(rows[rowIndex][colIndex]);
          if (val !== null) {
            matchedValue = val;
            break;
          }
        }
      }

      // If no exact match found, try substring matching
      if (matchedValue === null) {
        for (const [rowLabel, rowIndex] of labelToRow.entries()) {
          for (const synonym of synonyms) {
            const normalizedSynonym = normalizeLabel(synonym);
            if (rowLabel.includes(normalizedSynonym) || normalizedSynonym.includes(rowLabel)) {
              const val = coerceNumber(rows[rowIndex][colIndex]);
              if (val !== null) {
                matchedValue = val;
                break;
              }
            }
          }
          if (matchedValue !== null) break;
        }
      }

      fields[fieldName] = matchedValue;
    }

    // 4. Auto-compute derived ratios if missing from raw data
    if (fields.ebitda_margin_percent === null && fields.ebitda && fields.net_revenue && fields.net_revenue > 0) {
      fields.ebitda_margin_percent = Number(((fields.ebitda / fields.net_revenue) * 100).toFixed(2));
    }

    if (fields.net_margin_percent === null && fields.profit_after_tax && fields.net_revenue && fields.net_revenue > 0) {
      fields.net_margin_percent = Number(((fields.profit_after_tax / fields.net_revenue) * 100).toFixed(2));
    }

    if (fields.debt_to_equity === null && fields.total_equity && fields.total_equity > 0) {
      const totalDebt = (fields.long_term_borrowings || 0) + (fields.short_term_borrowings || 0);
      if (totalDebt > 0) {
        fields.debt_to_equity = Number((totalDebt / fields.total_equity).toFixed(2));
      }
    }

    if (fields.return_on_equity_percent === null && fields.profit_after_tax && fields.total_equity && fields.total_equity > 0) {
      fields.return_on_equity_percent = Number(((fields.profit_after_tax / fields.total_equity) * 100).toFixed(2));
    }

    if (fields.interest_coverage_ratio === null && fields.ebitda && fields.finance_costs && fields.finance_costs > 0) {
      fields.interest_coverage_ratio = Number((fields.ebitda / fields.finance_costs).toFixed(2));
    }

    results.push({
      statementType,
      financialYearEnding: dateStr,
      fields,
    });
  }

  return results;
}

/**
 * Main parser entry point to extract standalone & consolidated financial statements
 * from Excel workbooks (.xlsx, .xls, .csv).
 */
export function parseFinancialReport(buffer: Buffer): ParsedFinancialStatement[] {
  if (!buffer || buffer.length === 0) return [];

  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const allResults: ParsedFinancialStatement[] = [];
  const processedSheetNames = new Set<string>();

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    let statementType: "standalone" | "consolidated" = "standalone";
    if (/consolidat/i.test(sheetName) || /group/i.test(sheetName)) {
      statementType = "consolidated";
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
    const parsedStatements = parseSheet(rows, statementType);

    for (const stmt of parsedStatements) {
      // Avoid duplicate statements for same type and year
      const key = `${stmt.statementType}_${stmt.financialYearEnding}`;
      if (!processedSheetNames.has(key)) {
        processedSheetNames.add(key);
        allResults.push(stmt);
      }
    }
  }

  return allResults;
}
