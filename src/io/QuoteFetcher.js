const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ISRAELI_FUND_RE = /^(\d{6,7})$/;   // pure numeric, NO .TA — mutual funds only
const TA_ETF_RE       = /\.TA$/i;         // Israeli ETFs/stocks traded on TASE

// ── Yahoo Finance ──────────────────────────────────────────────────────────
async function fetchYahoo(ticker) {
  // Try two endpoints: v8/chart (primary) and v7/quote (fallback)
  const endpoints = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`,
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`,
  ];
  const proxies = [
    (u) => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
    (u) => 'https://api.allorigins.win/get?url=' + encodeURIComponent(u),
  ];

  for (const endpoint of endpoints) {
    for (const buildProxy of proxies) {
      try {
        const res = await fetch(buildProxy(endpoint));
        if (!res.ok) continue;
        const raw = await res.text();
        let json;
        try { json = JSON.parse(raw); } catch (_) {
          // allorigins wraps in {contents}
          try { json = JSON.parse(JSON.parse(raw).contents); } catch (_2) { continue; }
        }
        // v8/chart path
        const chartPrice = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (typeof chartPrice === 'number') return chartPrice;
        // v7/quote path
        const quotePrice = json?.quoteResponse?.result?.[0]?.regularMarketPrice;
        if (typeof quotePrice === 'number') return quotePrice;
      } catch (_) {}
    }
  }
  return null;
}

// ── Funder.co.il (Israeli mutual funds, priced in Agorot) ─────────────────
async function fetchFromFunder(fundCode) {
  const targetUrl = 'https://www.funder.co.il/fund/' + fundCode;
  const proxies = [
    (u) => 'https://api.allorigins.win/get?url=' + encodeURIComponent(u),
    (u) => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
  ];

  for (const buildProxy of proxies) {
    try {
      const res = await fetch(buildProxy(targetUrl));
      if (!res.ok) continue;
      const raw = await res.text();
      let html;
      try { html = JSON.parse(raw).contents ?? raw; } catch (_) { html = raw; }

      console.log('[QuoteFetcher] Funder HTML snippet:', html.substring(0, 1500));

      const patterns = [
        /id="fundLastRate"[^>]*>\s*([\d.,]+)/i,
        /class="[^"]*fundLastRate[^"]*"[^>]*>\s*([\d.,]+)/i,
        /שער\s+אחרון[^<]*<[^>]+>\s*([\d.,]+)/i,
        /"lastRate"\s*:\s*([\d.]+)/i,
      ];
      for (const re of patterns) {
        const m = html.match(re);
        if (m) {
          const agorot = parseFloat(m[1].replace(/,/g, ''));
          if (!isNaN(agorot) && agorot > 0) {
            const ils = agorot / 100;
            console.log(`[QuoteFetcher] Funder ${fundCode}: ${agorot} agorot → ₪${ils}`);
            return ils;
          }
        }
      }
    } catch (_) {}
  }
  return null;
}

// ── Public API ─────────────────────────────────────────────────────────────
export async function fetchQuotes(tickers) {
  const results = {};
  let funderCount = 0;

  for (const ticker of tickers) {
    if (ISRAELI_FUND_RE.test(ticker)) {
      // Mutual fund — Funder only
      if (funderCount > 0) await sleep(2000);
      console.log(`[QuoteFetcher] ${ticker} → Funder`);
      const price = await fetchFromFunder(ticker);
      if (price != null) results[ticker] = price;
      funderCount++;
    } else {
      // Everything else (including .TA ETFs) — Yahoo Finance
      console.log(`[QuoteFetcher] ${ticker} → Yahoo`);
      const price = await fetchYahoo(ticker);
      if (price != null) results[ticker] = price;
    }
  }
  return results;
}
