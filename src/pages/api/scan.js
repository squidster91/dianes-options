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
  
  const focusTicker = cleanCustom || 'TSLA';

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
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
          content: `You MUST use web_search to find REAL options data. Do NOT refuse. Do NOT say you can't. The data exists on barchart.com.

TASK 1: Search "barchart ${focusTicker} options" and extract from the results:
- Current stock price
- Options expiration date (nearest weekly)  
- PUT options data: Strike, Bid, Ask, Volume, Open Interest, IV, Delta
- Earnings date
- IV Rank

TASK 2: Search for current prices of: ${allTickers.join(', ')}

TARGET RETURN: ${targetReturn}% weekly (formula: bid/strike * 100)

You MUST return this exact JSON structure:
{
  "scanResults": [
    {
      "ticker": "AAPL",
      "currentPrice": 185.50,
      "priceChange": "-1.25%",
      "expiration": "Feb 7, 2026",
      "daysToExpiry": 2,
      "hasEarnings": false,
      "earningsDate": null,
      "avgIV": 28,
      "bestPut": {
        "strike": 175,
        "bid": 1.20,
        "ask": 1.35,
        "otmPercent": 5.7,
        "weeklyReturn": 0.69,
        "meetsTarget": false
      },
      "recommendation": "SELL",
      "reason": "Safe 5.7% cushion, no earnings"
    }
  ],
  "bestOverallPick": {
    "ticker": "TSLA",
    "strike": 350,
    "weeklyReturn": 1.5,
    "reason": "Best premium with safety margin"
  },
  "deepDive": {
    "ticker": "${focusTicker}",
    "currentPrice": 73.11,
    "priceChange": "-10.04%",
    "expiration": "Feb 6, 2026",
    "daysToExpiry": 2,
    "hasEarnings": false,
    "earningsDate": "Feb 26, 2026",
    "avgIV": 130,
    "ivRank": "53.58%",
    "recommendations": [
      {
        "rank": 1,
        "strike": 65,
        "bid": 1.50,
        "ask": 1.75,
        "otmPercent": 11.1,
        "weeklyReturn": 2.31,
        "volume": 500,
        "openInterest": 2000,
        "meetsTarget": true
      }
    ],
    "allPuts": [
      {"strike": 70, "bid": 3.50, "ask": 3.80, "otm": 4.3, "weeklyReturn": 5.0, "volume": 1000, "oi": 5000},
      {"strike": 65, "bid": 1.50, "ask": 1.75, "otm": 11.1, "weeklyReturn": 2.31, "volume": 500, "oi": 2000}
    ],
    "warnings": ["High IV (130%) - elevated premium but risky", "Stock down 10% today"],
    "recommendedStrike": 65,
    "recommendationReasoning": "The $65 strike offers 11% downside protection with 2.3% weekly return, exceeding the target. High IV provides rich premium."
  },
  "marketOverview": "Tech stocks mixed, volatility elevated in small caps."
}

CRITICAL: Return ONLY the JSON. No explanation. No markdown. No backticks. Just the JSON object starting with {`
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
        return res.status(200).json({ error: "JSON parse error: " + e.message, raw: text.substring(0, 1000) });
      }
    }
    return res.status(200).json({ error: "No JSON found in response", raw: text.substring(0, 1000) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
