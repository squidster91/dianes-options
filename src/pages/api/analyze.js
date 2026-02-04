import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { ticker = 'GOOG', targetReturn = 1.0 } = req.body;
  const cleanTicker = ticker.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
  
  if (!cleanTicker) {
    return res.status(400).json({ error: 'Invalid ticker symbol' });
  }

  const barchartUrl = `https://www.barchart.com/stocks/quotes/${cleanTicker.toLowerCase()}/options`;

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      tools: [
        {
          type: "web_fetch_20250305",
          name: "web_fetch"
        }
      ],
      messages: [
        {
          role: "user",
          content: `Fetch and analyze options data from: ${barchartUrl}

EXTRACT ALL DATA:
1. Current ${cleanTicker} stock price and % change
2. Options expiration date (nearest weekly)
3. PUT options 5-15% OTM: strike, bid, ask, volume, open interest, IV%, delta
4. Earnings date if shown
5. 52-week high/low if available

RISK ANALYSIS FLAGS:
- Earnings within 7 days = HIGH RISK
- IV > 50% = elevated volatility  
- Open interest < 100 = liquidity risk
- Bid-ask spread > 20% = poor execution
- Days to expiry <= 3 = theta decay risk

USER TARGET: ${targetReturn}% weekly return

RECOMMENDATION:
Find the BEST put considering: meets ${targetReturn}% target + highest OTM% (safety) + good liquidity + no earnings risk

Return ONLY this JSON:
{
  "ticker": "${cleanTicker}",
  "currentPrice": <number>,
  "priceChange": "<+/-X.XX%>",
  "fiftyTwoWeekHigh": <number or null>,
  "fiftyTwoWeekLow": <number or null>,
  "expiration": "<date string>",
  "daysToExpiry": <number>,
  "hasEarnings": <true if earnings within 7 days>,
  "earningsDate": "<date or null>",
  "avgIV": <number>,
  "ivRank": "<High/Medium/Low>",
  "targetReturn": ${targetReturn},
  "recommendations": [
    {
      "rank": 1,
      "strike": <number>,
      "bid": <number>,
      "ask": <number>,
      "mid": <(bid+ask)/2>,
      "otmPercent": <(price-strike)/price*100>,
      "weeklyReturn": <(mid/strike)*100>,
      "iv": <IV% or null>,
      "delta": <delta or null>,
      "volume": <number>,
      "openInterest": <number>,
      "spreadPercent": <(ask-bid)/mid*100>,
      "meetsTarget": <weeklyReturn >= ${targetReturn}>
    },
    {"rank": 2, ...},
    {"rank": 3, ...}
  ],
  "allPuts": [
    {"strike": <number>, "bid": <number>, "ask": <number>, "otm": <number>, "weeklyReturn": <number>, "iv": <number or null>, "delta": <number or null>, "volume": <number>, "oi": <number>}
  ],
  "warnings": ["<specific risk warnings>"],
  "analysisNotes": ["<observations about the options chain>"],
  "recommendedStrike": <single best strike number>,
  "recommendationReasoning": "<2-3 sentences explaining why this strike, considering target, safety, liquidity, risks>"
}

If earnings are imminent, strongly recommend AVOIDING puts until after.`
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
