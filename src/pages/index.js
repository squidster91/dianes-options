import { useState } from 'react';
import Head from 'next/head';

export default function Home() {
  const [ticker, setTicker] = useState('');
  const [targetReturn, setTargetReturn] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [scanData, setScanData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [lastScanned, setLastScanned] = useState(null);

  const targetReturnOptions = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0];
  const popularTickers = ['GOOG', 'AAPL', 'TSLA', 'NVDA', 'AMZN', 'META', 'MSFT', 'SPY'];

  const scanAllTickers = async () => {
    setScanning(true);
    setError(null);
    
    const tickersToScan = [...popularTickers];
    if (ticker.trim() && !popularTickers.includes(ticker.toUpperCase())) {
      tickersToScan.push(ticker.toUpperCase());
    }
    
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: tickersToScan, targetReturn })
      });
      
      const result = await response.json();
      
      if (result.error && !result.scanResults) {
        setError(result.error + (result.raw ? ` - ${result.raw}` : ''));
      } else {
        setScanData(result);
        setLastScanned(new Date().toLocaleString());
      }
    } catch (err) {
      setError(err.message || 'Failed to scan tickers');
    } finally {
      setScanning(false);
    }
  };

  const analyzeOptions = async (tickerToAnalyze) => {
    const targetTicker = tickerToAnalyze || ticker;
    if (!targetTicker.trim()) {
      setError('Please enter a ticker symbol');
      return;
    }
    
    setLoading(true);
    setError(null);
    setData(null);
    
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: targetTicker.toUpperCase(), targetReturn })
      });
      
      const result = await response.json();
      
      if (result.error && !result.currentPrice) {
        setError(result.error + (result.raw ? ` - ${result.raw}` : ''));
      } else {
        setData(result);
        setTicker(targetTicker.toUpperCase());
        setLastUpdated(new Date().toLocaleString());
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) {
      analyzeOptions();
    }
  };

  const getRankEmoji = (rank) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  const getRecommendationColor = (rec) => {
    if (rec === 'SELL') return 'text-emerald-400';
    if (rec === 'AVOID') return 'text-red-400';
    return 'text-amber-400';
  };

  const displayData = data;
  const currentTicker = ticker.toUpperCase();

  return (
    <>
      <Head>
        <title>Stock Put Scanner</title>
        <meta name="description" content="Analyze weekly put options for cash-secured selling strategies" />
        <meta name="author" content="Sid Mullick" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl">📊</span>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-white">Stock Put Scanner</h1>
                  <p className="text-slate-400 text-sm">Cash-secured put analysis tool</p>
                </div>
              </div>
              <button
                onClick={scanAllTickers}
                disabled={scanning}
                className={`px-6 py-3 font-semibold rounded-xl transition-all flex items-center gap-2 justify-center whitespace-nowrap ${
                  scanning 
                    ? 'bg-slate-600 text-slate-400 cursor-wait' 
                    : 'bg-purple-500 hover:bg-purple-600 text-white shadow-lg shadow-purple-500/25'
                }`}
              >
                {scanning ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Scanning...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Scan All Tickers
                  </>
                )}
              </button>
            </div>

            {/* Controls Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label className="text-slate-400 text-xs uppercase tracking-wide mb-1 block">Custom Ticker (optional)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    onKeyPress={handleKeyPress}
                    placeholder="Add custom ticker..."
                    className="flex-1 px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white text-lg font-medium placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    maxLength={5}
                  />
                  <button
                    onClick={() => analyzeOptions()}
                    disabled={loading || !ticker.trim()}
                    className={`px-4 py-3 font-semibold rounded-xl transition-all flex items-center gap-2 ${
                      loading || !ticker.trim()
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    }`}
                  >
                    {loading ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    )}
                    Analyze
                  </button>
                </div>
              </div>
              <div>
                <label className="text-slate-400 text-xs uppercase tracking-wide mb-1 block">Target Weekly Return</label>
                <select
                  value={targetReturn}
                  onChange={(e) => setTargetReturn(parseFloat(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white text-lg font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  {targetReturnOptions.map((val) => (
                    <option key={val} value={val}>
                      {val.toFixed(2)}%
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <div className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl">
                  <div className="text-slate-400 text-xs">Scanning</div>
                  <div className="text-white font-medium">{popularTickers.length + (ticker.trim() && !popularTickers.includes(ticker.toUpperCase()) ? 1 : 0)} tickers</div>
                </div>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4">
              <h3 className="text-red-400 font-bold">Error</h3>
              <p className="text-red-300/80 text-sm">{error}</p>
            </div>
          )}

          {/* Scan Results Dashboard */}
          {scanData && scanData.scanResults && (
            <div className="space-y-4">
              {/* Market Overview */}
              {scanData.marketOverview && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">🌍</span>
                    <h3 className="text-white font-bold">Market Overview</h3>
                    {lastScanned && <span className="text-slate-500 text-xs ml-auto">Scanned: {lastScanned}</span>}
                  </div>
                  <p className="text-slate-300">{scanData.marketOverview}</p>
                </div>
              )}

              {/* Best Overall Pick */}
              {scanData.bestOverallPick && (
                <div className="bg-emerald-500/10 border border-emerald-500/50 rounded-xl p-5">
                  <div className="flex items-start gap-4">
                    <span className="text-4xl">🏆</span>
                    <div className="flex-1">
                      <h3 className="text-emerald-400 font-bold text-lg mb-1">
                        Best Pick Today: {scanData.bestOverallPick.ticker} ${scanData.bestOverallPick.strike} PUT
                        {scanData.bestOverallPick.weeklyReturn && (
                          <span className="ml-2 text-emerald-300">({scanData.bestOverallPick.weeklyReturn.toFixed(2)}% return)</span>
                        )}
                      </h3>
                      <p className="text-emerald-100/90">{scanData.bestOverallPick.reason}</p>
                      <button
                        onClick={() => analyzeOptions(scanData.bestOverallPick.ticker)}
                        className="mt-3 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-all"
                      >
                        View Full Analysis →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* All Tickers Grid */}
              <div>
                <h2 className="text-xl font-bold text-white mb-4">All Tickers Scan</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {scanData.scanResults.map((result, idx) => (
                    <div 
                      key={result.ticker}
                      className={`bg-slate-800/50 border rounded-xl p-4 cursor-pointer hover:bg-slate-800/80 transition-all ${
                        scanData.bestOverallPick?.ticker === result.ticker 
                          ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' 
                          : 'border-slate-700'
                      }`}
                      onClick={() => analyzeOptions(result.ticker)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="text-white font-bold text-lg">{result.ticker}</span>
                          {scanData.bestOverallPick?.ticker === result.ticker && (
                            <span className="ml-2 text-emerald-400 text-xs">🏆 BEST</span>
                          )}
                        </div>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${getRecommendationColor(result.recommendation)} bg-slate-700/50`}>
                          {result.recommendation}
                        </span>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Price</span>
                          <span className="text-white">
                            ${result.currentPrice?.toFixed(2)}
                            <span className={`ml-1 text-xs ${result.priceChange?.includes('-') ? 'text-red-400' : 'text-emerald-400'}`}>
                              {result.priceChange}
                            </span>
                          </span>
                        </div>
                        
                        {result.bestPut && (
                          <>
                            <div className="border-t border-slate-700 pt-2 mt-2">
                              <div className="text-slate-400 text-xs mb-1">Best Put</div>
                              <div className="flex justify-between">
                                <span className="text-white font-medium">${result.bestPut.strike}</span>
                                <span className={`font-medium ${result.bestPut.meetsTarget ? 'text-emerald-400' : 'text-amber-400'}`}>
                                  {result.bestPut.weeklyReturn?.toFixed(2)}%
                                </span>
                              </div>
                              <div className="flex justify-between text-xs mt-1">
                                <span className="text-slate-500">OTM: {result.bestPut.otmPercent?.toFixed(1)}%</span>
                                <span className="text-slate-500">Bid: ${result.bestPut.bid?.toFixed(2)}</span>
                              </div>
                            </div>
                          </>
                        )}
                        
                        <div className="flex justify-between text-xs pt-1">
                          <span className="text-slate-500">Exp: {result.expiration}</span>
                          <span className={`${result.hasEarnings ? 'text-red-400' : 'text-slate-500'}`}>
                            {result.hasEarnings ? '⚠️ Earnings' : `IV: ${result.avgIV}%`}
                          </span>
                        </div>
                        
                        <p className="text-slate-400 text-xs italic mt-2">{result.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* No Data State */}
          {!scanData && !displayData && !loading && !scanning && !error && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
              <span className="text-6xl mb-4 block">📈</span>
              <h2 className="text-xl font-bold text-white mb-2">Ready to Scan</h2>
              <p className="text-slate-400 mb-6">Click "Scan All Tickers" to find the best put options across {popularTickers.length} popular stocks</p>
              <div className="flex flex-wrap justify-center gap-2">
                {popularTickers.map(t => (
                  <span key={t} className="px-3 py-1 bg-slate-700 text-slate-300 rounded-lg text-sm">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Loading State for Scan */}
          {scanning && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
              <svg className="w-12 h-12 animate-spin mx-auto mb-4 text-purple-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <h2 className="text-xl font-bold text-white mb-2">Scanning All Tickers...</h2>
              <p className="text-slate-400">Analyzing {popularTickers.length}+ stocks for {targetReturn}% weekly return opportunities</p>
            </div>
          )}

          {/* Detailed Analysis Section */}
          {displayData && (
            <div className="border-t border-slate-700 pt-6">
              <h2 className="text-2xl font-bold text-white mb-4">
                📊 Detailed Analysis: {displayData.ticker}
                <span className="text-sm font-normal text-slate-400 ml-3">Updated: {lastUpdated}</span>
              </h2>

              {/* AI Recommendation Box */}
              {displayData.recommendedStrike && displayData.recommendationReasoning && (
                <div className="bg-emerald-500/10 border border-emerald-500/50 rounded-xl p-5 mb-4">
                  <div className="flex items-start gap-4">
                    <span className="text-4xl">🎯</span>
                    <div className="flex-1">
                      <h3 className="text-emerald-400 font-bold text-lg mb-1">
                        Recommended: ${displayData.recommendedStrike} PUT
                      </h3>
                      <p className="text-emerald-100/90">{displayData.recommendationReasoning}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Warnings */}
              {displayData.warnings && displayData.warnings.length > 0 && (
                <div className="bg-amber-500/20 border border-amber-500/50 rounded-xl p-4 mb-4">
                  <h3 className="text-amber-400 font-bold mb-2">⚠️ Risk Warnings</h3>
                  <ul className="space-y-1">
                    {displayData.warnings.map((warning, i) => (
                      <li key={i} className="text-amber-300/80 text-sm">• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Market Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-4">
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">Ticker</div>
                  <div className="text-white text-2xl font-bold">{displayData.ticker}</div>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">Price</div>
                  <div className="text-white text-2xl font-bold">${displayData.currentPrice?.toFixed(2)}</div>
                  {displayData.priceChange && (
                    <div className={`text-sm ${displayData.priceChange?.includes('-') ? 'text-red-400' : 'text-emerald-400'}`}>
                      {displayData.priceChange}
                    </div>
                  )}
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">Expiration</div>
                  <div className="text-white text-lg font-bold">{displayData.expiration}</div>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">Days to Exp</div>
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
                  <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">IV Rank</div>
                  <div className={`text-lg font-bold ${
                    displayData.ivRank === 'High' ? 'text-purple-400' : 
                    displayData.ivRank === 'Low' ? 'text-blue-400' : 'text-white'
                  }`}>
                    {displayData.ivRank || 'N/A'}
                  </div>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">Target</div>
                  <div className="text-emerald-400 text-2xl font-bold">{targetReturn}%</div>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">Earnings</div>
                  <div className={`text-lg font-bold ${displayData.hasEarnings ? 'text-red-400' : 'text-emerald-400'}`}>
                    {displayData.hasEarnings ? '⚠️ YES' : '✓ Clear'}
                  </div>
                  {displayData.earningsDate && (
                    <div className="text-xs text-slate-400">{displayData.earningsDate}</div>
                  )}
                </div>
              </div>

              {/* Analysis Notes */}
              {displayData.analysisNotes && displayData.analysisNotes.length > 0 && (
                <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-4 mb-4">
                  <h3 className="text-slate-300 font-bold mb-2 text-sm uppercase tracking-wide">📝 Analysis Notes</h3>
                  <ul className="space-y-1">
                    {displayData.analysisNotes.map((note, i) => (
                      <li key={i} className="text-slate-400 text-sm">• {note}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Top Recommendations */}
              {displayData.recommendations && displayData.recommendations.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-white mb-3">Top 3 Recommendations</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    {displayData.recommendations.slice(0, 3).map((rec, idx) => (
                      <div 
                        key={rec.strike || idx}
                        className={`bg-slate-800/50 border rounded-xl p-5 ${
                          rec.strike === displayData.recommendedStrike 
                            ? 'border-emerald-500 ring-2 ring-emerald-500/30' 
                            : rec.rank === 1 
                              ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' 
                              : 'border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{getRankEmoji(rec.rank)}</span>
                            <span className="text-white font-bold text-xl">${rec.strike} PUT</span>
                          </div>
                          {rec.meetsTarget ? (
                            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-full">
                              ✓ {targetReturn}%+
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-slate-600/50 text-slate-400 text-xs font-medium rounded-full">
                              Below Target
                            </span>
                          )}
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Bid / Ask</span>
                            <span className="text-white">${rec.bid?.toFixed(2)} / ${rec.ask?.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Mid Price</span>
                            <span className="text-white">${rec.mid?.toFixed(2) || ((rec.bid + rec.ask) / 2).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">OTM %</span>
                            <span className="text-white">{rec.otmPercent?.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Weekly Return</span>
                            <span className={`font-bold ${rec.weeklyReturn >= targetReturn ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {rec.weeklyReturn?.toFixed(2)}%
                            </span>
                          </div>
                          {rec.iv && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">IV</span>
                              <span className={`${rec.iv > 50 ? 'text-purple-400' : 'text-white'}`}>{rec.iv?.toFixed(0)}%</span>
                            </div>
                          )}
                          {rec.delta && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Delta</span>
                              <span className="text-white">{rec.delta?.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="border-t border-slate-700 my-2 pt-2">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Capital Req.</span>
                              <span className="text-white">${(rec.strike * 100).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Max Profit</span>
                              <span className="text-emerald-400">${((rec.mid || (rec.bid + rec.ask) / 2) * 100).toFixed(0)}</span>
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
              )}

              {/* Full Options Table */}
              {displayData.allPuts && displayData.allPuts.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-white mb-3">All OTM Puts</h3>
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
                            <th className="text-right text-slate-400 font-medium px-4 py-3">IV</th>
                            <th className="text-right text-slate-400 font-medium px-4 py-3">Delta</th>
                            <th className="text-right text-slate-400 font-medium px-4 py-3">Volume</th>
                            <th className="text-right text-slate-400 font-medium px-4 py-3">OI</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayData.allPuts.map((put, i) => (
                            <tr 
                              key={put.strike || i} 
                              className={`${
                                put.strike === displayData.recommendedStrike 
                                  ? 'bg-emerald-500/10' 
                                  : i % 2 === 0 ? 'bg-slate-800/30' : ''
                              } hover:bg-slate-700/30`}
                            >
                              <td className="px-4 py-3 text-white font-medium">
                                ${put.strike}
                                {put.strike === displayData.recommendedStrike && (
                                  <span className="ml-2 text-emerald-400 text-xs">★</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-300">${put.bid?.toFixed(2)}</td>
                              <td className="px-4 py-3 text-right text-slate-300">${put.ask?.toFixed(2)}</td>
                              <td className="px-4 py-3 text-right text-slate-300">{put.otm?.toFixed(1)}%</td>
                              <td className={`px-4 py-3 text-right font-medium ${put.weeklyReturn >= targetReturn ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {put.weeklyReturn?.toFixed(2)}%
                              </td>
                              <td className={`px-4 py-3 text-right ${put.iv > 50 ? 'text-purple-400' : 'text-slate-300'}`}>
                                {put.iv ? `${put.iv?.toFixed(0)}%` : '-'}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-300">
                                {put.delta ? put.delta?.toFixed(2) : '-'}
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
              )}
            </div>
          )}

          {/* Loading State for Detailed Analysis */}
          {loading && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
              <svg className="w-12 h-12 animate-spin mx-auto mb-4 text-emerald-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <h2 className="text-xl font-bold text-white mb-2">Analyzing {currentTicker || ticker}...</h2>
              <p className="text-slate-400">Fetching detailed options data</p>
            </div>
          )}

          {/* Strategy Info */}
          <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-5">
            <h3 className="text-white font-bold mb-3">📋 Strategy Criteria</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div className="flex flex-col">
                <span className="text-slate-400">Target Return</span>
                <span className="text-emerald-400 font-medium">≥{targetReturn}% weekly</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-400">Delta Range</span>
                <span className="text-white font-medium">-0.05 to -0.15</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-400">Win Rate</span>
                <span className="text-white font-medium">85-95% OTM</span>
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
            <p>Built by <span className="text-slate-400">Sid Mullick</span> • Powered by Claude AI</p>
            <p>⚠️ Not financial advice. Options trading involves significant risk.</p>
          </div>
        </div>
      </div>
    </>
  );
}
