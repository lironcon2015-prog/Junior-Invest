const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchFromFunder(ticker) {
  try {
    const targetUrl = 'https://www.funder.co.il/fund/' + ticker;
    const res = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(targetUrl));
    const data = await res.json();
    const html = data.contents;
    console.log('Funder HTML snippet:', html.substring(0, 1000));
    const regex = /id="fundLastRate"[^>]*>([\d.,]+)</i;
    const fallbackRegex = /שער אחרון[^>]*>([\d.,]+)</i;
    const match = html.match(regex) || html.match(fallbackRegex);
    return match ? parseFloat(match[1].replace(/,/g, '')) : null;
  } catch (_) { return null; }
}

export async function fetchQuotes(tickers) {
  const results = {};
  let funderCount = 0;
  for (const ticker of tickers) {
    const isIsraeliFund = /^\d{7}$/.test(ticker);

    if (!isIsraeliFund) {
      try {
        const targetUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker);
        const res = await fetch('https://corsproxy.io/?url=' + encodeURIComponent(targetUrl));
        const data = await res.json();
        const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (typeof price === 'number') { results[ticker] = price; continue; }
      } catch (_) {}
    }

    if (isIsraeliFund) {
      if (funderCount > 0) await sleep(2000);
      console.log(`[QuoteFetcher] Fetching ${ticker} from Funder`);
      const funderPrice = await fetchFromFunder(ticker);
      if (funderPrice != null) results[ticker] = funderPrice;
      funderCount++;
    }
  }
  return results;
}
