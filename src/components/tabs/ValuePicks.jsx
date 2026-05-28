import React, { useState } from 'react'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import { useLivePrices } from '../../hooks/useLivePrices'

// ─── Static fundamentals — prices fetched live ───────────────────────────────
const VALUE_META = [
  {
    ticker: 'MSFT', name: 'Microsoft Corporation', sector: 'Cloud / Enterprise',
    fairValue: 600.00, dividend: 0.82, forwardPE: 28, rating: 'Strong Buy', risk: 'Moderate',
    type: 'Value+Growth', tags: ['Azure Cloud', 'Copilot AI', 'Enterprise'],
    reason: "Microsoft trades ~28% below Morningstar's $600 fair value. Azure growing 28%+ with AI Copilot upsell driving ARPU expansion. The most durable enterprise moat in tech — Office, Azure, Teams, LinkedIn, GitHub. Dividend growing 10%+ annually.",
    score: { Value: 90, Growth: 78, Dividend: 45, Moat: 98, Momentum: 70 },
    bull: ['Azure Copilot adoption driving seat expansion at premium tiers', '28% discount to fair value — institutional buying every dip', 'GitHub Copilot monetizing millions of developers'],
    bear: ['Antitrust scrutiny of OpenAI partnership', 'High absolute multiple vs peers (28× forward)'],
    entry: 'Strong buy below $440. Add on any pullback below $410.',
    stopLoss: 385,
  },
  {
    ticker: 'ABBV', name: 'AbbVie Inc.', sector: 'Pharmaceuticals',
    fairValue: 225.00, dividend: 3.40, forwardPE: 14, rating: 'Strong Buy', risk: 'Moderate',
    type: 'Value+Dividend', tags: ['Pharma', 'Dividend', 'Immunology'],
    reason: 'AbbVie is cheap at 14× forward earnings with a 3.4% yield. Humira biosimilar headwinds are priced in — Skyrizi and Rinvoq growing 50%+ and will fully offset Humira revenue by 2027. Dividend raised 33% over 5 years.',
    score: { Value: 95, Growth: 55, Dividend: 85, Moat: 75, Momentum: 65 },
    bull: ['Skyrizi + Rinvoq pipeline offsetting Humira headwind', 'Cheapest large pharma on forward P/E basis', '52-year dividend growth streak — Dividend King status'],
    bear: ['Humira revenue decline still materializing', 'Pipeline risk on late-stage trials'],
    entry: 'Buy aggressively at current levels. Target 13× → 16× re-rate.',
    stopLoss: 175,
  },
  {
    ticker: 'PFE', name: 'Pfizer Inc.', sector: 'Pharmaceuticals',
    fairValue: 32.00, dividend: 6.60, forwardPE: 9, rating: 'Buy', risk: 'Moderate',
    type: 'Deep Value+Dividend', tags: ['Pharma', 'High Yield', 'Turnaround'],
    reason: 'Pfizer yields 6.6% — well above its 5-year average of 4.5% — and trades 14% below fair value. COVID revenue decline is fully priced. Paxlovid has a durable role. Pipeline includes GLP-1 Danuglipron and oncology assets.',
    score: { Value: 92, Growth: 35, Dividend: 95, Moat: 65, Momentum: 40 },
    bull: ['6.6% dividend yield is very hard to find in large cap', 'GLP-1 oral drug could be a $10B+ opportunity', 'Deep value — 9× forward P/E with recovering earnings'],
    bear: ['Revenue declining post-COVID', 'GLP-1 is a long shot vs Eli Lilly/Novo lead', 'Activist investors creating management uncertainty'],
    entry: 'Accumulate between $26–$28. Income investors love the yield.',
    stopLoss: 23,
  },
  {
    ticker: 'PEP', name: 'PepsiCo Inc.', sector: 'Consumer Staples',
    fairValue: 169.00, dividend: 3.20, forwardPE: 20, rating: 'Buy', risk: 'Moderate',
    type: 'Value+Dividend', tags: ['Consumer Staples', 'Dividend', 'Defensive'],
    reason: 'PepsiCo trades near its $169 fair value. Snacks division (Frito-Lay) is the crown jewel — inelastic demand, 40%+ margins. International growth accelerating especially in emerging markets. Dividend growing at mid-single-digits with 51 consecutive years of increases.',
    score: { Value: 82, Growth: 45, Dividend: 80, Moat: 88, Momentum: 50 },
    bull: ['Frito-Lay snacks have near-zero substitutability', '51-year dividend growth — Dividend King', 'International market share gains in India/LatAm'],
    bear: ['Volume declines in North America beverages', 'Commodity cost inflation risk (corn, packaging)'],
    entry: 'Buy at current levels and on dips to $148–$152.',
    stopLoss: 140,
  },
  {
    ticker: 'JPM', name: 'JPMorgan Chase', sector: 'Financials',
    fairValue: 290.00, dividend: 2.20, forwardPE: 13, rating: 'Strong Buy', risk: 'Moderate',
    type: 'Value+Growth', tags: ['Banking', 'Financials', 'Dividend'],
    reason: 'JPM is the gold standard in global banking. Fortress balance sheet, diversified across IB, consumer, commercial, and wealth management. NIM expansion from higher-for-longer rates. 13× forward P/E with 2.2% dividend and buyback yield of ~3%.',
    score: { Value: 85, Growth: 60, Dividend: 68, Moat: 92, Momentum: 72 },
    bull: ['Investment banking revival as M&A and IPO market rebounds', 'Best risk management in the industry', 'Share buybacks value-accretive at current discount'],
    bear: ['Rate cuts will compress NIM if aggressive', 'Commercial real estate exposure manageable but present'],
    entry: 'Buy current levels. Add on any market-wide pullback.',
    stopLoss: 230,
  },
  {
    ticker: 'XOM', name: 'Exxon Mobil', sector: 'Energy',
    fairValue: 138.00, dividend: 3.60, forwardPE: 12, rating: 'Buy', risk: 'Moderate',
    type: 'Value+Dividend', tags: ['Energy', 'Dividend', 'FCF'],
    reason: "Energy is a leading sector in 2026. Exxon's Pioneer acquisition expanded Permian footprint dramatically, driving structural FCF improvement at any oil price above $50. 3.6% dividend + aggressive buybacks.",
    score: { Value: 88, Growth: 42, Dividend: 82, Moat: 80, Momentum: 78 },
    bull: ['Pioneer acquisition doubled Permian Basin output', 'Energy is leading S&P sector in 2026', 'FCF positive at $50 Brent — high margin of safety'],
    bear: ['Oil price volatility is a systemic risk', 'Energy transition pressuring long-term valuation multiples'],
    entry: 'Buy $115–$120. Sector tailwinds strong in current environment.',
    stopLoss: 105,
  },
  {
    ticker: 'BRK-B', name: 'Berkshire Hathaway B', sector: 'Diversified',
    fairValue: 540.00, dividend: 0, forwardPE: 22, rating: 'Buy', risk: 'Moderate',
    type: 'Value+Balanced', tags: ['Conglomerate', 'Insurance', 'Defensive'],
    reason: 'Berkshire holds $334B+ in cash — the ultimate dry-powder position. Insurance operations (GEICO, Gen Re) printing money. Wholly-owned businesses (BNSF, Berkshire Energy) generate steady FCF. Trading near intrinsic value.',
    score: { Value: 88, Growth: 40, Dividend: 10, Moat: 95, Momentum: 55 },
    bull: ['$334B cash reserve positions Berkshire to buy at market lows', 'Best capital allocator in history — disciplined buybacks', 'Zero chance of bankruptcy — insurance float finances everything'],
    bear: ['No dividend — income investors look elsewhere', 'BNSF facing rail competition pressure'],
    entry: 'Buy any time — this is a buy-and-hold forever position.',
    stopLoss: 455,
  },
]

const TYPE_COLORS = {
  'Value+Growth':        'bg-purple-100 text-purple-800',
  'Value+Dividend':      'bg-teal-100 text-teal-800',
  'Deep Value+Dividend': 'bg-orange-100 text-orange-800',
  'Value+Balanced':      'bg-blue-100 text-blue-800',
}

const TICKERS = VALUE_META.map(p => p.ticker)

// ── shared formatters ─────────────────────────────────────────────────────────
const fmtP = (n) => n != null ? `$${Number(n).toFixed(2)}` : '—'
const fmtC = (n) => n != null ? `${n >= 0 ? '+' : ''}${Number(n).toFixed(2)}%` : '—'
const fmtU = (n) => n != null ? `${n >= 0 ? '+' : ''}${Number(n).toFixed(1)}%` : '—'

// ── LiveStatusBar ─────────────────────────────────────────────────────────────
function LiveBar({ loading, error, lastUpdated, refresh }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
        loading ? 'bg-white/20 text-white/70'
        : error  ? 'bg-red-400/60 text-white'
        :          'bg-green-400/30 text-green-100 border border-green-400/50'
      }`}>
        <span className={`w-2 h-2 rounded-full ${loading ? 'bg-white/50 animate-pulse' : error ? 'bg-red-300' : 'bg-green-300 animate-pulse'}`} />
        {loading ? 'Fetching…' : error ? 'Fallback data' : 'Live prices'}
      </div>
      {lastUpdated && !loading && (
        <span className="text-xs text-teal-200">
          {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
      <button onClick={refresh} disabled={loading}
        className="px-3 py-1.5 rounded-full text-sm font-semibold bg-white/20 hover:bg-white/30 text-white transition-all disabled:opacity-50">
        {loading ? '⟳ …' : '⟳ Refresh'}
      </button>
    </div>
  )
}

export default function ValuePicks() {
  const [selected,   setSelected] = useState(null)
  const [typeFilter, setType]     = useState('All')

  const { prices, loading, lastUpdated, error, refresh } = useLivePrices(TICKERS)

  // Merge live price into each pick
  const picks = VALUE_META.map(p => {
    const live      = prices[p.ticker]
    const livePrice = live?.price   ?? null
    const liveChg   = live?.changePct ?? null
    const discount  = livePrice ? (((p.fairValue - livePrice) / p.fairValue) * 100) : null
    const upside    = livePrice ? (((p.fairValue - livePrice) / livePrice)   * 100) : null
    return { ...p, livePrice, liveChg, discount, upside }
  })

  const types   = ['All', ...new Set(VALUE_META.map(s => s.type))]
  const filtered = picks.filter(s => typeFilter === 'All' || s.type === typeFilter)

  const avgDiscount = picks.filter(p => p.discount != null).reduce((s, p) => s + p.discount, 0) /
                      (picks.filter(p => p.discount != null).length || 1)
  const avgDiv      = picks.filter(p => p.dividend > 0).reduce((s, p) => s + p.dividend, 0) /
                      (picks.filter(p => p.dividend > 0).length || 1)

  // Radar for selected stock
  const radarData = selected
    ? (() => {
        const s = picks.find(x => x.ticker === selected)
        return s ? Object.entries(s.score).map(([k, v]) => ({ subject: k, value: v })) : []
      })()
    : []

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-gradient-to-r from-teal-700 via-emerald-700 to-green-700 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">💎 Value & Balanced Picks</h1>
            <p className="text-teal-200 text-sm mt-1">Undervalued quality · Dividend income · Live prices · May 2026</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <LiveBar loading={loading} error={error} lastUpdated={lastUpdated} refresh={refresh} />
            {types.map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  typeFilter === t ? 'bg-white text-teal-700 shadow' : 'bg-white/20 hover:bg-white/30 text-white'
                }`}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Avg Discount to FV', value: loading ? '…' : `${avgDiscount.toFixed(1)}%`, color: 'text-teal-600', sub: 'vs fair value (live)' },
          { label: 'Avg Dividend Yield',  value: `${avgDiv.toFixed(1)}%`,                       color: 'text-green-600',sub: 'static (annual)' },
          { label: 'Avg Forward P/E',     value: `${(VALUE_META.reduce((a,b)=>a+b.forwardPE,0)/VALUE_META.length).toFixed(0)}×`, color: 'text-blue-600', sub: 'analyst consensus' },
          {
            label: 'Best Upside',
            value: loading ? '…' : (() => {
              const best = picks.filter(p => p.upside != null).sort((a,b) => b.upside - a.upside)[0]
              return best ? `${best.ticker} ${fmtU(best.upside)}` : '—'
            })(),
            color: 'text-purple-600', sub: 'to fair value (live)',
          },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-100 shadow p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">{k.label}</div>
            <div className={`text-xl font-bold mt-1 ${k.color}`}>{k.value}</div>
            <div className="text-xs text-slate-400 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Cards + optional radar */}
      <div className={`grid gap-4 ${selected ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'}`}>

        {selected && radarData.length > 0 && (
          <div className="bg-white rounded-2xl shadow border border-slate-100 p-5">
            <h3 className="font-bold text-slate-700 mb-1">{selected} — Quality Radar</h3>
            <p className="text-xs text-slate-400 mb-3">Multi-factor score (0–100)</p>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <Radar dataKey="value" stroke="#0d9488" fill="#0d9488" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
            {/* Live quote tile in radar panel */}
            {(() => {
              const p = picks.find(x => x.ticker === selected)
              return p?.livePrice ? (
                <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                  {[
                    { l: 'Live Price', v: fmtP(p.livePrice), c: 'text-slate-800' },
                    { l: 'Today',      v: fmtC(p.liveChg),   c: (p.liveChg ?? 0) >= 0 ? 'text-green-600' : 'text-red-500' },
                    { l: 'Fair Value', v: fmtP(p.fairValue),  c: 'text-teal-600' },
                    { l: 'Upside',     v: fmtU(p.upside),     c: (p.upside ?? 0) >= 0 ? 'text-green-600' : 'text-red-500' },
                  ].map(m => (
                    <div key={m.l} className="bg-slate-50 rounded-lg p-2">
                      <div className="text-slate-400">{m.l}</div>
                      <div className={`font-bold ${m.c}`}>{m.v}</div>
                    </div>
                  ))}
                </div>
              ) : null
            })()}
          </div>
        )}

        <div className={`space-y-4 ${selected ? 'md:col-span-2' : ''}`}>
          {filtered.map(stock => (
            <div key={stock.ticker}
              className={`bg-white rounded-2xl shadow border-2 transition-all cursor-pointer hover:shadow-lg ${
                selected === stock.ticker ? 'border-teal-500' : 'border-slate-100'
              }`}
              onClick={() => setSelected(selected === stock.ticker ? null : stock.ticker)}>

              <div className="p-5">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xl font-black text-slate-800">{stock.ticker}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${TYPE_COLORS[stock.type] || 'bg-slate-100 text-slate-600'}`}>
                        {stock.type}
                      </span>
                    </div>
                    <div className="text-sm text-slate-500">{stock.name} · {stock.sector}</div>

                    {/* Metrics row */}
                    <div className="flex flex-wrap gap-3 mt-3 text-center">
                      {[
                        { l: 'Live Price',  v: loading && !stock.livePrice ? '…' : fmtP(stock.livePrice), c: 'text-slate-800' },
                        { l: 'Today',       v: loading && !stock.liveChg  ? '…' : fmtC(stock.liveChg),   c: (stock.liveChg ?? 0) >= 0 ? 'text-green-600' : 'text-red-500' },
                        { l: 'Fair Value',  v: fmtP(stock.fairValue),  c: 'text-teal-600' },
                        { l: 'Discount',    v: loading && stock.discount == null ? '…' : stock.discount != null ? `${stock.discount >= 0 ? '-' : '+'}${Math.abs(stock.discount).toFixed(1)}%` : '—', c: (stock.discount ?? 0) >= 0 ? 'text-green-600' : 'text-red-500' },
                        { l: 'Upside',      v: loading && stock.upside == null ? '…' : fmtU(stock.upside), c: (stock.upside ?? 0) >= 0 ? 'text-green-600' : 'text-red-500' },
                        ...(stock.dividend > 0 ? [{ l: 'Div Yield', v: `${stock.dividend}%`, c: 'text-blue-600' }] : []),
                        { l: 'Fwd P/E',     v: `${stock.forwardPE}×`, c: 'text-slate-600' },
                      ].map(m => (
                        <div key={m.l}>
                          <div className="text-xs text-slate-400">{m.l}</div>
                          <div className={`font-bold text-sm ${m.c}`}>{m.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Discount badge */}
                  <div className="flex-shrink-0 text-center">
                    {stock.discount != null ? (
                      <span className={`text-sm font-bold px-3 py-1.5 rounded-full block ${
                        stock.discount >= 20 ? 'bg-green-100 text-green-700'
                        : stock.discount >= 10 ? 'bg-teal-100 text-teal-700'
                        : stock.discount >= 0  ? 'bg-blue-50 text-blue-600'
                        : 'bg-red-50 text-red-600'
                      }`}>
                        {stock.discount >= 20 ? '🔥 Deep Value'
                        : stock.discount >= 10 ? '💎 Undervalued'
                        : stock.discount >= 0  ? '📊 Fair Price'
                        : '⚠️ Above FV'}
                      </span>
                    ) : (
                      <div className="h-8 w-24 bg-slate-100 rounded-full animate-pulse" />
                    )}
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mt-3">
                  {stock.tags.map(t => (
                    <span key={t} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>

                {/* Upside bar */}
                {stock.livePrice && (
                  <div className="mt-3">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500 rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, Math.max(0, (stock.discount ?? 0) * 3))}%` }} />
                    </div>
                  </div>
                )}

                <p className="text-xs text-slate-600 leading-relaxed mt-3 line-clamp-2">{stock.reason}</p>
                <div className="text-xs text-teal-600 mt-1.5 font-semibold">
                  {selected === stock.ticker ? '▲ Collapse' : '▼ Full analysis + radar'}
                </div>
              </div>

              {/* Expanded */}
              {selected === stock.ticker && (
                <div className="border-t border-slate-100 p-5 space-y-4 bg-slate-50 rounded-b-2xl">
                  <p className="text-sm text-slate-700 leading-relaxed">{stock.reason}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-bold text-green-700 mb-1.5">✅ BULL CASE</div>
                      {stock.bull.map((b, i) => (
                        <div key={i} className="text-xs text-slate-600 flex gap-1.5 mb-1"><span className="text-green-500">•</span> {b}</div>
                      ))}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-red-700 mb-1.5">⚠️ RISKS</div>
                      {stock.bear.map((b, i) => (
                        <div key={i} className="text-xs text-slate-600 flex gap-1.5 mb-1"><span className="text-red-400">•</span> {b}</div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-xl border border-teal-200 p-3">
                      <div className="text-xs font-bold text-slate-600 mb-1">📍 Entry</div>
                      <div className="text-xs text-slate-700">{stock.entry}</div>
                    </div>
                    <div className="bg-white rounded-xl border border-red-200 p-3">
                      <div className="text-xs font-bold text-slate-600 mb-1">🛑 Stop Loss</div>
                      <div className="text-xs text-slate-700">
                        Stop at <strong className="text-red-600">${stock.stopLoss}</strong>
                        {stock.livePrice && (
                          <span className="text-slate-400"> ({(((stock.stopLoss - stock.livePrice)/stock.livePrice)*100).toFixed(1)}% from live)</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Dividend yield bar chart */}
      <div className="bg-white rounded-2xl shadow border border-slate-100 p-5">
        <h2 className="font-bold text-slate-700 text-lg mb-4">Dividend Yield Comparison</h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={VALUE_META.filter(s => s.dividend > 0)} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="ticker" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
            <Tooltip formatter={v => [`${v}%`, 'Dividend Yield']} />
            <Bar dataKey="dividend" radius={[4,4,0,0]}>
              {VALUE_META.filter(s => s.dividend > 0).map((s, i) => (
                <Cell key={i} fill={s.dividend > 5 ? '#0d9488' : s.dividend > 3 ? '#14b8a6' : '#5eead4'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
        <strong>⚡ Disclaimer:</strong> Prices refresh every 60 seconds via Yahoo Finance / Stooq / CNBC.
        Fair value estimates from Morningstar and analyst consensus as of May 2026. NOT financial advice.
      </div>
    </div>
  )
}
