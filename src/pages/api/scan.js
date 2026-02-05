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
  
  const popularTickers = ['GOOG', 'AAPL', 'TSLA', 'NVDA', 'AMZN', 'META', 'MSFT', 'SPY'];
  const cleanCustom = customTicker.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
  
  const allTickers = cleanCustom && !popularTickers.includes(cleanCustom) 
    ? [...popularTickers, cleanCustom] 
    : popularTickers;

  try {
    const client = new Anthropic({ apiKey });
    
    // STEP 1: HAIKU + WEB SEARCH (cheap - processes large search results)
    // Haiku extracts raw data, doesn't need to be smart about analysis
    const searchPrompt = `Search for current stock data for these tickers: ${allTickers.join(', ')}

For each ticker, find and extract:
1. Current stock price
2. Today's price change (% up or down)
3. Next earnings date (if within 30 days)
4. Any weekly put option with strike 3-15% below current price (strike, bid price, expiration date)

Return ONLY a JSON array with the data you find. Example format:
[
  {"ticker":"AAPL","price":185.50,"change":"-1.2%","earnings":"Feb 15","puts":[{"strike":180,"bid":2.10,"expiry":"Feb 7"}]},
  {"ticker":"GOOG","price":175.00,"change":"+0.5%","earnings":null,"puts":[{"strike":170,"bid":1.85,"expiry":"Feb 7"}]}
]

If you can't find put option data for a ticker, set "puts" to empty array [].
Include ALL tickers even if data is partial.`;

    const searchResponse = await client.messages.create({
      model: "claude-haiku-4-5-20251001",  // HAIKU for the expensive search part
      max_tokens: 2000,
      tools: [{
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 5
      }],
      messages: [{ role: "user", content: searchPrompt }]
    });

    // Extract text from response
    let rawData = '';
    for (const block of searchResponse.content) {
      if (block.type === 'text') {
        rawData += block.text;
      }
    }

    // Parse JSON from Haiku's response
    let tickerData = [];
    try {
      const jsonMatch = rawData.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        tickerData = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('JSON parse error:', e.message);
      console.error('Raw data:', rawData.substring(0, 500));
    }

    // If no data, return early
    if (tickerData.length === 0) {
      return res.status(200).json({
        scanResults: allTickers.map(t => ({ 
          ticker: t, 
          error: 'Failed to fetch data',
          recommendation: 'ERROR'
        })),
        marketOverview: 'Data fetch failed. Try again.',
        errors: ['Could not parse market data from search results']
      });
    }

    // STEP 2: SONNET FOR ANALYSIS (smart - small input, quality matters)
    // Now Sonnet only processes ~1000 tokens, not 50,000
    const analysisPrompt = `You are an expert options trader analyzing cash-secured put opportunities.

TARGET: ${targetReturn}% weekly return

MARKET DATA:
${JSON.stringify(tickerData, null, 2)}

For each ticker, analyze:
1. Is there a put meeting the ${targetReturn}% weekly return target? (calculate: bid/strike * 100)
2. Risk level (LOW/MEDIUM/HIGH/EXTREME):
   - Earnings within 7 days = EXTREME risk
   - Price down >3% today = HIGH risk
   - OTM cushion <5% = MEDIUM risk
   - Otherwise = LOW risk
3. Recommendation: SELL (good opportunity) / WAIT (below target) / AVOID (too risky)

Return JSON only:
{
  "analysis": [
    {
      "ticker": "AAPL",
      "price": 185.50,
      "bestPut": {"strike": 180, "bid": 2.10, "expiry": "Feb 7", "otmPercent": 3.0, "weeklyReturn": 1.17},
      "risk": "LOW",
      "recommendation": "SELL",
      "reasoning": "1.17% return with 3% cushion, no earnings soon"
    }
  ],
  "bestOverallPick": {
    "ticker": "AAPL",
    "strike": 180,
    "reason": "Best risk-adjusted return"
  },
  "marketSummary": "Brief 1-sentence market overview"
}`;

    const analysisResponse = await client.messages.create({
      model: "claude-sonnet-4-20250514",  // SONNET for smart analysis (small input)
      max_tokens: 1500,
      messages: [{ role: "user", content: analysisPrompt }]
    });

    // Parse Sonnet's analysis
    let analysis = null;
    try {
      const analysisText = analysisResponse.content[0]?.text || '';
      const analysisMatch = analysisText.match(/\{[\s\S]*\}/);
      if (analysisMatch) {
        analysis = JSON.parse(analysisMatch[0]);
      }
    } catch (e) {
      console.error('Analysis parse error:', e.message);
    }

    // Build final response
    if (analysis && analysis.analysis) {
      const scanResults = analysis.analysis.map(a => ({
        ticker: a.ticker,
        currentPrice: a.price,
        priceChange: tickerData.find(t => t.ticker === a.ticker)?.change || 'N/A',
        earningsDate: tickerData.find(t => t.ticker === a.ticker)?.earnings || null,
        hasEarnings: !!tickerData.find(t => t.ticker === a.ticker)?.earnings,
        bestPut: a.bestPut ? {
          strike: a.bestPut.strike,
          bid: a.bestPut.bid,
          expiry: a.bestPut.expiry,
          otmPercent: a.bestPut.otmPercent,
          weeklyReturn: a.bestPut.weeklyReturn,
          meetsTarget: a.bestPut.weeklyReturn >= targetReturn
        } : null,
        recommendation: a.recommendation,
        riskLevel: a.risk,
        reason: a.reasoning
      }));

      return res.status(200).json({
        scanResults,
        bestOverallPick: analysis.bestOverallPick,
        deepDive: scanResults.find(s => s.ticker === (cleanCustom || 'TSLA')) || scanResults[0],
        marketOverview: analysis.marketSummary || `Scanned ${scanResults.length} tickers.`,
        errors: []
      });
    }

    // Fallback if analysis failed
    return res.status(200).json({
      scanResults: tickerData.map(t => ({
        ticker: t.ticker,
        currentPrice: t.price,
        priceChange: t.change,
        earningsDate: t.earnings,
        hasEarnings: !!t.earnings,
        bestPut: t.puts?.[0] ? {
          strike: t.puts[0].strike,
          bid: t.puts[0].bid,
          expiry: t.puts[0].expiry,
          weeklyReturn: t.puts[0].bid && t.puts[0].strike ? 
            ((t.puts[0].bid / t.puts[0].strike) * 100).toFixed(2) : null
        } : null,
        recommendation: 'WAIT',
        riskLevel: 'MEDIUM',
        reason: 'Analysis pending'
      })),
      marketOverview: `Fetched data for ${tickerData.length} tickers.`,
      errors: ['Analysis parsing failed - showing raw data']
    });

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: error.message });
  }
}
