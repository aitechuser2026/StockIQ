/**
 * LiveMarket.jsx  — Full market dashboard
 * Sections: Market Status · Index Cards · Fear & Greed · Sector Heatmap · Earnings
 */
import React, { useState } from 'react'
import { useMarketData } from '../../hooks/useMarketData'

// ── Formatters ────────────────────────────────────────────────────────────────
function fmt(n, dec = 2) {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function sign(n) { return n >= 0 ? '+' : '' }
function isUp(n) { return n >= 0 }

// ── Market Status Banner ──────────────────────────────────────────────────────
function MarketBanner({ marketStatus, lastUpdated, liveStatus, onRefresh }) {
  const { session } = marketStatus
  const configs = {
    open:   { bg: 'from-emerald-600 to-emerald-700', label: '🟢 Market Open',   sub: 'NYSE & NASDAQ trading live', dot: 'bg-emerald-300' },
    pre:    { bg: 'from-amber-500 to-amber-600',    label: '🌅 Pre-Market',     sub: 'Extended hours trading active', dot: 'bg-amber-300' },
    after:  { bg: 'from-indigo-600 to-indigo-700',  label: '🌆 After-Hours',    sub: 'Extended hours trading active', dot: 'bg-indigo-300' },
    closed: { bg: 'from-slate-600 to-slate-700',    label: '🔴 Market Closed',  sub: 'Opens 9:30 AM ET Monday–Friday', dot: 'bg-slate-400' },
  }
  const cfg = configs[session] || configs.closed
  const dataLabel = liveStatus === 'live' ? '🟢 Live' : liveStatus === 'loading' ? '🔄 Updating…' : '⚪ Baseline'
  return (
    <div className={`flex items-center justify-between bg-gradient-to-r ${cfg.bg} text-white rounded-xl px-5 py-3.5 mb-4`}>
      <div className="flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full live-dot ${cfg.dot}`} />
        <div>
          <div className="font-bold text-sm">{cfg.label}</div>
          <div className="text-xs opacity-80">{cfg.sub}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-xs bg-black/20 px-2 py-1 rounded-lg font-semibold">{dataLabel}</div>
        {lastUpdated && (
          <div className="text-xs opacity-70">
            {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
        <button onClick={onRefresh}
          className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg font-semibold transition-colors">
          ↻ Refresh
        </button>
      </div>
    </div>
  )
}

// ── Index card ────────────────────────────────────────────────────────────────
function IndexCard({ item, isLive }) {
  const isVIX = item.sym === '^VIX'
  const is10Y = item.sym === '^TNX'
  const colorUp = isVIX ? !isUp(item.changePct) : isUp(item.changePct)
  const textColor = colorUp ? 'text-emerald-600' : 'text-red-500'
  const bgColor   = colorUp ? 'bg-emerald-50'    : 'bg-red-50'
  const borderColor = colorUp ? 'border-emerald-200' : 'border-red-200'
  const price = item.price
  const displayPrice = is10Y
    ? fmt(price, 3) + '%'
    : price > 10000 ? price.toLocaleString('en-US', { maximumFractionDigits: 0 })
    : price > 100 ? fmt(price, 2)
    : fmt(price, 2)
  return (
    <div className={`bg-white rounded-xl border ${borderColor} p-4 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{item.short || item.sym}</div>
          <div className="text-xs text-slate-500 leading-tight">{item.label}</div>
        </div>
        <div className={`text-xs px-2 py-0.5 rounded-full font-bold ${bgColor} ${textColor}`}>
          {sign(item.changePct)}{fmt(item.changePct)}%
        </div>
      </div>
      <div className={`text-xl font-extrabold leading-none mb-1 ${textColor}`}>{displayPrice}</div>
      <div className="flex items-center gap-1.5 text-xs">
        <span className={`font-semibold ${textColor}`}>{sign(item.change)}{fmt(item.change, 2)}</span>
        {item.dayHigh && item.dayLow && (
          <>
            <span className="text-slate-300">·</span>
            <span className="text-slate-400">
              {fmt(item.dayLow, 2)} – {fmt(item.dayHigh, 2)}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

// ── Fear & Greed Gauge ────────────────────────────────────────────────────────
function FearGreedGauge({ data, isLive }) {
  if (!data) return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center justify-center h-44 text-slate-400 text-sm">
      Calculating Fear & Greed…
    </div>
  )
  const { score, label, color, emoji } = data
  const angle = (score / 100) * 180 - 90
  const rad = (angle * Math.PI) / 180
  const cx = 120, cy = 100, r = 78
  const needleX = cx + r * 0.82 * Math.cos(rad)
  const needleY = cy + r * 0.82 * Math.sin(rad)

  function arcPath(cx, cy, r, startDeg, endDeg) {
    const s = (startDeg * Math.PI) / 180
    const e = (endDeg * Math.PI) / 180
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s)
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e)
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`
  }

  const segments = [
    { color: '#dc2626', start: 180, end: 216 },
    { color: '#ea580c', start: 216, end: 252 },
    { color: '#ca8a04', start: 252, end: 288 },
    { color: '#65a30d', start: 288, end: 324 },
    { color: '#16a34a', start: 324, end: 360 },
  ]

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fear & Greed Index</div>
        {!isLive && <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">est.</span>}
      </div>
      <div className="text-xs text-slate-400 mb-3">VIX-based approximation</div>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-shrink-0">
          <svg viewBox="40 25 160 95" width="190" height="100">
            <path d={arcPath(cx, cy, r, 180, 360)} fill="none" stroke="#f1f5f9" strokeWidth="18" />
            {segments.map((seg, i) => (
              <path key={i} d={arcPath(cx, cy, r, seg.start, seg.end)}
                fill="none" stroke={seg.color} strokeWidth="18" strokeLinecap="butt" />
            ))}
            <line x1={cx} y1={cy} x2={needleX} y2={needleY}
              stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
            <circle cx={cx} cy={cy} r="5" fill="#0f172a" />
            <text x={cx} y={cy + 22} textAnchor="middle" fontSize="20" fontWeight="800" fill={color}>{score}</text>
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-2xl mb-1">{emoji}</div>
          <div className="text-base font-extrabold mb-2" style={{ color }}>{label}</div>
          <div className="space-y-1">
            {[
              { range: '0–24',   lbl: 'Extreme Fear', c: '#dc2626' },
              { range: '25–44',  lbl: 'Fear',         c: '#ea580c' },
              { range: '45–54',  lbl: 'Neutral',      c: '#ca8a04' },
              { range: '55–74',  lbl: 'Greed',        c: '#65a30d' },
              { range: '75–100', lbl: 'Extreme Greed',c: '#16a34a' },
            ].map(row => (
              <div key={row.lbl} className="flex items-center gap-1.5 text-xs">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: row.c }} />
                <span style={{ color: row.c }} className="font-semibold">{row.lbl}</span>
                <span className="text-slate-400">({row.range})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sector Heatmap ────────────────────────────────────────────────────────────
function SectorHeatmap({ sectors, isLive }) {
  if (!sectors.length) return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Sector Performance</div>
      <div className="text-center text-slate-400 text-sm py-8 animate-pulse">Loading sectors…</div>
    </div>
  )
  const sorted = [...sectors].sort((a, b) => b.changePct - a.changePct)
  const maxAbs = Math.max(...sectors.map(s => Math.abs(s.changePct)), 0.01)

  function heatColor(pct) {
    const ratio = Math.min(Math.abs(pct) / maxAbs, 1)
    if (pct > 0) return `rgba(22, 163, 74, ${0.2 + 0.7 * ratio})`
    return `rgba(220, 38, 38, ${0.2 + 0.7 * ratio})`
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sector Performance</div>
          {!isLive && <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">baseline</span>}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded" style={{ background: 'rgba(22,163,74,0.7)' }} /> Up
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded" style={{ background: 'rgba(220,38,38,0.7)' }} /> Down
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2">
        {sorted.map(s => {
          const up = s.changePct >= 0
          return (
            <div key={s.sym} className="rounded-lg p-2.5 border transition-transform hover:scale-105 cursor-default"
              style={{ background: heatColor(s.changePct), borderColor: up ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)' }}>
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-sm">{s.icon}</span>
                <span className="text-xs font-bold text-slate-800">{s.sym}</span>
              </div>
              <div className="text-xs text-slate-600 leading-tight mb-1 truncate">{s.label}</div>
              <div className={`text-base font-extrabold leading-none ${up ? 'text-emerald-700' : 'text-red-700'}`}>
                {sign(s.changePct)}{fmt(s.changePct)}%
              </div>
              <div className="text-xs text-slate-500">{fmt(s.price)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Market Sentiment ──────────────────────────────────────────────────────────
function MarketSentiment({ sectors, indices }) {
  const up = sectors.filter(s => s.changePct >= 0).length
  const down = sectors.filter(s => s.changePct < 0).length
  const total = sectors.length || 11
  const bullPct = total ? Math.round((up / total) * 100) : 50

  const vix = indices.find(i => i.sym === '^VIX')
  const spx = indices.find(i => i.sym === '^GSPC')
  const ndx = indices.find(i => i.sym === '^IXIC')
  const tnx = indices.find(i => i.sym === '^TNX')

  let sentiment = 'Neutral', sentColor = 'text-amber-600', sentBg = 'bg-amber-50'
  if (bullPct >= 70)      { sentiment = 'Bullish';        sentColor = 'text-emerald-600'; sentBg = 'bg-emerald-50' }
  else if (bullPct >= 55) { sentiment = 'Mildly Bullish'; sentColor = 'text-green-600';   sentBg = 'bg-green-50' }
  else if (bullPct <= 30) { sentiment = 'Bearish';        sentColor = 'text-red-600';     sentBg = 'bg-red-50' }
  else if (bullPct <= 45) { sentiment = 'Mildly Bearish'; sentColor = 'text-orange-600';  sentBg = 'bg-orange-50' }

  const stats = [
    { label: 'Sectors Up',   val: `${up}/${total}`,   color: 'text-emerald-600' },
    { label: 'Sectors Down', val: `${down}/${total}`,  color: 'text-red-500' },
    { label: 'VIX',          val: vix ? fmt(vix.price) : '—', sub: vix ? `${sign(vix.changePct)}${fmt(vix.changePct)}%` : '', color: vix && vix.changePct > 0 ? 'text-red-500' : 'text-emerald-600' },
    { label: '10Y Yield',    val: tnx ? fmt(tnx.price, 3) + '%' : '—', sub: tnx ? `${sign(tnx.changePct)}${fmt(tnx.changePct)}%` : '', color: 'text-slate-700' },
    { label: 'S&P 500',      val: spx ? sign(spx.changePct) + fmt(spx.changePct) + '%' : '—', color: spx && spx.changePct >= 0 ? 'text-emerald-600' : 'text-red-500' },
    { label: 'NASDAQ',       val: ndx ? sign(ndx.changePct) + fmt(ndx.changePct) + '%' : '—', color: ndx && ndx.changePct >= 0 ? 'text-emerald-600' : 'text-red-500' },
  ]

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Market Breadth</div>
        <div className={`text-sm font-bold px-3 py-1 rounded-full ${sentBg} ${sentColor}`}>{sentiment}</div>
      </div>
      <div className="mb-3">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Bearish ({down})</span>
          <span>Bullish ({up})</span>
        </div>
        <div className="h-3 bg-red-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all duration-700"
            style={{ width: `${bullPct}%` }} />
        </div>
        <div className="text-center text-xs text-slate-400 mt-1">{bullPct}% sectors advancing</div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-3 gap-2">
        {stats.map(s => (
          <div key={s.label} className="bg-slate-50 rounded-lg p-2">
            <div className="text-xs text-slate-400 mb-0.5 leading-tight">{s.label}</div>
            <div className={`text-sm font-bold ${s.color}`}>{s.val}</div>
            {s.sub && <div className="text-xs text-slate-400">{s.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Earnings ──────────────────────────────────────────────────────────────────
function EarningsSection({ earnings }) {
  const { today = [], tomorrow = [], todayStr, tomorrowStr } = earnings
  function fmtDate(d) {
    if (!d) return ''
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  function EarningItem({ e }) {
    return (
      <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-slate-800 w-14 flex-shrink-0">{e.sym}</span>
          <span className="text-slate-500 text-xs truncate">{e.name}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {e.est && <span className="text-xs text-slate-400">Est <span className="font-semibold text-slate-700">${e.est}</span></span>}
          <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${e.timing === 'pre' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
            {e.timing === 'pre' ? '🌅 Pre' : '🌆 Post'}
          </span>
        </div>
      </div>
    )
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">📊 Earnings Calendar</div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
            <span className="blink w-2 h-2 rounded-full bg-yellow-400 inline-block" />
            Today — {fmtDate(todayStr)}
          </div>
          {today.length === 0
            ? <div className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-lg">No major earnings today</div>
            : <div className="space-y-1.5">{today.map((e, i) => <EarningItem key={i} e={e} />)}</div>
          }
        </div>
        <div>
          <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
            Tomorrow — {fmtDate(tomorrowStr)}
          </div>
          {tomorrow.length === 0
            ? <div className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-lg">No major earnings tomorrow</div>
            : <div className="space-y-1.5">{tomorrow.map((e, i) => <EarningItem key={i} e={e} />)}</div>
          }
        </div>
      </div>
      <div className="mt-3 text-xs text-slate-400">🌅 Pre-Market · 🌆 Post-Market · EPS estimates from analyst consensus</div>
    </div>
  )
}

// ── Top/Bottom Movers ─────────────────────────────────────────────────────────
function MarketMovers({ sectors }) {
  if (!sectors.length) return null
  const sorted = [...sectors].sort((a, b) => b.changePct - a.changePct)
  const top3 = sorted.slice(0, 3)
  const bot3 = sorted.slice(-3).reverse()
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Top / Bottom Sectors</div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-semibold text-emerald-600 mb-2">▲ Leading</div>
          <div className="space-y-2">
            {top3.map(s => (
              <div key={s.sym} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5">
                  <span>{s.icon}</span>
                  <div>
                    <div className="font-semibold text-slate-700 text-xs">{s.sym}</div>
                    <div className="text-slate-400 text-xs">{s.label}</div>
                  </div>
                </div>
                <span className="font-bold text-emerald-600">{sign(s.changePct)}{fmt(s.changePct)}%</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-red-500 mb-2">▼ Lagging</div>
          <div className="space-y-2">
            {bot3.map(s => (
              <div key={s.sym} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5">
                  <span>{s.icon}</span>
                  <div>
                    <div className="font-semibold text-slate-700 text-xs">{s.sym}</div>
                    <div className="text-slate-400 text-xs">{s.label}</div>
                  </div>
                </div>
                <span className="font-bold text-red-500">{sign(s.changePct)}{fmt(s.changePct)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ className }) {
  return <div className={`animate-pulse bg-slate-200 rounded ${className}`} />
}
function IndexSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <Skeleton className="h-3 w-16 mb-2" />
      <Skeleton className="h-6 w-24 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function LiveMarket() {
  const { marketStatus, indices, sectors, fearGreed, earnings, lastUpdated, liveStatus, refresh } = useMarketData()
  const mainIndices = indices.filter(i => ['^GSPC','^IXIC','^DJI','^RUT'].includes(i.sym))
  const riskIndices = indices.filter(i => ['^VIX','^TNX'].includes(i.sym))
  const isLive = liveStatus === 'live'

  return (
    <div className="space-y-4">
      <MarketBanner marketStatus={marketStatus} lastUpdated={lastUpdated} liveStatus={liveStatus} onRefresh={() => refresh(true)} />

      {/* Major Indices */}
      <div>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Major Indices</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {mainIndices.map(item => <IndexCard key={item.sym} item={item} isLive={isLive} />)}
        </div>
      </div>

      {/* Volatility & Yields */}
      <div>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Volatility & Yields</div>
        <div className="grid grid-cols-2 gap-3">
          {riskIndices.map(item => <IndexCard key={item.sym} item={item} isLive={isLive} />)}
        </div>
      </div>

      {/* Fear & Greed + Sentiment */}
      <div className="grid md:grid-cols-2 gap-4">
        <FearGreedGauge data={fearGreed} isLive={isLive} />
        <MarketSentiment sectors={sectors} indices={indices} />
      </div>

      {/* Sector Heatmap */}
      <SectorHeatmap sectors={sectors} isLive={isLive} />

      {/* Movers + Earnings */}
      <div className="grid md:grid-cols-2 gap-4">
        <MarketMovers sectors={sectors} />
        <EarningsSection earnings={earnings} />
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-500 leading-relaxed">
        📡 Data: Stooq.com (primary) · Yahoo Finance v8 (fallback) · Fear & Greed from VIX + S&P momentum ·
        Auto-refresh: 30s open · 2min pre/after-hours · 5min closed ·
        {liveStatus === 'static' ? ' ⚪ Showing last-known values' : liveStatus === 'loading' ? ' 🔄 Fetching live data…' : ' 🟢 Live data'}
      </div>
    </div>
  )
}
