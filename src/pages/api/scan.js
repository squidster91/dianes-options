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
  
  // Build ticker list - always include popular ones + custom if provided
  const popularTickers = ['GOOG', 'AAPL', 'TSLA', 'NVDA', 'AMZN', 'META', 'MSFT', 'SPY'];
  const cleanCustom = customTicker.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
  
  // Add custom ticker if not already in list
  const allTickers = cleanCustom && !popularTickers.includes(cleanCustom) 
    ? [...popularTickers, cleanCustom] 
    : popularTickers;
  
  // The ticker to do deep analysis on (custom if provided, otherwise best pick)
  const focusTicker = cleanCustom || null;

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search"
        }
      ],
      messages: [
        {
          role: "user",
          content: `Search for current stock prices and options data. I need TWO things:

PART 1: SCAN ALL TICKERS
Search for current prices and weekly put options for: ${allTickers.join(', ')}
For each, find: price, next weekly expiration, best OTM put (5-10% below price), earnings date if soon.

PART 2: DEEP DIVE ON ${focusTicker || 'THE BEST PICK'}
${focusTicker ? `Do detailed analysis on ${focusTicker}` : 'Do detailed analysis on whichever ticker has the best opportunity'}.
Find multiple put strikes with bid/ask/volume/OI data.

TARGET: ${targetReturn}% weekly return (calculated as: bid/strike * 100)

Return ONLY this JSON:
{
  "scanResults": [
    {
      "ticker": "<TICKER>",
      "currentPrice": <number>,
      "priceChange": "<+/-X.XX%>",
      "expiration": "<date>",
      "daysToExpiry": <number>,
      "hasEarnings": <boolean>,
      "earningsDate": "<date or null>",
      "avgIV": <number>,
      "bestPut": {
        "strike": <number>,
        "bid": <number>,
        "ask": <number>,
        "otmPercent": <number>,
        "weeklyReturn": <number>,
        "meetsTarget": <boolean>
      },
      "recommendation": "<SELL/AVOID/WAIT>",
      "reason": "<why>"
    }
  ],
  "bestOverallPick": {
    "ticker": "<ticker>",
    "strike": <number>,
    "weeklyReturn": <number>,
    "reason": "<why best>"
  },
  "deepDive": {
    "ticker": "${focusTicker || '<best pick ticker>'}",
    "currentPrice": <number>,
    "priceChange": "<+/-X.XX%>",
    "expiration": "<date>",
    "daysToExpiry": <number>,
    "hasEarnings": <boolean>,
    "earningsDate": "<date or null>",
    "avgIV": <number>,
    "ivRank": "<High/Medium/Low>",
    "recommendations": [
      {
        "rank": 1,
        "strike": <number>,
        "bid": <number>,
        "ask": <number>,
        "otmPercent": <number>,
        "weeklyReturn": <number>,
        "volume": <number>,
        "openInterest": <number>,
        "meetsTarget": <boolean>
      }
    ],
    "allPuts": [
      {"strike": <number>, "bid": <number>, "ask": <number>, "otm": <number>, "weeklyReturn": <number>, "volume": <number>, "oi": <number>}
    ],
    "warnings": ["<risks>"],
    "recommendedStrike": <number>,
    "recommendationReasoning": "<2-3 sentences why>"
  },
  "marketOverview": "<1 sentence market summary>"
}`
        }
      ]
    });

    let text = "";
    for (const block of message.content) {
      if (block.type === "text") {
        text += block.text;
      }
    }

    // Clean and parse JSON
    let jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return res.status(200).json(parsed);
      } catch (e) {
        return res.status(200).json({ error: "JSON parse error: " + e.message, raw: text.substring(0, 800) });
      }
    }
    return res.status(200).json({ error: "No JSON found in response", raw: text.substring(0, 800) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
