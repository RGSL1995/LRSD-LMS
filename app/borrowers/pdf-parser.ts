// @ts-expect-error - internal entry point has no bundled type declarations
import pdfParseModule from "pdf-parse/lib/pdf-parse.js";

type PdfParseFunction = (
  dataBuffer: Buffer | Uint8Array,
  options?: {
    pagerender?: (pageData: PageData) => Promise<string>;
    max?: number;
    version?: string;
  },
) => Promise<{
  numpages: number;
  numrender: number;
  info: unknown;
  metadata: unknown;
  text: string;
  version: string;
}>;

function getPdfParser(): PdfParseFunction {
  if (typeof pdfParseModule === "function") {
    return pdfParseModule as unknown as PdfParseFunction;
  }
  const modRecord = pdfParseModule as Record<string, unknown> | null | undefined;
  if (modRecord && typeof modRecord.default === "function") {
    return modRecord.default as PdfParseFunction;
  }
  return pdfParseModule as unknown as PdfParseFunction;
}

import type {
  ExtractedCorporateProfile,
  ExtractedHighlights,
  ExtractedAssociate,
  ExtractedFinancialStatement,
  ExtractedGroupEntity,
  ExtractedStructure,
  ExtractedOpenCharge,
  ExtractedPeerComparison,
  ExtractedComplianceChecks,
  ExtractedGstFiling,
  ExtractedGstin,
  ExtractedRptItem,
  ExtractedCorporateData,
} from "./corporate-types";

export type {
  ExtractedCorporateProfile,
  ExtractedHighlights,
  ExtractedAssociate,
  ExtractedFinancialStatement,
  ExtractedGroupEntity,
  ExtractedStructure,
  ExtractedOpenCharge,
  ExtractedPeerComparison,
  ExtractedComplianceChecks,
  ExtractedGstFiling,
  ExtractedGstin,
  ExtractedRptItem,
  ExtractedCorporateData,
};

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

function parseReportDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.trim().match(/(\d{1,2})\s+([A-Za-z]{3}),?\s+(\d{4})/);
  if (!match) return null;
  const [, day, monAbbr, year] = match;
  const month = MONTHS[monAbbr.toLowerCase()];
  if (!month) return null;
  return `${year}-${month}-${day.padStart(2, "0")}`;
}

function parseAddressComponents(addr: string) {
  const pinMatch = addr.match(/\b(\d{6})\b/);
  const pincode = pinMatch ? pinMatch[1] : undefined;

  const parts = addr.split(",").map((s) => s.trim()).filter(Boolean);
  let state: string | undefined;
  let city: string | undefined;

  if (parts.length >= 2) {
    state = parts[parts.length - 1].replace(/\b\d{6}\b/, "").trim();
    city = parts[parts.length - 2].replace(/\b\d{6}\b/, "").trim();
  }

  return { address: addr, city, state, pincode };
}

interface PageItem {
  str: string;
  transform: number[];
}

interface PageData {
  getTextContent(options: { normalizeWhitespace: boolean; disableCombineTextItems: boolean }): Promise<{
    items: PageItem[];
  }>;
}

function renderPageWithSpacing(pageData: PageData): Promise<string> {
  return pageData
    .getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
    .then((textContent) => {
      let lastY: number | null = null;
      let text = "";
      for (const item of textContent.items) {
        if (lastY === item.transform[5] || lastY === null) {
          text += " " + item.str;
        } else {
          text += "\n" + item.str;
        }
        lastY = item.transform[5];
      }
      return text;
    });
}

// 1. About the Company & Master Profile
function extractProfile(text: string): { profile: ExtractedCorporateProfile; highlights: ExtractedHighlights } {
  let legalName: string | undefined;

  // 1. Check top header line (Page 1): "Probe42.in\n<LEGAL_NAME>\nPrinted at :"
  const headerMatch = text.match(/(?:Probe42\.in\s*\n+)([^\n\r]+?)(?=\s*\n+\s*Printed at\s*:)/i);
  if (headerMatch) {
    const candidate = headerMatch[1].trim();
    if (candidate.length > 2 && !/probe|proprietary|table of contents/i.test(candidate)) {
      legalName = candidate;
    }
  }

  // 2. Fallback before Table of Contents or Key Statistics
  if (!legalName) {
    const tocMatch = text.match(/(?:Probe42\.in\s*\n+)([^\n\r]+?)(?=\s*\n+\s*(?:Table of Contents|Key Statistics))/i);
    if (tocMatch) {
      const candidate = tocMatch[1].trim();
      if (candidate.length > 2 && !/probe|proprietary/i.test(candidate)) {
        legalName = candidate;
      }
    }
  }

  // 3. Fallback: search before "Printed at" anywhere
  if (!legalName) {
    const printedMatch = text.match(/\n([A-Z0-9\s.,&()-]+?)\n\s*Printed at\s*:/i);
    if (printedMatch) {
      const candidate = printedMatch[1].replace(/Probe42\.in/gi, "").trim();
      if (candidate.length > 2 && !/probe|proprietary/i.test(candidate)) {
        legalName = candidate;
      }
    }
  }

  // 4. Final fallback: standard company/LLP name regex
  if (!legalName) {
    const nameHeaderMatch = text.match(/(?:Probe42\.in\s+)?([A-Z0-9\s.,&()-]+(?:LIMITED|PRIVATE LIMITED|LLP))/i);
    if (nameHeaderMatch) {
      const raw = nameHeaderMatch[1].replace(/Probe42\.in/gi, "").trim().split("\n")[0].trim();
      if (raw && raw.length > 3 && !/probe|proprietary/i.test(raw)) {
        legalName = raw;
      }
    }
  }

  const cinMatch = text.match(/CIN\s*([LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6})/i);
  const llpinMatch = text.match(/LLPIN\s*([A-Z0-9-]+)/i);
  const cin = cinMatch ? cinMatch[1].trim() : (llpinMatch ? llpinMatch[1].trim() : undefined);

  const panMatch = text.match(/PAN\s*([A-Z]{5}[0-9]{4}[A-Z])/i);
  const incDateMatch = text.match(/Date of Incorporation\s*(\d{1,2}\s+[A-Za-z]{3},?\s+\d{4})/i);
  const entityTypeMatch = text.match(/([^\n\r]+)Type of Entity/i);
  const listingMatch = text.match(/Listing Status\s*([A-Za-z]+)/i);
  const regAddrMatch = text.match(/Registered Address\s*([^\n\r]+)/i);
  const bizAddrMatch = text.match(/Business Address\s*([^\n\r]+)/i);
  const emailMatch = text.match(/Email\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  const phoneMatch = text.match(/Phone\s*(\+?[\d\s-]+)/i);
  const websiteMatch = text.match(/Website\s*(https?:\/\/[^\s]+)/i);

  let aboutText: string | undefined;
  const aboutIdx = text.indexOf("About The ", 1000);
  if (aboutIdx !== -1) {
    const endIdx = text.indexOf("Industry And Segment(s)", aboutIdx);
    aboutText = text
      .substring(aboutIdx, endIdx !== -1 ? endIdx : aboutIdx + 1500)
      .replace(/^About The (?:Company|LLP)\s*/i, "")
      .replace(/Page\s+\d+\s+of\s+\d+[\s\S]*?(?:Marked Copy For.*?\n|Probe42\.in)/gi, "")
      .replace(/©\s*PROBE INFORMATION SERVICES[\s\S]*?(?:Marked Copy For.*?\n|Probe42\.in)/gi, "")
      .replace(/Probe42\.in/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  let businessType: "public" | "private_limited" | "llp" | "partnership" | "other" = "other";
  const entityTypeStr = (entityTypeMatch ? entityTypeMatch[1] : "").toLowerCase();
  if (entityTypeStr.includes("public")) businessType = "public";
  else if (entityTypeStr.includes("private")) businessType = "private_limited";
  else if (entityTypeStr.includes("llp") || entityTypeStr.includes("limited liability partnership")) businessType = "llp";
  else if (entityTypeStr.includes("partnership")) businessType = "partnership";

  const regParsed = regAddrMatch ? parseAddressComponents(regAddrMatch[1].trim()) : null;
  const bizParsed = bizAddrMatch ? parseAddressComponents(bizAddrMatch[1].trim()) : null;

  const paidUpMatch = text.match(/(?:Paid[ -]?up Capital|Total\s+Contribution\s+Received)\s*(?:Rs\.\s*)?([\d,.]+)\s*Crore/i);
  const authCapMatch = text.match(/(?:Authorized Capital|Total\s+Obligation\s+of(?:\s+Contribution)?)\s*(?:Rs\.\s*)?([\d,.]+)\s*Crore/i);
  const sumChargesMatch = text.match(/Sum of Charges\s*(?:Rs\.\s*)?([\d,.]+)\s*Crore/i);
  const statusMatch = text.match(/(?:Company|LLP)\s*Status\s*([A-Za-z]+)/i);
  const complianceMatch = text.match(/Active Compliance\s*([^\n\r]+)/i);
  const lastAgmMatch = text.match(/Date of Last AGM\s*(\d{1,2}\s+[A-Za-z]{3},?\s+\d{4})/i);
  const leiMatch = text.match(/LEI\s*([A-Z0-9]{20})/i);

  return {
    profile: {
      legal_name: legalName,
      trade_name: legalName,
      cin,
      pan: panMatch ? panMatch[1].trim() : undefined,
      incorporation_date: incDateMatch ? parseReportDate(incDateMatch[1]) ?? undefined : undefined,
      business_type: businessType,
      is_registered: true,
      ownership_type: listingMatch ? listingMatch[1].trim() : undefined,
      website: websiteMatch ? websiteMatch[1].trim() : undefined,
      contact_no: phoneMatch ? phoneMatch[1].trim() : undefined,
      contact_email: emailMatch ? emailMatch[1].trim() : undefined,
      corporate_office_address: bizParsed?.address,
      corporate_office_city: bizParsed?.city,
      corporate_office_state: bizParsed?.state,
      corporate_office_pincode: bizParsed?.pincode,
      registered_office_address: regParsed?.address,
      registered_office_city: regParsed?.city,
      registered_office_state: regParsed?.state,
      registered_office_pincode: regParsed?.pincode,
      about: aboutText,
    },
    highlights: {
      paid_up_capital: paidUpMatch ? `Rs. ${paidUpMatch[1]} Crore` : null,
      authorized_capital: authCapMatch ? `Rs. ${authCapMatch[1]} Crore` : null,
      sum_of_charges: sumChargesMatch ? `Rs. ${sumChargesMatch[1]} Crore` : null,
      company_status: statusMatch ? statusMatch[1].trim() : null,
      active_compliance: complianceMatch ? complianceMatch[1].trim() : null,
      listing_status: listingMatch ? listingMatch[1].trim() : null,
      last_agm_date: lastAgmMatch ? lastAgmMatch[1].trim() : null,
      lei: leiMatch ? leiMatch[1].trim() : null,
    },
  };
}

// 2. Directors & Designated Partners
function extractDirectors(text: string): ExtractedAssociate[] {
  const shareholdingMap = new Map<string, number>();

  // 1. Company Directors Shareholding
  const dsIdx = text.indexOf("Directors Shareholding", 4000);
  if (dsIdx !== -1) {
    const dsEnd = text.indexOf("Shareholding more than 5%", dsIdx);
    const dsSection = text.substring(dsIdx, dsEnd !== -1 ? dsEnd : dsIdx + 3000);
    const dsLines = dsSection.split("\n");
    for (const line of dsLines) {
      const m = line.match(/^([A-Z\s.]+?)(?:Managing Director|Whole-time director|Director|Additional Director)\s+([\d,.]+)\s+([\d,.]+)/i);
      if (m) {
        shareholdingMap.set(m[1].trim().toUpperCase(), parseFloat(m[2]));
      }
    }
  }

  // 2. LLP Contribution by Partners
  const cpIdx = text.indexOf("Contribution by Partners", 3000);
  if (cpIdx !== -1) {
    const cpEnd = text.indexOf("Contribution by Body Corporate", cpIdx);
    const cpSection = text.substring(cpIdx, cpEnd !== -1 ? cpEnd : cpIdx + 2000);
    const totalReceivedMatch = text.match(/Total\s+Contribution\s+Received\s*(?:Rs\.\s*)?([\d,.]+)\s*Crore/i);
    const totalCr = totalReceivedMatch ? parseFloat(totalReceivedMatch[1]) : 0;
    const lines = cpSection.split("\n").map((l) => l.trim()).filter(Boolean);
    let pendingName = "";
    for (const line of lines) {
      if (/Contribution by Partners|Name Designation/i.test(line)) continue;
      const m = line.match(/^(.*?)(?:Designated Partner|Partner)\s+([\d.]+)\s+([\d.]+)/i);
      if (m) {
        const namePart = (pendingName + " " + m[1]).trim().toUpperCase();
        const received = parseFloat(m[3]);
        const pct = totalCr > 0 ? (received / totalCr) * 100 : 0;
        if (namePart) {
          shareholdingMap.set(namePart, parseFloat(pct.toFixed(2)));
        }
        pendingName = "";
      } else {
        pendingName = (pendingName + " " + line).trim();
      }
    }
  }

  let dIdx = text.indexOf("Directors\nDirector Name", 3000);
  if (dIdx === -1) {
    dIdx = text.indexOf("Directors\nDirector Name", 500);
  }
  if (dIdx === -1) return [];

  const dEnd = text.indexOf("Director - Association History", dIdx);
  const dSection = text.substring(dIdx, dEnd !== -1 ? dEnd : dIdx + 6000);

  const lines = dSection.split("\n").map((l) => l.trim()).filter(Boolean);
  const directors: ExtractedAssociate[] = [];

  for (const line of lines) {
    const m = line.match(
      /^([A-Z\s.]+?)\s+(Designated Partner|Partner|Managing Director|Whole-time director|Additional Director|Nominee Director|Independent Director|Director|Company Secretary|CFO|CEO|Manager)\s+(\d{8}|-)\s+(\d{1,2}\s+[A-Za-z]{3},\s+\d{4})\s*(\d{1,2}\s+[A-Za-z]{3},\s+\d{4}|-)?\s*(.*)$/i,
    );
    if (m) {
      const fullName = m[1].trim();
      const designation = m[2].trim();
      const din = m[3] !== "-" ? m[3] : null;
      const apptDate = m[4].trim();
      const origDate = m[5] && m[5] !== "-" ? m[5].trim() : null;
      const rest = m[6] ? m[6].trim() : "";

      const cessationMatch = rest.match(/(\d{1,2}\s+[A-Za-z]{3},\s+\d{4})/);
      const cessationDate = cessationMatch ? cessationMatch[1].trim() : null;

      let shPercent = shareholdingMap.get(fullName.toUpperCase()) ?? null;
      if (shPercent === null) {
        for (const [key, val] of shareholdingMap.entries()) {
          if (fullName.toUpperCase().includes(key) || key.includes(fullName.toUpperCase())) {
            shPercent = val;
            break;
          }
        }
      }

      const role: ExtractedAssociate["associate_role"] = /Company Secretary|CFO|CEO|Manager/i.test(designation)
        ? "key_management"
        : "director";

      directors.push({
        full_name: fullName,
        designation,
        din,
        associate_role: role,
        appointment_date: apptDate,
        original_appointment_date: origDate,
        cessation_date: cessationDate,
        shareholding_percent: shPercent,
        is_active: !cessationDate,
      });
    }
  }

  return directors;
}

// 3. Open Charges & Charge Details
function extractCharges(text: string): ExtractedOpenCharge[] {
  const cIdx = text.indexOf("Open Charges Sequence\nOpen Charges Sequence", 1000);
  if (cIdx === -1) return [];
  const cEnd = text.indexOf("Satisfied Charges Sequence", cIdx);
  const cSection = text.substring(cIdx, cEnd !== -1 ? cEnd : cIdx + 50000);

  const chargeBlocks = cSection.split(/(?=(?:Creation|Modification)\s+\d{1,2}\s+[A-Za-z]{3},\s+\d{4})/);
  const charges: ExtractedOpenCharge[] = [];

  for (const b of chargeBlocks) {
    const match = b.match(
      /^(Creation|Modification)\s+(\d{1,2}\s+[A-Za-z]{3},\s+\d{4})\s+(\d{1,2}\s+[A-Za-z]{3},\s+\d{4})\s+([\s\S]+?)\s+([\d,.]+)\s+([\s\S]+?)(?:(\d+)\.)?(\d{8,10})/,
    );
    if (match) {
      const cleanPropertyType = match[6]
        .replace(/\s+/g, " ")
        .replace(/\s*\d+\s*\d*\.?\s*$/, "")
        .trim();

      charges.push({
        status: match[1].trim(),
        date: match[2].trim(),
        filing_date: match[3].trim(),
        holder_name: match[4].replace(/\s+/g, " ").trim(),
        amount_crore: parseFloat(match[5].replace(/,/g, "")),
        property_type: cleanPropertyType,
        sl_no: match[7] ? match[7].trim() : null,
        charge_id: match[8].trim(),
      });
    }
  }

  return charges;
}

// 4. Structure & Subsidiaries
function extractStructure(text: string): { structure: ExtractedStructure; groupEntities: ExtractedGroupEntity[] } {
  const sIdx = text.indexOf("Structure -", 3000);
  const sEnd = text.indexOf("Directors\nDirector Name", sIdx !== -1 ? sIdx : 0);
  const sub = sIdx !== -1 ? text.substring(sIdx, sEnd !== -1 ? sEnd : sIdx + 25000) : "";

  const mOverview = sub.match(
    /Promoter %\s*Public %\s*No\. of Shareholders\s*Total Equity Shares\s*Total Preference Shares\s*([\d.]+)\s*([\d.]+)\s*([\d,]+)\s*(?:\[[^\]]+\])?\s*([\d,]+)/i,
  );

  let promoterPct = mOverview ? parseFloat(mOverview[1]) : null;
  let publicPct = mOverview ? parseFloat(mOverview[2]) : null;
  let totalShareholders = mOverview ? parseInt(mOverview[3].replace(/,/g, ""), 10) : null;
  const totalEquityShares = mOverview ? parseInt(mOverview[4].replace(/,/g, ""), 10) : null;

  // Major shareholders (>5%)
  const majorShareholders: ExtractedStructure["major_shareholders"] = [];
  const sh5Idx = text.indexOf("Shareholding more than 5% -", 3000);
  if (sh5Idx !== -1) {
    const sh5Section = text.substring(sh5Idx, sh5Idx + 2000);
    const lines = sh5Section.split("\n").map((l) => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const m = line.match(/^([\d.]+)\s+-\s+Person holding DIN/i);
      if (m && i > 0) {
        const name = lines[i - 1];
        if (name && !/Individuals|Name|Shareholding/i.test(name)) {
          majorShareholders.push({
            name,
            shareholding_percent: parseFloat(m[1]),
          });
        }
      }
    }
  }

  // If LLP, derive structure from partners
  const partnerSumIdx = text.indexOf("Summary of Designated Partner(s) / Partner(s) -", 3000);
  if (partnerSumIdx !== -1) {
    const pSumMatch = text.substring(partnerSumIdx, partnerSumIdx + 600).match(/Individuals\s+\d+\s+(\d+)\s+\d+\s+(\d+)/i);
    if (pSumMatch) {
      totalShareholders = parseInt(pSumMatch[2], 10);
      promoterPct = 100;
      publicPct = 0;
    }
  }

  // Subsidiaries & Associates
  const groupEntities: ExtractedGroupEntity[] = [];
  const subIdx = text.indexOf("Subsidiary Corporates\nSubsidiary Corporates - Company", 1000);
  const ascIdx = text.indexOf("Associate Corporates\nAssociate Corporates - Company", 1000);
  const jvIdx = text.indexOf("Joint Ventures\nJoint Ventures - Company", 1000);

  if (subIdx !== -1) {
    const candidateEnds = [
      ascIdx !== -1 ? ascIdx : Infinity,
      jvIdx !== -1 ? jvIdx : Infinity,
      text.indexOf("Directors\nDirector Name", subIdx),
      text.indexOf("Directors\n", subIdx + 50),
      text.indexOf("Director - Association History", subIdx),
      text.indexOf("Other Directorships", subIdx),
    ].filter((i) => i !== -1 && i > subIdx && i !== Infinity);

    const endIdx = candidateEnds.length > 0 ? Math.min(...candidateEnds) : subIdx + 5000;
    const subPart = text.substring(subIdx, endIdx);

    const matches = [
      ...subPart.matchAll(
        /([A-Z0-9\s.,&()-]+?)\n\s*\(([LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\)\s*\n\s*([\d.]+)\s+([A-Za-z]+)?/g,
      ),
    ];
    for (const m of matches) {
      groupEntities.push({
        entity_name: m[1].replace(/\s+/g, " ").trim(),
        relationship_type: "subsidiary",
        cin_or_registration: m[2],
        percentage_holding: parseFloat(m[3]),
        city: m[4] || undefined,
        status: "Active",
      });
    }
  }

  if (ascIdx !== -1) {
    const candidateEnds = [
      jvIdx !== -1 ? jvIdx : Infinity,
      text.indexOf("Directors\nDirector Name", ascIdx),
      text.indexOf("Directors\n", ascIdx + 50),
      text.indexOf("Director - Association History", ascIdx),
      text.indexOf("Other Directorships", ascIdx),
    ].filter((i) => i !== -1 && i > ascIdx && i !== Infinity);

    const endIdx = candidateEnds.length > 0 ? Math.min(...candidateEnds) : ascIdx + 5000;
    const ascPart = text.substring(ascIdx, endIdx);

    const matches = [
      ...ascPart.matchAll(
        /([A-Z0-9\s.,&()-]+?)\n\s*\(([LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\)\s*\n\s*([\d.]+)\s+([A-Za-z]+)?/g,
      ),
    ];
    for (const m of matches) {
      groupEntities.push({
        entity_name: m[1].replace(/\s+/g, " ").trim(),
        relationship_type: "associate_entity",
        cin_or_registration: m[2],
        percentage_holding: parseFloat(m[3]),
        city: m[4] || undefined,
        status: "Active",
      });
    }
  }

  return {
    structure: {
      promoter_percent: promoterPct,
      public_percent: publicPct,
      total_shareholders: totalShareholders,
      total_equity_shares: totalEquityShares,
      major_shareholders: majorShareholders,
    },
    groupEntities,
  };
}

// 5. Financial Data (Standalone & Consolidated)
function extractLineValues(sectionText: string, labelRegexStr: string): [number | null, number | null, number | null] {
  // Try after label
  const afterRegex = new RegExp(labelRegexStr + "\\s+([\\d,.-]+)\\s+([\\d,.-]+)\\s+([\\d,.-]+)", "i");
  const mAfter = sectionText.match(afterRegex);
  if (mAfter) {
    return [
      mAfter[1] === "-" ? null : parseFloat(mAfter[1].replace(/,/g, "")),
      mAfter[2] === "-" ? null : parseFloat(mAfter[2].replace(/,/g, "")),
      mAfter[3] === "-" ? null : parseFloat(mAfter[3].replace(/,/g, "")),
    ];
  }

  // Try before label (reversed: [2025, 2024, 2023])
  const beforeRegex = new RegExp("([\\d,.-]+)\\s+([\\d,.-]+)\\s+([\\d,.-]+)\\s+" + labelRegexStr, "i");
  const mBefore = sectionText.match(beforeRegex);
  if (mBefore) {
    return [
      mBefore[3] === "-" ? null : parseFloat(mBefore[3].replace(/,/g, "")),
      mBefore[2] === "-" ? null : parseFloat(mBefore[2].replace(/,/g, "")),
      mBefore[1] === "-" ? null : parseFloat(mBefore[1].replace(/,/g, "")),
    ];
  }

  return [null, null, null];
}

function extractStatements(text: string, type: "standalone" | "consolidated"): ExtractedFinancialStatement[] {
  let sub = "";
  let yearMatch: RegExpMatchArray | null = null;

  if (type === "standalone") {
    const tableRegex = /(?:Balance Sheet(?: - [A-Za-z0-9-]+)?|Statement of Assets and Liabilities)\s*\([^)]*?(?:Rs\.\s*Crore|Rs\.\s*Lakh)[^)]*?\)\s*(\d{1,2}\s+[A-Za-z]{3},\s+\d{4})\s+(\d{1,2}\s+[A-Za-z]{3},\s+\d{4})\s+(\d{1,2}\s+[A-Za-z]{3},\s+\d{4})/i;
    const match = text.match(tableRegex);
    if (match && match.index !== undefined) {
      yearMatch = match;
      const startIdx = match.index;
      const endIdx = text.indexOf("Consolidated Financial Data", startIdx + 1000);
      const altEndIdx = text.indexOf("Legal Cases of Financial Dispute", startIdx + 1000);
      const ends = [endIdx, altEndIdx, startIdx + 18000].filter((i) => i !== -1);
      sub = text.substring(startIdx, Math.min(...ends));
    }
  } else {
    const consolIdx = text.indexOf("Consolidated Financial Data\nBalance Sheet", 1000);
    const consolAltIdx = text.indexOf("Consolidated Financial Data", 4000);
    const targetIdx = consolIdx !== -1 ? consolIdx : consolAltIdx;
    if (targetIdx !== -1) {
      const subCandidate = text.substring(targetIdx, targetIdx + 20000);
      const tableRegex = /Balance Sheet(?: - [A-Za-z0-9-]+)?\s*\([^)]*?(?:Rs\.\s*Crore|Rs\.\s*Lakh)[^)]*?\)\s*(\d{1,2}\s+[A-Za-z]{3},\s+\d{4})\s+(\d{1,2}\s+[A-Za-z]{3},\s+\d{4})\s+(\d{1,2}\s+[A-Za-z]{3},\s+\d{4})/i;
      const match = subCandidate.match(tableRegex);
      if (match && match.index !== undefined) {
        yearMatch = match;
        const endIdx = subCandidate.indexOf("Auditor(s)", 1000);
        sub = subCandidate.substring(match.index, endIdx !== -1 ? endIdx : match.index + 18000);
      }
    }
  }

  if (!yearMatch) return [];

  const years = [yearMatch[1], yearMatch[2], yearMatch[3]];
  const dates = years.map((y) => parseReportDate(y) ?? "2025-03-31");

  const metricMap: Record<string, string> = {
    share_capital: "(?:Share Capital|Contribution Received)",
    reserves_and_surplus: "Reserves and Surplus",
    total_equity: "(?:Total Equity|Partner'?s Funds)",
    long_term_borrowings: "Long Term Borrowings",
    short_term_borrowings: "(?:Short Term Borrowings?|Short Term Borrowing)",
    trade_payables: "(?:Trade Payables|Creditor / Trade Payables)",
    total_liabilities: "(?:Total Equity and Liabilities|Total)",
    trade_receivables: "(?:Trade Receivables|Debtors / Trade Receivables)",
    inventories: "Inventories",
    cash_and_bank_balances: "(?:Cash and Bank Balances|Cash and Cash Equivalents)",
    total_assets: "(?:Total Assets|Total)",
    net_revenue: "Net Revenue(?:\\s*\\*)?",
    total_operating_cost: "Total Operating Cost",
    ebitda: "Operating Profit\\s*\\(\\s*EBITDA\\s*\\)",
    depreciation_and_amortization: "(?:Depreciation and Amortization Expense|Depreciation and Amortization)",
    finance_costs: "Finance Costs",
    profit_before_tax: "Profit Before Tax",
    income_tax: "(?:Income Tax|Tax Expense)",
    profit_after_tax: "(?:Profit for the Period|Profit After Tax)",
    ebitda_margin_percent: "EBITDA Margin\\s*\\(%\\)",
    net_margin_percent: "Net Margin\\s*\\(%\\)",
    return_on_equity_percent: "Return on Equity\\s*\\(%\\)",
    debt_to_equity: "Debt \\/ Equity",
    current_ratio: "Current Ratio",
    interest_coverage_ratio: "Interest Coverage Ratio",
  };

  const metricValues: Record<string, [number | null, number | null, number | null]> = {};
  for (const [key, pattern] of Object.entries(metricMap)) {
    metricValues[key] = extractLineValues(sub, pattern);
  }

  return [0, 1, 2].map((col) => {
    const fields: Record<string, number | null> = {};
    for (const [key, vals] of Object.entries(metricValues)) {
      fields[key] = vals[col];
    }
    return {
      statementType: type,
      financialYearEnding: dates[col],
      fields,
    };
  });
}

// 6. Peer Comparison
function extractPeerComparison(text: string): ExtractedPeerComparison {
  const pIdx = text.indexOf("Peer Comparison\nComparative Metrics", 4000);
  if (pIdx === -1) return { closest_peers: [] };
  const pEnd = text.indexOf("Auditors' Comments", pIdx);
  const sub = text.substring(pIdx, pEnd !== -1 ? pEnd : pIdx + 10000);

  const indMatch = sub.match(/Industry:\s*([^|]+)\s*\|\s*Segment\(s\):\s*([^\n\r]+)/i);

  const peers: ExtractedPeerComparison["closest_peers"] = [];
  const peerTableIdx = sub.indexOf("5 Closest Peers by Revenue");
  if (peerTableIdx !== -1) {
    const peerPart = sub.substring(peerTableIdx, peerTableIdx + 1500);
    const lines = peerPart.split("\n").map((l) => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const revMatch = line.match(/^([\d,.]+)$/);
      if (revMatch && i >= 2) {
        const rev = parseFloat(revMatch[1].replace(/,/g, ""));
        const companyName = lines[i - 1];
        const city = lines[i - 2];
        if (companyName && !/Legal Name|City|Revenue|Probe/i.test(companyName)) {
          peers.push({ name: companyName, city, revenue_crore: rev });
        }
      }
    }
  }

  return {
    industry: indMatch ? indMatch[1].trim() : undefined,
    segment: indMatch ? indMatch[2].trim() : undefined,
    closest_peers: peers,
  };
}

// 7. Compliance Checks
function extractCompliance(text: string): ExtractedComplianceChecks {
  const cIdx = text.indexOf("Compliance\nIncidents of Name Removal", 1000);
  if (cIdx === -1) return { epfo_establishments: [] };
  const candidateEnds = [
    text.indexOf("Annexure - Contact Details", cIdx),
    text.indexOf("Annexure - Statement of Account", cIdx),
    text.indexOf("Annexure -", cIdx),
  ].filter((i) => i !== -1 && i > cIdx);
  const cEnd = candidateEnds.length > 0 ? Math.min(...candidateEnds) : cIdx + 6000;
  const sub = text.substring(cIdx, cEnd);

  function getSectionClean(startLabel: string, nextLabel?: string) {
    const s = sub.indexOf(startLabel);
    if (s === -1) return null;
    const e = nextLabel ? sub.indexOf(nextLabel, s) : -1;
    let snippet = sub.substring(s + startLabel.length, e !== -1 ? e : s + 400).trim();
    // remove page footer and vendor boilerplate
    snippet = snippet.split("Page ")[0].trim();
    snippet = snippet.split("© PROBE")[0].trim();
    snippet = snippet.replace(/Probe42\.in/gi, "").trim();
    snippet = snippet.replace(/Marked Copy For.*$/gi, "").trim();
    return snippet.replace(/\s+/g, " ");
  }

  const epfo: ExtractedComplianceChecks["epfo_establishments"] = [];
  const epfoIdx = text.indexOf("Establishments Registered with EPFO", 1000);
  if (epfoIdx !== -1) {
    const epfoSection = text.substring(epfoIdx, epfoIdx + 1500);
    const epfoMatches = [
      ...epfoSection.matchAll(
        /([A-Z0-9]{15,22})[\s\S]+?([A-Z0-9\s.,&()-]+(?:LIMITED|PRIVATE LIMITED|LLP))\s+([A-Za-z\s]+?)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/gi,
      ),
    ];
    for (const m of epfoMatches) {
      epfo.push({
        id: m[1].trim(),
        name: m[2].replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim(),
        city: m[3].replace(/\s+/g, " ").trim(),
      });
    }
  }

  return {
    roc_name_removal: getSectionClean("Incidents of Name Removal U/S 248(5) by ROC", "BIFR History"),
    bifr_history: getSectionClean("BIFR History", "Corporate Debt Restructuring (CDR) History"),
    cdr_history: getSectionClean("Corporate Debt Restructuring (CDR) History", "Suit Filed Cases as per Bureaus"),
    suit_filed_cases: getSectionClean("Suit Filed Cases as per Bureaus", "Establishments Registered with EPFO"),
    epfo_establishments: epfo,
  };
}

// 8. Related Party Transactions (RPT)
function extractRptData(rawText: string): ExtractedRptItem[] {
  const startIdx = rawText.indexOf("Related Party Transactions - FY Ending On");
  if (startIdx === -1) return [];
  const endIdx = rawText.indexOf("MSME Supplier Payment Delays", startIdx);
  const sectionText = rawText.substring(startIdx, endIdx !== -1 ? endIdx : startIdx + 20000);

  // Extract FY Date
  const fyMatch = sectionText.match(/Related Party Transactions - FY Ending On\s+([^\n]+)/i);
  const fyEnding = fyMatch ? fyMatch[1].trim() : "";
  const financialYear = fyEnding ? `FY Ending ${fyEnding}` : "FY 2024-25";

  // Split into Company and Individuals subsections
  const indMatch = sectionText.match(/Individuals\s*\n\s*Name\s+Relationship\s+Transaction\s+Type/i);
  const indIdx = indMatch && typeof indMatch.index === "number" ? indMatch.index : -1;

  const companyBlock = indIdx !== -1 ? sectionText.substring(0, indIdx) : sectionText;
  const indBlock = indIdx !== -1 ? sectionText.substring(indIdx) : "";

  function cleanBoilerplate(str: string) {
    return str
      .replace(/Page\s+\d+\s+of\s+\d+[\s\S]*?Marked Copy For[^\n]*\n/gi, "")
      .replace(/Probe42\.in\s*\n[^\n]+\n/gi, "")
      .replace(/(?:Company|Individuals)\s*\n\s*Name\s+Relationship\s+Transaction\s+Type[^\n]*\n/gi, "")
      .replace(/^Company\s*$/gm, "")
      .replace(/^Individuals\s*$/gm, "");
  }

  function parseBlock(block: string, category: "company" | "individual"): ExtractedRptItem[] {
    const cleaned = cleanBoilerplate(block);
    const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);

    const items: ExtractedRptItem[] = [];
    let currentName = "";
    let accumulatedRelationship: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/Related Party Transactions/i.test(line)) continue;
      if (/Name\s+Relationship\s+Transaction\s+Type/i.test(line)) continue;
      if (/^Company$/i.test(line) || /^Individuals$/i.test(line)) continue;
      if (/^Probe42\.in$/i.test(line)) continue;
      if (/^© PROBE INFORMATION/i.test(line)) continue;
      if (/^Marked Copy For/i.test(line)) continue;

      // Check if line contains transaction type & amount at the end
      const tailMatch = line.match(
        /(.*?)\b(Revenue|Expense|Sales|Purchase|Loan|Advance|Remuneration|Other)\s+(\d+\.?\d*|\*{3,})$/i,
      );

      if (tailMatch) {
        const relationshipPrefix = tailMatch[1].trim();
        const txType = tailMatch[2].trim();
        const amtStr = tailMatch[3].trim();

        if (relationshipPrefix) {
          accumulatedRelationship.push(relationshipPrefix);
        }

        const fullRelationship = accumulatedRelationship.join(" ").trim();
        const amountCrore = amtStr.startsWith("*") ? null : parseFloat(amtStr);
        const amountInr = amountCrore !== null ? Math.round(amountCrore * 10000000) : 0;

        if (currentName) {
          items.push({
            partyName: currentName,
            category,
            relationship: fullRelationship || (category === "individual" ? "Key Management / Director" : "Related Entity"),
            transactionType: txType,
            amountCrore,
            amountInr,
            financialYear,
            isMaterial: amountInr >= 10000000 || (amountCrore !== null && amountCrore >= 1.0),
          });
        }

        currentName = "";
        accumulatedRelationship = [];
      } else {
        if (!currentName) {
          currentName = line;
        } else {
          accumulatedRelationship.push(line);
        }
      }
    }

    return items;
  }

  return [...parseBlock(companyBlock, "company"), ...parseBlock(indBlock, "individual")];
}

export { GST_STATE_MAP } from "./gst-constants";
import { GST_STATE_MAP } from "./gst-constants";

// 9. GSTINs & Filing Details
function extractGstData(rawText: string): ExtractedGstin[] {
  const gstinsMap = new Map<string, ExtractedGstin>();

  // A. Parse Summary Active GSTINs table
  const summaryMatch = rawText.match(/Active GSTINs\s*\n\s*GSTIN\s+State\s+Latest Filing\(s\)/i);
  if (summaryMatch && typeof summaryMatch.index === "number") {
    const summaryIdx = summaryMatch.index;
    const legalHistIdx = rawText.indexOf("Legal History", summaryIdx);
    const summaryText = rawText.substring(summaryIdx, legalHistIdx !== -1 ? legalHistIdx : summaryIdx + 12000);

    // Matches: GSTIN State Return Date FY Period
    // e.g.: 18AABCO7980R1ZG Assam GSTR1 10 Sep, 2026 2026-2027 August
    const activeGstRegex =
      /(\d{2}[A-Z]{5}\d{4}[A-Z0-9]{3}[A-Z0-9])\s+([A-Za-z\s]+?)\s+(GSTR[0-9A-Z]+)\s+(\d{1,2}\s+[A-Za-z]{3},?\s+\d{4})\s+(\d{4}-\d{4})\s+([A-Za-z]+)/g;

    let am: RegExpExecArray | null;
    while ((am = activeGstRegex.exec(summaryText)) !== null) {
      const gstin = am[1].trim();
      const state = am[2].trim();
      const latestReturn = am[3].trim();
      const latestFilingDate = am[4].trim();
      const financialYear = am[5].trim();
      const taxPeriod = am[6].trim();

      gstinsMap.set(gstin, {
        gstin,
        state,
        status: "Active",
        latestReturn,
        latestFilingDate,
        financialYear,
        taxPeriod,
        filings: [],
      });
    }

    // Parse Inactive GSTINs from summary
    const inactiveIdx = summaryText.indexOf("Inactive GSTINs");
    if (inactiveIdx !== -1) {
      const inactiveSub = summaryText.substring(inactiveIdx);
      const inactiveMatches = inactiveSub.matchAll(
        /([0-9A-Z]{15})(?:[\s\S]*?)(Suspended|Cancelled|Inactive|PR)\s+([A-Za-z\s]+?)(?:See Annexure|$)/gi,
      );
      for (const im of inactiveMatches) {
        const gstin = im[1].trim();
        const status = im[2].trim();
        const state = im[3].trim();
        if (!gstinsMap.has(gstin)) {
          gstinsMap.set(gstin, {
            gstin,
            state: state || GST_STATE_MAP[gstin.substring(0, 2)] || "India",
            status: status.toLowerCase().startsWith("susp") ? "Suspended" : status.toLowerCase().startsWith("canc") ? "Cancelled" : status,
            filings: [],
          });
        }
      }
    }
  }

  // B. Parse Annexure - GST for full filing details & jurisdictions
  const annexStart = rawText.lastIndexOf("Annexure - GST");
  if (annexStart !== -1) {
    const annexEnd = rawText.indexOf("Annexure - Credit Ratings", annexStart);
    const annexText = rawText.substring(annexStart, annexEnd !== -1 ? annexEnd : annexStart + 250000);

    // Find all GSTIN section positions in Annexure
    const gstinPositions: Array<{ gstin: string; index: number }> = [];
    const gstinHeaderRegex = /(?:^|\n)\s*(\d{2}[A-Z]{5}\d{4}[A-Z0-9]{3}[A-Z0-9]|[0-9A-Z]{15})\b/g;
    let hm: RegExpExecArray | null;
    while ((hm = gstinHeaderRegex.exec(annexText)) !== null) {
      const g = hm[1];
      const lookahead = annexText.substring(hm.index, hm.index + 1200);
      if (/Date of Registration|GSTIN Status|Return Type|Legal Name/i.test(lookahead)) {
        gstinPositions.push({ gstin: g, index: hm.index });
      }
    }

    // Process each GSTIN section block
    for (let i = 0; i < gstinPositions.length; i++) {
      const cur = gstinPositions[i];
      const nextIndex = i + 1 < gstinPositions.length ? gstinPositions[i + 1].index : annexText.length;
      const block = annexText.substring(cur.index, nextIndex);
      const gstin = cur.gstin;

      let entry = gstinsMap.get(gstin);
      if (!entry) {
        entry = {
          gstin,
          status: "Active",
          filings: [],
        };
        gstinsMap.set(gstin, entry);
      }

      const statusMatch = block.match(/GSTIN Status\s*:\s*(Active|Suspended|Cancelled|PR|Inactive)/i);
      if (statusMatch) entry.status = statusMatch[1].trim();

      const stateMatch = block.match(/State\s*:\s*([^\n]+?)(?:Taxpayer|Date|Jurisdiction|$)/i);
      if (stateMatch && !entry.state) entry.state = stateMatch[1].trim();

      const regMatch = block.match(/Date of Registration\s*:\s*([^\n]+?)(?:Centre|$)/i);
      if (regMatch) entry.dateOfRegistration = regMatch[1].trim();

      const centreMatch = block.match(/Centre Jurisdiction\s*:\s*([^\n]+)/i);
      if (centreMatch) entry.centreJurisdiction = centreMatch[1].trim();

      const stateJurisMatch = block.match(/State Jurisdiction\s*:\s*([^\n]+)/i);
      if (stateJurisMatch) entry.stateJurisdiction = stateJurisMatch[1].trim();

      const taxpayerMatch = block.match(/Taxpayer Type\s*:\s*([^\n]+)/i);
      if (taxpayerMatch) entry.taxpayerType = taxpayerMatch[1].trim();

      const legalNameMatch = block.match(/Legal Name of Business\s*:\s*([^\n]+?)(?:Trade Name|$)/i);
      if (legalNameMatch) entry.legalName = legalNameMatch[1].trim();

      const tradeNameMatch = block.match(/Trade Name\s*:\s*([^\n]+)/i);
      if (tradeNameMatch) entry.tradeName = tradeNameMatch[1].trim();

      const natureMatch = block.match(/Nature of Business Activities\s*:\s*([^\n]+)/i);
      if (natureMatch) entry.natureOfBusiness = natureMatch[1].trim();

      // Return filings table (handles dates, dashes, and statuses with spaces)
      const filingRegex =
        /(GSTR[0-9A-Z]+)\s+(\d{4}-\d{4})\s+([A-Za-z]+)\s+([-–]|\d{1,2}\s+[A-Za-z]{3},?\s+\d{4})\s+([-–]|\d{1,2}\s+[A-Za-z]{3},?\s+\d{4})\s+(Filed on Time|Filed After Due Date|Pending|Filed)/gi;

      let fm: RegExpExecArray | null;
      while ((fm = filingRegex.exec(block)) !== null) {
        const returnType = fm[1];
        const financialYear = fm[2];
        const taxPeriod = fm[3];
        const dueDate = fm[4] !== "-" && fm[4] !== "–" ? fm[4] : undefined;
        const filingDate = fm[5] !== "-" && fm[5] !== "–" ? fm[5] : (dueDate || undefined);
        const status = fm[6];

        if (!entry.filings) entry.filings = [];
        entry.filings.push({
          returnType,
          financialYear,
          taxPeriod,
          dueDate,
          filingDate,
          status,
        });
      }
    }
  }

  // Normalize all entries
  for (const item of gstinsMap.values()) {
    if (!item.state || item.state.length < 2) {
      item.state = GST_STATE_MAP[item.gstin.substring(0, 2)] || "India";
    }
    const stLower = (item.status || "").toLowerCase();
    if (stLower.startsWith("active")) {
      item.status = "Active";
    } else if (stLower.startsWith("suspended")) {
      item.status = "Suspended";
    } else if (stLower.startsWith("cancelled")) {
      item.status = "Cancelled";
    } else if (stLower.startsWith("pr")) {
      item.status = "Provisional";
    }
  }

  return Array.from(gstinsMap.values());
}

export function parseCorporateText(text: string): ExtractedCorporateData {
  const { profile, highlights } = extractProfile(text);
  const associates = extractDirectors(text);
  const openCharges = extractCharges(text);
  const { structure, groupEntities } = extractStructure(text);
  const standaloneFinancials = extractStatements(text, "standalone");
  const consolidatedFinancials = extractStatements(text, "consolidated");
  const peerComparison = extractPeerComparison(text);
  const complianceChecks = extractCompliance(text);
  const gstins = extractGstData(text);
  const rpt = extractRptData(text);

  // If primary GSTIN was found, sync it to profile
  if (!profile.gstin && gstins.length > 0) {
    profile.gstin = gstins[0].gstin;
  }

  return {
    profile,
    highlights,
    associates,
    financials: [...standaloneFinancials, ...consolidatedFinancials],
    groupStructure: groupEntities,
    structure,
    openCharges,
    peerComparison,
    complianceChecks,
    gstins,
    rpt,
  };
}

export async function parseCorporatePdf(buffer: Buffer): Promise<ExtractedCorporateData> {
  if (!buffer || buffer.length === 0) {
    throw new Error("Empty or invalid PDF buffer provided.");
  }

  // Ensure file contains the %PDF- magic bytes in the first 1KB
  const headerPreview = buffer.subarray(0, 1024).toString("latin1");
  if (!headerPreview.includes("%PDF-")) {
    throw new Error("Invalid document format: expected a valid PDF file starting with %PDF-.");
  }

  const parser = getPdfParser();
  if (typeof parser !== "function") {
    throw new Error("PDF parser module could not be initialized.");
  }

  try {
    const data = await parser(buffer, {
      pagerender: renderPageWithSpacing,
    });

    if (!data?.text || data.text.trim().length === 0) {
      throw new Error("No readable text could be extracted from this PDF document.");
    }

    return parseCorporateText(data.text);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse corporate PDF: ${message}`);
  }
}
