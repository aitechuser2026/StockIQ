import React, { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useLivePrices } from '../../hooks/useLivePrices'

// ─── Static fundamentals (analyst targets, thesis, ratings) ──────────────────
// Live prices are fetched from Yahoo Finance via priceService on mount + every 60s
const PICKS_META = [
  {
    ticker: 'NVDA',
    name: 'NVIDIA Corporation',
    sector: 'Semiconductors',
    target: 295.34,
    rating: 'Strong Buy',
    ratingCount: 61,
    risk: 'Aggressive',
    momentum: 'VERY HIGH',
    revenueGrowth: 61,
    tags: ['AI Infrastructure', 'Data Center', 'GPUs'],
    reason: 'Dominant GPU supplier for AI workloads. H100/H200/B200 chips command 80%+ data center AI market share. FY2027 revenue projected +61% YoY. Blackwell architecture ramp is a multi-year catalyst. CUDA software moat makes switching costs near-impossible.',
    bull: ['Blackwell GPU demand exceeds supply into 2027', 'Data center revenue scaling exponentially', 'Software moat via CUDA ecosystem — near-impossible to replicate'],
    bear: ['Rich valuation at 35× forward earnings', 'China export restrictions could cap TAM', 'AMD/Intel competition intensifying'],
    entry: 'Buy dips to $200–$210 zone. Strong support at 50-day MA.',
    stopLoss: 185,
  },
  {
    ticker: 'META',
    name: 'Meta Platforms',
    sector: 'Social / AI',
    target: 826.60,
    rating: 'Strong Buy',
    ratingCount: 63,
    risk: 'Moderate',
    momentum: 'VERY HIGH',
    revenueGrowth: 26,
    tags: ['AI Advertising', 'VR/AR', 'Social Media'],
    reason: "META's Llama AI models are powering ad targeting improvements that drove 33% revenue growth in Q1 2026. 26% revenue growth projected for full year 2026. Family DAP hit new records. Valuation at ~24× forward earnings is reasonable for the growth profile.",
    bull: ['AI-enhanced ads driving massive ARPU growth', 'WhatsApp monetization still early innings', 'Reality Labs VR headset gaining enterprise traction'],
    bear: ['Regulatory antitrust risk in EU and US', 'Teen engagement declining in core markets', 'Heavy AI capex compressing near-term margins'],
    entry: 'Current levels attractive. Add aggressively on any pullback to $560–$580.',
    stopLoss: 535,
  },
  {
    ticker: 'AVGO',
    name: 'Broadcom Inc.',
    sector: 'Semiconductors',
    target: 260.00,
    rating: 'Strong Buy',
    ratingCount: 38,
    risk: 'Moderate',
    momentum: 'HIGH',
    revenueGrowth: 64,
    tags: ['Custom AI Chips', 'Networking', 'VMware'],
    reason: 'AI semiconductor revenue grew 106% in FY2025. Custom AI ASIC chips for Google TPU and Meta MTIA are a massive TAM — analysts project AI chip run-rate hitting $100B by 2027. VMware acquisition adding $4B+ annual FCF.',
    bull: ['Custom ASIC is hyperscaler-preferred alternative to NVDA', 'VMware integration unlocking enterprise cross-sell', 'Best-in-class networking silicon for AI clusters'],
    bear: ['Concentration risk — top 3 customers = 50%+ revenue', 'Integration risk from VMware acquisition'],
    entry: 'Buy between $185–$200. Strong FCF support.',
    stopLoss: 170,
  },
  {
    ticker: 'GOOGL',
    name: 'Alphabet Inc.',
    sector: 'Cloud / AI',
    target: 230.00,
    rating: 'Strong Buy',
    ratingCount: 55,
    risk: 'Moderate',
    momentum: 'HIGH',
    revenueGrowth: 15,
    tags: ['Cloud', 'Search AI', 'YouTube'],
    reason: 'Gemini AI integration across Search, YouTube, and GCP accelerates. Google Cloud growing 28%+ YoY. Trading at a discount to peers at ~21× forward earnings. AI Overviews in Search adding engagement without cannibilzing ads.',
    bull: ['Gemini 2.0 competitive with GPT-4o', 'Cloud growing 28% with margin expansion', 'Deep Search monetization moat'],
    bear: ['DOJ antitrust breakup risk (Chrome/Search)', 'AI Overviews could reduce paid click volume'],
    entry: 'Strong buy here and on any dip to $165–$170.',
    stopLoss: 155,
  },
  {
    ticker: 'CRDO',
    name: 'Credo Technology',
    sector: 'AI Networking',
    target: 105.00,
    rating: 'Strong Buy',
    ratingCount: 18,
    risk: 'Aggressive',
    momentum: 'VERY HIGH',
    revenueGrowth: 202,
    tags: ['Active Electrical Cables', 'AI Networking', 'Small Cap'],
    reason: 'Explosive 202% YoY revenue growth in Q3 FY2026. Credo\'s AEC technology is the critical last-mile connection inside AI data centers, replacing expensive optical transceivers. Microsoft and Amazon are key customers.',
    bull: ['202% revenue growth — fastest in the sector', 'AEC technology replacing optical in short-reach AI clusters', 'Sole supplier to major hyperscalers for this use case'],
    bear: ['Small-cap, high-beta — volatility risk', 'Customer concentration in 2–3 hyperscalers', 'Competition from Marvell and InPhi emerging'],
    entry: 'Buy at current levels or on pullbacks to $65. High conviction.',
    stopLoss: 58,
  },
  {
    ticker: 'ALAB',
    name: 'Astera Labs',
    sector: 'AI Infrastructure',
    target: 130.00,
    rating: 'Buy',
    ratingCount: 22,
    risk: 'Aggressive',
    momentum: 'HIGH',
    revenueGrowth: 93,
    tags: ['PCIe Retimers', 'AI Infrastructure', 'Small Cap'],
    reason: '93% YoY revenue growth with $308M last quarter. Astera Labs makes the PCIe and CXL connectivity chips that wire together CPUs and GPUs in AI servers. ARIES retimers are design-wins in every major AI server platform including NVDA DGX.',
    bull: ['Every NVDA GPU cluster needs ARIES retimers', 'CXL memory connectivity is the next growth vector', 'Approaching profitability — FCF inflection point'],
    bear: ['Niche product — addressable market is narrower', 'NVDA could vertically integrate this function'],
    entry: 'Accumulate between $85–$95. Strong momentum.',
    stopLoss: 75,
  },
  {
    ticker: 'PLTR',
    name: 'Palantir Technologies',
    sector: 'AI/Data Analytics',
    target: 145.00,
    rating: 'Buy',
    ratingCount: 30,
    risk: 'Aggressive',
    momentum: 'HIGH',
    revenueGrowth: 35,
    tags: ['AIP Platform', 'Government AI', 'Commercial AI'],
    reason: 'AIP (AI Platform) is converting enterprise data into actionable intelligence — sales cycle compressed dramatically. US commercial revenue grew 71% in Q4 2025. Government contracts with DoD expanding. Only profitable pure-play enterprise AI platform.',
    bull: ['AIP boot camps driving explosive commercial deal velocity', 'Government AI spending expanding dramatically', 'Only profitable pure-play enterprise AI platform'],
    bear: ['Expensive at 90× forward earnings', 'Government contract concentration risk', 'CEO stock sales creating negative headlines'],
    entry: 'Buy on pullbacks to $105–$110.',
    stopLoss: 95,
  },
  {
    ticker: 'CRWV',
    name: 'CoreWeave',
    sector: 'AI Cloud',
    target: 90.00,
    rating: 'Buy',
    ratingCount: 12,
    risk: 'Aggressive',
    momentum: 'HIGH',
    revenueGrowth: 420,
    tags: ['GPU Cloud', 'AI Infrastructure', 'Recent IPO'],
    reason: 'Pure-play AI cloud infrastructure. Grew from $16M (2022) to $5.1B (2025) revenue. Customers include OpenAI, Microsoft, Meta, and NVDA. Sits at the intersection of AI training demand and cloud computing supply.',
    bull: ['OpenAI is a major customer — near-monopoly on top AI lab workloads', 'Hyperscalers cannot build GPU capacity fast enough', 'Revenue visibility via multi-year contracts'],
    bear: ['Enormous capex requirements — debt-heavy balance sheet', 'Hyperscalers building competing internal capacity', 'Profitability is years away'],
    entry: 'Speculative entry only. Small position. Buy $60–$65.',
    stopLoss: 52,
  },
]

const TICKERS = PICKS_META.map(p => p.ticker)
const RISK_COLORS  = { Moderate: 'bg-blue-100 text-blue-800', Aggressive: 'bg-red-100 text-red-800' }
const MOM_COLORS   = { HIGH: 'bg-amber-100 text-amber-700', 'VERY HIGH': 'bg-green-100 text-green-700' }

export default function GrowthPicks() {
  const [selected,   setSelected]   = useState(null)
  const [sortBy,     setSortBy]     = useState('upside')
  const [riskFilter, setRisk]       = useState('All')

  const { prices, loading, lastUpdated, error, refresh } = useLivePrices(TICKERS)

  // Merge live price into each pick
  const picks = PICKS_META.map(p => {
    const live      = prices[p.ticker]
    const livePrice = live?.price   ?? null
    const liveChg   = live?.changePct ?? null
    const upside    = livePrice ? (((p.target - livePrice) / livePrice) * 100) : null
    return { ...p, livePrice, liveChg, upside }
  })

  const filtered = picks
    .filter(s => riskFilter === 'All' || s.risk === riskFilter)
    .sort((a, b) => {
      if (sortBy === 'upside')        return (b.upside ?? -999) - (a.upside ?? -999)
      if (sortBy === 'revenueGrowth') return b.revenueGrowth - a.revenueGrowth
      if (sortBy === 'change')        return (b.liveChg ?? -999) - (a.liveChg ?? -999)
      return 0
    })

  const avgUpside = picks.filter(p => p.upside !== null).reduce((s, p) => s + p.upside, 0) /
                    (picks.filter(p => p.upside !== null).length || 1)

  const chartData = filtered.map(s => ({
    ticker: s.ticker,
    growth: s.revenueGrowth,
    upside: s.upside !== null ? +s.upside.toFixed(1) : 0,
  }))

  const fmtPrice = (n) => n != null ? `$${n < 10 ? n.toFixed(3) : n < 100 ? n.toFixed(2) : n.toFixed(2)}` : '—'
  const fmtChg   = (n) => n != null ? `${n >= 0 ? '+' : ''}${n.toFixed(2)}%` : '—'
  const fmtUp    = (n) => n != null ? `${n >= 0 ? '+' : ''}${n.toFixed(1)}%` : '—'

  return (
    <div className="space-y-4 md:space-y-6">

      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-violet-700 via-purple-700 to-indigo-700 rounded-2xl p-4 md:p-6 text-white shadow-lg">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-lg md:text-2xl font-bold flex items-center gap-2">🚀 Growth & Momentum</h1>
              <p className="text-violet-200 text-xs md:text-sm mt-0.5">
                AI-era leaders · Live prices · Analyst targets · May 2026
              </p>
            </div>
            {/* Live badge + refresh */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${
                loading ? 'bg-white/20 text-white/70' :
                error   ? 'bg-red-400/60 text-white'  :
                          'bg-green-400/30 text-green-100 border border-green-400/50'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-white/50 animate-pulse' : error ? 'bg-red-300' : 'bg-green-300 animate-pulse'}`} />
                {loading ? 'Loading…' : error ? 'Cached' : 'Live'}
              </div>
              <button onClick={refresh} disabled={loading}
                className="px-2 py-1 rounded-full text-xs font-semibold bg-white/20 hover:bg-white/30 text-white transition-all disabled:opacity-50">
                ⟳
              </button>
            </div>
          </div>

          {/* Controls row — scrollable on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="bg-white/20 text-white border border-white/30 rounded-lg px-2 py-1.5 text-xs flex-shrink-0">
              <option value="upside">↑ Upside %</option>
              <option value="revenueGrowth">↑ Rev Growth</option>
              <option value="change">↑ Today %</option>
            </select>
            <select value={riskFilter} onChange={e => setRisk(e.target.value)}
              className="bg-white/20 text-white border border-white/30 rounded-lg px-2 py-1.5 text-xs flex-shrink-0">
              <option value="All">All Risk</option>
              <option value="Moderate">Moderate</option>
              <option value="Aggressive">Aggressive</option>
            </select>
            {lastUpdated && !loading && (
              <span className="text-[10px] text-violet-300 whitespace-nowrap flex-shrink-0">
                {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Avg Analyst Upside',
            value: loading ? '…' : fmtUp(avgUpside),
            color: 'text-green-600',
            sub: 'vs live price',
          },
          {
            label: 'Best Today',
            value: loading ? '…' : (() => {
              const best = picks.filter(p => p.liveChg !== null).sort((a,b) => b.liveChg - a.liveChg)[0]
              return best ? `${best.ticker} ${fmtChg(best.liveChg)}` : '—'
            })(),
            color: 'text-emerald-600',
            sub: 'top daily mover',
          },
          {
            label: 'Most Upside',
            value: loading ? '…' : (() => {
              const best = picks.filter(p => p.upside !== null).sort((a,b) => b.upside - a.upside)[0]
              return best ? `${best.ticker} ${fmtUp(best.upside)}` : '—'
            })(),
            color: 'text-purple-600',
            sub: 'to analyst target',
          },
          {
            label: 'Picks Loaded',
            value: loading ? `0/${TICKERS.length}` : `${Object.keys(prices).length}/${TICKERS.length}`,
            color: 'text-blue-600',
            sub: 'live data',
          },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-100 shadow p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">{k.label}</div>
            <div className={`text-xl font-bold mt-1 ${k.color}`}>{k.value}</div>
            <div className="text-xs text-slate-400 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Loading skeleton ── */}
      {loading && Object.keys(prices).length === 0 && (
        <div className="bg-white rounded-2xl shadow border border-slate-100 p-8 text-center">
          <div className="text-3xl mb-3 animate-bounce">📡</div>
          <div className="text-slate-600 font-semibold">Fetching live prices for {TICKERS.join(', ')}…</div>
          <div className="text-xs text-slate-400 mt-1">Using Yahoo Finance · Stooq · CNBC (fastest source wins)</div>
          <div className="mt-4 flex justify-center gap-1">
            {TICKERS.map(t => (
              <div key={t} className="h-2 w-8 bg-slate-200 rounded animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {/* ── Charts ── */}
      {!loading || Object.keys(prices).length > 0 ? (
        <div className="bg-white rounded-2xl shadow border border-slate-100 p-5">
          <h2 className="font-bold text-slate-700 text-lg mb-1">Analyst Upside vs Revenue Growth</h2>
          <p className="text-xs text-slate-400 mb-4">Upside % calculated from <strong>live price</strong> to analyst consensus target</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-semibold text-slate-600 mb-2">Analyst Price Target Upside (%) — Live</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="ticker" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(v, n) => [`${v}%`, 'Upside to target']} />
                  <Bar dataKey="upside" radius={[4,4,0,0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.upside > 40 ? '#059669' : d.upside > 20 ? '#10b981' : d.upside > 0 ? '#6ee7b7' : '#f87171'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-600 mb-2">Revenue Growth YoY (%)</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="ticker" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Rev Growth']} />
                  <Bar dataKey="growth" radius={[4,4,0,0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.growth > 100 ? '#7c3aed' : d.growth > 30 ? '#6366f1' : '#a5b4fc'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Stock cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(stock => {
          const hasLive = stock.livePrice !== null
          const isDown  = stock.liveChg !== null && stock.liveChg < 0
          const upsideOk = stock.upside !== null && stock.upside > 0

          return (
            <div key={stock.ticker}
              className={`bg-white rounded-2xl shadow border-2 transition-all cursor-pointer hover:shadow-lg ${
                selected === stock.ticker ? 'border-violet-500' : 'border-slate-100'
              }`}
              onClick={() => setSelected(selected === stock.ticker ? null : stock.ticker)}>

              <div className="p-5">
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-2xl font-black text-slate-800">{stock.ticker}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${RISK_COLORS[stock.risk]}`}>
                        {stock.risk}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${MOM_COLORS[stock.momentum]}`}>
                        ⚡ {stock.momentum}
                      </span>
                    </div>
                    <div className="text-sm text-slate-500 mt-0.5">{stock.name}</div>
                    <div className="text-xs text-slate-400">{stock.sector}</div>
                  </div>

                  {/* Live price block */}
                  <div className="text-right flex-shrink-0">
                    {loading && !hasLive ? (
                      <div className="space-y-1.5">
                        <div className="h-7 w-20 bg-slate-200 rounded animate-pulse" />
                        <div className="h-4 w-16 bg-slate-100 rounded animate-pulse ml-auto" />
                      </div>
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-slate-800">
                          {fmtPrice(stock.livePrice)}
                        </div>
                        <div className={`text-sm font-semibold ${isDown ? 'text-red-500' : 'text-green-600'}`}>
                          {isDown ? '▼' : '▲'} {fmtChg(stock.liveChg)} today
                        </div>
                        <div className={`text-xs font-semibold mt-0.5 ${upsideOk ? 'text-green-600' : 'text-red-500'}`}>
                          {upsideOk ? '▲' : '▼'} {fmtUp(stock.upside)} to target
                        </div>
                        <div className="text-xs text-slate-400">Target: ${stock.target}</div>
                      </>
                    )}
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {stock.tags.map(t => (
                    <span key={t} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>

                {/* Metrics row */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-violet-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-slate-500">Rev Growth</div>
                    <div className="font-bold text-violet-700">+{stock.revenueGrowth}%</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-slate-500">Rating</div>
                    <div className="font-bold text-green-700 text-xs leading-tight">{stock.rating}</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-slate-500">Analysts</div>
                    <div className="font-bold text-blue-700">{stock.ratingCount}</div>
                  </div>
                </div>

                {/* Upside progress bar — live */}
                {hasLive && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Live: {fmtPrice(stock.livePrice)}</span>
                      <span>Target: ${stock.target} ({fmtUp(stock.upside)})</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          upsideOk
                            ? 'bg-gradient-to-r from-violet-500 to-green-500'
                            : 'bg-gradient-to-r from-red-400 to-orange-400'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, upsideOk ? (stock.upside ?? 0) * 1.5 : 10))}%` }}
                      />
                    </div>
                  </div>
                )}

                <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{stock.reason}</p>

                <div className="text-xs text-violet-600 mt-2 font-semibold">
                  {selected === stock.ticker ? '▲ Less detail' : '▼ Full analysis'}
                </div>
              </div>

              {/* ── Expanded section ── */}
              {selected === stock.ticker && (
                <div className="border-t border-slate-100 p-5 space-y-4 bg-slate-50 rounded-b-2xl">
                  <p className="text-sm text-slate-700 leading-relaxed">{stock.reason}</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-bold text-green-700 mb-1.5">✅ BULL CASE</div>
                      <ul className="space-y-1">
                        {stock.bull.map((b, i) => (
                          <li key={i} className="text-xs text-slate-600 flex gap-1.5">
                            <span className="text-green-500 flex-shrink-0">•</span> {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-red-700 mb-1.5">⚠️ BEAR / RISK</div>
                      <ul className="space-y-1">
                        {stock.bear.map((b, i) => (
                          <li key={i} className="text-xs text-slate-600 flex gap-1.5">
                            <span className="text-red-400 flex-shrink-0">•</span> {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-white rounded-xl border border-green-200 p-3">
                      <div className="text-xs font-bold text-slate-600 mb-1">📍 Entry Strategy</div>
                      <div className="text-xs text-slate-700">{stock.entry}</div>
                    </div>
                    <div className="bg-white rounded-xl border border-red-200 p-3">
                      <div className="text-xs font-bold text-slate-600 mb-1">🛑 Stop Loss</div>
                      <div className="text-xs text-slate-700">
                        Hard stop at{' '}
                        <strong className="text-red-600">${stock.stopLoss}</strong>
                        {hasLive && stock.livePrice && (
                          <span className="text-slate-500">
                            {' '}({(((stock.stopLoss - stock.livePrice) / stock.livePrice) * 100).toFixed(1)}% from current)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Live price detail card */}
                  {hasLive && (
                    <div className="bg-white rounded-xl border border-violet-200 p-3">
                      <div className="text-xs font-bold text-slate-600 mb-2">📊 Live Quote — {stock.ticker}</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                        <div>
                          <div className="text-xs text-slate-400">Last Price</div>
                          <div className="font-bold text-slate-800">{fmtPrice(stock.livePrice)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Today</div>
                          <div className={`font-bold ${(stock.liveChg ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {fmtChg(stock.liveChg)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Analyst Target</div>
                          <div className="font-bold text-blue-600">${stock.target}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Upside to Target</div>
                          <div className={`font-bold ${upsideOk ? 'text-green-600' : 'text-red-500'}`}>
                            {fmtUp(stock.upside)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Disclaimer ── */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
        <strong>⚡ Disclaimer:</strong> Prices update every 60 seconds via Yahoo Finance / Stooq / CNBC.
        Analyst targets from public consensus as of May 2026. This is NOT financial advice.
        Always do your own due diligence and size positions according to your risk tolerance.
      </div>
    </div>
  )
}
