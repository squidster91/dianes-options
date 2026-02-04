import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  // Get ticker from request body, default to GOOG
  const { ticker = 'GOOG' } = req.body;
  
  // Validate ticker (basic validation)
  const cleanTicker = ticker.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
  
  if (!cleanTicker) {
    return res.status(400).json({ error: 'Invalid ticker symbol' });
  }

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
          content: `Search for current ${cleanTicker} stock options data and provide analysis for selling cash-secured puts.

I need you to:
1. Search for ${cleanTicker} current stock price
2. Search for ${cleanTicker} weekly options chain data (puts) - look for the nearest expiration
3. Find puts that are 5-10% out of the money
4. Check if there are any upcoming earnings within the next week

Calculate these metrics for each put:
- OTM % = (Current Price - Strike) / Current Price × 100
- Weekly Return % = (Mid Price / Strike) × 100
- Mid Price = (Bid + Ask) / 2

IMPORTANT: Return ONLY a JSON object with NO other text before or after. Use this exact structure:
{
  "ticker": "${cleanTicker}",
  "currentPrice": <number>,
  "priceChange": "<string like -1.22% or +0.5%>",
  "date": "<today's date as string>",
  "expiration": "<nearest weekly expiration date>",
  "daysToExpiry": <number>,
  "hasEarnings": <boolean - true if earnings within expiration period>,
  "earningsInfo": "<earnings date and time if applicable, or null>",
  "avgIV": <number - average implied volatility percentage>,
  "recommendations": [
    {
      "rank": <1, 2, or 3>,
      "strike": <number>,
      "bid": <number>,
      "ask": <number>,
      "otmPercent": <number>,
      "weeklyReturn": <number>,
      "volume": <number>,
      "openInterest": <number>,
      "meetsTarget": <boolean - true if weeklyReturn >= 1.0>
    }
  ],
  "allPuts": [
    {
      "strike": <number>,
      "bid": <number>,
      "ask": <number>,
      "otm": <number>,
      "weeklyReturn": <number>,
      "volume": <number>,
      "oi": <number>
    }
  ],
  "warnings": ["<array of risk warning strings>"],
  "recommendation": "<overall recommendation string>"
}

Selection criteria:
- Only include puts where strike is 3-12% below current price
- Rank by best risk/reward: prefer ~1%+ return with >5% OTM
- Flag any puts near earnings as high risk
- Top 3 recommendations should be the best balance of return vs safety

Output ONLY the JSON object, nothing else.`
        }
      ]
    });

    // Extract text from response
    let text = "";
    for (const block of message.content) {
      if (block.type === "text") {
        text += block.text;
      }
    }

    // Try to parse JSON from the response
    // First, try to find JSON in the response (it might have markdown code blocks)
    let jsonStr = text;
    
    // Remove markdown code blocks if present
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }
    
    // Try to find a JSON object
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return res.status(200).json(parsed);
      } catch (parseError) {
        return res.status(200).json({ 
          error: "Could not parse JSON: " + parseError.message,
          raw: text.substring(0, 500)
        });
      }
    } else {
      return res.status(200).json({ 
        error: "No JSON found in response",
        raw: text.substring(0, 500)
      });
    }
  } catch (error) {
    console.error('Anthropic API error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to analyze options' 
    });
  }
}
