/**
 * StockDeepDive.jsx
 *
 * Data source: Financial Modeling Prep (FMP) free tier
 *   Two parallel calls per search:
 *   1. /v3/quote/{ticker}                              → price, trailing PE/EPS, market cap, 52W, beta
 *   2. /v3/income-statement/{ticker}?period=quarter    → 5 quarters of revenue, margins, EPS
 *
 * Requires FMP_KEY in .env  (free key at financialmodelingprep.com — 250 req/day, injected server-side by /api/proxy)
 */

import React, { useState, useCallback, useRef } from 'react'

// ─── FMP config ─────────────────────────────────────────────────────────────────
// All FMP calls go through /api/proxy — the proxy injects FMP_KEY server-side.
// No API key in the client bundle.
const fmpUrl = (path) =>
  `/api/proxy?url=${encodeURIComponent(`https://financialmodelingprep.com/api/v3${path}`)}`

// ─── Low-level fetch ────────────────────────────────────────────────────────────
async function safeFetch(url, ms = 15000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    })
    clearTimeout(t)
    if (!res.ok) {
      console.warn('[DeepDive]', url.slice(0, 80), '→ HTTP', res.status)
      // Surface proxy config errors (e.g. FMP_KEY not set on Vercel)
      if (res.status === 500) {
        const body = await res.json().catch(() => ({}))
        if (body?.error?.includes('FMP_KEY')) throw new Error(body.error)
      }
      return null
    }
    return await res.json()
  } catch (e) {
    clearTimeout(t)
    if (e.message?.includes('FMP_KEY')) throw e   // re-throw key errors so useDeepDive can show them
    console.warn('[DeepDive]', url.slice(0, 80), '→', e.name === 'AbortError' ? 'Timeout' : e.message)
    return null
  }
}

// ─── Source 1: FMP real-time quote ──────────────────────────────────────────────
// /v3/quote/{ticker} — price, trailing PE, trailing EPS, market cap, 52W range, beta
async function fetchFMPQuote(ticker) {
  const data = await safeFetch(
    fmpUrl(`/quote/${encodeURIComponent(ticker.toUpperCase())}`), 12000
  )
  const q = data?.[0]
  if (!q?.price) { console.warn('[DeepDive] FMP quote: no data for', ticker); return null }
  console.log('[DeepDive] FMP quote ✓', ticker, 'price:', q.price, 'PE:', q.pe)

  return {
    name:             q.name              || ticker,
    price:            q.price             ?? null,
    change1d:         q.changesPercentage ?? null,
    prevClose:        q.previousClose     ?? null,
    currency:         'USD',
    marketCap:        q.marketCap         ?? null,
    trailingPE:       q.pe                ?? null,
    trailingEps:      q.eps               ?? null,
    forwardPE:        null,   // analyst estimates = paid tier; computed from EDGAR EPS below
    forwardEps:       null,
    priceToBook:      null,
    fiftyTwoWeekHigh: q.yearHigh          ?? null,
    fiftyTwoWeekLow:  q.yearLow           ?? null,
    beta:             q.beta              ?? null,
  }
}

// ─── Source 2: FMP quarterly income statement ────────────────────────────────────
// /v3/income-statement/{ticker}?period=quarter&limit=9
// Returns revenue, gross profit, operating income, net income, R&D, diluted EPS per quarter.
// Margins (ratios) are pre-computed by FMP — no division required.
async function fetchFMPQuarters(ticker) {
  const data = await safeFetch(
    fmpUrl(`/income-statement/${encodeURIComponent(ticker.toUpperCase())}?period=quarter&limit=9`),
    15000
  )
  if (!data?.length) { console.warn('[DeepDive] FMP income: no data for', ticker); return [] }
  console.log('[DeepDive] FMP income ✓', ticker, data.length, 'quarters')

  // FMP returns most-recent first. Fetch 9 rows so [i+4] is valid for YoY on all 5 displayed rows.
  const rows = data.slice(0, 9)
  return rows.slice(0, 5).map((s, i) => {
    const prev = rows[i + 1]
    const yoy  = rows[i + 4]
    const rev  = s.revenue          ?? null
    const op   = s.operatingIncome  ?? null
    const net  = s.netIncome        ?? null
    const gp   = s.grossProfit      ?? null
    const rnd  = s.researchAndDevelopmentExpenses ?? null
    return {
      label:           `${s.period} '${String(s.calendarYear).slice(2)}`,
      date:            s.date,
      revenue:         rev,
      revYoY:          rev && yoy?.revenue  ? (rev - yoy.revenue)  / Math.abs(yoy.revenue)  : null,
      revQoQ:          rev && prev?.revenue ? (rev - prev.revenue) / Math.abs(prev.revenue) : null,
      grossProfit:     gp,
      grossMargin:     s.grossProfitRatio     ?? (gp  != null && rev ? gp  / rev : null),
      operatingIncome: op,
      operatingMargin: s.operatingIncomeRatio ?? (op  != null && rev ? op  / rev : null),
      netIncome:       net,
      netMargin:       s.netIncomeRatio       ?? (net != null && rev ? net / rev : null),
      eps:             s.epsdiluted           ?? s.eps ?? null,
      rnd,
      rndPct:          rnd && rev ? rnd / rev : null,
    }
  })
}

// ─── Merge into flat summary object ────────────────────────────────────────────
function buildSummary(quote, quarters, ticker) {
  const q  = quote  || {}
  const r0 = quarters[0] || {}

  // Trailing EPS/PE: prefer FMP quote values; fall back to computing from 4 quarters of EPS
  const epsQuarters = quarters.filter(x => x.eps != null).slice(0, 4)
  const computedEps = epsQuarters.length === 4
    ? epsQuarters.reduce((s, x) => s + x.eps, 0)
    : null
  const computedPE  = (q.price && computedEps && computedEps > 0)
    ? q.price / computedEps
    : null

  return {
    name:             q.name             || ticker || '—',
    price:            q.price            ?? null,
    change1d:         q.change1d         ?? null,
    prevClose:        q.prevClose        ?? null,
    currency:         q.currency         || 'USD',
    marketCap:        q.marketCap        ?? null,
    forwardPE:        q.forwardPE        ?? null,
    trailingPE:       q.trailingPE       ?? computedPE,   // FMP quote or computed from quarters
    forwardEps:       q.forwardEps       ?? null,
    trailingEps:      q.trailingEps      ?? computedEps,  // FMP quote or summed from quarters
    priceToBook:      q.priceToBook      ?? null,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow:  q.fiftyTwoWeekLow  ?? null,
    // Margins from most recent EDGAR quarter
    grossMargin:      r0.grossMargin     ?? null,
    operatingMargin:  r0.operatingMargin ?? null,
    netMargin:        r0.netMargin       ?? null,
    roe: null, roa: null, description: '',
  }
}

// ─── Moat scorer ───────────────────────────────────────────────────────────────
function scoreMoat(summary, quarters) {
  const signals = []
  let score = 0

  // 1. Gross margin — pricing power
  const gm = summary.grossMargin
  if (gm != null) {
    if      (gm > 0.6)  { score += 2; signals.push({ icon: '💰', text: `Gross margin ${fmtMargin(gm)} — exceptional pricing power` }) }
    else if (gm > 0.4)  { score += 1; signals.push({ icon: '💰', text: `Gross margin ${fmtMargin(gm)} — solid pricing power` }) }
    else if (gm > 0.25) { score += 0; signals.push({ icon: '⚠️', text: `Gross margin ${fmtMargin(gm)} — moderate, watch competition` }) }
    else                { score -= 1; signals.push({ icon: '🔴', text: `Gross margin ${fmtMargin(gm)} — thin, commodity-like pricing` }) }
  }

  // 2. Operating margin trend
  if (quarters.length >= 3) {
    const recent = quarters.slice(0, 2).map(q => q.operatingMargin).filter(x => x != null)
    const older  = quarters.slice(2, 4).map(q => q.operatingMargin).filter(x => x != null)
    if (recent.length && older.length) {
      const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length
      const olderAvg  = older.reduce((s, v) => s + v, 0)  / older.length
      const delta     = recentAvg - olderAvg
      if      (delta >  0.02) { score += 2; signals.push({ icon: '📈', text: `Operating margin expanding +${(delta * 100).toFixed(1)}pp — efficiency improving` }) }
      else if (delta >  0)    { score += 1; signals.push({ icon: '📈', text: 'Operating margin slightly expanding' }) }
      else if (delta < -0.03) { score -= 1; signals.push({ icon: '📉', text: `Operating margin contracting ${(delta * 100).toFixed(1)}pp — cost pressure` }) }
      else                    {             signals.push({ icon: '➡️', text: 'Operating margin stable' }) }
    }
  }

  // 3. Revenue growth consistency
  const growths = quarters.map(q => q.revYoY).filter(x => x != null)
  if (growths.length >= 3) {
    const allPos   = growths.every(g => g > 0)
    const avgGrowth = growths.reduce((s, v) => s + v, 0) / growths.length
    if      (allPos && avgGrowth > 0.2) { score += 2; signals.push({ icon: '🚀', text: `Consistent growth avg ${fmtPct(avgGrowth)} YoY — strong demand moat` }) }
    else if (allPos)                    { score += 1; signals.push({ icon: '✅', text: 'Consistent positive revenue growth — solid market position' }) }
    else                                {             signals.push({ icon: '⚠️', text: 'Revenue growth inconsistent — monitor demand trends' }) }
  }

  // 4. R&D investment
  const rndPcts = quarters.map(q => q.rndPct).filter(x => x != null)
  if (rndPcts.length) {
    const avgRnd = rndPcts.reduce((s, v) => s + v, 0) / rndPcts.length
    if      (avgRnd > 0.15) { score += 2; signals.push({ icon: '🔬', text: `R&D ${fmtMargin(avgRnd)} of revenue — heavy innovation investment` }) }
    else if (avgRnd > 0.08) { score += 1; signals.push({ icon: '🔬', text: `R&D ${fmtMargin(avgRnd)} of revenue — meaningful innovation spend` }) }
    else if (avgRnd > 0.03) {             signals.push({ icon: '🔬', text: `R&D ${fmtMargin(avgRnd)} of revenue — moderate` }) }
  }

  // 5. Net margin
  const nm = summary.netMargin
  if (nm != null) {
    if      (nm > 0.25) { score += 1; signals.push({ icon: '💵', text: `Net margin ${fmtMargin(nm)} — keeps $${(nm * 100).toFixed(0)} of every $100 in revenue` }) }
    else if (nm < 0.05) {             signals.push({ icon: '⚠️', text: `Net margin ${fmtMargin(nm)} — thin after all costs` }) }
  }

  const verdicts = [
    { min: 7,   label: 'FORTRESS MOAT', color: 'bg-emerald-600 text-white', desc: 'Exceptional competitive position — durable for decades' },
    { min: 5,   label: 'STRONG MOAT',   color: 'bg-green-600 text-white',   desc: 'Durable advantage, growing stronger — watch every quarter' },
    { min: 3,   label: 'NARROW MOAT',   color: 'bg-blue-600 text-white',    desc: 'Some competitive edge, needs monitoring to stay ahead' },
    { min: 1,   label: 'THIN MOAT',     color: 'bg-amber-500 text-white',   desc: 'Limited differentiation — competitive pressures are real' },
    { min: -99, label: 'NO CLEAR MOAT', color: 'bg-red-500 text-white',     desc: 'Commoditized or deteriorating position — high risk' },
  ]
  const verdict = verdicts.find(v => score >= v.min) || verdicts[verdicts.length - 1]
  return { score, signals, verdict }
}

// ─── Formatters ────────────────────────────────────────────────────────────────
function fmtB(n) {
  if (n == null || isNaN(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (abs >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`
  return `$${Number(n).toLocaleString()}`
}
function fmtPct(n, dec = 1) {
  if (n == null || isNaN(n)) return '—'
  const val  = Math.abs(n) <= 1 ? n * 100 : n
  const sign = val > 0 ? '+' : ''
  return `${sign}${val.toFixed(dec)}%`
}
function fmtMargin(n) {
  if (n == null || isNaN(n)) return '—'
  return `${(Math.abs(n) <= 1 ? n * 100 : n).toFixed(1)}%`
}
function fmtX(n, dec = 1) {
  if (n == null || isNaN(n)) return '—'
  return `${Number(n).toFixed(dec)}x`
}

// ─── Main data hook ─────────────────────────────────────────────────────────────
function useDeepDive() {
  const [state, setState] = useState({ status: 'idle', data: null, error: null, ticker: '' })
  const abortRef = useRef(null)

  const analyze = useCallback(async (rawTicker) => {
    const ticker = rawTicker.trim().toUpperCase()
    if (!ticker) return

    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    setState({ status: 'loading', data: null, error: null, ticker })

    try {
      // Both FMP calls run in parallel
      // FMP key is injected server-side by /api/proxy — no client-side key check needed

      const [quote, quarters] = await Promise.all([
        fetchFMPQuote(ticker).catch((e)    => { console.error('[DeepDive] quote error:', e);    return null }),
        fetchFMPQuarters(ticker).catch((e) => { console.error('[DeepDive] income error:', e);   return [] }),
      ])

      if (!quote && !quarters.length) {
        throw new Error(
          `No data found for "${ticker}". ` +
          `Check the ticker symbol (e.g. AAPL, MSFT, NVDA) — FMP may not carry this stock on the free tier.`
        )
      }

      const summary = buildSummary(quote, quarters, ticker)
      const moat    = scoreMoat(summary, quarters)

      setState({ status: 'done', ticker, data: { summary, quarters, moat }, error: null })
    } catch (err) {
      if (err.name === 'AbortError') return
      setState((prev) => ({ ...prev, status: 'error', error: err.message }))
    }
  }, [])

  return { ...state, analyze }
}

// ─── UI primitives ─────────────────────────────────────────────────────────────
function Card({ title, badge, badgeColor, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h2 className="font-black text-slate-800 text-sm">{title}</h2>
        {badge && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeColor}`}>{badge}</span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function Delta({ value }) {
  if (value == null || isNaN(value)) return <span className="text-slate-400 text-xs">—</span>
  const pct = Math.abs(value) <= 1 ? value * 100 : value
  const pos = pct >= 0
  return (
    <span className={`text-xs font-bold ${pos ? 'text-emerald-600' : 'text-red-500'}`}>
      {pos ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function Skeleton({ rows = 4 }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-8 bg-slate-100 rounded-lg" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  )
}

// ─── Section 1: Revenue Growth ─────────────────────────────────────────────────
function SectionRevenue({ quarters }) {
  if (!quarters.length) {
    return (
      <Card title="1. Is the Business Actually Growing?">
        <p className="text-slate-400 text-sm">Quarterly revenue data not available for this ticker.</p>
      </Card>
    )
  }

  const growths   = quarters.map(q => q.revYoY).filter(x => x != null)
  const avgGrowth = growths.length ? growths.reduce((s, v) => s + v, 0) / growths.length : null
  const allAccel  = growths.length >= 2 && growths[0] > growths[growths.length - 1]

  const verdict = avgGrowth == null ? null
    : avgGrowth > 0.2  ? { label: 'ACCELERATING',  color: 'bg-emerald-600 text-white' }
    : avgGrowth > 0.05 ? { label: 'STEADY GROWTH',  color: 'bg-green-600 text-white' }
    : avgGrowth > 0    ? { label: 'SLOWING',         color: 'bg-amber-500 text-white' }
    :                    { label: 'CONTRACTING',     color: 'bg-red-500 text-white' }

  return (
    <Card title="1. Is the Business Actually Growing?" badge={verdict?.label} badgeColor={verdict?.color}>
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-xs min-w-[480px]">
          <thead>
            <tr className="text-slate-400 font-semibold uppercase tracking-wide">
              <th className="text-left pb-2">Quarter</th>
              <th className="text-right pb-2">Revenue</th>
              <th className="text-right pb-2">YoY</th>
              <th className="text-right pb-2">QoQ</th>
              <th className="text-right pb-2">Gross Margin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {quarters.map((q, i) => (
              <tr key={q.date} className={i === 0 ? 'bg-blue-50/60 font-bold' : ''}>
                <td className="py-2 pr-3 font-semibold text-slate-700">
                  {q.label}
                  {i === 0 && <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">MRQ</span>}
                </td>
                <td className="py-2 text-right font-mono text-slate-800">{fmtB(q.revenue)}</td>
                <td className="py-2 text-right"><Delta value={q.revYoY} /></td>
                <td className="py-2 text-right"><Delta value={q.revQoQ} /></td>
                <td className="py-2 text-right">
                  {q.grossMargin != null
                    ? <span className="font-semibold text-slate-700">{fmtMargin(q.grossMargin)}</span>
                    : <span className="text-slate-400">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {avgGrowth != null && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-full font-semibold">
            Avg YoY: <span className={avgGrowth > 0 ? 'text-emerald-700' : 'text-red-600'}>{fmtPct(avgGrowth)}</span>
          </span>
          {allAccel  && <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-semibold">📈 Accelerating</span>}
          {!allAccel && growths.length >= 2 && <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-semibold">⚠️ Decelerating</span>}
        </div>
      )}
    </Card>
  )
}

// ─── Section 2: Profitability ──────────────────────────────────────────────────
function SectionProfitability({ quarters }) {
  if (!quarters.length) {
    return (
      <Card title="2. Is It Getting More Profitable?">
        <p className="text-slate-400 text-sm">Profitability data not available for this ticker.</p>
      </Card>
    )
  }

  const opMargins = quarters.map(q => q.operatingMargin).filter(x => x != null)
  const recent2   = opMargins.slice(0, 2)
  const older2    = opMargins.slice(2, 4)
  const recentAvg = recent2.length ? recent2.reduce((s, v) => s + v, 0) / recent2.length : null
  const olderAvg  = older2.length  ? older2.reduce((s, v) => s + v, 0)  / older2.length  : null
  const delta     = recentAvg != null && olderAvg != null ? recentAvg - olderAvg : null

  const expanding   = delta != null && delta >  0.01
  const contracting = delta != null && delta < -0.01
  const verdict = contracting
    ? { label: 'MARGIN PRESSURE',   color: 'bg-red-500 text-white',     desc: 'Costs rising faster than revenue — investigate' }
    : expanding
    ? { label: 'EXPANDING MARGINS', color: 'bg-emerald-600 text-white', desc: 'Pricing power + efficiency improving' }
    : { label: 'STABLE MARGINS',    color: 'bg-blue-600 text-white',    desc: 'Consistent profitability — watch for expansion' }

  return (
    <Card title="2. Is It Getting More Profitable?" badge={verdict.label} badgeColor={verdict.color}>
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-xs min-w-[520px]">
          <thead>
            <tr className="text-slate-400 font-semibold uppercase tracking-wide">
              <th className="text-left pb-2">Quarter</th>
              <th className="text-right pb-2">Op. Income</th>
              <th className="text-right pb-2">Op. Margin</th>
              <th className="text-right pb-2">Net Income</th>
              <th className="text-right pb-2">Net Margin</th>
              <th className="text-right pb-2">EPS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {quarters.map((q, i) => {
              const prevOp = quarters[i + 1]?.operatingMargin
              const pp = prevOp != null && q.operatingMargin != null ? q.operatingMargin - prevOp : null
              return (
                <tr key={q.date} className={i === 0 ? 'bg-blue-50/60 font-bold' : ''}>
                  <td className="py-2 pr-3 font-semibold text-slate-700">
                    {q.label}
                    {i === 0 && <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">MRQ</span>}
                  </td>
                  <td className="py-2 text-right font-mono text-slate-800">{fmtB(q.operatingIncome)}</td>
                  <td className="py-2 text-right">
                    <span className="font-semibold text-slate-700">{fmtMargin(q.operatingMargin)}</span>
                    {pp != null && (
                      <span className={`ml-1 text-[10px] ${pp > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {pp > 0 ? '▲' : '▼'}{Math.abs(pp * 100).toFixed(1)}pp
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right font-mono text-slate-800">{fmtB(q.netIncome)}</td>
                  <td className="py-2 text-right font-semibold text-slate-700">{fmtMargin(q.netMargin)}</td>
                  <td className="py-2 text-right font-mono text-slate-800">
                    {q.eps != null ? `$${Number(q.eps).toFixed(2)}` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
        <span className="font-black text-slate-700">💡 Verdict: </span>{verdict.desc}
        {delta != null && (
          <span>
            {' '}Operating margin shift: <span className={`font-bold ${expanding ? 'text-emerald-700' : contracting ? 'text-red-600' : 'text-slate-700'}`}>
              {expanding ? '+' : ''}{(delta * 100).toFixed(1)}pp
            </span>
            {expanding   && ' — Revenue + margin expanding = pricing power confirmed.'}
            {contracting && ' — Rising costs or competitive pressure eating into profits.'}
          </span>
        )}
      </div>
    </Card>
  )
}

// ─── Section 3: Valuation ──────────────────────────────────────────────────────
function PEBar({ value }) {
  if (value == null) return null
  const clamped  = Math.min(value, 80)
  const position = Math.min((clamped / 80) * 100, 97)
  const zones    = [
    { label: 'Cheap',   color: 'bg-emerald-400', width: '18%' },
    { label: 'Fair',    color: 'bg-green-400',   width: '18%' },
    { label: 'Premium', color: 'bg-amber-400',   width: '24%' },
    { label: 'High',    color: 'bg-red-400',      width: '40%' },
  ]
  return (
    <div className="mt-3">
      <div className="relative h-5 rounded-full overflow-hidden flex">
        {zones.map(z => (
          <div key={z.label} className={`${z.color} opacity-30`} style={{ width: z.width }} />
        ))}
        <div className="absolute top-0 bottom-0 w-0.5 bg-slate-800" style={{ left: `${position}%` }} />
        <div
          className="absolute -top-1 text-[10px] font-black text-slate-800 bg-white border border-slate-300 rounded px-1 leading-5 shadow-sm transform -translate-x-1/2"
          style={{ left: `${position}%` }}
        >
          {fmtX(value)}
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-semibold">
        <span>0x</span>
        <span className="text-emerald-600">15x Cheap</span>
        <span className="text-green-600">25x Fair</span>
        <span className="text-amber-600">40x Premium</span>
        <span className="text-red-500">80x+</span>
      </div>
    </div>
  )
}

function SectionValuation({ summary, quarters }) {
  const { forwardPE, trailingPE, forwardEps, trailingEps, priceToBook,
          price, fiftyTwoWeekHigh, fiftyTwoWeekLow, marketCap, currency } = summary

  const hasValuation = forwardPE != null || trailingPE != null

  // Use forward PE if available, fall back to trailing PE for the zone verdict
  const peForZone   = forwardPE ?? trailingPE
  const peLabel     = forwardPE != null ? 'Forward P/E' : 'Trailing P/E'
  const peLabelNote = forwardPE != null ? 'Next 12m estimate' : 'Last 12m actual (no fwd estimate available)'

  const zone = peForZone == null ? null
    : peForZone < 15  ? { label: 'CHEAP',     color: 'bg-emerald-600 text-white', desc: 'Below 15x — market may be underpricing the business.' }
    : peForZone < 25  ? { label: 'FAIR PRICE', color: 'bg-green-600 text-white',   desc: '15–25x — fair value. Returns will track earnings growth.' }
    : peForZone < 40  ? { label: 'PREMIUM',    color: 'bg-amber-500 text-white',   desc: '25–40x — premium. Business must deliver consistently.' }
    :                   { label: 'PRICED FOR PERFECTION', color: 'bg-red-500 text-white', desc: 'Above 40x — little room for error.' }

  // 52-week range bar
  const rangePos = (price && fiftyTwoWeekHigh && fiftyTwoWeekLow && fiftyTwoWeekHigh > fiftyTwoWeekLow)
    ? ((price - fiftyTwoWeekLow) / (fiftyTwoWeekHigh - fiftyTwoWeekLow)) * 100
    : null

  return (
    <Card title="3. What Am I Actually Paying?" badge={zone?.label} badgeColor={zone?.color}>
      {!hasValuation && (
        <p className="text-slate-400 text-sm mb-3">Valuation data not available. FMP may not carry PE data for this ticker on the free tier.</p>
      )}

      {hasValuation && peForZone != null && (
        <>
          <div className="text-xs font-black text-slate-600 uppercase tracking-wide mb-2">
            {peLabel} — What You Pay Per $1 of Earnings
          </div>
          <PEBar value={peForZone} />
          {zone && <p className="text-xs text-slate-500 mt-1">{zone.desc}</p>}
        </>
      )}

      {/* Metrics grid */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'Forward P/E',   value: fmtX(forwardPE),                                                  note: forwardPE  != null ? 'Next 12m est.'    : 'Not available' },
          { label: 'Trailing P/E',  value: fmtX(trailingPE),                                                 note: trailingPE != null ? 'Last 12m actual' : 'Needs 4 qtrs EPS' },
          { label: 'Forward EPS',   value: forwardEps  != null ? `$${Number(forwardEps).toFixed(2)}`  : '—', note: 'Analyst consensus' },
          { label: 'Trailing EPS',  value: trailingEps != null ? `$${Number(trailingEps).toFixed(2)}` : '—', note: trailingEps != null ? 'Actual TTM' : 'From SEC filings' },
          { label: 'Price to Book', value: fmtX(priceToBook),                                               note: 'P/B multiple' },
          { label: 'Market Cap',    value: fmtB(marketCap),                                                  note: currency },
          { label: '52W High',      value: fiftyTwoWeekHigh ? `$${Number(fiftyTwoWeekHigh).toFixed(2)}` : '—', note: '12-month high' },
          { label: '52W Low',       value: fiftyTwoWeekLow  ? `$${Number(fiftyTwoWeekLow).toFixed(2)}`  : '—', note: '12-month low' },
        ].map(m => (
          <div key={m.label} className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{m.label}</div>
            <div className="text-base font-black text-slate-900 mt-0.5">{m.value}</div>
            <div className="text-[10px] text-slate-400">{m.note}</div>
          </div>
        ))}
      </div>

      {/* 52-week range bar */}
      {rangePos != null && (
        <div className="mt-4">
          <div className="text-xs font-black text-slate-600 uppercase tracking-wide mb-2">
            52-Week Range — Where Is the Stock Now?
          </div>
          <div className="relative h-3 bg-slate-100 rounded-full">
            <div
              className="absolute top-0 h-3 bg-indigo-500 rounded-full"
              style={{ width: `${rangePos}%` }}
            />
            <div
              className="absolute top-0 w-3 h-3 bg-white border-2 border-indigo-600 rounded-full shadow transform -translate-x-1/2"
              style={{ left: `${rangePos}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>${Number(fiftyTwoWeekLow).toFixed(0)} Low</span>
            <span className="font-bold text-indigo-600">${Number(price).toFixed(2)} now ({rangePos.toFixed(0)}%)</span>
            <span>${Number(fiftyTwoWeekHigh).toFixed(0)} High</span>
          </div>
        </div>
      )}

      {/* EPS trend */}
      {quarters.filter(q => q.eps != null).length >= 2 && (
        <div className="mt-4">
          <div className="text-xs font-black text-slate-600 uppercase tracking-wide mb-2">Quarterly EPS Trend (from SEC filings)</div>
          <div className="flex gap-2">
            {quarters.filter(q => q.eps != null).map((q, i, arr) => {
              const prev = arr[i + 1]
              const up   = prev ? q.eps > prev.eps : null
              return (
                <div key={q.date} className={`flex-1 text-center rounded-lg p-2 ${i === 0 ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 border border-slate-100'}`}>
                  <div className="text-[10px] text-slate-400 font-semibold">{q.label}</div>
                  <div className={`text-sm font-black ${i === 0 ? 'text-blue-800' : 'text-slate-700'}`}>
                    ${Number(q.eps).toFixed(2)}
                  </div>
                  {up != null && (
                    <div className={`text-[10px] font-bold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
                      {up ? '▲' : '▼'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {zone && (
        <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
          <span className="font-black text-slate-700">💡 Verdict: </span>{zone.desc}
        </div>
      )}
    </Card>
  )
}

// ─── Section 4: Moat ───────────────────────────────────────────────────────────
function SectionMoat({ moat, summary }) {
  const { score, signals, verdict } = moat
  const maxScore = 9
  const barPct   = Math.max(0, Math.min((score / maxScore) * 100, 100))

  return (
    <Card title="4. What Is the Competitive Advantage?" badge={verdict.label} badgeColor={verdict.color}>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-slate-500">Moat Score</span>
          <span className="text-sm font-black text-slate-800">{score} / {maxScore}</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all duration-700 ${
              score >= 7 ? 'bg-emerald-500' : score >= 5 ? 'bg-green-500' : score >= 3 ? 'bg-blue-500' : score >= 1 ? 'bg-amber-500' : 'bg-red-400'
            }`}
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>

      {signals.length === 0 && (
        <p className="text-slate-400 text-sm mb-4">
          Need quarterly data to score the moat. Try a major US ticker (e.g. AAPL, MSFT).
        </p>
      )}

      <div className="space-y-2 mb-4">
        {signals.map((sig, i) => (
          <div key={i} className="flex items-start gap-2 bg-slate-50 rounded-xl p-2.5 border border-slate-100">
            <span className="text-sm flex-shrink-0">{sig.icon}</span>
            <span className="text-xs text-slate-700 leading-relaxed">{sig.text}</span>
          </div>
        ))}
      </div>

      <div className={`rounded-xl p-3.5 ${verdict.color} mb-4`}>
        <div className="font-black text-sm mb-0.5">{verdict.label}</div>
        <div className="text-xs opacity-90">{verdict.desc}</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'Gross Margin',     value: fmtMargin(summary.grossMargin),     icon: '💰' },
          { label: 'Op. Margin',       value: fmtMargin(summary.operatingMargin), icon: '📊' },
          { label: 'Net Margin',       value: fmtMargin(summary.netMargin),       icon: '💵' },
          { label: 'Price / Book',     value: fmtX(summary.priceToBook),          icon: '📚' },
        ].map(m => (
          <div key={m.label} className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-center">
            <div className="text-lg">{m.icon}</div>
            <div className="text-sm font-black text-slate-900">{m.value}</div>
            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 mt-3 italic">
        Moat scored from financial metrics (margins, growth, R&D). Qualitative advantages — patents, network effects, brand — may not be fully reflected.
      </p>
    </Card>
  )
}

// ─── Company header ────────────────────────────────────────────────────────────
function CompanyHeader({ summary, ticker }) {
  const { name, price, change1d, marketCap, currency } = summary
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-black text-slate-900">{name}</h1>
            <span className="text-sm font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{ticker}</span>
          </div>
          {marketCap && (
            <div className="text-xs text-slate-500 mt-0.5">Market Cap: {fmtB(marketCap)}</div>
          )}
        </div>
        <div className="text-right">
          {price != null ? (
            <div className="text-2xl font-black text-slate-900">
              {currency === 'USD' ? '$' : `${currency} `}{Number(price).toFixed(2)}
            </div>
          ) : (
            <div className="text-sm text-slate-400">Price unavailable</div>
          )}
          {change1d != null && (
            <div className={`text-sm font-bold ${change1d >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {change1d >= 0 ? '▲' : '▼'} {Math.abs(change1d).toFixed(2)}% today
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Search bar ────────────────────────────────────────────────────────────────
const QUICK_PICKS = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NFLX', 'ORCL', 'TSM']

function SearchBar({ onSubmit, loading }) {
  const [input, setInput] = useState('')

  const submit = (val) => {
    const t = (val ?? input).trim().toUpperCase()
    if (t) { setInput(t); onSubmit(t) }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Enter ticker symbol (e.g. AAPL, NVDA, GOOGL)"
          className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent shadow-sm"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          onClick={() => submit()}
          disabled={loading || !input.trim()}
          className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-sm transition-colors"
        >
          {loading ? '…' : 'Analyze'}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_PICKS.map(t => (
          <button
            key={t}
            onClick={() => submit(t)}
            className="text-xs font-bold px-2.5 py-1 bg-white border border-slate-200 rounded-full text-slate-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors"
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function StockDeepDive() {
  const { status, ticker, data, error, analyze } = useDeepDive()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Stock Deep Dive</h1>
        <p className="text-sm text-slate-500 mt-0.5">4-question fundamental analysis · Any US ticker</p>
      </div>

      <SearchBar onSubmit={analyze} loading={status === 'loading'} />

      {status === 'loading' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-indigo-100 animate-pulse" />
              <div className="h-6 w-48 bg-slate-100 rounded-lg animate-pulse" />
            </div>
            <Skeleton rows={2} />
          </div>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="h-5 w-48 bg-slate-100 rounded-lg animate-pulse mb-4" />
              <Skeleton rows={4} />
            </div>
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
          <div className="text-2xl mb-2">⚠️</div>
          <div className="font-bold text-red-700 mb-1">Analysis Failed</div>
          <div className="text-sm text-red-600 mb-3">{error}</div>
          <button
            onClick={() => analyze(ticker)}
            className="text-sm text-indigo-600 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {status === 'done' && data && (
        <>
          <CompanyHeader summary={data.summary} ticker={ticker} />
          <SectionRevenue      quarters={data.quarters} />
          <SectionProfitability quarters={data.quarters} />
          <SectionValuation    summary={data.summary} quarters={data.quarters} />
          <SectionMoat         moat={data.moat} summary={data.summary} />
        </>
      )}
    </div>
  )
}
