import { useState } from 'react';
import Head from 'next/head';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const analyzeOptions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.error && !result.currentPrice) {
        setError(result.error);
      } else {
        setData(result);
        setLastUpdated(new Date().toLocaleString());
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const getRankEmoji = (rank) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  // Demo data for initial display
  const demoData = {
    ticker: "GOOG",
    currentPrice: 340.70,
    priceChange: "-1.22%",
    date: new Date().toLocaleDateString(),
    expiration: "Next Friday",
    daysToExpiry: 5,
    hasEarnings: false,
    earningsInfo: null,
    avgIV: 45,
    recommendations: [
      { rank: 1, strike: 320, bid: 2.10, ask: 2.20, otmPercent: 6.1, weeklyReturn: 0.68, volume: 1500, openInterest: 5000, meetsTarget: false },
      { rank: 2, strike: 315, bid: 1.50, ask: 1.60, otmPercent: 7.5, weeklyReturn: 0.49, volume: 2200, openInterest: 4200, meetsTarget: false },
      { rank: 3, strike: 310, bid: 1.00, ask: 1.10, otmPercent: 9.0, weeklyReturn: 0.34, volume: 1800, openInterest: 3500, meetsTarget: false }
    ],
    allPuts: [
      { strike: 305, bid: 0.70, ask: 0.80, otm: 10.5, weeklyReturn: 0.25, volume: 1000, oi: 2500 },
      { strike: 310, bid: 1.00, ask: 1.10, otm: 9.0, weeklyReturn: 0.34, volume: 1800, oi: 3500 },
      { strike: 315, bid: 1.50, ask: 1.60, otm: 7.5, weeklyReturn: 0.49, volume: 2200, oi: 4200 },
      { strike: 320, bid: 2.10, ask: 2.20, otm: 6.1, weeklyReturn: 0.68, volume: 1500, oi: 5000 },
      { strike: 325, bid: 3.00, ask: 3.15, otm: 4.6, weeklyReturn: 0.95, volume: 2500, oi: 6000 }
    ],
    warnings: ["📊 Demo data - Click 'Analyze Now' for live data"],
    recommendation: "Click 'Analyze Now' to fetch real-time GOOG options data"
  };

  const displayData = data || demoData;
  const isDemo = !data;

  return (
    <>
      <Head>
        <title>GOOG Put Options Analyzer</title>
        <meta name="description" content="Analyze GOOG weekly put options for cash-secured selling" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">📊</span>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">{displayData.ticker} Put Scanner</h1>
                <p className="text-slate-400 text-sm">
                  {isDemo ? "Demo Data - Click Analyze for Live Data" : `Last updated: ${lastUpdated}`}
                </p>
              </div>
            </div>
            <button
              onClick={analyzeOptions}
              disabled={loading}
              className={`px-6 py-3 font-semibold rounded-xl transition-all flex items-center gap-2 justify-center ${
                loading 
                  ? 'bg-slate-600 text-slate-400 cursor-wait' 
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
              }`}
            >
              {loading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analyzing...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Analyze Now
                </>
              )}
            </button>
          </div>

          {/* Demo Banner */}
          {isDemo && (
            <div className="bg-blue-500/20 border border-blue-500/50 rounded-xl p-4 flex items-start gap-3">
              <span className="text-2xl">ℹ️</span>
              <div>
                <h3 className="text-blue-400 font-bold">Demo Mode</h3>
                <p className="text-blue-300/80 text-sm">
                  Showing sample data. Click <strong>"Analyze Now"</strong> to fetch live GOOG options data using AI-powered web search.
                </p>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4">
              <h3 className="text-red-400 font-bold">Error</h3>
              <p className="text-red-300/80 text-sm">{error}</p>
            </div>
          )}

          {/* Warnings */}
          {displayData.warnings && displayData.warnings.length > 0 && !isDemo && (
            <div className="bg-amber-500/20 border border-amber-500/50 rounded-xl p-4">
              <h3 className="text-amber-400 font-bold mb-2">⚠️ Risk Warnings</h3>
              <ul className="space-y-1">
                {displayData.warnings.map((warning, i) => (
                  <li key={i} className="text-amber-300/80 text-sm">{warning}</li>
                ))}
              </ul>
              {displayData.recommendation && (
                <p className="text-amber-100 font-semibold mt-3 pt-3 border-t border-amber-500/30">
                  💡 {displayData.recommendation}
                </p>
              )}
            </div>
          )}

          {/* Market Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">Current Price</div>
              <div className="text-white text-2xl font-bold">${displayData.currentPrice?.toFixed(2)}</div>
              {displayData.priceChange && (
                <div className={`text-sm ${displayData.priceChange?.startsWith('-') ? 'text-red-400' : 'text-emerald-400'}`}>
                  {displayData.priceChange}
                </div>
              )}
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">Expiration</div>
              <div className="text-white text-lg font-bold">{displayData.expiration}</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">Days to Expiry</div>
              <div className={`text-2xl font-bold ${displayData.daysToExpiry <= 3 ? 'text-amber-400' : 'text-white'}`}>
                {displayData.daysToExpiry}
              </div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">Avg IV</div>
              <div className={`text-2xl font-bold ${displayData.avgIV > 50 ? 'text-purple-400' : 'text-white'}`}>
                {displayData.avgIV}%
              </div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">Earnings</div>
              <div className={`text-lg font-bold ${displayData.hasEarnings ? 'text-red-400' : 'text-emerald-400'}`}>
                {displayData.hasEarnings ? '⚠️ YES' : '✓ Clear'}
              </div>
            </div>
          </div>

          {/* Top Recommendations */}
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Top Recommendations</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {displayData.recommendations?.slice(0, 3).map((rec) => (
                <div 
                  key={rec.strike}
                  className={`bg-slate-800/50 border rounded-xl p-5 ${
                    rec.rank === 1 ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getRankEmoji(rec.rank)}</span>
                      <span className="text-white font-bold text-xl">${rec.strike} PUT</span>
                    </div>
                    {rec.meetsTarget ? (
                      <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-full">
                        ✓ 1%+ Return
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-slate-600/50 text-slate-400 text-xs font-medium rounded-full">
                        Below 1%
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Bid / Ask</span>
                      <span className="text-white">${rec.bid?.toFixed(2)} / ${rec.ask?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">OTM %</span>
                      <span className="text-white">{rec.otmPercent?.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Weekly Return</span>
                      <span className={`font-bold ${rec.weeklyReturn >= 1 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {rec.weeklyReturn?.toFixed(2)}%
                      </span>
                    </div>
                    <div className="border-t border-slate-700 my-2 pt-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Capital Req.</span>
                        <span className="text-white">${(rec.strike * 100).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Max Profit</span>
                        <span className="text-emerald-400">${(((rec.bid + rec.ask) / 2) * 100).toFixed(0)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Vol / OI</span>
                      <span className="text-slate-400">{rec.volume?.toLocaleString()} / {rec.openInterest?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Full Options Table */}
          <div>
            <h2 className="text-xl font-bold text-white mb-4">All OTM Puts</h2>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-900/50">
                      <th className="text-left text-slate-400 font-medium px-4 py-3">Strike</th>
                      <th className="text-right text-slate-400 font-medium px-4 py-3">Bid</th>
                      <th className="text-right text-slate-400 font-medium px-4 py-3">Ask</th>
                      <th className="text-right text-slate-400 font-medium px-4 py-3">OTM %</th>
                      <th className="text-right text-slate-400 font-medium px-4 py-3">Weekly %</th>
                      <th className="text-right text-slate-400 font-medium px-4 py-3">Volume</th>
                      <th className="text-right text-slate-400 font-medium px-4 py-3">OI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayData.allPuts?.map((put, i) => (
                      <tr key={put.strike} className={`${i % 2 === 0 ? 'bg-slate-800/30' : ''} hover:bg-slate-700/30`}>
                        <td className="px-4 py-3 text-white font-medium">${put.strike}</td>
                        <td className="px-4 py-3 text-right text-slate-300">${put.bid?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-slate-300">${put.ask?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{put.otm?.toFixed(1)}%</td>
                        <td className={`px-4 py-3 text-right font-medium ${put.weeklyReturn >= 1 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {put.weeklyReturn?.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300">{put.volume?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{put.oi?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Strategy Info */}
          <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-5">
            <h3 className="text-white font-bold mb-3">📋 Strategy Criteria</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div className="flex flex-col">
                <span className="text-slate-400">Target Return</span>
                <span className="text-white font-medium">≥1% weekly</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-400">Delta Range</span>
                <span className="text-white font-medium">-0.05 to -0.10</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-400">Win Rate</span>
                <span className="text-white font-medium">90%+ OTM</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-400">Min OI</span>
                <span className="text-white font-medium">100+</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-400">Max Spread</span>
                <span className="text-white font-medium">&lt;20%</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-slate-500 text-xs space-y-1">
            <p>Powered by Claude AI with real-time web search</p>
            <p>⚠️ Not financial advice. Options trading involves significant risk.</p>
          </div>
        </div>
      </div>
    </>
  );
}
