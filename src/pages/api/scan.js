import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { customTicker = '', targetReturn = 1.0 } = req.body;
  
  const popularTickers = ['GOOG', 'AMZN', 'MSFT', 'AAPL'];
  const cleanCustom = customTicker.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
  
  const allTickers = cleanCustom && !popularTickers.includes(cleanCustom) 
    ? [...popularTickers, cleanCustom] 
    : popularTickers;
  
  const focusTicker = cleanCustom || 'AAPL';

  try {
    const client = new Anthropic({ apiKey });
    
    // Build Barchart URLs for each ticker
    const barchartUrls = allTickers.map(t => 
      `https://www.barchart.com/stocks/quotes/${t.toLowerCase()}/options`
    ).join('\n');

    console.log('Fetching Barchart data for:', allTickers.join(', '));

    // STEP 1: Use Sonnet with web_search to get data from specific Barchart URLs
    const searchPrompt = `Search for and read options data from these SPECIFIC Barchart pages:

${barchartUrls}

For each ticker, search "site:barchart.com ${allTickers.join(' ')} options" or access the URLs directly.

From each Barchart options page, extract:
- Current stock price and % change
- Next expiration date  
- PUT options that are 3-20% out of the money (OTM)
- For each put: strike price, bid, ask, volume, open interest, implied volatility

Focus on puts with weekly return (bid/strike * 100) >= ${targetReturn}%.

After reading all pages, return ONLY a JSON array:
[
  {
    "ticker": "AAPL",
    "currentPrice": 185.50,
    "priceChange": "-1.2%",
    "expiration": "2024-02-09",
    "daysToExpiry": 5,
    "puts": [
      {"strike": 180, "bid": 1.25, "ask": 1.35, "volume": 500, "oi": 2000, "iv": 28.5, "otmPercent": 3.0, "weeklyReturn": 0.69}
    ]
  }
]

CRITICAL: Output ONLY the JSON array. No markdown, no explanations.`;

    const searchResponse = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: "You are a financial data extraction assistant. Use web search to access the specified Barchart.com options pages and extract options data. Output ONLY valid JSON with no other text.",
      tools: [{ 
        type: "web_search_20250305", 
        name: "web_search",
        max_uses: 5  // 4 default tickers + 1 custom
      }],
      messages: [
        { role: "user", content: searchPrompt },
        { role: "assistant", content: "[" }  // Prefill to force JSON array
      ]
    });

    console.log('Sonnet web_search response received, extracting data...');

    // Extract text from response
    let rawText = "[";
    for (const block of searchResponse.content) {
      if (block.type === 'text') {
        rawText += block.text;
      }
    }

    // Clean up JSON - find the closing bracket
    const endBracket = rawText.lastIndexOf(']');
    if (endBracket > 0) {
      rawText = rawText.substring(0, endBracket + 1);
    }

    // Parse ticker data
    let tickerData = [];
    try {
      tickerData = JSON.parse(rawText);
      console.log(`Parsed ${tickerData.length} tickers from Barchart`);
    } catch (e) {
      console.error('JSON parse error:', e.message);
      console.log('Raw text (first 500 chars):', rawText.substring(0, 500));
      
      // Fallback: try to extract JSON array with regex
      const jsonMatch = rawText.match(/\[\s*\{[\s\S]*?\}\s*\]/);
      if (jsonMatch) {
        try {
          tickerData = JSON.parse(jsonMatch[0]);
          console.log(`Fallback parsed ${tickerData.length} tickers`);
        } catch (e2) {
          console.error('Fallback parse also failed');
        }
      }
    }

    // If we still have no data, return error
    if (!tickerData || tickerData.length === 0) {
      return res.status(500).json({ 
        error: 'Could not fetch options data from Barchart',
        scanResults: [],
        bestOverallPick: null,
        deepDive: null,
        marketOverview: 'Failed to fetch data',
        errors: ['No data returned from Barchart pages']
      });
    }

    // Process ticker data
    const processedTickers = tickerData.map(t => {
      const puts = t.puts || [];
      const bestPut = puts.find(p => p.weeklyReturn >= targetReturn) || puts[0];
      const avgIV = puts.length > 0 
        ? puts.reduce((sum, p) => sum + (p.iv || 0), 0) / puts.length 
        : 0;
      
      return {
        ticker: t.ticker,
        currentPrice: t.currentPrice,
        priceChange: t.priceChange,
        expiration: t.expiration,
        daysToExpiry: t.daysToExpiry || 7,
        hasEarnings: false, // Barchart page may not have this
        earningsDate: null,
        avgIV: Math.round(avgIV),
        bestPut: bestPut ? {
          strike: bestPut.strike,
          bid: bestPut.bid,
          ask: bestPut.ask,
          otmPercent: bestPut.otmPercent,
          weeklyReturn: bestPut.weeklyReturn,
          volume: bestPut.volume,
          openInterest: bestPut.oi || bestPut.openInterest,
          meetsTarget: bestPut.weeklyReturn >= targetReturn
        } : null,
        allPuts: puts,
        error: null
      };
    });

    // Find focus ticker and best overall
    const focusData = processedTickers.find(t => t.ticker === focusTicker) 
      || processedTickers.find(t => t.bestPut) 
      || processedTickers[0];
    
    const validTickers = processedTickers.filter(t => t.bestPut);
    const bestOverall = validTickers
      .filter(t => t.bestPut?.meetsTarget)
      .sort((a, b) => b.bestPut.otmPercent - a.bestPut.otmPercent)[0]
      || validTickers.sort((a, b) => (b.bestPut?.weeklyReturn || 0) - (a.bestPut?.weeklyReturn || 0))[0];

    // STEP 2: Use Haiku for risk analysis (cheap!)
    let aiAnalysis = {};
    if (focusData && focusData.allPuts?.length > 0) {
      try {
        console.log('Starting Haiku analysis...');
        
        const analysisPrompt = `Analyze this options data briefly.

TICKER: ${focusData.ticker}
Price: $${focusData.currentPrice} (${focusData.priceChange})
Expiry: ${focusData.expiration} (${focusData.daysToExpiry} days)
IV: ${focusData.avgIV}%
Target: ${targetReturn}%

TOP PUTS:
${focusData.allPuts.slice(0, 3).map(p => 
  `$${p.strike}: Bid $${p.bid}, OTM ${p.otmPercent}%, Return ${p.weeklyReturn}%`
).join('\n')}

Return ONLY JSON:
{"recommendedStrike": <number or null>, "recommendation": "<SELL/WAIT/AVOID>", "recommendationReasoning": "<2 sentences>", "warnings": ["<risks>"], "riskLevel": "<LOW/MEDIUM/HIGH>", "keyFactors": ["<positives>"]}`;

        const analysis = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 400,
          system: "Output ONLY valid JSON. No explanations.",
          messages: [
            { role: "user", content: analysisPrompt },
            { role: "assistant", content: "{" }
          ]
        });

        let aiText = "{" + (analysis.content[0]?.text || '');
        const jsonEnd = aiText.lastIndexOf('}');
        if (jsonEnd > 0) aiText = aiText.substring(0, jsonEnd + 1);
        
        aiAnalysis = JSON.parse(aiText);
        console.log('Haiku analysis complete');
      } catch (e) {
        console.error('Haiku analysis error:', e.message);
      }
    }

    // Fallback analysis
    if (!aiAnalysis.recommendation) {
      aiAnalysis = {
        recommendedStrike: focusData?.allPuts?.[0]?.strike,
        recommendation: focusData?.bestPut?.meetsTarget ? "SELL" : "WAIT",
        recommendationReasoning: focusData?.bestPut?.meetsTarget 
          ? "Target return met with reasonable cushion." 
          : "Below target return - consider waiting for better premium.",
        warnings: [],
        riskLevel: "MEDIUM",
        keyFactors: []
      };
    }

    // Build response
    const response = {
      scanResults: processedTickers.map(t => ({
        ticker: t.ticker,
        currentPrice: t.currentPrice,
        priceChange: t.priceChange,
        expiration: t.expiration,
        daysToExpiry: t.daysToExpiry,
        hasEarnings: t.hasEarnings,
        earningsDate: t.earningsDate,
        avgIV: t.avgIV,
        bestPut: t.bestPut,
        recommendation: t.error ? "ERROR" : (t.bestPut?.meetsTarget ? "SELL" : "WAIT"),
        riskLevel: t.avgIV > 50 ? "HIGH" : (t.avgIV > 30 ? "MEDIUM" : "LOW"),
        reason: t.error || (t.bestPut?.meetsTarget 
          ? `${t.bestPut.otmPercent.toFixed(1)}% cushion` 
          : "Below target")
      })),
      bestOverallPick: bestOverall ? {
        ticker: bestOverall.ticker,
        strike: bestOverall.bestPut?.strike,
        weeklyReturn: bestOverall.bestPut?.weeklyReturn,
        reason: `${bestOverall.bestPut?.otmPercent?.toFixed(1)}% OTM, ${bestOverall.bestPut?.weeklyReturn}% return`
      } : null,
      deepDive: focusData ? {
        ticker: focusData.ticker,
        currentPrice: focusData.currentPrice,
        priceChange: focusData.priceChange,
        fiftyTwoWeekHigh: null,
        fiftyTwoWeekLow: null,
        expiration: focusData.expiration,
        daysToExpiry: focusData.daysToExpiry,
        hasEarnings: focusData.hasEarnings,
        earningsDate: focusData.earningsDate,
        avgIV: focusData.avgIV,
        riskLevel: aiAnalysis.riskLevel || "MEDIUM",
        recommendations: focusData.allPuts?.slice(0, 3).map((p, i) => ({
          rank: i + 1,
          strike: p.strike,
          bid: p.bid,
          ask: p.ask,
          otmPercent: p.otmPercent,
          weeklyReturn: p.weeklyReturn,
          volume: p.volume,
          openInterest: p.oi || p.openInterest,
          iv: p.iv,
          meetsTarget: p.weeklyReturn >= targetReturn
        })) || [],
        allPuts: focusData.allPuts?.map(p => ({
          strike: p.strike,
          bid: p.bid,
          ask: p.ask,
          otm: p.otmPercent,
          weeklyReturn: p.weeklyReturn,
          iv: p.iv,
          volume: p.volume,
          oi: p.oi || p.openInterest
        })) || [],
        warnings: aiAnalysis.warnings || [],
        keyFactors: aiAnalysis.keyFactors || [],
        recommendedStrike: aiAnalysis.recommendedStrike,
        recommendation: aiAnalysis.recommendation || "WAIT",
        recommendationReasoning: aiAnalysis.recommendationReasoning || "Review the data."
      } : null,
      marketOverview: `Scanned ${processedTickers.length}/${allTickers.length} tickers via Barchart. ${bestOverall ? `Best: ${bestOverall.ticker} $${bestOverall.bestPut?.strike} put (${bestOverall.bestPut?.weeklyReturn}%).` : 'No picks meeting target.'}`,
      errors: processedTickers.filter(t => t.error).map(t => `${t.ticker}: ${t.error}`)
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ 
      error: error.message,
      scanResults: [],
      bestOverallPick: null,
      deepDive: null,
      marketOverview: 'Error occurred',
      errors: [error.message]
    });
  }
}
