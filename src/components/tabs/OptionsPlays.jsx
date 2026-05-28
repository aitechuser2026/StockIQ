import React, { useState } from 'react'
import { useLivePrices } from '../../hooks/useLivePrices'

// ─── Short-Term Options Plays — May/June 2026 (1–3 week window) ──────────────
const OPTIONS_TICKERS = ['NVDA', 'META', 'CRDO', 'SPY', 'XOM', 'PLTR']
const OPTIONS_PLAYS = [
  {
    id: 1,
    ticker: 'NVDA',
    name: 'NVIDIA Corp',
    strategy: 'Bull Call Spread',
    type: 'BULLISH',
    urgency: 'HIGH',
    expiry: 'Jun 20, 2026',
    daysLeft: 25,
    legs: [
      { action: 'BUY',  type: 'CALL', strike: 220, premium: 12.50 },
      { action: 'SELL', type: 'CALL', strike: 240, premium:  5.80 },
    ],
    netDebit: 6.70,
    maxProfit: 13.30,
    maxLoss: 6.70,
    breakeven: 226.70,
    riskReward: '2.0:1',
    catalyst: 'NVDA GTC Developer Conference keynote Jun 5. Blackwell B200 production ramp update expected to beat estimates. IV Rank ~55 — moderate. Spread limits risk vs naked call.',
    ivRank: 55,
    expectedMove: 8.5,
    risk: 'Moderate',
    tags: ['Earnings Momentum', 'AI Catalyst', 'Defined Risk'],
    signal: 'BUY',
    confidence: 78,
  },
  {
    id: 2,
    ticker: 'META',
    name: 'Meta Platforms',
    strategy: 'Long Call',
    type: 'BULLISH',
    urgency: 'MEDIUM',
    expiry: 'Jun 13, 2026',
    daysLeft: 18,
    legs: [
      { action: 'BUY', type: 'CALL', strike: 620, premium: 18.40 },
    ],
    netDebit: 18.40,
    maxProfit: 'Unlimited',
    maxLoss: 18.40,
    breakeven: 638.40,
    riskReward: 'Open-ended',
    catalyst: 'Meta AI Summit on Jun 9 — expected to announce Llama 4 release timeline and new advertising AI products. Strong Q1 beat momentum. Stock trending above all MAs. IV at 52-week low — cheapest calls in 12 months.',
    ivRank: 22,
    expectedMove: 6.0,
    risk: 'Moderate',
    tags: ['Low IV Entry', 'AI Catalyst', 'Momentum'],
    signal: 'BUY',
    confidence: 72,
  },
  {
    id: 3,
    ticker: 'CRDO',
    name: 'Credo Technology',
    strategy: 'Long Call',
    type: 'BULLISH',
    urgency: 'HIGH',
    expiry: 'Jun 20, 2026',
    daysLeft: 25,
    legs: [
      { action: 'BUY', type: 'CALL', strike: 75, premium: 8.20 },
    ],
    netDebit: 8.20,
    maxProfit: 'Unlimited',
    maxLoss: 8.20,
    breakeven: 83.20,
    riskReward: 'Open-ended',
    catalyst: 'Q4 FY2026 earnings expected ~Jun 10. Revenue guided $425–$435M (+200% YoY). Beat + raise scenario is base case given order book. High institutional accumulation visible in dark pool data.',
    ivRank: 65,
    expectedMove: 15.0,
    risk: 'Aggressive',
    tags: ['Earnings Play', 'AI Networking', 'Momentum'],
    signal: 'BUY',
    confidence: 68,
  },
  {
    id: 4,
    ticker: 'SPY',
    name: 'S&P 500 ETF',
    strategy: 'Bear Put Spread',
    type: 'BEARISH HEDGE',
    urgency: 'MEDIUM',
    expiry: 'Jun 6, 2026',
    daysLeft: 11,
    legs: [
      { action: 'BUY',  type: 'PUT', strike: 530, premium: 8.10 },
      { action: 'SELL', type: 'PUT', strike: 515, premium: 3.90 },
    ],
    netDebit: 4.20,
    maxProfit: 10.80,
    maxLoss: 4.20,
    breakeven: 525.80,
    riskReward: '2.6:1',
    catalyst: 'September seasonality risk is approaching. Current S&P 500 is up 15%+ YTD — technically overbought (RSI 72). FOMC minutes release Jun 4 could signal hawkish delay. Hedge your long book with this cheap put spread.',
    ivRank: 38,
    expectedMove: 2.5,
    risk: 'Moderate',
    tags: ['Portfolio Hedge', 'Defined Risk', 'Event Risk'],
    signal: 'HEDGE',
    confidence: 65,
  },
  {
    id: 5,
    ticker: 'XOM',
    name: 'Exxon Mobil',
    strategy: 'Covered Call / Cash-Secured Put',
    type: 'NEUTRAL/BULLISH',
    urgency: 'LOW',
    expiry: 'Jun 20, 2026',
    daysLeft: 25,
    legs: [
      { action: 'SELL', type: 'PUT', strike: 112, premium: 3.20 },
    ],
    netDebit: -3.20,
    maxProfit: 3.20,
    maxLoss: 108.80,
    breakeven: 108.80,
    riskReward: 'Income play',
    catalyst: 'Energy is a leading sector in 2026. XOM has strong FCF above $50 oil. Selling the $112 put generates 2.8% income in 25 days (annualizes to ~41%). If assigned, you own XOM at $108.80 — a great entry for a long-term value play.',
    ivRank: 48,
    expectedMove: 3.5,
    risk: 'Moderate',
    tags: ['Income Play', 'Energy Sector', 'Premium Selling'],
    signal: 'SELL PUT',
    confidence: 74,
  },
  {
    id: 6,
    ticker: 'PLTR',
    name: 'Palantir Technologies',
    strategy: 'Bull Call Spread',
    type: 'BULLISH',
    urgency: 'HIGH',
    expiry: 'Jun 20, 2026',
    daysLeft: 25,
    legs: [
      { action: 'BUY',  type: 'CALL', strike: 120, premium: 9.40 },
      { action: 'SELL', type: 'CALL', strike: 135, premium: 4.10 },
    ],
    netDebit: 5.30,
    maxProfit: 9.70,
    maxLoss: 5.30,
    breakeven: 125.30,
    riskReward: '1.8:1',
    catalyst: 'Palantir US government contract renewals pipeline closing Jun/Jul. AIP commercial bootcamp schedule extremely active. High-volume unusual call activity detected in Jun $130 strike. Spread reduces cost on this premium-heavy name.',
    ivRank: 70,
    expectedMove: 10.0,
    risk: 'Aggressive',
    tags: ['Unusual Options Activity', 'Government Catalyst', 'AI Platform'],
    signal: 'BUY',
    confidence: 65,
  },
]

const TYPE_STYLES = {
  'BULLISH':        { bg: 'bg-green-50 border-green-300', badge: 'bg-green-100 text-green-800', icon: '📈' },
  'BEARISH HEDGE':  { bg: 'bg-red-50 border-red-300',     badge: 'bg-red-100 text-red-800',     icon: '🛡️' },
  'NEUTRAL/BULLISH':{ bg: 'bg-blue-50 border-blue-300',   badge: 'bg-blue-100 text-blue-700',   icon: '💰' },
}

const URGENCY_COLORS = {
  HIGH:   'bg-red-100 text-red-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW:    'bg-slate-100 text-slate-600',
}

const SIGNAL_COLORS = {
  'BUY':       'bg-green-600 text-white',
  'HEDGE':     'bg-amber-500 text-white',
  'SELL PUT':  'bg-blue-600 text-white',
}

function ConfidenceBar({ val, color }) {
  return (
    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${val}%` }} />
    </div>
  )
}

function LiveBar({ loading, error, lastUpdated, refresh }) {
  return (
    <div className="flex items-center justify-between text-xs mt-1">
      <div className="flex items-center gap-2">
        {loading ? (
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
            <span className="animate-spin">⏳</span> Fetching…
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
        className="bg-white border border-slate-200 hover:border-rose-400 hover:text-rose-600 px-3 py-1 rounded-full transition-all font-medium shadow-sm">
        ↻ Refresh
      </button>
    </div>
  )
}

export default function OptionsPlays() {
  const [filter, setFilter] = useState('All')
  const [expanded, setExpanded] = useState(null)

  const { prices, loading, lastUpdated, error, refresh } = useLivePrices(OPTIONS_TICKERS)

  const filters = ['All', 'BULLISH', 'BEARISH HEDGE', 'NEUTRAL/BULLISH']
  const filtered = OPTIONS_PLAYS.filter(p => filter === 'All' || p.type === filter)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-gradient-to-r from-rose-700 via-pink-700 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">🎯 Short-Term Options Plays</h1>
            <p className="text-rose-200 text-sm mt-1">
              1–3 week catalyst-driven setups · May 26 – Jun 20, 2026 · IV-aware entries
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  filter === f ? 'bg-white text-rose-700 shadow' : 'bg-white/20 hover:bg-white/30 text-white'
                }`}>{f === 'All' ? '🔀 All' : f === 'BULLISH' ? '📈 Bullish' : f === 'BEARISH HEDGE' ? '🛡️ Hedge' : '💰 Income'}</button>
            ))}
          </div>
        </div>
        <LiveBar loading={loading} error={error} lastUpdated={lastUpdated} refresh={refresh} />
      </div>

      {/* Warnings */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
        <strong>⚠️ Options Risk Warning:</strong> Options are complex instruments and carry significant risk including the potential
        for total loss of premium. Short-term options plays are <strong>highly speculative</strong>. Only risk capital you can afford to lose.
        Implied volatility, time decay (theta), and direction must all work in your favor simultaneously.
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Plays This Window', value: OPTIONS_PLAYS.length, color: 'text-rose-600' },
          { label: 'Bullish Setups', value: OPTIONS_PLAYS.filter(p=>p.type==='BULLISH').length, color: 'text-green-600' },
          { label: 'Avg Days to Expiry', value: `${Math.round(OPTIONS_PLAYS.reduce((a,b)=>a+b.daysLeft,0)/OPTIONS_PLAYS.length)}d`, color: 'text-blue-600' },
          { label: 'Hedge Plays', value: OPTIONS_PLAYS.filter(p=>p.type==='BEARISH HEDGE').length, color: 'text-amber-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-100 shadow p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">{k.label}</div>
            <div className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Upcoming catalyst timeline */}
      <div className="bg-white rounded-2xl shadow border border-slate-100 p-5">
        <h2 className="font-bold text-slate-700 text-lg mb-4">📅 Key Catalyst Timeline (May–Jun 2026)</h2>
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
          {[
            { date: 'Jun 4',  event: 'FOMC Minutes Release', impact: 'Market-wide', color: 'bg-amber-400' },
            { date: 'Jun 5',  event: 'NVDA GTC Developer Conference Keynote', impact: 'NVDA, Semis', color: 'bg-violet-500' },
            { date: 'Jun 9',  event: 'Meta AI Summit — Llama 4 Announcement', impact: 'META, GOOGL', color: 'bg-blue-500' },
            { date: 'Jun 10', event: 'CRDO Q4 FY2026 Earnings (~est.)', impact: 'CRDO', color: 'bg-green-500' },
            { date: 'Jun 12', event: 'CPI Inflation Report', impact: 'Bonds, Rate-sensitive', color: 'bg-red-500' },
            { date: 'Jun 20', event: 'OpEx — June Options Expiration', impact: 'All plays expire', color: 'bg-slate-500' },
          ].map((e, i) => (
            <div key={i} className="flex items-start gap-4 pl-10 pb-4 relative">
              <div className={`absolute left-2.5 w-3 h-3 rounded-full ${e.color} ring-2 ring-white`} />
              <div className="flex-1 bg-slate-50 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-700 text-sm">{e.date} — </span>
                  <span className="text-sm text-slate-700">{e.event}</span>
                </div>
                <span className="text-xs bg-white border border-slate-200 px-2 py-0.5 rounded-full text-slate-500 flex-shrink-0">{e.impact}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Play cards */}
      <div className="space-y-4">
        {filtered.map(play => {
          const style    = TYPE_STYLES[play.type] || TYPE_STYLES.BULLISH
          const liveData = prices[play.ticker]
          const livePrice = liveData?.price
          const liveChg   = liveData?.changePct

          return (
            <div key={play.id}
              className={`rounded-2xl border-2 shadow transition-all cursor-pointer hover:shadow-lg ${style.bg}`}
              onClick={() => setExpanded(expanded === play.id ? null : play.id)}>

              <div className="p-5">
                {/* Top row */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-2xl">{style.icon}</span>
                      <span className="text-xl font-black text-slate-800">{play.ticker}</span>
                      {/* Live price badge */}
                      {loading && !liveData ? (
                        <span className="h-5 w-16 bg-slate-200 animate-pulse rounded-full" />
                      ) : livePrice ? (
                        <span className="text-xs font-bold bg-slate-800 text-white px-2 py-0.5 rounded-full">
                          ${livePrice.toFixed(2)}
                          {liveChg !== undefined && (
                            <span className={`ml-1 ${liveChg >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                              {liveChg >= 0 ? '▲' : '▼'}{Math.abs(liveChg).toFixed(2)}%
                            </span>
                          )}
                        </span>
                      ) : null}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${SIGNAL_COLORS[play.signal]}`}>
                        {play.signal}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${URGENCY_COLORS[play.urgency]}`}>
                        {play.urgency} URGENCY
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${style.badge}`}>
                        {play.type}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 mt-1">{play.strategy} · Exp: {play.expiry} ({play.daysLeft}d)</div>
                  </div>

                  {/* Confidence */}
                  <div className="flex-shrink-0 w-32">
                    <div className="text-xs text-slate-500 mb-1">Setup Confidence</div>
                    <ConfidenceBar val={play.confidence} color={play.confidence >= 70 ? 'bg-green-500' : 'bg-amber-500'} />
                    <div className="text-right text-sm font-bold text-slate-700 mt-0.5">{play.confidence}%</div>
                  </div>
                </div>

                {/* Trade legs */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {play.legs.map((leg, i) => (
                    <div key={i} className={`rounded-lg px-3 py-1.5 text-xs font-semibold border ${
                      leg.action === 'BUY' ? 'bg-green-50 border-green-300 text-green-800' : 'bg-red-50 border-red-300 text-red-800'
                    }`}>
                      {leg.action} {leg.strike} {leg.type} @ ${leg.premium}
                    </div>
                  ))}
                </div>

                {/* P&L metrics */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
                  {[
                    { label: 'Net Cost', value: play.netDebit < 0 ? `+$${Math.abs(play.netDebit)} credit` : `$${play.netDebit} debit`, color: 'text-slate-700' },
                    { label: 'Max Profit', value: typeof play.maxProfit === 'number' ? `$${play.maxProfit}/contract` : play.maxProfit, color: 'text-green-700' },
                    { label: 'Max Loss', value: `$${play.maxLoss}/contract`, color: 'text-red-700' },
                    { label: 'Breakeven', value: `$${play.breakeven}`, color: 'text-blue-700' },
                    { label: 'Risk/Reward', value: play.riskReward, color: 'text-purple-700' },
                  ].map(m => (
                    <div key={m.label} className="bg-white/70 rounded-lg p-2">
                      <div className="text-xs text-slate-500">{m.label}</div>
                      <div className={`font-bold text-sm ${m.color}`}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {play.tags.map(t => (
                    <span key={t} className="text-xs bg-white/80 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">{t}</span>
                  ))}
                </div>

                {/* IV Rank + Expected Move */}
                <div className="flex gap-4 text-xs text-slate-600">
                  <span>📊 IV Rank: <strong className={play.ivRank > 60 ? 'text-red-600' : play.ivRank > 40 ? 'text-amber-600' : 'text-green-600'}>{play.ivRank}</strong></span>
                  <span>📐 Expected Move: ±<strong>{play.expectedMove}%</strong></span>
                  <span>🎯 Risk: <strong className={play.risk === 'Aggressive' ? 'text-red-600' : 'text-blue-600'}>{play.risk}</strong></span>
                </div>

                <div className="text-xs text-rose-600 mt-2 font-semibold">
                  {expanded === play.id ? '▲ Less' : '▼ Full catalyst + thesis'}
                </div>
              </div>

              {/* Expanded catalyst */}
              {expanded === play.id && (
                <div className="border-t border-white/50 p-5 bg-white/60 rounded-b-2xl space-y-3">
                  <h4 className="font-bold text-slate-700 text-sm">🔍 Catalyst & Trade Thesis</h4>
                  <p className="text-sm text-slate-700 leading-relaxed">{play.catalyst}</p>

                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h4 className="font-bold text-slate-700 text-sm mb-2">📊 IV Rank Interpretation</h4>
                    <div className="h-3 bg-slate-200 rounded-full overflow-hidden mb-1">
                      <div className={`h-full rounded-full ${play.ivRank > 60 ? 'bg-red-500' : play.ivRank > 40 ? 'bg-amber-500' : 'bg-green-500'}`}
                        style={{ width: `${play.ivRank}%` }} />
                    </div>
                    <p className="text-xs text-slate-600">
                      {play.ivRank > 60
                        ? `IV Rank ${play.ivRank} = Options are EXPENSIVE. Prefer spreads or selling premium. Avoid buying naked calls.`
                        : play.ivRank > 40
                        ? `IV Rank ${play.ivRank} = Moderate IV. Spreads and defined-risk plays are optimal.`
                        : `IV Rank ${play.ivRank} = Options are CHEAP. Excellent time to buy calls/puts outright. Favorable entry.`}
                    </p>
                  </div>

                  <div className="bg-slate-800 text-white rounded-xl p-4">
                    <h4 className="font-semibold text-sm mb-2">💡 How to Execute This Trade</h4>
                    <ol className="space-y-1 text-xs text-slate-200">
                      {play.legs.length === 1 ? (
                        <>
                          <li>1. Check current price of {play.ticker} and verify it aligns with thesis</li>
                          <li>2. On your broker, go to Options Chain for {play.ticker}</li>
                          <li>3. Select expiry: <strong>{play.expiry}</strong></li>
                          <li>4. {play.legs[0].action} the ${play.legs[0].strike} {play.legs[0].type} (current premium ~${play.legs[0].premium})</li>
                          <li>5. Limit order — never market order options</li>
                          <li>6. Size: 1–3% of portfolio max on aggressive plays</li>
                        </>
                      ) : (
                        <>
                          <li>1. Use your broker's spread order ticket (not individual legs)</li>
                          <li>2. Select expiry: <strong>{play.expiry}</strong></li>
                          {play.legs.map((leg, i) => (
                            <li key={i}>{i+2}. {leg.action} {play.ticker} ${leg.strike} {leg.type} @ ~${leg.premium}</li>
                          ))}
                          <li>{play.legs.length + 2}. Net cost target: ~${Math.abs(play.netDebit)} per spread</li>
                          <li>{play.legs.length + 3}. Use limit order — target mid-price between bid/ask</li>
                        </>
                      )}
                    </ol>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
