import React, { useState } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell, AreaChart, Area } from 'recharts'
import { useLivePrices } from '../../hooks/useLivePrices'

// Live tickers for market indices, VIX, and 10Y yield
const INDEX_TICKERS = ['^GSPC', '^IXIC', '^DJI', '^RUT', '^VIX', '^TNX']

// ─── Macro Data — May 2026 ────────────────────────────────────────────────────
const MACRO = {
  fedRate:    { current: 3.75, prev: 5.25, label: 'Fed Funds Rate', unit: '%', direction: 'down', status: 'Cutting', color: '#0ea5e9' },
  cpi:        { current: 2.4,  prev: 3.0,  label: 'CPI Inflation', unit: '%', direction: 'down', status: 'Cooling', color: '#10b981' },
  corePCE:    { current: 2.6,  prev: 3.3,  label: 'Core PCE', unit: '%', direction: 'down', status: 'Above Target', color: '#f59e0b' },
  gdp:        { current: 2.1,  prev: 2.8,  label: 'GDP Growth', unit: '%', direction: 'down', status: 'Solid', color: '#6366f1' },
  unemployment:{ current: 4.2, prev: 3.6,  label: 'Unemployment', unit: '%', direction: 'up', status: 'Softening', color: '#ec4899' },
  tenYrYield: { current: 4.35, prev: 4.68, label: '10-Yr Treasury', unit: '%', direction: 'down', status: 'Range-Bound', color: '#f97316' },
  vix:        { current: 17.8, prev: 24.1, label: 'VIX Volatility', unit: '', direction: 'down', status: 'Moderate', color: '#8b5cf6' },
  dollarIdx:  { current: 101.2,prev: 106.5,label: 'US Dollar Index', unit: '', direction: 'down', status: 'Weakening', color: '#64748b' },
}

// Historical CPI trend
const CPI_TREND = [
  { month: 'Jan 25', cpi: 3.0, core: 3.3 },
  { month: 'Mar 25', cpi: 2.8, core: 3.1 },
  { month: 'May 25', cpi: 2.7, core: 3.0 },
  { month: 'Jul 25', cpi: 2.6, core: 2.9 },
  { month: 'Sep 25', cpi: 2.5, core: 2.8 },
  { month: 'Nov 25', cpi: 2.4, core: 2.7 },
  { month: 'Jan 26', cpi: 2.4, core: 2.7 },
  { month: 'Mar 26', cpi: 2.3, core: 2.6 },
  { month: 'May 26', cpi: 2.4, core: 2.6 },
]

// Fed rate path
const FED_RATE_PATH = [
  { period: 'May 23', rate: 5.25 },
  { period: 'Sep 23', rate: 5.50 },
  { period: 'Dec 23', rate: 5.50 },
  { period: 'Mar 24', rate: 5.25 },
  { period: 'Jun 24', rate: 5.00 },
  { period: 'Sep 24', rate: 4.75 },
  { period: 'Dec 24', rate: 4.50 },
  { period: 'Mar 25', rate: 4.25 },
  { period: 'Jun 25', rate: 4.00 },
  { period: 'Sep 25', rate: 3.75 },
  { period: 'Dec 25', rate: 3.75 },
  { period: 'Mar 26', rate: 3.75 },
  { period: 'May 26', rate: 3.75 },
  { period: 'Dec 26', rate: 3.50, forecast: true },
]

// Yield curve
const YIELD_CURVE = [
  { term: '1M', yield: 4.10 },
  { term: '3M', yield: 4.05 },
  { term: '6M', yield: 3.95 },
  { term: '1Y', yield: 3.85 },
  { term: '2Y', yield: 3.95 },
  { term: '5Y', yield: 4.10 },
  { term: '10Y', yield: 4.35 },
  { term: '20Y', yield: 4.55 },
  { term: '30Y', yield: 4.62 },
]

// Market indices metadata — levels fetched live; ytd/pe are analytical estimates
const INDICES_META = [
  { name: 'S&P 500',     symbol: 'SPX', liveTicker: '^GSPC', ytd: 15.2, pe: 22.4, color: '#6366f1' },
  { name: 'Nasdaq',      symbol: 'NDX', liveTicker: '^IXIC', ytd: 19.8, pe: 28.1, color: '#0ea5e9' },
  { name: 'Dow Jones',   symbol: 'DJI', liveTicker: '^DJI',  ytd: 9.4,  pe: 17.8, color: '#10b981' },
  { name: 'Russell 2000',symbol: 'RUT', liveTicker: '^RUT',  ytd: 4.2,  pe: 21.5, color: '#f59e0b' },
]

// Investment regime
const REGIME = {
  label: 'Late Expansion / Early Slowdown',
  color: 'bg-amber-100 border-amber-300 text-amber-900',
  description: 'GDP is solid but decelerating. Unemployment ticking up. Fed has cut but paused. Inflation above target — no rush to cut further. This regime favors Quality Growth, Defensive Value, and Dividend stocks. Avoid high-yield credit and rate-sensitive sectors.',
  favorable: ['Quality Growth', 'Large Cap', 'Dividend Payers', 'Energy', 'Semiconductors'],
  unfavorable: ['Small Caps', 'High-Yield Bonds', 'Commercial Real Estate', 'Consumer Discretionary'],
}

function GaugeMeter({ value, min, max, label, color, unit, status }) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow p-4">
      <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">{label}</div>
      <div className="text-3xl font-black" style={{ color }}>{value}{unit}</div>
      <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="flex justify-between text-xs text-slate-400 mt-0.5">
        <span>{min}{unit}</span>
        <span className="font-semibold" style={{ color }}>{status}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}

export default function MacroDashboard() {
  const [view, setView] = useState('overview')

  // Live market data: indices, VIX, 10Y yield
  const { prices: liveIdx, loading: idxLoading, lastUpdated: idxUpdated, error: idxError, refresh: idxRefresh } = useLivePrices(INDEX_TICKERS)

  // Pull live values with fallback to static defaults
  const liveVix    = liveIdx['^VIX']?.price  ?? MACRO.vix.current
  const liveTnx    = liveIdx['^TNX']?.price  != null ? liveIdx['^TNX'].price * 0.1 : MACRO.tenYrYield.current
  const vixChgPct  = liveIdx['^VIX']?.changePct
  const tnxChgPct  = liveIdx['^TNX']?.changePct

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">🌐 Macro Dashboard</h1>
            <p className="text-slate-300 text-sm mt-1">
              Fed Policy · Inflation · Yield Curve · Market Regime · May 26, 2026
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['overview','rates','indices'].map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  view === v ? 'bg-white text-slate-800 shadow' : 'bg-white/20 hover:bg-white/30 text-white'
                }`}>
                {v === 'overview' ? '📊 Overview' : v === 'rates' ? '📈 Rates & Yields' : '🏛️ Indices'}
              </button>
            ))}
          </div>
        </div>
        {/* Live status bar */}
        <div className="flex items-center justify-between text-xs mt-2">
          <div className="flex items-center gap-2">
            {idxLoading ? (
              <span className="inline-flex items-center gap-1 bg-amber-900/40 text-amber-200 px-2 py-0.5 rounded-full font-semibold">
                <span className="animate-spin">⏳</span> Fetching live data…
              </span>
            ) : idxError ? (
              <span className="bg-red-900/40 text-red-300 px-2 py-0.5 rounded-full font-semibold">⚠️ Live feed unavailable</span>
            ) : (
              <span className="bg-green-900/40 text-green-300 px-2 py-0.5 rounded-full font-semibold">🟢 Live indices</span>
            )}
            {idxUpdated && !idxLoading && (
              <span className="text-slate-400">Updated {idxUpdated.toLocaleTimeString()}</span>
            )}
          </div>
          <button onClick={idxRefresh}
            className="bg-white/10 border border-white/20 hover:bg-white/20 text-white px-3 py-1 rounded-full transition-all font-medium text-xs">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Regime Banner */}
      <div className={`rounded-2xl border-2 p-5 ${REGIME.color}`}>
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1">
            <div className="font-bold text-lg">📍 Current Market Regime: {REGIME.label}</div>
            <p className="text-sm mt-1 leading-relaxed">{REGIME.description}</p>
          </div>
          <div className="flex-shrink-0 space-y-2">
            <div>
              <div className="text-xs font-bold text-green-800 mb-1">✅ Favorable</div>
              <div className="flex flex-wrap gap-1">
                {REGIME.favorable.map(f => (
                  <span key={f} className="text-xs bg-green-200 text-green-900 px-2 py-0.5 rounded-full">{f}</span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-red-800 mb-1">🚫 Unfavorable</div>
              <div className="flex flex-wrap gap-1">
                {REGIME.unfavorable.map(f => (
                  <span key={f} className="text-xs bg-red-200 text-red-900 px-2 py-0.5 rounded-full">{f}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── OVERVIEW ── */}
      {view === 'overview' && (
        <>
          {/* Gauge grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <GaugeMeter value={3.75}  min={0} max={7}  label="Fed Funds Rate" unit="%" status="Pausing"  color="#0ea5e9" />
            <GaugeMeter value={2.4}   min={0} max={6}  label="CPI Inflation"  unit="%" status="Cooling"  color="#10b981" />
            <GaugeMeter value={parseFloat(liveTnx.toFixed(2))} min={2} max={6} label="10-Yr Yield" unit="%" status={tnxChgPct !== undefined ? (tnxChgPct >= 0 ? '▲ Rising' : '▼ Falling') : 'Stable'} color="#f97316" />
            <GaugeMeter value={parseFloat(liveVix.toFixed(1))} min={10} max={50} label="VIX Fear Index" unit="" status={liveVix < 15 ? 'Low Fear' : liveVix < 25 ? 'Moderate' : 'Elevated'} color="#8b5cf6" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <GaugeMeter value={2.1}  min={0} max={5} label="GDP Growth"    unit="%" status="Solid" color="#6366f1" />
            <GaugeMeter value={4.2}  min={3} max={7} label="Unemployment"  unit="%" status="Softening" color="#ec4899" />
            <GaugeMeter value={2.6}  min={0} max={5} label="Core PCE"      unit="%" status="Above Target" color="#f59e0b" />
            <GaugeMeter value={101.2} min={88} max={115} label="DXY Dollar Index" unit="" status="Weakening" color="#64748b" />
          </div>

          {/* CPI trend chart */}
          <div className="bg-white rounded-2xl shadow border border-slate-100 p-5">
            <h2 className="font-bold text-slate-700 text-lg mb-1">Inflation Trend (CPI & Core PCE)</h2>
            <p className="text-xs text-slate-400 mb-4">Fed target = 2.0% · Current trajectory: gradual disinflation</p>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={CPI_TREND} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis domain={[1.5, 4.0]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => [`${v}%`]} />
                <ReferenceLine y={2.0} stroke="#10b981" strokeDasharray="6 3" label={{ value: 'Fed Target 2%', position: 'right', fontSize: 11, fill: '#10b981' }} />
                <Line type="monotone" dataKey="cpi" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4 }} name="CPI" />
                <Line type="monotone" dataKey="core" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4 }} name="Core PCE" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Key upcoming macro events */}
          <div className="bg-white rounded-2xl shadow border border-slate-100 p-5">
            <h2 className="font-bold text-slate-700 text-lg mb-4">📅 Upcoming Macro Events</h2>
            <div className="space-y-2">
              {[
                { date: 'Jun 4',  event: 'FOMC Meeting Minutes Released', impact: 'HIGH', note: 'Watch for tone on rate cut timeline — market pricing 1 more cut in 2026' },
                { date: 'Jun 12', event: 'CPI Inflation Report (May data)', impact: 'HIGH', note: 'Expected: 2.3–2.4%. Beat = risk-on rally. Miss = bonds + defensives' },
                { date: 'Jun 13', event: 'PPI Producer Price Index', impact: 'MEDIUM', note: 'Leading indicator for future CPI. Key for inflation trajectory' },
                { date: 'Jun 18', event: 'Fed Speakers Schedule (2 governors)', impact: 'MEDIUM', note: 'Market will parse every word for Jul/Sep rate cut signals' },
                { date: 'Jun 20', event: 'Options Expiration (OPEX)', impact: 'MEDIUM', note: 'Potential volatility around large options positions unwinding' },
                { date: 'Jun 27', event: 'GDP Q1 2026 Final Revision', impact: 'MEDIUM', note: 'Final read on Q1. Expected ~2.1% annualized. Watch for consumer spending revision' },
              ].map(e => (
                <div key={e.date} className="flex gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-sm font-bold text-slate-700 w-12 flex-shrink-0">{e.date}</div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-700">{e.event}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{e.note}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold h-fit flex-shrink-0 ${
                    e.impact === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>{e.impact}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── RATES & YIELDS ── */}
      {view === 'rates' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl shadow border border-slate-100 p-5">
              <h2 className="font-bold text-slate-700 text-lg mb-1">Fed Funds Rate History</h2>
              <p className="text-xs text-slate-400 mb-4">Peak 5.5% → Current 3.75% (dashed = forecast)</p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={FED_RATE_PATH} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis domain={[3, 6]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => [`${v}%`, 'Fed Rate']} />
                  <ReferenceLine y={2.0} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Neutral ~2.5-3%', position: 'right', fontSize: 10 }} />
                  <Line type="monotone" dataKey="rate" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4 }} name="Fed Rate" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl shadow border border-slate-100 p-5">
              <h2 className="font-bold text-slate-700 text-lg mb-1">Yield Curve (Treasury)</h2>
              <p className="text-xs text-slate-400 mb-4">
                Curve is normalizing after 2023–24 inversion. 2Y–10Y spread: <strong className="text-green-600">+0.40%</strong> (healthy)
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={YIELD_CURVE} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="term" tick={{ fontSize: 11 }} />
                  <YAxis domain={[3.5, 5.0]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => [`${v}%`, 'Yield']} />
                  <Area type="monotone" dataKey="yield" stroke="#f97316" fill="#fed7aa" strokeWidth={2.5} name="Yield" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bond market implications */}
          <div className="bg-white rounded-2xl shadow border border-slate-100 p-5">
            <h2 className="font-bold text-slate-700 text-lg mb-4">📊 Rates & Yields — Investment Implications</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: 'Fed Pausing at 3.75%', icon: '⏸️', cls: 'bg-blue-50 border-blue-200',
                  points: ['No urgency to cut further with core PCE at 2.6%', 'Fed watching labor market for cracks', '1 more cut priced by markets for late 2026', 'Yields range-bound at current levels'] },
                { title: 'Yield Curve Now Normal', icon: '📈', cls: 'bg-green-50 border-green-200',
                  points: ['2Y–10Y spread turned positive in late 2025', 'No longer signaling recession risk', 'Banks benefit from wider NIM spread', 'Duration risk in bonds is moderate'] },
                { title: 'VIX at 17.8 — Complacency Watch', icon: '⚠️', cls: 'bg-amber-50 border-amber-200',
                  points: ['VIX below 20 = low fear environment', 'Historically, <15 often precedes spikes', 'Consider VIX calls as cheap tail hedges', 'Portfolio insurance is underpriced currently'] },
              ].map(card => (
                <div key={card.title} className={`rounded-xl p-4 border ${card.cls}`}>
                  <div className="font-bold text-sm mb-2">{card.icon} {card.title}</div>
                  {card.points.map((p, i) => (
                    <div key={i} className="text-xs text-slate-600 flex gap-1.5 mb-1">
                      <span className="text-slate-400">•</span> {p}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── INDICES ── */}
      {view === 'indices' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {INDICES_META.map(idx => {
              const live    = liveIdx[idx.liveTicker]
              const level   = live?.price
              const chgPct  = live?.changePct
              return (
                <div key={idx.symbol} className="bg-white rounded-2xl shadow border border-slate-100 p-5">
                  <div className="text-xs text-slate-400 font-medium">{idx.symbol}</div>
                  <div className="text-sm font-bold text-slate-600 mb-2">{idx.name}</div>
                  {idxLoading && !live ? (
                    <div className="h-8 w-28 bg-slate-200 animate-pulse rounded mb-2" />
                  ) : (
                    <>
                      <div className="text-2xl font-black text-slate-800">
                        {level ? level.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                      </div>
                      {chgPct !== undefined && (
                        <div className={`text-sm font-bold mt-0.5 ${chgPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {chgPct >= 0 ? '▲' : '▼'} {Math.abs(chgPct).toFixed(2)}% today
                        </div>
                      )}
                    </>
                  )}
                  <div className="text-xs font-semibold text-green-600 mt-1">+{idx.ytd}% YTD est.</div>
                  <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, idx.ytd * 4)}%`, backgroundColor: idx.color }} />
                  </div>
                  <div className="text-xs text-slate-500 mt-2">Forward P/E: <strong>{idx.pe}×</strong></div>
                </div>
              )
            })}
          </div>

          {/* Live VIX + 10Y callout in indices view */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow border border-slate-100 p-5 flex items-center gap-4">
              <div className="text-4xl">😰</div>
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wide font-medium">VIX — Fear Index (Live)</div>
                {idxLoading && !liveIdx['^VIX'] ? (
                  <div className="h-8 w-20 bg-slate-200 animate-pulse rounded mt-1" />
                ) : (
                  <>
                    <div className="text-3xl font-black" style={{ color: '#8b5cf6' }}>{liveVix.toFixed(1)}</div>
                    {vixChgPct !== undefined && (
                      <div className={`text-sm font-semibold ${vixChgPct >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {vixChgPct >= 0 ? '▲' : '▼'} {Math.abs(vixChgPct).toFixed(2)}% today
                      </div>
                    )}
                    <div className="text-xs text-slate-500 mt-0.5">
                      {liveVix < 15 ? 'Very Low Fear — possible complacency' : liveVix < 20 ? 'Moderate — healthy market' : liveVix < 30 ? 'Elevated — watch closely' : 'High — fear in market'}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow border border-slate-100 p-5 flex items-center gap-4">
              <div className="text-4xl">🏦</div>
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wide font-medium">10-Year Treasury Yield (Live)</div>
                {idxLoading && !liveIdx['^TNX'] ? (
                  <div className="h-8 w-20 bg-slate-200 animate-pulse rounded mt-1" />
                ) : (
                  <>
                    <div className="text-3xl font-black" style={{ color: '#f97316' }}>{liveTnx.toFixed(2)}%</div>
                    {tnxChgPct !== undefined && (
                      <div className={`text-sm font-semibold ${tnxChgPct >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {tnxChgPct >= 0 ? '▲' : '▼'} {Math.abs(tnxChgPct).toFixed(2)}% today
                      </div>
                    )}
                    <div className="text-xs text-slate-500 mt-0.5">
                      {liveTnx >= 4.5 ? 'High — pressure on equities' : liveTnx >= 4.0 ? 'Elevated — range-bound' : 'Moderate — equity-friendly'}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow border border-slate-100 p-5">
            <h2 className="font-bold text-slate-700 text-lg mb-4">YTD Index Performance (estimated)</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={INDICES_META} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="symbol" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => [`${v}%`, 'YTD Return']} />
                <Bar dataKey="ytd" radius={[6, 6, 0, 0]}>
                  {INDICES_META.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Valuation warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <h2 className="font-bold text-amber-800 text-lg mb-2">📐 Valuation Context</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-amber-900">
              <div>
                <strong>S&P 500 at 22.4× Forward P/E</strong> — above the 20-year average of ~17.5×.
                Elevated but justified by: (1) AI-driven productivity premium, (2) mega-cap tech quality,
                (3) declining rates. Market is not cheap, but not 2021-bubble territory.
              </div>
              <div>
                <strong>Nasdaq 100 at 28.1×</strong> — pricing in continued AI capex expansion.
                Risk scenario: if rate cuts stall or earnings disappoint, compression to 24–25× would
                mean a ~10–12% drawdown from current levels. Maintain position sizing discipline.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
