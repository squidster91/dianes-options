import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { tickers = ['GOOG', 'AAPL', 'TSLA', 'NVDA', 'AMZN', 'META', 'MSFT', 'SPY'], targetReturn = 1.0 } = req.body;
  
  const cleanTickers = [...new Set(tickers.map(t => t.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5)))].filter(Boolean);
  
  if (cleanTickers.length === 0) {
    return res.status(400).json({ error: 'No valid tickers provided' });
  }

  const barchartUrls = cleanTickers.map(t => `https://www.barchart.com/stocks/quotes/${t.toLowerCase()}/options`);

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      tools: [
        {
          type: "web_fetch_20250305",
          name: "web_fetch"
        }
      ],
      messages: [
        {
          role: "user",
          content: `Analyze put options for these ${cleanTickers.length} stocks. Fetch their options data and find the BEST put for each.

Tickers to analyze: ${cleanTickers.join(', ')}

For EACH ticker, determine:
1. Current stock price and % change
2. Next weekly expiration date and days until expiry
3. Best put strike 5-10% OTM that meets ${targetReturn}% weekly return target
4. Check if earnings are within 7 days (HIGH RISK if so)
5. Average IV level

IMPORTANT RISK FLAGS:
- If earnings within 7 days of expiration: recommendation = "AVOID"
- If IV > 60%: note "elevated volatility"
- If no puts meet ${targetReturn}% target: recommend closest one, note "below target"

Calculate weekly return as: (bid price / strike price) * 100

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
      "avgIV": <number>,
      "bestPut": {
        "strike": <number>,
        "bid": <number>,
        "ask": <number>,
        "otmPercent": <number>,
        "weeklyReturn": <number>,
        "volume": <number>,
        "openInterest": <number>,
        "meetsTarget": <true if weeklyReturn >= ${targetReturn}>,
        "delta": <number or null>
      },
      "recommendation": "<SELL/AVOID/WAIT>",
      "reason": "<1 sentence why>"
    }
  ],
  "marketOverview": "<1-2 sentence summary of market conditions for put selling>",
  "bestOverallPick": {
    "ticker": "<best ticker>",
    "strike": <best strike>,
    "weeklyReturn": <return %>,
    "reason": "<why this is #1 pick today>"
  }
}

Rank by: meets target return + highest OTM% + no earnings risk + good liquidity. The bestOverallPick should be the single best opportunity across all tickers.`
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
