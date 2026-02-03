# GOOG Put Options Analyzer 📊

An AI-powered web app that analyzes GOOG weekly put options for cash-secured selling strategies. Uses Claude AI with real-time web search to fetch current options data and provide recommendations.

![Dashboard Preview](https://via.placeholder.com/800x400?text=GOOG+Put+Options+Dashboard)

## Features

- 🔄 **Real-time Analysis** - Fetches current GOOG options data using AI-powered web search
- 📈 **Smart Recommendations** - Ranks puts by risk/reward for your criteria
- ⚠️ **Risk Warnings** - Alerts for earnings, high IV, and other risks
- 📊 **Full Options Table** - View all OTM puts in the target range
- 🎯 **Strategy Criteria** - Targets 1%+ weekly return with 90%+ win rate

## Quick Start

### Prerequisites

- Node.js 18+ installed
- An Anthropic API key ([Get one here](https://console.anthropic.com/))

### Local Development

1. **Clone or download this project**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up your API key**
   ```bash
   cp .env.example .env.local
   ```
   Then edit `.env.local` and add your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open [http://localhost:3000](http://localhost:3000)**

## Deploy to Vercel (Recommended)

The easiest way to deploy this app is with [Vercel](https://vercel.com):

### Option 1: One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Click the button above
2. Import your repository
3. Add your `ANTHROPIC_API_KEY` in the Environment Variables section
4. Deploy!

### Option 2: Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```

3. **Add your API key**
   ```bash
   vercel env add ANTHROPIC_API_KEY
   ```
   Enter your API key when prompted.

4. **Redeploy with the env variable**
   ```bash
   vercel --prod
   ```

## Deploy to Netlify

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Create a `netlify.toml` file:**
   ```toml
   [build]
     command = "npm run build"
     publish = ".next"

   [[plugins]]
     package = "@netlify/plugin-nextjs"
   ```

3. **Deploy via Netlify CLI or Dashboard**
   - Add `ANTHROPIC_API_KEY` to your environment variables in Netlify dashboard

## Deploy to Railway

1. Connect your GitHub repo to [Railway](https://railway.app)
2. Add `ANTHROPIC_API_KEY` to the environment variables
3. Railway will auto-detect Next.js and deploy

## Project Structure

```
goog-puts-app/
├── src/
│   ├── pages/
│   │   ├── api/
│   │   │   └── analyze.js    # API route for Claude calls
│   │   ├── _app.js           # App wrapper
│   │   └── index.js          # Main dashboard page
│   └── styles/
│       └── globals.css       # Tailwind styles
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── next.config.js
├── .env.example
└── README.md
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | Yes |

## How It Works

1. User clicks "Analyze Now"
2. Frontend calls `/api/analyze` endpoint
3. Backend sends request to Claude with web_search tool enabled
4. Claude searches for current GOOG stock price and options data
5. Claude analyzes the data and returns structured JSON
6. Frontend displays the analysis in a beautiful dashboard

## Strategy Criteria

The analyzer looks for puts that meet these criteria:
- **Target Return**: ≥1% weekly
- **Delta Range**: -0.05 to -0.10 (90-95% probability of expiring worthless)
- **OTM Range**: 5-10% below current stock price
- **Minimum Open Interest**: 100+
- **Maximum Spread**: <20%

## Customization

To change the ticker or strategy criteria, edit the prompt in `src/pages/api/analyze.js`.

## Cost Considerations

Each analysis uses approximately:
- ~4000 tokens input
- ~2000 tokens output
- 1-3 web searches

At current Anthropic pricing, this is roughly $0.02-0.05 per analysis.

## Limitations

- Options data from web search may not be as precise as direct API feeds
- Rate limited by Anthropic API limits
- Web search results may vary in freshness

## Contributing

Pull requests welcome! Please open an issue first to discuss proposed changes.

## License

MIT

## Disclaimer

⚠️ **This is not financial advice.** Options trading involves significant risk of loss. This tool is for educational and informational purposes only. Always do your own research and consult with a financial advisor before making investment decisions.
