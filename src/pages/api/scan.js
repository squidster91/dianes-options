import Anthropic from '@anthropic-ai/sdk';

// Direct Yahoo Finance fetch (no npm package needed)
async function fetchYahooQuote(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!res.ok) throw new Error(`Quote fetch failed: ${res.status}`);
  const data = await res.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error('No quote data');
  
  const meta = result.meta;
  return {
    price: meta.regularMarketPrice,
    previousClose: meta.previousClose,
    change: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100).toFixed(2),
    high: meta.regularMarketDayHigh,
    low: meta.regularMarketDayLow,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow
  };
}

async function fetchYahooOptions(ticker) {
  const url = `https://query1.finance.yahoo.com/v7/finance/options/${ticker}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!res.ok) throw new Error(`Options fetch failed: ${res.status}`);
  const data = await res.json();
  const result = data.optionChain?.result?.[0];
  if (!result) throw new Error('No options data');
  
  return {
    expirationDates: result.expirationDates,
    puts: result.options?.[0]?.puts || [],
    quote: result.quote
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { customTicker = '', targetReturn = 1.0 } = req.body;
  
  const popularTickers = ['GOOG', 'AAPL', 'TSLA', 'NVDA', 'AMZN', 'META', 'MSFT', 'SPY'];
  const cleanCustom = customTicker.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
  
  const allTickers = cleanCustom && !popularTickers.includes(cleanCustom) 
    ? [...popularTickers, cleanCustom] 
    : popularTickers;
  
  const focusTicker = cleanCustom || 'TSLA';

  try {
    // Fetch data for all tickers
    const tickerData = await Promise.all(
      allTickers.map(async (ticker) => {
        try {
          // Get options data (includes quote)
          const options = await fetchYahooOptions(ticker);
          const quote = options.quote;
          
          const currentPrice = quote?.regularMarketPrice;
          if (!currentPrice) throw new Error('No price data');
          
          // Get earnings date
          const earningsTimestamp = quote?.earningsTimestamp;
          let earningsDate = null;
          let hasEarnings = false;
          if (earningsTimestamp) {
            earningsDate = new Date(earningsTimestamp * 1000).toLocaleDateString();
            const daysToEarnings = Math.ceil((earningsTimestamp * 1000 - Date.now()) / (1000 * 60 * 60 * 24));
            hasEarnings = daysToEarnings >= 0 && daysToEarnings <= 7;
          }
          
          // Get expiration info
          const expDate = options.expirationDates?.[0];
          const daysToExpiry = expDate ? Math.ceil((expDate * 1000 - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
          
          // Filter OTM puts (3-20% below current price)
          const puts = options.puts;
          const otmPuts = puts
            .filter(p => {
              const otmPct = ((currentPrice - p.strike) / currentPrice) * 100;
              return otmPct >= 3 && otmPct <= 20 && p.bid > 0;
            })
            .map(p => ({
              strike: p.strike,
              bid: p.bid || 0,
              ask: p.ask || 0,
              volume: p.volume || 0,
              openInterest: p.openInterest || 0,
              iv: p.impliedVolatility ? (p.impliedVolatility * 100).toFixed(1) : null,
              otmPercent: (((currentPrice - p.strike) / currentPrice) * 100).toFixed(1),
              weeklyReturn: p.bid ? ((p.bid / p.strike) * 100).toFixed(2) : 0
            }))
            .sort((a, b) => parseFloat(b.weeklyReturn) - parseFloat(a.weeklyReturn))
            .slice(0, 10);

          const bestPut = otmPuts.find(p => parseFloat(p.weeklyReturn) >= targetReturn) || otmPuts[0];
          const avgIV = otmPuts.length > 0 
            ? (otmPuts.reduce((sum, p) => sum + parseFloat(p.iv || 0), 0) / otmPuts.length).toFixed(0) 
            : 0;

          return {
            ticker,
            currentPrice,
            priceChange: quote?.regularMarketChangePercent?.toFixed(2) + '%' || '0%',
            fiftyTwoWeekHigh: quote?.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: quote?.fiftyTwoWeekLow,
            expiration: expDate ? new Date(expDate * 1000).toLocaleDateString() : 'N/A',
            daysToExpiry,
            earningsDate,
            hasEarnings,
            avgIV: parseFloat(avgIV),
            bestPut: bestPut ? {
              strike: bestPut.strike,
              bid: bestPut.bid,
              ask: bestPut.ask,
              otmPercent: parseFloat(bestPut.otmPercent),
              weeklyReturn: parseFloat(bestPut.weeklyReturn),
              volume: bestPut.volume,
              openInterest: bestPut.openInterest,
              meetsTarget: parseFloat(bestPut.weeklyReturn) >= targetReturn
            } : null,
            allPuts: otmPuts,
            error: null
          };
        } catch (e) {
          console.error(`Error fetching ${ticker}:`, e.message);
          return {
            ticker,
            error: e.message,
            currentPrice: null,
            bestPut: null,
            allPuts: []
          };
        }
      })
    );

    // Get detailed data for focus ticker
    const focusData = tickerData.find(t => t.ticker === focusTicker && !t.error) || tickerData.find(t => !t.error) || tickerData[0];
    
    // Find best overall pick (exclude those with imminent earnings)
    const validTickers = tickerData.filter(t => t.bestPut && !t.error && !t.hasEarnings);
    const bestOverall = validTickers
      .filter(t => t.bestPut?.meetsTarget)
      .sort((a, b) => b.bestPut.otmPercent - a.bestPut.otmPercent)[0] 
      || validTickers.sort((a, b) => (b.bestPut?.weeklyReturn || 0) - (a.bestPut?.weeklyReturn || 0))[0];

    // Use Haiku to analyze risks (only if we have data)
    let aiAnalysis = {};
    if (focusData && !focusData.error) {
      try {
        const client = new Anthropic({ apiKey });
        
        const analysisPrompt = `You are an options risk analyst. Analyze this data briefly.

TICKER: ${focusData.ticker}
- Price: $${focusData.currentPrice} (${focusData.priceChange} today)
- 52-Week: $${focusData.fiftyTwoWeekLow} - $${focusData.fiftyTwoWeekHigh}
- Earnings: ${focusData.earningsDate || 'Not scheduled'} ${focusData.hasEarnings ? '⚠️ WITHIN 7 DAYS' : ''}
- Expiry: ${focusData.expiration} (${focusData.daysToExpiry} days)
- Avg IV: ${focusData.avgIV}%
- Target: ${targetReturn}%

TOP PUTS:
${focusData.allPuts?.slice(0, 3).map(p => 
  `$${p.strike}: Bid $${p.bid}, OTM ${p.otmPercent}%, Return ${p.weeklyReturn}%`
).join('\n') || 'None'}

Return ONLY JSON:
{
  "recommendedStrike": <number or null>,
  "recommendation": "<SELL/WAIT/AVOID>",
  "recommendationReasoning": "<2 sentences>",
  "warnings": ["<risks>"],
  "riskLevel": "<LOW/MEDIUM/HIGH>",
  "keyFactors": ["<positives>"]
}`;

        const analysis = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 400,
          messages: [{ role: "user", content: analysisPrompt }]
        });

        const aiText = analysis.content[0]?.text || '';
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiAnalysis = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('AI analysis error:', e.message);
      }
    }

    // Fallback analysis
    if (!aiAnalysis.recommendation) {
      aiAnalysis = { 
        recommendedStrike: focusData?.hasEarnings ? null : focusData?.allPuts?.[0]?.strike, 
        recommendation: focusData?.hasEarnings ? "AVOID" : (focusData?.bestPut?.meetsTarget ? "SELL" : "WAIT"),
        recommendationReasoning: focusData?.hasEarnings ? "Earnings imminent - high risk of gap." : "Review strikes based on your risk tolerance.", 
        warnings: focusData?.hasEarnings ? ["Earnings within 7 days - avoid"] : [], 
        riskLevel: focusData?.hasEarnings ? "HIGH" : "MEDIUM",
        keyFactors: []
      };
    }

    // Build response
    const response = {
      scanResults: tickerData.map(t => ({
        ticker: t.ticker,
        currentPrice: t.currentPrice,
        priceChange: t.priceChange,
        expiration: t.expiration,
        daysToExpiry: t.daysToExpiry,
        hasEarnings: t.hasEarnings,
        earningsDate: t.earningsDate,
        avgIV: t.avgIV || 0,
        bestPut: t.bestPut,
        recommendation: t.error ? "ERROR" : (t.hasEarnings ? "AVOID" : (t.bestPut?.meetsTarget ? "SELL" : "WAIT")),
        reason: t.error || (t.hasEarnings ? `⚠️ Earnings ${t.earningsDate}` : (t.bestPut?.meetsTarget ? `${t.bestPut.otmPercent.toFixed(1)}% cushion` : "Below target"))
      })),
      bestOverallPick: bestOverall ? {
        ticker: bestOverall.ticker,
        strike: bestOverall.bestPut?.strike,
        weeklyReturn: bestOverall.bestPut?.weeklyReturn,
        reason: `${bestOverall.bestPut?.otmPercent?.toFixed(1)}% OTM, ${bestOverall.bestPut?.weeklyReturn}% return`
      } : null,
      deepDive: focusData && !focusData.error ? {
        ticker: focusData.ticker,
        currentPrice: focusData.currentPrice,
        priceChange: focusData.priceChange,
        fiftyTwoWeekHigh: focusData.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: focusData.fiftyTwoWeekLow,
        expiration: focusData.expiration,
        daysToExpiry: focusData.daysToExpiry,
        hasEarnings: focusData.hasEarnings,
        earningsDate: focusData.earningsDate,
        avgIV: focusData.avgIV || 0,
        riskLevel: aiAnalysis.riskLevel || "MEDIUM",
        recommendations: focusData.allPuts?.slice(0, 3).map((p, i) => ({
          rank: i + 1,
          strike: p.strike,
          bid: p.bid,
          ask: p.ask,
          otmPercent: parseFloat(p.otmPercent),
          weeklyReturn: parseFloat(p.weeklyReturn),
          volume: p.volume,
          openInterest: p.openInterest,
          iv: parseFloat(p.iv) || null,
          meetsTarget: parseFloat(p.weeklyReturn) >= targetReturn
        })) || [],
        allPuts: focusData.allPuts?.map(p => ({
          strike: p.strike,
          bid: p.bid,
          ask: p.ask,
          otm: parseFloat(p.otmPercent),
          weeklyReturn: parseFloat(p.weeklyReturn),
          iv: parseFloat(p.iv) || null,
          volume: p.volume,
          oi: p.openInterest
        })) || [],
        warnings: aiAnalysis.warnings || [],
        keyFactors: aiAnalysis.keyFactors || [],
        recommendedStrike: aiAnalysis.recommendedStrike,
        recommendation: aiAnalysis.recommendation || "WAIT",
        recommendationReasoning: aiAnalysis.recommendationReasoning || "Review the data."
      } : null,
      marketOverview: `Scanned ${tickerData.filter(t => !t.error).length}/${allTickers.length} tickers. ${bestOverall ? `Best: ${bestOverall.ticker} $${bestOverall.bestPut?.strike} put (${bestOverall.bestPut?.weeklyReturn}%).` : 'No picks found.'}`,
      errors: tickerData.filter(t => t.error).map(t => `${t.ticker}: ${t.error}`)
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: error.message });
  }
}
