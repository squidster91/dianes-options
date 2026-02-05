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

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search"
        }
      ],
      messages: [
        {
          role: "user",
          content: `Search for current stock prices and options data for these ${allTickers.length} stocks: ${allTickers.join(', ')}

For EACH ticker, search and find:
1. Current stock price and % change today
2. Next weekly options expiration date
3. Put options 5-10% out of the money - find strike, bid, ask prices
4. Whether earnings are within the next 7 days

USER'S TARGET: ${targetReturn}% weekly return

Calculate weekly return as: (bid price / strike price) * 100

RECOMMENDATION RULES:
- If earnings within 7 days: recommendation = "AVOID"
- If a put meets ${targetReturn}% target with good OTM%: recommendation = "SELL"
- Otherwise: recommendation = "WAIT"

Return ONLY this JSON:
{
  "scanResults": [
    {
      "ticker": "<TICKER>",
      "currentPrice": <number>,
      "priceChange": "<+X.XX% or -X.XX%>",
      "expiration": "<date string>",
      "daysToExpiry": <number>,
      "hasEarnings": <true if earnings within 7 days>,
      "earningsDate": "<date or null>",
      "avgIV": <implied volatility number or estimate 30-50>,
      "bestPut": {
        "strike": <number>,
        "bid": <number>,
        "ask": <number>,
        "otmPercent": <(price-strike)/price*100>,
        "weeklyReturn": <(bid/strike)*100>,
        "volume": <number or 1000>,
        "openInterest": <number or 5000>,
        "meetsTarget": <true if weeklyReturn >= ${targetReturn}>,
        "delta": <number or null>
      },
      "recommendation": "<SELL/AVOID/WAIT>",
      "riskLevel": "<LOW/MEDIUM/HIGH>",
      "reason": "<1 sentence why>"
    }
  ],
  "marketOverview": "<1-2 sentence summary of market conditions>",
  "bestOverallPick": {
    "ticker": "<best ticker to sell puts on>",
    "strike": <best strike>,
    "weeklyReturn": <return %>,
    "reason": "<why this is the #1 pick today>"
  },
  "deepDive": {
    "ticker": "${cleanCustom || '<SAME AS bestOverallPick.ticker>'}",
    "currentPrice": <number>,
    "priceChange": "<+X.XX%>",
    "fiftyTwoWeekHigh": <number>,
    "fiftyTwoWeekLow": <number>,
    "expiration": "<date>",
    "daysToExpiry": <number>,
    "hasEarnings": <boolean>,
    "earningsDate": "<date or null>",
    "avgIV": <number>,
    "riskLevel": "<LOW/MEDIUM/HIGH>",
    "recommendations": [
      {"rank": 1, "strike": <n>, "bid": <n>, "ask": <n>, "otmPercent": <n>, "weeklyReturn": <n>, "volume": <n>, "openInterest": <n>, "iv": <n>, "meetsTarget": <bool>}
    ],
    "allPuts": [
      {"strike": <n>, "bid": <n>, "ask": <n>, "otm": <n>, "weeklyReturn": <n>, "iv": <n>, "volume": <n>, "oi": <n>}
    ],
    "warnings": ["<any risks>"],
    "keyFactors": ["<positive factors>"],
    "recommendedStrike": <number>,
    "recommendation": "<SELL/WAIT/AVOID>",
    "recommendationReasoning": "<2 sentences>"
  },
  "errors": []
}

Pick the bestOverallPick as the one with: highest return that meets target + highest OTM% + no earnings risk.

IMPORTANT: The deepDive MUST be for ${cleanCustom ? `"${cleanCustom}" (the custom ticker the user entered)` : 'the SAME ticker as bestOverallPick'}.`
        }
      ]
    });

    let text = "";
    for (const block of message.content) {
      if (block.type === "text") {
        text += block.text;
      }
    }

    let jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return res.status(200).json(parsed);
      } catch (e) {
        return res.status(200).json({ error: "JSON parse error: " + e.message, raw: text.substring(0, 500) });
      }
    }
    return res.status(200).json({ error: "No JSON found", raw: text.substring(0, 500) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
