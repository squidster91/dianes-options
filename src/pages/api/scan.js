import Anthropic from '@anthropic-ai/sdk';
import yahooFinance from 'yahoo-finance2';

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
          // Get quote data (includes price, change, 52-week range)
          const quote = await yahooFinance.quote(ticker);
          
          // Get earnings and calendar data
          let earningsDate = null;
          let hasEarnings = false;
          try {
            const summary = await yahooFinance.quoteSummary(ticker, { modules: ['calendarEvents', 'defaultKeyStatistics'] });
            const earnings = summary.calendarEvents?.earnings;
            if (earnings?.earningsDate?.[0]) {
              earningsDate = new Date(earnings.earningsDate[0]).toLocaleDateString();
              // Check if earnings within 7 days
              const daysToEarnings = Math.ceil((new Date(earnings.earningsDate[0]) - Date.now()) / (1000 * 60 * 60 * 24));
              hasEarnings = daysToEarnings >= 0 && daysToEarnings <= 7;
            }
          } catch (e) {
            // Earnings data not available for some tickers
          }
          
          // Get options chain
          const options = await yahooFinance.options(ticker);
          
          // Get nearest expiration puts
          const puts = options.options?.[0]?.puts || [];
          const expDate = options.expirationDates?.[0];
          const daysToExpiry = expDate ? Math.ceil((expDate * 1000 - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
          
          // Filter OTM puts (3-20% below current price)
          const currentPrice = quote.regularMarketPrice;
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
              delta: p.delta ? p.delta.toFixed(3) : null,
              otmPercent: (((currentPrice - p.strike) / currentPrice) * 100).toFixed(1),
              weeklyReturn: p.bid ? ((p.bid / p.strike) * 100).toFixed(2) : 0
            }))
            .sort((a, b) => parseFloat(b.weeklyReturn) - parseFloat(a.weeklyReturn))
            .slice(0, 10);

          // Find best put that meets target
          const bestPut = otmPuts.find(p => parseFloat(p.weeklyReturn) >= targetReturn) || otmPuts[0];

          // Calculate avg IV
          const avgIV = otmPuts.length > 0 
            ? (otmPuts.reduce((sum, p) => sum + parseFloat(p.iv || 0), 0) / otmPuts.length).toFixed(0) 
            : 0;

          return {
            ticker,
            currentPrice,
            priceChange: quote.regularMarketChangePercent?.toFixed(2) + '%',
            fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
            expiration: expDate ? new Date(expDate * 1000).toLocaleDateString() : 'N/A',
            daysToExpiry,
            earningsDate,
            hasEarnings,
            avgIV: parseFloat(avgIV),
            marketCap: quote.marketCap,
            dayHigh: quote.regularMarketDayHigh,
            dayLow: quote.regularMarketDayLow,
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
    const focusData = tickerData.find(t => t.ticker === focusTicker) || tickerData[0];
    
    // Find best overall pick (exclude those with imminent earnings)
    const validTickers = tickerData.filter(t => t.bestPut && !t.error && !t.hasEarnings);
    const bestOverall = validTickers
      .filter(t => t.bestPut?.meetsTarget)
      .sort((a, b) => b.bestPut.otmPercent - a.bestPut.otmPercent)[0] 
      || validTickers.sort((a, b) => (b.bestPut?.weeklyReturn || 0) - (a.bestPut?.weeklyReturn || 0))[0];

    // Use Haiku to analyze risks and provide recommendation
    const client = new Anthropic({ apiKey });
    
    const analysisPrompt = `You are an options risk analyst. Analyze this data and identify ALL risks.

FOCUS TICKER: ${focusData.ticker}
- Price: $${focusData.currentPrice} (${focusData.priceChange} today)
- 52-Week Range: $${focusData.fiftyTwoWeekLow} - $${focusData.fiftyTwoWeekHigh}
- Earnings Date: ${focusData.earningsDate || 'Not scheduled'}
- Earnings Within 7 Days: ${focusData.hasEarnings ? 'YES - HIGH RISK' : 'No'}
- Options Expiration: ${focusData.expiration} (${focusData.daysToExpiry} days)
- Average IV: ${focusData.avgIV}%

TOP PUTS AVAILABLE:
${focusData.allPuts?.slice(0, 5).map(p => 
  `Strike $${p.strike}: Bid $${p.bid}, Ask $${p.ask}, OTM ${p.otmPercent}%, Return ${p.weeklyReturn}%, IV ${p.iv || 'N/A'}%, Vol ${p.volume}, OI ${p.openInterest}`
).join('\n') || 'No puts available'}

USER'S TARGET: ${targetReturn}% weekly return

RISK FACTORS TO CHECK:
1. Earnings within 7 days of expiration = AVOID
2. IV > 60% = elevated volatility, higher risk
3. Stock down >5% today = momentum risk
4. Stock near 52-week low = potential falling knife
5. Low open interest (<100) = liquidity risk
6. Wide bid-ask spread (>25%) = execution risk
7. Days to expiry <=2 = theta decay, limited adjustment time

Return ONLY this JSON:
{
  "recommendedStrike": <best strike number or null if should avoid>,
  "recommendation": "<SELL/WAIT/AVOID>",
  "recommendationReasoning": "<2-3 sentences explaining the recommendation, mentioning specific data points>",
  "warnings": ["<list each specific risk found>"],
  "riskLevel": "<LOW/MEDIUM/HIGH/EXTREME>",
  "keyFactors": ["<positive factors>"]
}`;

    const analysis = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: analysisPrompt }]
    });

    let aiAnalysis = {};
    try {
      const aiText = analysis.content[0]?.text || '';
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiAnalysis = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      aiAnalysis = { 
        recommendedStrike: focusData.hasEarnings ? null : focusData.allPuts?.[0]?.strike, 
        recommendation: focusData.hasEarnings ? "AVOID" : "WAIT",
        recommendationReasoning: focusData.hasEarnings ? "Earnings imminent - avoid selling puts until after announcement." : "Review the data and select based on your risk tolerance.", 
        warnings: focusData.hasEarnings ? ["Earnings within 7 days"] : [], 
        riskLevel: focusData.hasEarnings ? "EXTREME" : "MEDIUM",
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
        recommendation: t.hasEarnings ? "AVOID" : (t.bestPut?.meetsTarget ? "SELL" : "WAIT"),
        reason: t.error ? t.error : (t.hasEarnings ? `⚠️ Earnings ${t.earningsDate}` : (t.bestPut?.meetsTarget ? `${t.bestPut.otmPercent.toFixed(1)}% cushion, meets target` : "Below target return"))
      })),
      bestOverallPick: bestOverall ? {
        ticker: bestOverall.ticker,
        strike: bestOverall.bestPut?.strike,
        weeklyReturn: bestOverall.bestPut?.weeklyReturn,
        reason: `Best risk/reward: ${bestOverall.bestPut?.otmPercent?.toFixed(1)}% OTM with ${bestOverall.bestPut?.weeklyReturn}% return, no earnings risk`
      } : null,
      deepDive: {
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
        recommendationReasoning: aiAnalysis.recommendationReasoning || "Review the data carefully."
      },
      marketOverview: `Scanned ${tickerData.filter(t => !t.error).length}/${allTickers.length} tickers. ${bestOverall ? `Best opportunity: ${bestOverall.ticker} $${bestOverall.bestPut?.strike} put (${bestOverall.bestPut?.weeklyReturn}% return).` : 'No strong picks meeting criteria.'}`
    };

    return res.status(200).json(response);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
