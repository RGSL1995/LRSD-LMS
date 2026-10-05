import { RAW_NSE_EQUITIES } from "./data/nse-equities";

export interface SecurityRecord {
  symbol: string;
  companyName: string;
  isin: string;
}

const rawList = RAW_NSE_EQUITIES;

export const ALL_SECURITIES: SecurityRecord[] = rawList.map((e) => ({
  symbol: e.s,
  companyName: e.n,
  isin: e.i,
}));

// Fast index maps
const isinIndex = new Map<string, SecurityRecord>();
const symbolIndex = new Map<string, SecurityRecord>();

ALL_SECURITIES.forEach((sec) => {
  isinIndex.set(sec.isin.toUpperCase(), sec);
  symbolIndex.set(sec.symbol.toUpperCase(), sec);
});

/**
 * Look up security by exact ISIN code (e.g. "INE467B01029")
 */
export function lookupSecurityByIsin(isin: string): SecurityRecord | null {
  if (!isin) return null;
  const clean = isin.trim().toUpperCase();
  return isinIndex.get(clean) || null;
}

/**
 * Look up security by symbol (e.g. "TCS") or company name (e.g. "Tata Consultancy Services")
 */
export function lookupSecurityByNameOrSymbol(query: string): SecurityRecord | null {
  if (!query) return null;
  const clean = query.trim();
  const upper = clean.toUpperCase();

  // 1. Direct ISIN match
  if (isinIndex.has(upper)) {
    return isinIndex.get(upper)!;
  }

  // 2. Direct Symbol match (e.g. "TCS", "RELIANCE", "INFY", "HDFCBANK")
  if (symbolIndex.has(upper)) {
    return symbolIndex.get(upper)!;
  }

  // 3. Exact Company Name match (case-insensitive)
  const cleanLower = clean.toLowerCase();
  const exactName = ALL_SECURITIES.find(
    (e) => e.companyName.toLowerCase() === cleanLower
  );
  if (exactName) return exactName;

  // 4. Company Name begins with query
  const prefixMatch = ALL_SECURITIES.find((e) =>
    e.companyName.toLowerCase().startsWith(cleanLower)
  );
  if (prefixMatch) return prefixMatch;

  // 5. Company Name contains query as a distinct word
  const wordMatch = ALL_SECURITIES.find((e) => {
    const nameLower = e.companyName.toLowerCase();
    return nameLower.includes(` ${cleanLower}`) || nameLower.startsWith(cleanLower);
  });
  if (wordMatch) return wordMatch;

  // 6. Substring match
  return ALL_SECURITIES.find((e) => e.companyName.toLowerCase().includes(cleanLower)) || null;
}

/**
 * Search directory for instant autocomplete (matches against ISIN, Symbol, or Company Name)
 */
export function searchSecuritiesDirectory(query: string, limit = 8): SecurityRecord[] {
  if (!query || !query.trim()) return [];
  const clean = query.trim().toLowerCase();
  const upper = clean.toUpperCase();

  const results: SecurityRecord[] = [];
  const seenIsins = new Set<string>();

  // 1. ISIN prefix matches (e.g. typing "INE002")
  for (const item of ALL_SECURITIES) {
    if (item.isin.toUpperCase().includes(upper)) {
      results.push(item);
      seenIsins.add(item.isin);
      if (results.length >= limit) return results;
    }
  }

  // 2. Symbol starts with (e.g. typing "TC" -> TCS)
  for (const item of ALL_SECURITIES) {
    if (!seenIsins.has(item.isin) && item.symbol.toLowerCase().startsWith(clean)) {
      results.push(item);
      seenIsins.add(item.isin);
      if (results.length >= limit) return results;
    }
  }

  // 3. Company name starts with (e.g. typing "Tata" -> Tata Consultancy...)
  for (const item of ALL_SECURITIES) {
    if (!seenIsins.has(item.isin) && item.companyName.toLowerCase().startsWith(clean)) {
      results.push(item);
      seenIsins.add(item.isin);
      if (results.length >= limit) return results;
    }
  }

  // 4. Company name contains
  for (const item of ALL_SECURITIES) {
    if (!seenIsins.has(item.isin) && item.companyName.toLowerCase().includes(clean)) {
      results.push(item);
      seenIsins.add(item.isin);
      if (results.length >= limit) return results;
    }
  }

  return results;
}
