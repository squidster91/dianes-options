import { useState } from 'react';
import Head from 'next/head';

export default function Home() {
  const [ticker, setTicker] = useState('');
  const [targetReturn, setTargetReturn] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [lastScanned, setLastScanned] = useState(null);

  const targetReturnOptions = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
  const popularTickers = ['GOOG', 'AAPL', 'TSLA', 'NVDA', 'AMZN', 'META', 'MSFT', 'SPY'];

  const runScan = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customTicker: ticker, targetReturn })
      });
      
      const result = await response.json();
      
      if (result.error && !result.scanResults) {
        setError(result.error);
      } else {
        setData(result);
        setLastScanned(new Date().toLocaleString());
      }
    } catch (err) {
      setError(err.message || 'Failed to scan');
    } finally {
      setLoading(false);
    }
  };

  const getRecommendationStyle = (rec) => {
    if (rec === 'SELL') return 'bg-emerald-500/20 text-emerald-400';
    if (rec === 'AVOID') return 'bg-red-500/20 text-red-400';
    return 'bg-amber-500/20 text-amber-400';
  };

  const getRiskStyle = (risk) => {
    if (risk === 'LOW') return 'text-emerald-400';
    if (risk === 'HIGH') return 'text-red-400';
    return 'text-amber-400';
  };

  return (
    <>
      <Head>
        <title>Stock Put Scanner</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">📊 Stock Put Scanner</h1>
            <p className="text-slate-400">Find the best cash-secured put opportunities</p>
          </div>

          {/* Controls */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="md:col-span-2">
                <label className="text-slate-400 text-sm mb-2 block">Custom Ticker (optional)</label>
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && !loading && runScan()}
                  placeholder="e.g. RKLB"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white text-lg placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  maxLength={5}
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm mb-2 block">Target Return</label>
                <select
                  value={targetReturn}
                  onChange={(e) => setTargetReturn(parseFloat(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white text-lg focus:outline-none focus:border-emerald-500"
                >
                  {targetReturnOptions.map((val) => (
                    <option key={val} value={val}>{val.toFixed(2)}% weekly</option>
                  ))}
                </select>
              </div>
              <button
                onClick={runScan}
                disabled={loading}
                className={`px-6 py-3 font-bold rounded-xl transition-all ${
                  loading 
                    ? 'bg-slate-600 text-slate-400 cursor-wait' 
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg'
                }`}
              >
                {loading ? '⏳ Scanning...' : '🔍 Scan & Analyze'}
              </button>
            </div>
            <div className="mt-3 text-slate-500 text-sm">
              Scanning: {popularTickers.join(', ')}{ticker && !popularTickers.includes(ticker) ? `, ${ticker}` : ''}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4">
              <p className="text-red-400 font-bold">Error</p>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
              <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-white text-lg">Fetching live options data...</p>
              <p className="text-slate-400 text-sm">This takes 5-10 seconds</p>
            </div>
          )}

          {/* Results */}
          {data && !loading && (
            <>
              {/* Market Overview */}
              {data.marketOverview && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <p className="text-slate-300">🌍 {data.marketOverview}</p>
                  <p className="text-slate-500 text-xs mt-1">Scanned: {lastScanned}</p>
                </div>
              )}

              {/* Best Overall Pick */}
              {data.bestOverallPick && (
                <div className="bg-emerald-500/10 border border-emerald-500/50 rounded-xl p-5">
                  <h3 className="text-emerald-400 font-bold text-xl mb-2">
                    🏆 Best Pick: {data.bestOverallPick.ticker} ${data.bestOverallPick.strike} PUT
                  </h3>
                  <p className="text-emerald-100">{data.bestOverallPick.reason}</p>
                  {data.bestOverallPick.weeklyReturn && (
                    <p className="text-emerald-300 mt-2 text-lg">Expected Return: <span className="font-bold">{data.bestOverallPick.weeklyReturn}%</span></p>
                  )}
                </div>
              )}

              {/* All Tickers Grid */}
              {data.scanResults && (
                <div>
                  <h2 className="text-xl font-bold text-white mb-4">All Tickers</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {data.scanResults.map((result) => (
                      <div 
                        key={result.ticker}
                        className={`bg-slate-800/50 border rounded-xl p-4 ${
                          data.bestOverallPick?.ticker === result.ticker 
                            ? 'border-emerald-500' 
                            : result.hasEarnings 
                              ? 'border-red-500/50' 
                              : 'border-slate-700'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-white font-bold">{result.ticker}</span>
                          <span className={`text-xs px-2 py-1 rounded ${getRecommendationStyle(result.recommendation)}`}>
                            {result.recommendation}
                          </span>
                        </div>
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Price</span>
                            <span className="text-white">${result.currentPrice?.toFixed(2)}</span>
                          </div>
                          {result.bestPut && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Put</span>
                                <span className="text-white">${result.bestPut.strike}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Return</span>
                                <span className={result.bestPut.meetsTarget ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                                  {result.bestPut.weeklyReturn?.toFixed(2)}%
                                </span>
                              </div>
                            </>
                          )}
                          {result.hasEarnings && (
                            <div className="text-red-400 text-xs mt-2 font-medium">⚠️ Earnings: {result.earningsDate}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Deep Dive Section */}
              {data.deepDive && (
                <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-white">
                      📊 Deep Dive: {data.deepDive.ticker}
                    </h2>
                    {data.deepDive.riskLevel && (
                      <span className={`text-sm font-bold ${getRiskStyle(data.deepDive.riskLevel)}`}>
                        Risk: {data.deepDive.riskLevel}
                      </span>
                    )}
                  </div>

                  {/* Verdict Banner */}
                  {data.deepDive.overallVerdict && (
                    <div className={`rounded-lg p-3 mb-4 ${getRecommendationStyle(data.deepDive.overallVerdict)}`}>
                      <span className="font-bold text-lg">Verdict: {data.deepDive.overallVerdict}</span>
                    </div>
                  )}

                  {/* Recommendation */}
                  {data.deepDive.recommendedStrike && (
                    <div className="bg-emerald-500/10 border border-emerald-500/50 rounded-xl p-4 mb-4">
                      <h3 className="text-emerald-400 font-bold">
                        🎯 Recommended: ${data.deepDive.recommendedStrike} PUT
                      </h3>
                      <p className="text-emerald-100/90 text-sm mt-1">{data.deepDive.recommendationReasoning}</p>
                    </div>
                  )}

                  {/* Warnings */}
                  {data.deepDive.warnings?.length > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/50 rounded-xl p-4 mb-4">
                      <h3 className="text-amber-400 font-bold mb-2">⚠️ Risk Warnings</h3>
                      {data.deepDive.warnings.map((w, i) => (
                        <p key={i} className="text-amber-300 text-sm">• {w}</p>
                      ))}
                    </div>
                  )}

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="bg-slate-800 rounded-lg p-3">
                      <div className="text-slate-400 text-xs">Price</div>
                      <div className="text-white font-bold">${data.deepDive.currentPrice?.toFixed(2)}</div>
                      <div className={`text-xs ${data.deepDive.priceChange?.includes('-') ? 'text-red-400' : 'text-emerald-400'}`}>
                        {data.deepDive.priceChange}
                      </div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3">
                      <div className="text-slate-400 text-xs">52-Week Range</div>
                      <div className="text-white text-sm">
                        ${data.deepDive.fiftyTwoWeekLow?.toFixed(0)} - ${data.deepDive.fiftyTwoWeekHigh?.toFixed(0)}
                      </div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3">
                      <div className="text-slate-400 text-xs">Expiry</div>
                      <div className="text-white font-bold">{data.deepDive.expiration}</div>
                      <div className="text-slate-400 text-xs">{data.deepDive.daysToExpiry} days</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3">
                      <div className="text-slate-400 text-xs">Avg IV</div>
                      <div className={`font-bold ${data.deepDive.avgIV > 50 ? 'text-purple-400' : 'text-white'}`}>
                        {data.deepDive.avgIV}%
                      </div>
                      <div className="text-slate-400 text-xs">{data.deepDive.ivRank}</div>
                    </div>
                  </div>

                  {/* Earnings & Dividend Row */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className={`rounded-lg p-3 ${data.deepDive.hasEarnings ? 'bg-red-500/20 border border-red-500/50' : 'bg-slate-800'}`}>
                      <div className="text-slate-400 text-xs">Earnings Date</div>
                      <div className={`font-bold ${data.deepDive.hasEarnings ? 'text-red-400' : 'text-white'}`}>
                        {data.deepDive.earningsDate || 'Not scheduled'}
                      </div>
                      {data.deepDive.hasEarnings && (
                        <div className="text-red-400 text-xs">⚠️ Before expiry!</div>
                      )}
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3">
                      <div className="text-slate-400 text-xs">Ex-Dividend</div>
                      <div className="text-white font-bold">{data.deepDive.exDividendDate || 'N/A'}</div>
                    </div>
                  </div>

                  {/* Top Picks */}
                  {data.deepDive.recommendations?.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-white font-bold mb-3">Top 3 Strikes</h3>
                      <div className="grid md:grid-cols-3 gap-3">
                        {data.deepDive.recommendations.slice(0, 3).map((rec, i) => (
                          <div key={i} className={`bg-slate-800 rounded-lg p-4 ${
                            rec.strike === data.deepDive.recommendedStrike ? 'ring-2 ring-emerald-500' : ''
                          }`}>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-white font-bold">${rec.strike} PUT</span>
                              <span className={`text-xs px-2 py-1 rounded ${rec.meetsTarget ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600 text-slate-300'}`}>
                                {rec.meetsTarget ? `✓ ${targetReturn}%+` : 'Below'}
                              </span>
                            </div>
                            <div className="text-sm space-y-1">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Bid/Ask</span>
                                <span className="text-white">${rec.bid?.toFixed(2)} / ${rec.ask?.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">OTM</span>
                                <span className="text-white">{rec.otmPercent?.toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Return</span>
                                <span className={rec.meetsTarget ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                                  {rec.weeklyReturn?.toFixed(2)}%
                                </span>
                              </div>
                              <div className="flex justify-between text-xs text-slate-500">
                                <span>Vol: {rec.volume?.toLocaleString()}</span>
                                <span>OI: {rec.openInterest?.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All Puts Table */}
                  {data.deepDive.allPuts?.length > 0 && (
                    <div>
                      <h3 className="text-white font-bold mb-3">All OTM Puts</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-slate-400 border-b border-slate-700">
                              <th className="text-left py-2 px-3">Strike</th>
                              <th className="text-right py-2 px-3">Bid</th>
                              <th className="text-right py-2 px-3">Ask</th>
                              <th className="text-right py-2 px-3">OTM%</th>
                              <th className="text-right py-2 px-3">Return</th>
                              <th className="text-right py-2 px-3">IV</th>
                              <th className="text-right py-2 px-3">Vol</th>
                              <th className="text-right py-2 px-3">OI</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.deepDive.allPuts.map((put, i) => (
                              <tr key={i} className={`border-b border-slate-800 ${
                                put.strike === data.deepDive.recommendedStrike ? 'bg-emerald-500/10' : ''
                              }`}>
                                <td className="py-2 px-3 text-white font-medium">
                                  ${put.strike}
                                  {put.strike === data.deepDive.recommendedStrike && <span className="text-emerald-400 ml-1">★</span>}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-300">${put.bid?.toFixed(2)}</td>
                                <td className="py-2 px-3 text-right text-slate-300">${put.ask?.toFixed(2)}</td>
                                <td className="py-2 px-3 text-right text-slate-300">{put.otm?.toFixed(1)}%</td>
                                <td className={`py-2 px-3 text-right font-medium ${put.weeklyReturn >= targetReturn ? 'text-emerald-400' : 'text-amber-400'}`}>
                                  {put.weeklyReturn?.toFixed(2)}%
                                </td>
                                <td className={`py-2 px-3 text-right ${put.iv > 50 ? 'text-purple-400' : 'text-slate-300'}`}>
                                  {put.iv ? `${put.iv}%` : '-'}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-300">{put.volume?.toLocaleString()}</td>
                                <td className="py-2 px-3 text-right text-slate-300">{put.oi?.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Empty State */}
          {!data && !loading && !error && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
              <p className="text-4xl mb-4">📈</p>
              <p className="text-white text-lg mb-2">Ready to scan</p>
              <p className="text-slate-400">Click "Scan & Analyze" to find put opportunities</p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-slate-500 text-xs pt-4">
            <p>Built by <span className="text-slate-400">Sid Mullick</span> • Powered by Claude AI + Yahoo Finance</p>
            <p>⚠️ Not financial advice. Options trading involves significant risk.</p>
          </div>
        </div>
      </div>
    </>
  );
}
