const TIMEOUT_MS = 8000;

function fetchWithTimeout(url) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(id));
}

async function proxyFetch(targetUrl) {
  // Try corsproxy first (no JSON wrapper), then allorigins (JSON wrapper)
  const attempts = [
    { url: 'https://corsproxy.io/?url=' + encodeURIComponent(targetUrl), json: false },
    { url: 'https://api.allorigins.win/get?url=' + encodeURIComponent(targetUrl), json: true },
  ];
  for (const { url, json } of attempts) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) continue;
      const raw = await res.text();
      const text = json ? (JSON.parse(raw).contents ?? raw) : raw;
      if (text && text.length > 50) return text;
    } catch (_) {}
  }
  return null;
}

export async function getQuote(ticker) {
  const isMutualFund = /^\d{6,7}$/.test(ticker);  // pure numeric only
  const rawId = ticker.replace(/\.TA$/i, '');

  if (isMutualFund) {
    try {
      const html = await proxyFetch('https://www.funder.co.il/fund/' + rawId);
      if (!html) throw new Error('empty');
      console.log('[QuoteFetcher] Funder snippet:', html.substring(0, 800));
      const match =
        html.match(/id="fundLastRate"[^>]*>\s*([\d.,]+)/i) ||
        html.match(/שער[^0-9]*([0-9]{3,5}\.[0-9]{1,3})/i) ||
        html.match(/class="[^"]*info-price[^"]*"[^>]*>\s*([\d,.]+)/i);
      if (match) {
        const agorot = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(agorot) && agorot > 0) return agorot / 100;
      }
    } catch (e) { console.warn('[QuoteFetcher] Funder failed:', e.message); }
  } else {
    const endpoints = [
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`,
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`,
    ];
    for (const ep of endpoints) {
      try {
        const text = await proxyFetch(ep);
        if (!text) continue;
        const data = JSON.parse(text);
        const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (typeof price === 'number') { console.log(`[QuoteFetcher] Yahoo OK: ${ticker} = ${price}`); return price; }
      } catch (e) { console.warn(`[QuoteFetcher] Yahoo failed ${ticker}:`, e.message); }
    }
  }
  return null;
}

// Batch wrapper used by the UI
export async function fetchQuotes(tickers) {
  const results = {};
  for (const ticker of tickers) {
    const price = await getQuote(ticker);
    if (price != null) results[ticker] = price;
  }
  return results;
}
