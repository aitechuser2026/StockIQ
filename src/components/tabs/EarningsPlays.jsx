import React, { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { useLivePrices } from '../../hooks/useLivePrices'

// ─── Earnings Plays — June 2026 ──────────────────────────────────────────────
const EARNINGS_TICKERS = ['CRDO', 'ORCL', 'ADBE', 'RH', 'FDX']

const EARNINGS = [
  {
    ticker: 'CRDO',
    name: 'Credo Technology',
    reportDate: 'Jun 10, 2026',
    when: 'After Close',
    daysAway: 15,
    sector: 'AI Networking',
    refPrice: 72.00,
    expectedMove: 15.0,
    historicalAvgMove: 18.2,
    ivRank: 65,
    epsEst: 0.42,
    prevEps: 0.18,
    revEst: 428,
    prevRev: 185,
    revGrowthEst: 131,
    optionStrategy: 'Long Call (speculative) OR Straddle',
    reasoning: '202% revenue growth last quarter. Q4 guidance $425–435M. Beat probability high given backlog from AI hyperscalers. Options are pricing a 15% move — historical average is 18.2%, suggesting options are CHEAP relative to typical move.',
    signals: ['🟢 Beat & Raise likely', '🟢 AI networking tailwind', '🟢 Historical move > implied', '🔴 High IV (expensive premium)'],
    stance: 'BULLISH',
    riskLevel: 'Aggressive',
    playDetails: 'Buy Jun 20 $80 Call @ ~$4.50. Max risk = $450/contract. If CRDO jumps 15%, profit ~$600. Alternatively, straddle the $72 strike ($4.50c + $4.20p = $8.70 net) for a pure volatility play.',
    historicalMoves: [18.5, -12.3, 22.1, 15.6, -8.9, 25.4, -11.2, 19.8],
  },
  {
    ticker: 'ORCL',
    name: 'Oracle Corporation',
    reportDate: 'Jun 11, 2026',
    when: 'After Close',
    daysAway: 16,
    sector: 'Cloud / Database',
    refPrice: 165.00,
    expectedMove: 7.5,
    historicalAvgMove: 9.1,
    ivRank: 42,
    epsEst: 1.65,
    prevEps: 1.53,
    revEst: 14850,
    prevRev: 14273,
    revGrowthEst: 4,
    optionStrategy: 'Bull Call Spread',
    reasoning: 'Oracle Cloud Infrastructure (OCI) growing 50%+ for AI training workloads. Cohere, NVIDIA, and government contracts expanding. Jan Ellison\'s AI push is credible. IV Rank 42 = moderate, spread reduces cost. FY2026 guidance expected to be raised.',
    signals: ['🟢 OCI AI cloud growing 50%+', '🟢 Government contract pipeline strong', '🟡 Moderate IV — spread is efficient', '🔴 Core database legacy drag'],
    stance: 'BULLISH',
    riskLevel: 'Moderate',
    playDetails: 'Bull Call Spread: Buy Jun 20 $165 Call, Sell Jun 20 $180 Call. Net debit ~$5.50. Max profit $9.50 per spread if ORCL hits $180. Risk/reward 1.7:1.',
    historicalMoves: [9.8, -6.2, 12.4, 8.1, -4.5, 11.3, 7.8, -5.9],
  },
  {
    ticker: 'ADBE',
    name: 'Adobe Inc.',
    reportDate: 'Jun 12, 2026',
    when: 'After Close',
    daysAway: 17,
    sector: 'Creative Software / AI',
    refPrice: 440.00,
    expectedMove: 8.0,
    historicalAvgMove: 8.8,
    ivRank: 38,
    epsEst: 4.95,
    prevEps: 4.48,
    revEst: 5750,
    prevRev: 5310,
    revGrowthEst: 8,
    optionStrategy: 'Bull Call Spread OR Long Straddle',
    reasoning: 'Adobe Firefly AI generative tools are monetizing inside Creative Cloud and Express. AI-driven seat upsell increasing ARPU. IV Rank 38 = options are relatively cheap — good setup for directional play or straddle. Q2 2025 beat drove +14% single-day move.',
    signals: ['🟢 Firefly AI monetization accelerating', '🟢 IV Rank 38 — cheap options entry', '🟢 Historical avg move (8.8%) > implied (8%)', '🟡 Competition from Canva AI and generative tools'],
    stance: 'BULLISH',
    riskLevel: 'Moderate',
    playDetails: 'Straddle: Buy $440 Call + $440 Put both for Jun 20 expiry. Estimated $35–$38 total premium. Profitable if ADBE moves >8.5% in either direction. Or buy $450 Call / Sell $470 Call spread for ~$7.',
    historicalMoves: [14.1, -8.4, 11.2, 6.8, -9.3, 15.8, -7.1, 10.5],
  },
  {
    ticker: 'RH',
    name: 'RH (Restoration Hardware)',
    reportDate: 'Jun 13, 2026',
    when: 'After Close',
    daysAway: 18,
    sector: 'Consumer Discretionary',
    refPrice: 278.00,
    expectedMove: 12.0,
    historicalAvgMove: 16.4,
    ivRank: 72,
    epsEst: 4.20,
    prevEps: 2.85,
    revEst: 895,
    prevRev: 762,
    revGrowthEst: 17,
    optionStrategy: 'Sell Iron Condor (Neutral) or Buy Put',
    reasoning: 'Consumer discretionary is the LAGGING sector in 2026. RH is heavily tied to luxury housing market which remains pressured by 4.35% mortgage rates. High IV (72) means options are expensive — SELLING premium is favored. Alternatively, buying put as a bearish macro hedge.',
    signals: ['🔴 Consumer discretionary in lagging sector', '🔴 Housing market under rate pressure', '🟡 High IV (72) favors premium selling', '🔴 Volatile stock — historical avg 16.4% move'],
    stance: 'BEARISH/NEUTRAL',
    riskLevel: 'Aggressive',
    playDetails: 'If neutral: Iron Condor — Sell $310 call/Buy $330 call + Sell $250 put/Buy $230 put. Collect ~$8 credit. Keep if RH stays between $258–$302. If bearish: Buy Jun 20 $265 Put @ ~$12.',
    historicalMoves: [-18.2, 22.4, -14.6, 19.8, -11.3, 24.1, -16.8, 13.5],
  },
  {
    ticker: 'FDX',
    name: 'FedEx Corporation',
    reportDate: 'Jun 18, 2026',
    when: 'After Close',
    daysAway: 23,
    sector: 'Industrials / Logistics',
    refPrice: 282.00,
    expectedMove: 6.5,
    historicalAvgMove: 8.3,
    ivRank: 44,
    epsEst: 5.28,
    prevEps: 4.55,
    revEst: 22400,
    prevRev: 21900,
    revGrowthEst: 2,
    optionStrategy: 'Bull Call Spread',
    reasoning: 'FedEx\'s DRIVE cost-cutting program has been delivering exceptional margin expansion. Management upgraded FY2027 guidance. Industrials is a leading sector. E-commerce volume normalizing post-pandemic is a tailwind. IV rank 44 = moderate, good for spread.',
    signals: ['🟢 Industrials is a leading sector', '🟢 DRIVE program driving margin expansion', '🟢 E-commerce volume recovery', '🟡 Macro slowing could hit volume'],
    stance: 'BULLISH',
    riskLevel: 'Moderate',
    playDetails: 'Bull Call Spread: Buy Jun 20 $285 Call, Sell Jun 20 $300 Call. Net debit ~$4.80. Max profit $10.20 per spread. Target: FDX hits $295+ post-earnings.',
    historicalMoves: [7.8, -9.1, 12.4, 5.6, -6.8, 10.2, -7.4, 8.9],
  },
]

const STANCE_COLORS = {
  BULLISH: { bg: 'bg-green-50 border-green-300', badge: 'bg-green-100 text-green-800', icon: '📈' },
  'BEARISH/NEUTRAL': { bg: 'bg-red-50 border-red-300', badge: 'bg-red-100 text-red-700', icon: '📉' },
}

// ─── Live status bar ─────────────────────────────────────────────────────────
function LiveBar({ loading, error, lastUpdated, refresh }) {
  return (
    <div className="flex items-center justify-between text-xs mt-1">
      <div className="flex items-center gap-2">
        {loading ? (
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
            <span className="animate-spin">⏳</span> Fetching prices…
          </span>
        ) : error ? (
          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">⚠️ Price feed unavailable</span>
        ) : (
          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">🟢 Live</span>
        )}
        {lastUpdated && !loading && (
          <span className="text-slate-400">Updated {lastUpdated.toLocaleTimeString()}</span>
        )}
      </div>
      <button onClick={refresh}
        className="bg-white border border-slate-200 hover:border-orange-400 hover:text-orange-600 px-3 py-1 rounded-full transition-all font-medium shadow-sm">
        ↻ Refresh
      </button>
    </div>
  )
}

export default function EarningsPlays() {
  const [expanded, setExpanded]   = useState(null)
  const [stanceFilter, setFilter] = useState('All')

  const { prices, loading, lastUpdated, error, refresh } = useLivePrices(EARNINGS_TICKERS)

  const filtered = EARNINGS.filter(e => stanceFilter === 'All' || e.stance === stanceFilter)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">📣 Earnings Mover Plays</h1>
            <p className="text-amber-200 text-sm mt-1">
              Upcoming earnings + implied vs historical move · Options strategies · June 2026
            </p>
          </div>
          <div className="flex gap-2">
            {['All','BULLISH','BEARISH/NEUTRAL'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  stanceFilter === f ? 'bg-white text-orange-700 shadow' : 'bg-white/20 hover:bg-white/30 text-white'
                }`}>
                {f === 'All' ? '🔀 All' : f === 'BULLISH' ? '📈 Bullish' : '🛡️ Bear/Neutral'}
              </button>
            ))}
          </div>
        </div>
        <LiveBar loading={loading} error={error} lastUpdated={lastUpdated} refresh={refresh} />
      </div>

      {/* Risk Warning */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-800">
        <strong>⚠️ Earnings Options Warning:</strong> Playing earnings with options is extremely high-risk.
        IV crush post-earnings can wipe out 30–60% of option value even if the stock moves in your direction.
        Always verify IV Rank before entry. Prefer defined-risk spreads over naked long options on earnings unless you have strong conviction.
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Earnings This Window', value: EARNINGS.length, color: 'text-orange-600' },
          { label: 'Bullish Setups', value: EARNINGS.filter(e=>e.stance==='BULLISH').length, color: 'text-green-600' },
          { label: 'Avg Expected Move', value: `±${(EARNINGS.reduce((a,b)=>a+b.expectedMove,0)/EARNINGS.length).toFixed(1)}%`, color: 'text-blue-600' },
          { label: 'Best Risk/Reward', value: [...EARNINGS].sort((a,b) => (b.historicalAvgMove-b.expectedMove) - (a.historicalAvgMove-a.expectedMove))[0].ticker, color: 'text-purple-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-100 shadow p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">{k.label}</div>
            <div className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Implied vs Historical Move chart */}
      <div className="bg-white rounded-2xl shadow border border-slate-100 p-5">
        <h2 className="font-bold text-slate-700 text-lg mb-1">Implied Move vs Historical Average Move</h2>
        <p className="text-xs text-slate-400 mb-4">
          When historical avg &gt; implied move → options may be CHEAP (favor buying). When historical avg &lt; implied → options may be expensive (favor selling/spreads).
        </p>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={EARNINGS.map(e => ({ ticker: e.ticker, implied: e.expectedMove, historical: e.historicalAvgMove }))}
            margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="ticker" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
            <Tooltip formatter={v => [`${v}%`]} />
            <Bar dataKey="implied" name="Implied Move" fill="#f97316" radius={[4,4,0,0]} />
            <Bar dataKey="historical" name="Hist. Avg Move" fill="#6366f1" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Earnings cards */}
      <div className="space-y-4">
        {filtered.map(e => {
          const style = STANCE_COLORS[e.stance] || STANCE_COLORS.BULLISH
          const histBetter = e.historicalAvgMove > e.expectedMove
          const liveData  = prices[e.ticker]
          const livePrice = liveData?.price ?? e.refPrice
          const liveChg   = liveData?.changePct

          return (
            <div key={e.ticker}
              className={`rounded-2xl border-2 shadow transition-all cursor-pointer hover:shadow-lg ${style.bg}`}
              onClick={() => setExpanded(expanded === e.ticker ? null : e.ticker)}>

              <div className="p-5">
                {/* Top row */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xl">{style.icon}</span>
                      <span className="text-xl font-black text-slate-800">{e.ticker}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${style.badge}`}>{e.stance}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        e.riskLevel === 'Aggressive' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`}>{e.riskLevel}</span>
                    </div>
                    <div className="text-sm text-slate-600 mt-0.5">{e.name} · {e.sector}</div>
                    <div className="text-sm font-semibold text-slate-700 mt-0.5">
                      📅 {e.reportDate} ({e.when}) · {e.daysAway}d away
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {loading && !liveData ? (
                      <div className="h-7 w-20 bg-slate-200 animate-pulse rounded mb-1" />
                    ) : (
                      <>
                        <div className="text-xl font-bold text-slate-800">${livePrice.toFixed(2)}</div>
                        {liveChg !== undefined && (
                          <div className={`text-sm font-semibold ${liveChg >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {liveChg >= 0 ? '▲' : '▼'} {Math.abs(liveChg).toFixed(2)}% today
                          </div>
                        )}
                        <div className="text-xs text-slate-400">
                          Expected move: ±${(livePrice * e.expectedMove / 100).toFixed(2)}
                        </div>
                      </>
                    )}
                    <div className={`text-xs font-bold mt-0.5 ${histBetter ? 'text-green-600' : 'text-amber-600'}`}>
                      {histBetter ? '✅ Hist > Implied' : '⚠️ Implied > Hist'}
                    </div>
                    <div className="text-xs text-slate-500">IV Rank: {e.ivRank}</div>
                  </div>
                </div>

                {/* Expected move metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                  {[
                    { label: 'Implied Move', value: `±${e.expectedMove}%`, color: 'text-orange-600', bg: 'bg-orange-50' },
                    { label: 'Hist. Avg Move', value: `±${e.historicalAvgMove}%`, color: 'text-purple-600', bg: 'bg-purple-50' },
                    { label: 'EPS Est.', value: `$${e.epsEst}`, color: 'text-slate-700', bg: 'bg-slate-50' },
                    { label: 'Rev Est.', value: `$${e.revEst}M`, color: 'text-blue-700', bg: 'bg-blue-50' },
                  ].map(m => (
                    <div key={m.label} className={`rounded-lg p-2 ${m.bg}`}>
                      <div className="text-xs text-slate-500">{m.label}</div>
                      <div className={`font-bold text-sm ${m.color}`}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Signals */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {e.signals.map((s, i) => (
                    <span key={i} className="text-xs bg-white/80 border border-slate-200 px-2 py-0.5 rounded-full text-slate-700">{s}</span>
                  ))}
                </div>

                {/* Strategy highlight */}
                <div className="bg-white/70 rounded-xl px-3 py-2 border border-slate-200">
                  <span className="text-xs font-bold text-slate-600">📊 Recommended: </span>
                  <span className="text-xs text-slate-700">{e.optionStrategy}</span>
                </div>

                <div className="text-xs text-orange-600 mt-2 font-semibold">
                  {expanded === e.ticker ? '▲ Collapse' : '▼ Full analysis + trade setup'}
                </div>
              </div>

              {/* Expanded */}
              {expanded === e.ticker && (
                <div className="border-t border-white/50 p-5 bg-white/60 rounded-b-2xl space-y-4">
                  <div>
                    <h4 className="font-bold text-slate-700 text-sm mb-2">🔍 Analysis & Reasoning</h4>
                    <p className="text-sm text-slate-700 leading-relaxed">{e.reasoning}</p>
                  </div>

                  {/* Historical moves chart */}
                  <div>
                    <h4 className="font-bold text-slate-700 text-sm mb-2">📈 Historical Earnings Moves (last 8 quarters)</h4>
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={e.historicalMoves.map((m, i) => ({ q: `Q${e.historicalMoves.length-i}`, move: m }))}
                        margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="q" tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 9 }} />
                        <Tooltip formatter={v => [`${v}%`, 'Actual Move']} />
                        <ReferenceLine y={0} stroke="#94a3b8" />
                        <Bar dataKey="move" radius={[3,3,0,0]}>
                          {e.historicalMoves.map((m, i) => (
                            <Cell key={i} fill={m >= 0 ? '#10b981' : '#ef4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-slate-800 text-white rounded-xl p-4">
                    <h4 className="font-semibold text-sm mb-2">💡 Trade Setup Details</h4>
                    <p className="text-xs text-slate-200 leading-relaxed">{e.playDetails}</p>
                  </div>

                  {/* EPS + Revenue growth comparison */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-3">
                      <div className="text-xs text-slate-500 mb-2">EPS: Est vs Prior</div>
                      <div className="flex items-end gap-3">
                        <div className="text-center">
                          <div className="text-xs text-slate-400">Prior</div>
                          <div className="text-lg font-bold text-slate-700">${e.prevEps}</div>
                        </div>
                        <div className="text-slate-400 text-lg">→</div>
                        <div className="text-center">
                          <div className="text-xs text-slate-400">Estimate</div>
                          <div className="text-lg font-bold text-green-600">${e.epsEst}</div>
                        </div>
                        <div className="text-green-600 font-bold text-sm">
                          +{(((e.epsEst - e.prevEps) / e.prevEps) * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-3">
                      <div className="text-xs text-slate-500 mb-2">Revenue: Est vs Prior</div>
                      <div className="flex items-end gap-3">
                        <div className="text-center">
                          <div className="text-xs text-slate-400">Prior</div>
                          <div className="text-lg font-bold text-slate-700">${(e.prevRev/1000).toFixed(1)}B</div>
                        </div>
                        <div className="text-slate-400 text-lg">→</div>
                        <div className="text-center">
                          <div className="text-xs text-slate-400">Estimate</div>
                          <div className="text-lg font-bold text-green-600">${(e.revEst/1000).toFixed(1)}B</div>
                        </div>
                        <div className="text-green-600 font-bold text-sm">+{e.revGrowthEst}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
        <strong>⚡ Disclaimer:</strong> Earnings dates and estimates are based on analyst consensus as of May 26, 2026.
        Dates can change. Always verify on Yahoo Finance, Earnings Whispers, or your broker before trading.
        Options are highly leveraged instruments. Past implied move accuracy does not guarantee future performance.
      </div>
    </div>
  )
}
