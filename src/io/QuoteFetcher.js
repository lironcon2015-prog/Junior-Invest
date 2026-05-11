export async function getQuote(ticker) {
    const isMutualFund = /^\d{6,7}(?:\.TA)?$/.test(ticker);
    const rawId = ticker.replace('.TA', '');

    if (isMutualFund) {
        // MUTUAL FUND: Try Funder via proxy
        try {
            const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent('https://www.funder.co.il/fund/' + rawId)}`;
            const res = await fetch(proxy);
            if (!res.ok) throw new Error('Proxy error');
            const data = await res.json();
            const html = data.contents;

            // Extract using robust Regex (looking for 'שער' or price classes)
            const match = html.match(/שער[^0-9]*([0-9]{3,5}\.[0-9]{1,3})/i) || html.match(/class="[^"]*info-price[^"]*"[^>]*>\s*([0-9,.]+)/i);

            if (match && match[1]) {
                const priceAgorot = parseFloat(match[1].replace(/,/g, ''));
                return priceAgorot / 100; // Convert to ILS
            }
        } catch(e) {
            console.warn('Funder fetch failed', e);
        }
    } else {
        // ETF / US STOCK: Try Yahoo via proxy
        try {
            const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/' + ticker)}`;
            const res = await fetch(proxy);
            if (!res.ok) throw new Error('Proxy error');
            const data = await res.json();
            const yahooData = JSON.parse(data.contents);
            return yahooData.chart.result[0].meta.regularMarketPrice;
        } catch(e) {
            console.warn('Yahoo fetch failed', e);
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
