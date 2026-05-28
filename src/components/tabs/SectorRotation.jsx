import React, { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, ReferenceLine } from 'recharts'
import { useLivePrices } from '../../hooks/useLivePrices'

// ─── Sector metadata (YTD / momentum sourced from State Street May 2026) ──────
const SECTORS = [
  { name: 'Technology',       etf: 'XLK',  ytd: 18.2,  mom1: 3.1,  mom3: 8.4,  phase: 'Lagging',   signal: 'NEUTRAL', weight: 32.1, top: ['NVDA','MSFT','AAPL'],   color: '#6366f1' },
  { name: 'Semiconductors',   etf: 'SOXX', ytd: 31.5,  mom1: 7.2,  mom3: 18.1, phase: 'Leading',   signal: 'BUY',     weight: 9.8,  top: ['NVDA','AVGO','AMD'],    color: '#7c3aed' },
  { name: 'Energy',           etf: 'XLE',  ytd: 22.4,  mom1: 5.8,  mom3: 11.2, phase: 'Leading',   signal: 'BUY',     weight: 4.0,  top: ['XOM','CVX','SLB'],      color: '#f59e0b' },
  { name: 'Industrials',      etf: 'XLI',  ytd: 14.8,  mom1: 2.9,  mom3: 6.7,  phase: 'Leading',   signal: 'BUY',     weight: 8.5,  top: ['RTX','HON','UPS'],      color: '#0ea5e9' },
  { name: 'Consumer Staples', etf: 'XLP',  ytd: 9.2,   mom1: 1.8,  mom3: 4.1,  phase: 'Leading',   signal: 'HOLD',    weight: 5.8,  top: ['PEP','KO','COST'],      color: '#10b981' },
  { name: 'Materials',        etf: 'XLB',  ytd: 11.6,  mom1: 3.4,  mom3: 7.8,  phase: 'Leading',   signal: 'HOLD',    weight: 2.5,  top: ['LIN','APD','FCX'],      color: '#84cc16' },
  { name: 'Healthcare',       etf: 'XLV',  ytd: 7.4,   mom1: 0.8,  mom3: 2.1,  phase: 'Weakening', signal: 'HOLD',    weight: 12.3, top: ['LLY','UNH','ABBV'],     color: '#22d3ee' },
  { name: 'Financials',       etf: 'XLF',  ytd: 5.1,   mom1: -0.9, mom3: 1.2,  phase: 'Lagging',   signal: 'NEUTRAL', weight: 13.2, top: ['JPM','BAC','WFC'],      color: '#f97316' },
  { name: 'Comm. Services',   etf: 'XLC',  ytd: 12.8,  mom1: 2.1,  mom3: 5.6,  phase: 'Lagging',   signal: 'NEUTRAL', weight: 8.9,  top: ['META','GOOGL','NFLX'],  color: '#ec4899' },
  { name: 'Consumer Disc.',   etf: 'XLY',  ytd: -2.3,  mom1: -3.2, mom3: -5.8, phase: 'Lagging',   signal: 'AVOID',   weight: 10.5, top: ['AMZN','TSLA','NKE'],    color: '#ef4444' },
  { name: 'Real Estate',      etf: 'XLRE', ytd: -4.1,  mom1: -2.8, mom3: -6.2, phase: 'Lagging',   signal: 'AVOID',   weight: 2.2,  top: ['AMT','PLD','SPG'],      color: '#dc2626' },
  { name: 'Utilities',        etf: 'XLU',  ytd: 6.8,   mom1: 1.2,  mom3: 3.4,  phase: 'Weakening', signal: 'HOLD',    weight: 2.5,  top: ['NEE','DUK','SO'],       color: '#64748b' },
]

const ETF_TICKERS = SECTORS.map(s => s.etf)

const PHASE_STYLES = {
  Leading:   { badge: 'bg-green-100 text-green-800',  dot: 'bg-green-500' },
  Lagging:   { badge: 'bg-red-100 text-red-700',      dot: 'bg-red-500' },
  Weakening: { badge: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500' },
}
const SIGNAL_COLORS = {
  BUY:     'bg-green-600 text-white',
  HOLD:    'bg-blue-100 text-blue-800',
  NEUTRAL: 'bg-slate-200 text-slate-700',
  AVOID:   'bg-red-600 text-white',
}
const CLOCK_POSITIONS = {
  Leading:   { x: 65, y: 35 },
  Weakening: { x: 65, y: 65 },
  Lagging:   { x: 35, y: 65 },
  Improving: { x: 35, y: 35 },
}

const fmtP = (n) => n != null ? `$${Number(n).toFixed(2)}` : '—'
const fmtC = (n) => n != null ? `${n >= 0 ? '+' : ''}${Number(n).toFixed(2)}%` : '—'

function LiveBar({ loading, error, lastUpdated, refresh }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
        loading ? 'bg-white/20 text-white/70'
        : error  ? 'bg-red-400/60 text-white'
        :          'bg-green-400/30 text-green-100 border border-green-400/50'
      }`}>
        <span className={`w-2 h-2 rounded-full ${loading ? 'bg-white/50 animate-pulse' : error ? 'bg-red-300' : 'bg-green-300 animate-pulse'}`} />
        {loading ? 'Fetching…' : error ? 'Fallback' : 'Live ETF prices'}
      </div>
      {lastUpdated && !loading && (
        <span className="text-xs text-sky-200">{lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      )}
      <button onClick={refresh} disabled={loading}
        className="px-3 py-1.5 rounded-full text-sm font-semibold bg-white/20 hover:bg-white/30 text-white disabled:opacity-50">
        {loading ? '⟳ …' : '⟳ Refresh'}
      </button>
    </div>
  )
}

export default function SectorRotation() {
  const [sortBy, setSortBy] = useState('ytd')
  const [view,   setView]   = useState('table')

  const { prices, loading, lastUpdated, error, refresh } = useLivePrices(ETF_TICKERS)

  // Merge live prices into sector data
  const sectors = SECTORS.map(s => {
    const live = prices[s.etf]
    return { ...s, livePrice: live?.price ?? null, liveChg: live?.changePct ?? null }
  })

  const sorted = [...sectors].sort((a, b) => {
    if (sortBy === 'liveChg') return (b.liveChg ?? -999) - (a.liveChg ?? -999)
    return b[sortBy] - a[sortBy]
  })

  const chartData = sorted.map(s => ({
    name: s.etf, ytd: s.ytd, mom1: s.mom1, mom3: s.mom3,
    liveChg: s.liveChg != null ? +s.liveChg.toFixed(2) : null,
  }))

  const bestToday  = sectors.filter(s => s.liveChg != null).sort((a,b) => b.liveChg - a.liveChg)[0]
  const worstToday = sectors.filter(s => s.liveChg != null).sort((a,b) => a.liveChg - b.liveChg)[0]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-700 via-sky-700 to-blue-700 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">🔄 Sector Rotation Tracker</h1>
            <p className="text-cyan-200 text-sm mt-1">Live ETF prices · S&P 500 sector momentum · May 2026</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <LiveBar loading={loading} error={error} lastUpdated={lastUpdated} refresh={refresh} />
            {['table','chart'].map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  view === v ? 'bg-white text-sky-700 shadow' : 'bg-white/20 hover:bg-white/30 text-white'
                }`}>{v === 'table' ? '📋 Grid' : '📊 Chart'}</button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Leading Sectors',    value: sectors.filter(s=>s.phase==='Leading').length,  color: 'text-green-600',  sub: sectors.filter(s=>s.phase==='Leading').map(s=>s.etf).join(', ') },
          { label: 'Lagging Sectors',    value: sectors.filter(s=>s.phase==='Lagging').length,  color: 'text-red-600',    sub: sectors.filter(s=>s.phase==='Lagging').map(s=>s.etf).join(', ') },
          { label: 'Best Today (Live)',  value: loading ? '…' : bestToday  ? `${bestToday.etf} ${fmtC(bestToday.liveChg)}`  : '—', color: 'text-green-600',  sub: 'live daily change' },
          { label: 'Worst Today (Live)', value: loading ? '…' : worstToday ? `${worstToday.etf} ${fmtC(worstToday.liveChg)}` : '—', color: 'text-red-600',    sub: 'live daily change' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-100 shadow p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">{k.label}</div>
            <div className={`text-xl font-bold mt-1 ${k.color}`}>{k.value}</div>
            <div className="text-xs text-slate-400 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Rotation Clock */}
      <div className="bg-white rounded-2xl shadow border border-slate-100 p-5">
        <h2 className="font-bold text-slate-700 text-lg mb-1">📡 Sector Rotation Clock</h2>
        <p className="text-xs text-slate-400 mb-4">Leading (top-right) → Weakening (bottom-right) → Lagging (bottom-left) → Improving (top-left)</p>
        <div className="relative bg-slate-50 rounded-2xl overflow-hidden" style={{ height: 340 }}>
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
            {[['IMPROVING 📈','border-r border-b'],['LEADING 🚀','border-b'],['LAGGING ⬇️','border-r'],['WEAKENING ⚠️','']].map(([label,cls],i)=>(
              <div key={i} className={`${cls} border-slate-200 flex items-center justify-center`}>
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${i===1?'text-teal-700 bg-teal-50':i===0?'text-green-700 bg-green-50':i===2?'text-red-700 bg-red-50':'text-amber-700 bg-amber-50'}`}>{label}</span>
              </div>
            ))}
          </div>
          {sectors.map((s, idx) => {
            const pos = CLOCK_POSITIONS[s.phase] || CLOCK_POSITIONS.Lagging
            const jx = (idx % 4 - 1.5) * 6
            const jy = (Math.floor(idx / 4) % 3 - 1) * 8
            return (
              <div key={s.etf} className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
                style={{ left: `${pos.x + jx}%`, top: `${pos.y + jy}%` }}>
                <div className={`w-11 h-11 rounded-full flex flex-col items-center justify-center text-white shadow-lg cursor-default text-xs font-bold ${
                  s.phase==='Leading'?'bg-teal-500':s.phase==='Weakening'?'bg-amber-500':'bg-red-500'
                }`}>
                  <span>{s.etf.replace('XL','').replace('SOXX','SI')}</span>
                  {s.liveChg != null && (
                    <span className="text-[9px] leading-none opacity-90">{s.liveChg>=0?'+':''}{s.liveChg.toFixed(1)}%</span>
                  )}
                </div>
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                  {s.name}: {s.livePrice ? fmtP(s.livePrice) : '—'} ({fmtC(s.liveChg)})
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Strategy */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
        <h2 className="font-bold text-lg mb-3">🧠 Rotation Strategy</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          {[
            { c:'text-green-400', h:'✅ OVERWEIGHT', t:'SOXX, XLE, XLI are in the Leading quadrant. Semiconductors (AI capex), Energy (supply discipline), Industrials (defense + reshoring) — all have fundamental catalysts backing the momentum.' },
            { c:'text-yellow-400', h:'⚖️ MARKET WEIGHT', t:'XLP, XLB, XLU, XLV are stable defensive plays. Hold for income and stability. Healthcare weakening but ABBV/LLY provide stock-specific alpha over the ETF.' },
            { c:'text-red-400', h:'🚫 UNDERWEIGHT', t:'XLY, XLRE are in the Lagging quadrant with negative momentum. Consumer Discretionary hurt by cautious spending. Real Estate pressured by elevated rates. Trim or avoid.' },
          ].map(b=>(
            <div key={b.h} className="bg-white/10 rounded-xl p-4">
              <div className={`${b.c} font-bold mb-1`}>{b.h}</div>
              <p className="text-slate-200 text-xs">{b.t}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Chart view */}
      {view === 'chart' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-700 text-lg">Today's Live Change by Sector ETF</h2>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => v != null ? [`${v}%`] : ['—']} />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <Bar dataKey="liveChg" name="Today %" radius={[4,4,0,0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={(d.liveChg ?? 0) >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl shadow border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-700 text-lg">YTD Performance by Sector</h2>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm">
                <option value="ytd">YTD</option>
                <option value="mom1">1-Month</option>
                <option value="mom3">3-Month</option>
                <option value="liveChg">Today (Live)</option>
              </select>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => [`${v}%`]} />
                <Legend />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <Bar dataKey="ytd"  name="YTD %"     fill="#6366f1" radius={[4,4,0,0]} />
                <Bar dataKey="mom1" name="1-Month %"  fill="#10b981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table view */}
      {view === 'table' && (
        <div className="bg-white rounded-2xl shadow border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-700 text-lg">All Sectors Scorecard — Live Prices</h2>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm">
              <option value="ytd">Sort: YTD</option>
              <option value="mom1">Sort: 1-Month</option>
              <option value="liveChg">Sort: Today (Live)</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="p-3 text-left">Sector</th>
                  <th className="p-3 text-center">ETF</th>
                  <th className="p-3 text-right">Live Price</th>
                  <th className="p-3 text-right">Today</th>
                  <th className="p-3 text-center">Phase</th>
                  <th className="p-3 text-center">Signal</th>
                  <th className="p-3 text-right">YTD</th>
                  <th className="p-3 text-right">1-Mo</th>
                  <th className="p-3 text-left hidden md:table-cell">Top Holdings</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, i) => {
                  const ps = PHASE_STYLES[s.phase] || PHASE_STYLES.Lagging
                  return (
                    <tr key={s.etf} className={`border-t border-slate-100 hover:bg-slate-50 ${i%2===0?'':'bg-slate-50/30'}`}>
                      <td className="p-3 font-semibold text-slate-700 text-xs">{s.name}</td>
                      <td className="p-3 text-center font-mono text-xs bg-slate-100 rounded mx-1">{s.etf}</td>
                      <td className="p-3 text-right font-bold text-slate-800 text-xs">
                        {loading && !s.livePrice ? (
                          <span className="inline-block h-4 w-14 bg-slate-200 rounded animate-pulse" />
                        ) : fmtP(s.livePrice)}
                      </td>
                      <td className={`p-3 text-right font-bold text-xs ${(s.liveChg ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {loading && s.liveChg == null ? (
                          <span className="inline-block h-4 w-12 bg-slate-200 rounded animate-pulse" />
                        ) : fmtC(s.liveChg)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ps.badge}`}>{s.phase}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${SIGNAL_COLORS[s.signal]}`}>{s.signal}</span>
                      </td>
                      <td className={`p-3 text-right font-bold text-xs ${s.ytd >= 0 ? 'text-green-600' : 'text-red-600'}`}>{s.ytd >= 0 ? '+' : ''}{s.ytd}%</td>
                      <td className={`p-3 text-right text-xs ${s.mom1 >= 0 ? 'text-green-600' : 'text-red-600'}`}>{s.mom1 >= 0 ? '+' : ''}{s.mom1}%</td>
                      <td className="p-3 hidden md:table-cell">
                        <div className="flex gap-1">
                          {s.top.map(t => <span key={t} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{t}</span>)}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
