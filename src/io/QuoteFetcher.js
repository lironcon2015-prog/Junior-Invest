const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Strips optional .TA suffix and matches 6–7 digit Israeli fund codes
const ISRAELI_FUND_RE = /^(\d{6,7})(\.TA)?$/i;

async function fetchFromFunder(fundCode) {
  const proxies = [
    (u) => 'https://api.allorigins.win/get?url=' + encodeURIComponent(u),
    (u) => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
  ];
  const targetUrl = 'https://www.funder.co.il/fund/' + fundCode;

  for (const buildUrl of proxies) {
    try {
      const res = await fetch(buildUrl(targetUrl));
      if (!res.ok) continue;
      const raw = await res.text();
      // allorigins wraps in JSON; corsproxy returns raw HTML
      let html;
      try { html = JSON.parse(raw).contents ?? raw; } catch (_) { html = raw; }

      console.log('[QuoteFetcher] Funder HTML snippet:', html.substring(0, 1500));

      // Try several patterns in order of specificity
      const patterns = [
        /id="fundLastRate"[^>]*>\s*([\d.,]+)/i,
        /class="[^"]*last[^"]*rate[^"]*"[^>]*>\s*([\d.,]+)/i,
        /שער\s+אחרון[^<]*<[^>]+>\s*([\d.,]+)/i,
        />\s*([\d]{1,6}(?:[.,]\d{1,4})?)\s*<\/(?:td|span|div)/i,
      ];
      for (const re of patterns) {
        const m = html.match(re);
        if (m) {
          const raw = parseFloat(m[1].replace(/,/g, ''));
          if (!isNaN(raw) && raw > 0) {
            // Funder quotes Israeli mutual funds in Agorot — convert to ILS
            const ils = raw / 100;
            console.log(`[QuoteFetcher] Funder price for ${fundCode}: ${raw} agorot → ${ils} ILS`);
            return ils;
          }
        }
      }
    } catch (_) {}
  }
  return null;
}

export async function fetchQuotes(tickers) {
  const results = {};
  let funderCount = 0;

  for (const ticker of tickers) {
    const fundMatch = ISRAELI_FUND_RE.exec(ticker);

    if (!fundMatch) {
      // Non-Israeli ticker: try Yahoo Finance
      try {
        const targetUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker);
        const res = await fetch('https://corsproxy.io/?url=' + encodeURIComponent(targetUrl));
        const data = await res.json();
        const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (typeof price === 'number') { results[ticker] = price; continue; }
      } catch (_) {}
    } else {
      // Israeli mutual fund: go straight to Funder
      const fundCode = fundMatch[1];
      if (funderCount > 0) await sleep(2000);
      console.log(`[QuoteFetcher] Fetching ${ticker} (code ${fundCode}) from Funder`);
      const funderPrice = await fetchFromFunder(fundCode);
      if (funderPrice != null) results[ticker] = funderPrice;
      funderCount++;
    }
  }
  return results;
}
