export async function fetchQuotes(tickers) {
  const results = {};
  for (const ticker of tickers) {
    try {
      const targetUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker);
      const res = await fetch('https://corsproxy.io/?url=' + encodeURIComponent(targetUrl));
      const data = await res.json();
      const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (typeof price === 'number') results[ticker] = price;
    } catch (_) {}
  }
  return results;
}
