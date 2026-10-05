"use server";

import {
  lookupSecurityByIsin,
  lookupSecurityByNameOrSymbol,
  searchSecuritiesDirectory,
  type SecurityRecord,
} from "@/lib/securities-directory";

export type LiveStockPriceResult = {
  success: boolean;
  symbol?: string;
  companyName?: string;
  isin?: string;
  cmp?: number;
  previousClose?: number;
  dayHigh?: number;
  dayLow?: number;
  exchange?: string;
  currency?: string;
  error?: string;
};

/**
 * Resolves ISIN Code and Company Name reciprocally.
 * Given Company Name or Symbol -> returns official ISIN Code.
 * Given ISIN Code -> returns official Company Name & Stock Symbol.
 */
export async function lookupSecurityDetails(query: string): Promise<{
  found: boolean;
  isin?: string;
  companyName?: string;
  symbol?: string;
}> {
  if (!query || !query.trim()) return { found: false };
  const clean = query.trim();

  // 1. Direct directory lookup (ISIN, Symbol, or Name)
  const isinMatch = lookupSecurityByIsin(clean);
  if (isinMatch) {
    return {
      found: true,
      isin: isinMatch.isin,
      companyName: isinMatch.companyName,
      symbol: isinMatch.symbol,
    };
  }

  const nameMatch = lookupSecurityByNameOrSymbol(clean);
  if (nameMatch) {
    return {
      found: true,
      isin: nameMatch.isin,
      companyName: nameMatch.companyName,
      symbol: nameMatch.symbol,
    };
  }

  // 2. If not found in local directory and query looks like an ISIN, attempt Yahoo search
  if (clean.length >= 10 && clean.toUpperCase().startsWith("IN")) {
    try {
      const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(clean)}&quotesCount=1`;
      const res = await fetch(searchUrl, {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const quote = data?.quotes?.[0];
        if (quote?.symbol) {
          const matchedDir = lookupSecurityByNameOrSymbol(quote.symbol.replace(/\.NS$|\.BO$/, ""));
          return {
            found: true,
            isin: matchedDir?.isin || clean.toUpperCase(),
            companyName: matchedDir?.companyName || quote.longname || quote.shortname || clean,
            symbol: quote.symbol,
          };
        }
      }
    } catch {
      // ignore
    }
  }

  return { found: false };
}

/**
 * Autocomplete search for securities by company name, symbol, or ISIN.
 */
export async function searchSecuritiesAction(query: string): Promise<SecurityRecord[]> {
  return searchSecuritiesDirectory(query, 8);
}

/**
 * Fetches real-time market data for Indian equities (NSE/BSE)
 * by ISIN, Stock Symbol, or Company Name without any API fees.
 * Automatically resolves and populates reciprocal ISIN and Company Name.
 */
export async function fetchLiveStockPrice(query: string): Promise<LiveStockPriceResult> {
  if (!query || !query.trim()) {
    return { success: false, error: "Please enter an ISIN, stock symbol, or company name." };
  }

  const clean = query.trim();

  try {
    let symbol = clean.toUpperCase();
    let name = clean;
    let resolvedIsin: string | undefined;

    // 1. Try resolving via local canonical securities directory first (NSE 2,500+ equities)
    const dirMatch = lookupSecurityByIsin(clean) || lookupSecurityByNameOrSymbol(clean);
    if (dirMatch) {
      symbol = `${dirMatch.symbol}.NS`;
      name = dirMatch.companyName;
      resolvedIsin = dirMatch.isin;
    } else if (!symbol.endsWith(".NS") && !symbol.endsWith(".BO")) {
      // 2. If not found locally and not a raw ticker, search on Yahoo
      const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(clean)}&quotesCount=5&newsCount=0`;
      const searchRes = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!searchRes.ok) {
        return { success: false, error: "Search service unavailable. Please enter CMP manually." };
      }

      const searchData = await searchRes.json();
      const quotes: Array<{ symbol?: string; shortname?: string; longname?: string; exchange?: string }> =
        searchData?.quotes || [];

      // Prioritize NSE (.NS), then BSE (.BO)
      const bestQuote =
        quotes.find((q) => q.symbol?.endsWith(".NS")) ||
        quotes.find((q) => q.symbol?.endsWith(".BO")) ||
        quotes[0];

      if (!bestQuote || !bestQuote.symbol) {
        return { success: false, error: `No exchange-listed scrip found for "${clean}".` };
      }

      symbol = bestQuote.symbol;
      name = bestQuote.longname || bestQuote.shortname || clean;

      // Check if this resolved symbol matches an ISIN in directory
      const baseSym = symbol.replace(/\.NS$|\.BO$/, "");
      const symMatch = lookupSecurityByNameOrSymbol(baseSym);
      if (symMatch) {
        resolvedIsin = symMatch.isin;
        name = symMatch.companyName;
      } else if (clean.toUpperCase().startsWith("IN") && clean.length === 12) {
        resolvedIsin = clean.toUpperCase();
      }
    }

    // 3. Fetch live quote chart
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d`;
    const chartRes = await fetch(chartUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!chartRes.ok) {
      return { success: false, error: `Could not fetch live quote for ${symbol}.` };
    }

    const chartData = await chartRes.json();
    const meta = chartData?.chart?.result?.[0]?.meta;

    if (!meta || meta.regularMarketPrice === undefined) {
      return { success: false, error: `Live market price not available for ${symbol}.` };
    }

    const exchange = symbol.endsWith(".NS") ? "NSE" : symbol.endsWith(".BO") ? "BSE" : meta.exchangeName || "NSE";

    return {
      success: true,
      symbol,
      companyName: name,
      isin: resolvedIsin,
      cmp: Number(meta.regularMarketPrice.toFixed(2)),
      previousClose: meta.chartPreviousClose || meta.previousClose ? Number((meta.chartPreviousClose || meta.previousClose).toFixed(2)) : undefined,
      dayHigh: meta.regularMarketDayHigh ? Number(meta.regularMarketDayHigh.toFixed(2)) : undefined,
      dayLow: meta.regularMarketDayLow ? Number(meta.regularMarketDayLow.toFixed(2)) : undefined,
      exchange,
      currency: meta.currency || "INR",
    };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    console.error("fetchLiveStockPrice error:", err);
    return {
      success: false,
      error: errorObj?.message || "Failed to reach market data service.",
    };
  }
}
