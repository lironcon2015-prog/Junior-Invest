async function fetchFromFunder(ticker) {
  try {
    const targetUrl = 'https://www.funder.co.il/fund/' + ticker;
    const res = await fetch('https://corsproxy.io/?url=' + encodeURIComponent(targetUrl));
    const text = await res.text();
    const match = text.match(/id="fundLastRate">([\d.]+)</);
    return match ? parseFloat(match[1]) : null;
  } catch (_) { return null; }
}

export async function fetchQuotes(tickers) {
  const results = {};
  for (const ticker of tickers) {
    try {
      const targetUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker);
      const res = await fetch('https://corsproxy.io/?url=' + encodeURIComponent(targetUrl));
      const data = await res.json();
      const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (typeof price === 'number') { results[ticker] = price; continue; }
    } catch (_) {}

    if (/^\d{7}$/.test(ticker)) {
      console.log(`[QuoteFetcher] Yahoo miss for ${ticker}, falling back to Funder`);
      const funderPrice = await fetchFromFunder(ticker);
      if (funderPrice != null) results[ticker] = funderPrice;
    }
  }
  return results;
}
