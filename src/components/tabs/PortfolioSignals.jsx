import React, { useState, useEffect, useCallback, useRef } from 'react'
import { fetchPrice, invalidateCache } from '../../services/priceService'

// ─────────────────────────────────────────────────────────────────────────────
// SIGNAL CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const SIG = {
  GREEN:  { label: 'STRONG HOLD', icon: '🟢', color: 'emerald', bg: 'bg-emerald-50',  border: 'border-emerald-200', badge: 'bg-emerald-600 text-white',  ring: '#10b981', text: 'text-emerald-700' },
  ORANGE: { label: 'HOLD / WATCH', icon: '🟠', color: 'amber',   bg: 'bg-amber-50',   border: 'border-amber-200',   badge: 'bg-amber-500 text-white',    ring: '#f59e0b', text: 'text-amber-700'   },
  RED:    { label: 'CONSIDER EXIT', icon: '🔴', color: 'red',     bg: 'bg-red-50',     border: 'border-red-200',     badge: 'bg-red-600 text-white',      ring: '#ef4444', text: 'text-red-700'     },
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const f$ = (n, digits = 2) =>
  n != null ? `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}` : '—'
const fPct  = (n, sign = true) => n != null ? `${sign && n > 0 ? '+' : ''}${Number(n).toFixed(1)}%` : '—'
const fNum  = (n, d = 1) => n != null ? Number(n).toFixed(d) : '—'
const fCap  = (n) => {
  if (!n) return '—'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`
  return `$${n.toLocaleString()}`
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNDAMENTALS FETCH  (proxy → allorigins fallback)
// ─────────────────────────────────────────────────────────────────────────────
const _crumbCache = { value: null, expiry: 0 }

async function getCrumb() {
  if (_crumbCache.value && _crumbCache.expiry > Date.now()) return _crumbCache.value
  try {
    const r = await fetch('/api/crumb', { signal: AbortSignal.timeout(5000) })
    if (r.ok) {
      const { crumb } = await r.json()
      if (crumb) { _crumbCache.value = crumb; _crumbCache.expiry = Date.now() + 50 * 60 * 1000 }
      return crumb || null
    }
  } catch { /* no crumb */ }
  return null
}

function rawVal(v) { return (v && typeof v === 'object' && 'raw' in v) ? v.raw : v ?? null }

function parseFundamentals(res, sym) {
  if (!res) return null
  const fd = res.financialData || {}
  const sd = res.summaryDetail || {}
  const ks = res.defaultKeyStatistics || {}
  const pr = res.price || {}
  return {
    name:             pr.longName || pr.shortName || sym,
    targetMeanPrice:  rawVal(fd.targetMeanPrice),
    targetHighPrice:  rawVal(fd.targetHighPrice),
    targetLowPrice:   rawVal(fd.targetLowPrice),
    recommendation:   fd.recommendationKey || null,
    numberOfAnalysts: rawVal(fd.numberOfAnalystOpinions),
    revenueGrowth:    rawVal(fd.revenueGrowth),
    earningsGrowth:   rawVal(fd.earningsGrowth),
    grossMargins:     rawVal(fd.grossMargins),
    operatingMargins: rawVal(fd.operatingMargins),
    returnOnEquity:   rawVal(fd.returnOnEquity),
    debtToEquity:     rawVal(fd.debtToEquity),
    currentRatio:     rawVal(fd.currentRatio),
    freeCashflow:     rawVal(fd.freeCashflow),
    forwardPE:        rawVal(sd.forwardPE)  ?? rawVal(ks.forwardPE),
    trailingPE:       rawVal(sd.trailingPE),
    beta:             rawVal(sd.beta),
    week52High:       rawVal(sd.fiftyTwoWeekHigh),
    week52Low:        rawVal(sd.fiftyTwoWeekLow),
    marketCap:        rawVal(pr.marketCap) ?? rawVal(sd.marketCap),
    pegRatio:         rawVal(ks.pegRatio),
    shortRatio:       rawVal(ks.shortRatio),
    forwardEPS:       rawVal(ks.forwardEps),
  }
}

async function fetchFundamentals(sym) {
  const modules = 'financialData,defaultKeyStatistics,summaryDetail,price'
  const t = ms => ({ signal: AbortSignal.timeout(ms) })
  const extract = d => {
    const r = d?.quoteSummary?.result?.[0]
    return r && (r.financialData || r.summaryDetail) ? r : null
  }

  // 1. Proxy with crumb
  try {
    const crumb = await getCrumb()
    const cp = crumb ? `&crumb=${encodeURIComponent(crumb)}` : ''
    const r = await fetch(`/api/quote?symbols=${encodeURIComponent(sym)}&modules=${encodeURIComponent(modules)}${cp}`, t(10000))
    if (r.ok) { const res = extract(await r.json()); if (res) return parseFundamentals(res, sym) }
  } catch { /* fall through */ }

  // 2. allorigins fallback
  for (const host of ['query2', 'query1']) {
    try {
      const yurl = `https://${host}.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=${encodeURIComponent(modules)}&formatted=false`
      const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(yurl)}`, t(12000))
      if (r.ok) { const res = extract(await r.json()); if (res) return parseFundamentals(res, sym) }
    } catch { /* try next */ }
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// NEWS FETCH + IMPACT CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────

const HIGH_IMPACT = [
  'earnings','beat','miss','guidance','revenue','profit','loss','quarterly',
  'forecast','outlook','fda','approval','merger','acquisition','buyout',
  'takeover','lawsuit','sec','investigation','fraud','bankruptcy','default',
  'layoff','ceo','cfo','resign','fired','dividend','buyback','split',
  'recall','warning','downgrade','upgrade','target price','rate','fed',
  'inflation','interest rate','tariff','sanction','results','report',
]
const POSITIVE_KW = [
  'beat','surpass','record','growth','raised','upgrade','bullish','strong',
  'exceeds','above','gain','rise','rally','soars','jumps','best','wins',
  'approved','expands','acquires','partnership','profit','positive',
  'outperform','better than expected','topped','record high','boosts',
]
const NEGATIVE_KW = [
  'miss','below','cut','downgrade','bearish','weak','disappoints','loses',
  'falls','drops','crashes','sinks','warning','concern','risk','recall',
  'investigation','lawsuit','bankruptcy','default','layoff','resign',
  'fired','fraud','decline','lower','guidance cut','loss','reduces',
  'worse than expected','selloff','plunges','tumbles','slumps','halted',
]

function classifyArticle(title) {
  const t = title.toLowerCase()
  const isHighImpact = HIGH_IMPACT.some(k => t.includes(k))
  const pos = POSITIVE_KW.filter(k => t.includes(k)).length
  const neg = NEGATIVE_KW.filter(k => t.includes(k)).length
  const sentiment = pos > neg ? 'positive' : neg > pos ? 'negative' : 'neutral'
  return { isHighImpact, sentiment }
}

function timeAgo(epochMs) {
  const diff = Date.now() - epochMs
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 2)  return 'just now'
  if (h < 1)  return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7)  return `${d}d ago`
  return new Date(epochMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

async function fetchNews(ticker) {
  // Multiple CORS proxies — tried in order until one succeeds
  const PROXIES = [
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  ]

  const BASE_URLS = [
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&newsCount=8&quotesCount=0&enableFuzzyQuery=false&enableNavLinks=false`,
    `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&newsCount=8&quotesCount=0&enableFuzzyQuery=false&enableNavLinks=false`,
  ]

  const parseNews = (data) => {
    try {
      const items = data?.news || []
      if (!items.length) return null
      return items
        .filter(n => n.title)
        .slice(0, 8)
        .map(n => ({
          title:     n.title,
          publisher: n.publisher || 'Yahoo Finance',
          link:      n.link || '#',
          time:      (n.providerPublishTime || 0) * 1000,
          ...classifyArticle(n.title),
        }))
        .sort((a, b) => {
          if (a.isHighImpact !== b.isHighImpact) return a.isHighImpact ? -1 : 1
          return b.time - a.time
        })
    } catch { return null }
  }

  for (const baseUrl of BASE_URLS) {
    for (const makeProxy of PROXIES) {
      // Fresh AbortController per attempt — never reuse a timed-out signal
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 9000)
      try {
        const r = await fetch(makeProxy(baseUrl), { signal: ctrl.signal })
        clearTimeout(timer)
        if (!r.ok) continue
        const text = await r.text()
        let data
        try { data = JSON.parse(text) } catch { continue } // proxy returned HTML, skip
        const result = parseNews(data)
        if (result?.length) return result
      } catch {
        clearTimeout(timer)
        /* try next */
      }
    }
  }
  return []
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING ENGINE  — 10 factors, confidence-weighted, 0-100 scale
// ─────────────────────────────────────────────────────────────────────────────
function scoreEngine(holding, priceData, fund) {
  const { ticker, shares, cost } = holding
  const price = priceData?.price
  if (!price || price <= 0) return null

  const plPct    = cost > 0 ? ((price - cost) / cost) * 100 : 0
  const equity   = price * shares
  const costBasis = cost * shares
  const pl       = equity - costBasis

  const target   = fund?.targetMeanPrice
  const targetUp = (target && price) ? ((target - price) / price) * 100 : null
  const rec      = (fund?.recommendation || '').toLowerCase().replace(/_/g, ' ')
  const nAna     = fund?.numberOfAnalysts || 0
  const revG     = fund?.revenueGrowth
  const epsG     = fund?.earningsGrowth
  const fpe      = fund?.forwardPE
  const peg      = fund?.pegRatio
  const opM      = fund?.operatingMargins
  const beta     = fund?.beta || 1
  const w52H     = priceData?.week52High || fund?.week52High
  const w52L     = priceData?.week52Low  || fund?.week52Low
  const fromHigh = w52H ? ((price - w52H) / w52H) * 100 : null
  const fromLow  = w52L ? ((price - w52L) / w52L) * 100 : null
  const roe      = fund?.returnOnEquity
  const dte      = fund?.debtToEquity
  const shortR   = fund?.shortRatio

  let score = 50
  let dataPoints = 0, availablePoints = 0
  const factors = []

  const addFactor = (name, maxPts, value, pts, pos, detail, hasData = true) => {
    if (hasData) { dataPoints++; availablePoints++ } else availablePoints++
    score += pts
    factors.push({ name, maxPts, value, score: pts, pos, detail, hasData })
  }

  // ── 1. Analyst Consensus  ±20 ─────────────────────────────────────────────
  {
    let pts = 0, pos = null, val = 'No data', detail = 'No analyst coverage'
    const hasData = !!rec && rec !== 'n/a'
    if (hasData) {
      val = rec
      detail = `${nAna} analyst${nAna !== 1 ? 's' : ''}`
      if (rec.includes('strong buy'))  { pts = 20;  pos = true  }
      else if (rec === 'buy')          { pts = 12;  pos = true  }
      else if (rec === 'hold' || rec === 'neutral') { pts = 0; pos = null; detail += ' · neutral consensus' }
      else if (rec.includes('underperform')) { pts = -10; pos = false }
      else if (rec.includes('strong sell')) { pts = -20; pos = false }
      else if (rec.includes('sell'))   { pts = -14; pos = false }
    }
    addFactor('Analyst Consensus', 20, val, pts, pos, detail, hasData)
  }

  // ── 2. Price Target Upside  ±18 ──────────────────────────────────────────
  {
    let pts = 0, pos = null
    const hasData = targetUp !== null
    const val  = hasData ? `${targetUp.toFixed(1)}%` : 'No data'
    let detail = hasData ? `Target $${target?.toFixed(2)} vs current $${price.toFixed(2)}` : 'No price target'
    if (hasData) {
      if      (targetUp > 40) { pts = 18; pos = true;  detail = `Strong upside: ${targetUp.toFixed(0)}% to $${target?.toFixed(2)}` }
      else if (targetUp > 25) { pts = 14; pos = true;  detail = `Good upside: ${targetUp.toFixed(0)}% to $${target?.toFixed(2)}` }
      else if (targetUp > 12) { pts = 10; pos = true;  detail = `Moderate upside: ${targetUp.toFixed(0)}% to $${target?.toFixed(2)}` }
      else if (targetUp > 5)  { pts = 5;  pos = true;  detail = `Modest upside: ${targetUp.toFixed(0)}% to $${target?.toFixed(2)}` }
      else if (targetUp > -5) { pts = 0;  pos = null;  detail = `Near analyst target of $${target?.toFixed(2)}` }
      else if (targetUp > -15){ pts = -8; pos = false; detail = `${Math.abs(targetUp).toFixed(0)}% above analyst target — stretched` }
      else if (targetUp > -25){ pts = -14;pos = false; detail = `${Math.abs(targetUp).toFixed(0)}% above analyst target — overvalued` }
      else                    { pts = -18;pos = false; detail = `${Math.abs(targetUp).toFixed(0)}% above target — significantly overvalued` }
    }
    addFactor('Price Target Upside', 18, val, pts, pos, detail, hasData)
  }

  // ── 3. Revenue Growth  ±15 ───────────────────────────────────────────────
  {
    let pts = 0, pos = null
    const hasData = revG != null
    const val    = hasData ? fPct(revG * 100, false) + ' YoY' : 'No data'
    let detail   = hasData ? 'Year-over-year revenue trend' : 'No revenue data'
    if (hasData) {
      const p = revG * 100
      if      (p > 30)  { pts = 15; pos = true;  detail = `Rapid growth ${p.toFixed(0)}% YoY — high-growth company` }
      else if (p > 15)  { pts = 10; pos = true;  detail = `Strong growth ${p.toFixed(0)}% YoY` }
      else if (p > 5)   { pts = 6;  pos = true;  detail = `Solid growth ${p.toFixed(0)}% YoY` }
      else if (p > 0)   { pts = 2;  pos = null;  detail = `Modest growth ${p.toFixed(1)}% YoY` }
      else if (p > -5)  { pts = -3; pos = null;  detail = `Near-flat revenue, slight decline` }
      else if (p > -15) { pts = -8; pos = false; detail = `Revenue declining ${Math.abs(p).toFixed(0)}% — headwind` }
      else              { pts = -15;pos = false; detail = `Revenue falling ${Math.abs(p).toFixed(0)}% — serious concern` }
    }
    addFactor('Revenue Growth', 15, val, pts, pos, detail, hasData)
  }

  // ── 4. Earnings Growth  ±10 ──────────────────────────────────────────────
  {
    let pts = 0, pos = null
    const hasData = epsG != null
    const val    = hasData ? fPct(epsG * 100, false) + ' YoY' : 'No data'
    let detail   = hasData ? 'Earnings growth trend' : 'No earnings data'
    if (hasData) {
      const p = epsG * 100
      if      (p > 30)  { pts = 10; pos = true;  detail = `Strong earnings growth ${p.toFixed(0)}%` }
      else if (p > 10)  { pts = 7;  pos = true;  detail = `Good earnings growth ${p.toFixed(0)}%` }
      else if (p > 0)   { pts = 3;  pos = true;  detail = `Positive earnings trend +${p.toFixed(1)}%` }
      else if (p > -10) { pts = -3; pos = null;  detail = `Slight earnings pressure ${p.toFixed(1)}%` }
      else if (p > -20) { pts = -7; pos = false; detail = `Earnings declining ${Math.abs(p).toFixed(0)}%` }
      else              { pts = -10;pos = false; detail = `Sharp earnings decline ${Math.abs(p).toFixed(0)}%` }
    }
    addFactor('Earnings Growth', 10, val, pts, pos, detail, hasData)
  }

  // ── 5. Operating Margin  ±8 ──────────────────────────────────────────────
  {
    let pts = 0, pos = null
    const hasData = opM != null
    const val    = hasData ? fPct(opM * 100, false) : 'No data'
    let detail   = hasData ? 'Profitability efficiency' : 'No margin data'
    if (hasData) {
      const p = opM * 100
      if      (p > 30) { pts = 8;  pos = true;  detail = `Excellent margin ${p.toFixed(0)}% — highly profitable` }
      else if (p > 20) { pts = 6;  pos = true;  detail = `Strong margin ${p.toFixed(0)}%` }
      else if (p > 10) { pts = 3;  pos = true;  detail = `Healthy margin ${p.toFixed(0)}%` }
      else if (p > 0)  { pts = 0;  pos = null;  detail = `Low but positive margin ${p.toFixed(1)}%` }
      else             { pts = -8; pos = false; detail = `Operating loss — margin ${p.toFixed(1)}%` }
    }
    addFactor('Operating Margin', 8, val, pts, pos, detail, hasData)
  }

  // ── 6. Forward P/E Valuation  ±8 ────────────────────────────────────────
  {
    let pts = 0, pos = null
    const hasData = fpe != null && fpe > 0
    const val    = hasData ? `${fpe.toFixed(1)}×` : 'No data'
    let detail   = hasData ? 'Forward price-to-earnings' : 'No P/E data'
    if (hasData) {
      if      (fpe < 12)  { pts = 8;  pos = true;  detail = `Deep value at ${fpe.toFixed(1)}× fwd P/E` }
      else if (fpe < 20)  { pts = 6;  pos = true;  detail = `Reasonable valuation ${fpe.toFixed(1)}× fwd P/E` }
      else if (fpe < 30)  { pts = 3;  pos = true;  detail = `Fair valuation ${fpe.toFixed(1)}× fwd P/E` }
      else if (fpe < 50)  { pts = 0;  pos = null;  detail = `Premium valuation ${fpe.toFixed(1)}× fwd P/E` }
      else if (fpe < 80)  { pts = -5; pos = false; detail = `Stretched at ${fpe.toFixed(1)}× fwd P/E` }
      else                { pts = -8; pos = false; detail = `Expensive at ${fpe.toFixed(1)}× fwd P/E` }
    }
    addFactor('Forward P/E', 8, val, pts, pos, detail, hasData)
  }

  // ── 7. PEG Ratio  ±8 ────────────────────────────────────────────────────
  {
    let pts = 0, pos = null
    const hasData = peg != null && peg > 0
    const val    = hasData ? fNum(peg, 2) : 'No data'
    let detail   = hasData ? 'Price/Earnings-to-Growth ratio' : 'No PEG data'
    if (hasData) {
      if      (peg < 0.8)  { pts = 8;  pos = true;  detail = `Undervalued vs growth (PEG ${peg.toFixed(2)})` }
      else if (peg < 1.2)  { pts = 5;  pos = true;  detail = `Fair growth pricing (PEG ${peg.toFixed(2)})` }
      else if (peg < 2.0)  { pts = 2;  pos = null;  detail = `Slightly elevated PEG ${peg.toFixed(2)}` }
      else if (peg < 3.0)  { pts = -3; pos = false; detail = `Expensive vs growth (PEG ${peg.toFixed(2)})` }
      else                  { pts = -8; pos = false; detail = `Very expensive vs growth (PEG ${peg.toFixed(2)})` }
    }
    addFactor('PEG Ratio', 8, val, pts, pos, detail, hasData)
  }

  // ── 8. Position P&L vs Cost  ±8 ─────────────────────────────────────────
  {
    let pts = 0, pos = null
    const val    = fPct(plPct)
    let detail   = `Cost basis ${f$(cost)} · Current ${f$(price)}`
    if      (plPct > 100) { pts = -3; pos = null;  detail = `Up ${plPct.toFixed(0)}% — very extended, consider taking profits` }
    else if (plPct > 50)  { pts = 3;  pos = true;  detail = `Up ${plPct.toFixed(0)}% — strong position` }
    else if (plPct > 15)  { pts = 5;  pos = true;  detail = `Up ${plPct.toFixed(0)}% — healthy gain` }
    else if (plPct > 0)   { pts = 2;  pos = true;  detail = `Slight gain from cost` }
    else if (plPct > -15) { pts = -1; pos = null;  detail = `Small loss ${plPct.toFixed(1)}% — in recovery zone` }
    else if (plPct > -30) { pts = -5; pos = false; detail = `Down ${Math.abs(plPct).toFixed(0)}% — notable loss` }
    else                  { pts = -8; pos = false; detail = `Down ${Math.abs(plPct).toFixed(0)}% — significant unrealized loss` }
    addFactor('Position P&L', 8, val, pts, pos, detail, true)
  }

  // ── 9. 52-Week Momentum  ±7 ──────────────────────────────────────────────
  {
    let pts = 0, pos = null
    const hasData = fromHigh != null
    const val    = hasData ? `${fromHigh.toFixed(1)}% from 52w high` : 'No data'
    let detail   = hasData ? `52w range ${f$(w52L)} – ${f$(w52H)}` : 'No range data'
    if (hasData) {
      if      (fromHigh > -5)   { pts = 7;  pos = true;  detail = `Near 52w high — strong momentum` }
      else if (fromHigh > -15)  { pts = 4;  pos = true;  detail = `${Math.abs(fromHigh).toFixed(0)}% below 52w high — healthy pullback` }
      else if (fromHigh > -30)  { pts = 0;  pos = null;  detail = `${Math.abs(fromHigh).toFixed(0)}% below 52w high — mid range` }
      else if (fromHigh > -50)  {
        pts = fromLow != null && fromLow < 20 ? 3 : -4
        pos = pts > 0 ? null : false
        detail = fromLow != null && fromLow < 20 ? 'Near 52w low — potential value entry' : `${Math.abs(fromHigh).toFixed(0)}% off highs — weak momentum`
      } else                    { pts = -7; pos = false; detail = `${Math.abs(fromHigh).toFixed(0)}% below 52w high — very weak momentum` }
    }
    addFactor('52-Week Momentum', 7, val, pts, pos, detail, hasData)
  }

  // ── 10. Debt & Financial Health  ±4 ──────────────────────────────────────
  {
    let pts = 0, pos = null
    const hasData = dte != null
    const val    = hasData ? `${dte.toFixed(1)}` : 'No data'
    let detail   = hasData ? 'Debt-to-equity ratio' : 'No debt data'
    if (hasData) {
      if      (dte < 0.3)  { pts = 4;  pos = true;  detail = `Low debt (D/E ${dte.toFixed(2)}) — strong balance sheet` }
      else if (dte < 1.0)  { pts = 2;  pos = true;  detail = `Manageable debt (D/E ${dte.toFixed(2)})` }
      else if (dte < 2.0)  { pts = 0;  pos = null;  detail = `Moderate debt (D/E ${dte.toFixed(2)})` }
      else if (dte < 4.0)  { pts = -2; pos = false; detail = `High debt (D/E ${dte.toFixed(2)}) — leverage risk` }
      else                  { pts = -4; pos = false; detail = `Very high debt (D/E ${dte.toFixed(2)}) — significant leverage` }
    }
    addFactor('Debt / Balance Sheet', 4, val, pts, pos, detail, hasData)
  }

  // ── Final score & signal ──────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, Math.round(score)))
  const signal = score >= 63 ? 'GREEN' : score <= 37 ? 'RED' : 'ORANGE'
  const confidence = Math.round((dataPoints / factors.length) * 100)

  // ── Price recommendations ─────────────────────────────────────────────────
  const trailPct  = beta > 2 ? 0.22 : beta > 1.5 ? 0.18 : beta > 1.0 ? 0.13 : 0.10
  const stopLoss  = Math.max(cost * 0.85, price * (1 - trailPct))
  const dipTarget = price * (1 - Math.min(0.12, Math.max(0.05, Math.abs((fromHigh || 0) / 150))))
  const sellBounce = price * 1.03

  let action = '', actionDetail = '', actionType = ''
  let sellAt = null, stopAt = null, addAt = null

  if (signal === 'RED') {
    actionType = 'exit'
    stopAt  = price * 0.93  // tight stop
    if (targetUp !== null && targetUp < -10) {
      action = `Sell — trading ${Math.abs(targetUp).toFixed(0)}% above analyst target`
      actionDetail = `Exit at market or set limit at ${f$(sellBounce)}. Analysts see ${Math.abs(targetUp).toFixed(0)}% downside to $${target?.toFixed(2)}.`
      sellAt = price
    } else if (plPct < -30) {
      action = `Cut losses — down ${Math.abs(plPct).toFixed(0)}% with weak fundamentals`
      actionDetail = `Consider exiting to stop further losses. If holding, set hard stop at ${f$(stopAt)}.`
      sellAt = price
    } else {
      action = `Consider reducing — weak fundamental score`
      actionDetail = `Use any rally to reduce position. Sell into strength near ${f$(sellBounce)}.`
      sellAt = sellBounce
    }
  } else if (signal === 'ORANGE') {
    actionType = 'hold'
    stopAt = stopLoss
    addAt  = null
    if (plPct > 0) {
      action = `Hold and protect — set stop-loss to lock in gains`
      actionDetail = `Protect your ${fPct(plPct)} gain. Exit if price closes below ${f$(stopAt)}. Reassess if fundamentals deteriorate.`
    } else {
      action = `Hold for recovery — monitor closely`
      actionDetail = `Position is ${fPct(plPct)} from cost. Hold with stop-loss at ${f$(stopAt)}. Watch for fundamental improvement.`
    }
    if (targetUp && targetUp > 10) addAt = dipTarget
  } else {
    // GREEN
    actionType = 'add'
    stopAt = Math.max(cost * 0.90, price * (1 - trailPct))
    addAt  = dipTarget
    action = `Strong hold — conviction position`
    const upStr = targetUp ? ` — analyst target ${f$(target)} (+${targetUp.toFixed(0)}%)` : ''
    actionDetail = `Maintain position${upStr}. Add more at ${f$(addAt)} on dips. Trailing stop at ${f$(stopAt)}.`
  }

  // Risk/Reward ratio
  const reward = target ? (target - price) : (price * 0.15)
  const risk   = price - stopAt
  const rr = risk > 0 ? (reward / risk).toFixed(1) : '—'

  return {
    ticker, shares, cost, price, plPct, equity, pl,
    signal, score, confidence,
    factors,
    target, targetUp, rec, nAna,
    revG, epsG, fpe, peg, opM, beta, roe, dte, shortR,
    w52H, w52L, fromHigh, fromLow,
    sellAt, stopAt, addAt,
    action, actionDetail, actionType,
    riskReward: rr,
    name: fund?.name || ticker,
    marketCap: fund?.marketCap,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CIRCULAR SCORE GAUGE
// ─────────────────────────────────────────────────────────────────────────────
function ScoreGauge({ score, signal, size = 64 }) {
  const S = SIG[signal]
  const r = (size / 2) - 5
  const circ = 2 * Math.PI * r
  const filled = circ * (score / 100)
  const colors = { GREEN: '#10b981', ORANGE: '#f59e0b', RED: '#ef4444' }
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={colors[signal]} strokeWidth="5"
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-base font-black leading-none ${S.text}`}>{score}</span>
        <span className="text-[8px] text-slate-400 font-bold">/ 100</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 52-WEEK PRICE LADDER
// ─────────────────────────────────────────────────────────────────────────────
function PriceLadder({ price, low, high }) {
  if (!low || !high || low >= high) return null
  const pct = Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100))
  return (
    <div className="w-full">
      <div className="relative h-1.5 bg-slate-200 rounded-full">
        <div className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%`, background: pct > 70 ? '#10b981' : pct > 35 ? '#f59e0b' : '#ef4444' }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-600 shadow"
          style={{ left: `calc(${pct}% - 5px)` }} />
      </div>
      <div className="flex justify-between text-[9px] text-slate-400 font-bold mt-0.5">
        <span>{f$(low, 0)}</span>
        <span className="text-slate-500">52-week range</span>
        <span>{f$(high, 0)}</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORE BREAKDOWN MODAL
// ─────────────────────────────────────────────────────────────────────────────
function ScoreModal({ sig, onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  if (!sig) return null
  const S = SIG[sig.signal]
  let running = 50

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-3xl border-b border-slate-100 px-6 pt-5 pb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <ScoreGauge score={sig.score} signal={sig.signal} size={52} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black">{sig.ticker}</span>
                  <span className={`text-xs font-black px-2.5 py-1 rounded-full ${S.badge}`}>{S.icon} {S.label}</span>
                </div>
                <div className="text-sm text-slate-500 mt-0.5">{sig.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Data confidence: <strong className="text-slate-600">{sig.confidence}%</strong>
                  {sig.confidence < 60 && <span className="text-amber-500 ml-1">· Low data — interpret carefully</span>}
                </div>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-700 text-2xl font-bold transition-colors ml-3">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Score bar */}
          <div className="bg-slate-50 rounded-2xl p-4">
            <div className="flex justify-between text-xs font-black text-slate-400 mb-2 uppercase tracking-wider">
              <span>Sell Zone (0–37)</span><span>Hold (38–62)</span><span>Strong Hold (63–100)</span>
            </div>
            <div className="relative h-4 rounded-full overflow-hidden">
              <div className="absolute inset-0 flex">
                <div className="bg-red-200"   style={{ width: '37%' }} />
                <div className="bg-amber-200" style={{ width: '26%' }} />
                <div className="bg-emerald-200" style={{ width: '37%' }} />
              </div>
              <div className={`absolute top-0 left-0 h-full rounded-full ${
                sig.signal === 'GREEN' ? 'bg-emerald-500' : sig.signal === 'RED' ? 'bg-red-500' : 'bg-amber-500'
              }`} style={{ width: `${sig.score}%` }} />
              <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-slate-800 shadow"
                style={{ left: `calc(${sig.score}% - 6px)` }} />
            </div>
          </div>

          {/* 10-Factor Scorecard */}
          <div>
            <div className="text-sm font-black text-slate-500 uppercase tracking-wider mb-3">10-Factor Scorecard</div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_80px_60px_40px] gap-2 px-3 mb-1">
              <div className="text-xs font-black text-slate-400">Factor</div>
              <div className="text-xs font-black text-slate-400 text-right">Value</div>
              <div className="text-xs font-black text-slate-400 text-center">Impact</div>
              <div className="text-xs font-black text-slate-400 text-right">Pts</div>
            </div>

            {/* Base row */}
            <div className="grid grid-cols-[1fr_80px_60px_40px] gap-2 items-center px-3 py-2 mb-1 bg-slate-100 rounded-xl">
              <span className="text-sm font-bold text-slate-500">Base Score</span>
              <span className="text-xs text-slate-400 text-right">—</span>
              <div className="flex justify-center"><div className="h-1.5 w-6 bg-slate-400 rounded-full" /></div>
              <span className="text-sm font-black text-slate-600 text-right">+50</span>
            </div>

            {sig.factors.map((f, i) => {
              running += f.score
              const clamped = Math.max(0, Math.min(100, running))
              const barW = Math.round((Math.abs(f.score) / 20) * 48)
              return (
                <div key={i} className={`grid grid-cols-[1fr_80px_60px_40px] gap-2 items-center px-3 py-2.5 mb-1 rounded-xl ${
                  !f.hasData ? 'bg-slate-50 opacity-60' :
                  f.pos === true ? 'bg-emerald-50' : f.pos === false ? 'bg-red-50' : 'bg-white border border-slate-100'
                }`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{f.pos === true ? '✅' : f.pos === false ? '❌' : '⚪'}</span>
                      <span className={`text-sm font-bold ${
                        f.pos === true ? 'text-emerald-800' : f.pos === false ? 'text-red-800' : 'text-slate-600'
                      }`}>{f.name}</span>
                      <span className="text-[9px] text-slate-300 font-bold">±{f.maxPts}</span>
                    </div>
                    <div className={`text-xs mt-0.5 ml-5 leading-snug ${
                      f.pos === true ? 'text-emerald-600' : f.pos === false ? 'text-red-500' : 'text-slate-400'
                    }`}>{f.detail}</div>
                  </div>
                  <div className="text-xs font-semibold text-slate-500 text-right truncate">{f.value}</div>
                  <div className="flex items-center justify-center">
                    {f.score !== 0 ? (
                      <div className={`h-1.5 rounded-full ${f.score > 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                        style={{ width: `${Math.max(4, barW)}px` }} />
                    ) : <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />}
                  </div>
                  <div className={`text-sm font-black text-right ${
                    f.score > 0 ? 'text-emerald-600' : f.score < 0 ? 'text-red-600' : 'text-slate-400'
                  }`}>{f.score > 0 ? `+${f.score}` : f.score === 0 ? '—' : f.score}</div>
                </div>
              )
            })}

            {/* Final row */}
            <div className={`grid grid-cols-[1fr_80px_60px_40px] gap-2 items-center px-3 py-3 rounded-xl border-2 mt-2 ${
              sig.signal === 'GREEN' ? 'bg-emerald-100 border-emerald-300' :
              sig.signal === 'RED'   ? 'bg-red-100 border-red-300' : 'bg-amber-100 border-amber-300'
            }`}>
              <span className={`text-sm font-black ${S.text}`}>Final Score</span>
              <span className="text-xs text-slate-400 text-right">{sig.confidence}% data</span>
              <span />
              <span className={`text-xl font-black text-right ${S.text}`}>{sig.score}</span>
            </div>
          </div>

          {/* Risk / Reward */}
          {sig.riskReward !== '—' && (
            <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-4">
              <div>
                <div className="text-xs font-black text-slate-400 uppercase tracking-wider">Risk / Reward</div>
                <div className="text-2xl font-black text-slate-800 mt-0.5">1 : {sig.riskReward}</div>
              </div>
              <div className="flex-1 text-xs text-slate-400 leading-relaxed">
                Risk: ${(sig.price - sig.stopAt).toFixed(2)} downside to stop {f$(sig.stopAt)}<br />
                Reward: ${sig.target ? (sig.target - sig.price).toFixed(2) : 'N/A'} upside to analyst target
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="text-xs text-slate-400 bg-slate-50 rounded-xl px-4 py-3 leading-relaxed">
            Score starts at 50 (neutral). Each factor adds or subtracts points based on real fundamental data from Yahoo Finance.
            Score ≤37 = Consider Exit, 38–62 = Hold/Watch, ≥63 = Strong Hold. Confidence reflects what % of the 10 factors have live data.
            <strong className="text-slate-500"> Not financial advice.</strong>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGNAL CARD
// ─────────────────────────────────────────────────────────────────────────────
function SignalCard({ sig, onScoreClick }) {
  const [expanded, setExpanded] = useState(false)
  const S = SIG[sig.signal]

  const actionColors = {
    exit: 'bg-red-100 border-red-300 text-red-800',
    hold: 'bg-amber-100 border-amber-300 text-amber-800',
    add:  'bg-emerald-100 border-emerald-300 text-emerald-800',
  }

  const priceBoxes = sig.signal === 'RED'
    ? [
        { label: 'Sell At',      val: sig.sellAt, color: 'text-red-600' },
        { label: 'Stop Loss',    val: sig.stopAt, color: 'text-amber-600' },
        { label: 'Analyst Tgt', val: sig.target,  color: 'text-blue-600' },
      ]
    : sig.signal === 'ORANGE'
    ? [
        { label: 'Stop Loss',   val: sig.stopAt, color: 'text-amber-600' },
        { label: 'Analyst Tgt', val: sig.target,  color: 'text-blue-600' },
        { label: 'Add On Dip',  val: sig.addAt,   color: 'text-emerald-600' },
      ]
    : [
        { label: 'Trailing Stop', val: sig.stopAt, color: 'text-amber-600' },
        { label: 'Add On Dip',   val: sig.addAt,   color: 'text-emerald-600' },
        { label: 'Analyst Tgt',  val: sig.target,  color: 'text-blue-600' },
      ]

  return (
    <div className={`${S.bg} border-2 ${S.border} rounded-2xl overflow-hidden shadow-sm`}>

      {/* ── Card Header ── */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl font-black text-slate-900">{sig.ticker}</span>
              <span className={`text-xs font-black px-2.5 py-1 rounded-full ${S.badge}`}>{S.icon} {S.label}</span>
              {sig.rec && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-white/70 text-slate-600 rounded border border-slate-200 uppercase">
                  {sig.rec} · {sig.nAna} analysts
                </span>
              )}
              {sig.confidence < 50 && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded border border-amber-200">
                  ⚠ Limited data
                </span>
              )}
            </div>
            <div className="text-sm text-slate-500 font-semibold mt-0.5 truncate">{sig.name}</div>
          </div>

          {/* Score circle — clickable */}
          <button onClick={() => onScoreClick(sig)}
            className="flex-shrink-0 flex flex-col items-center group focus:outline-none"
            title="Click to see score breakdown">
            <ScoreGauge score={sig.score} signal={sig.signal} size={60} />
            <span className="text-[9px] text-slate-400 font-bold mt-0.5 group-hover:text-blue-500 transition-colors">TAP FOR DETAILS</span>
          </button>
        </div>

        {/* Price line */}
        <div className="flex items-baseline gap-3 mt-2 flex-wrap">
          <span className="text-3xl font-black text-slate-900">{f$(sig.price)}</span>
          <span className={`text-base font-bold ${sig.plPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {fPct(sig.plPct)} from cost {f$(sig.cost)}
          </span>
          {sig.marketCap && (
            <span className="text-xs text-slate-400 font-semibold">Mkt cap {fCap(sig.marketCap)}</span>
          )}
        </div>

        {/* 52-week price ladder */}
        {sig.w52H && sig.w52L && (
          <div className="mt-2">
            <PriceLadder price={sig.price} low={sig.w52L} high={sig.w52H} />
          </div>
        )}
      </div>

      {/* ── Action Box ── */}
      <div className={`mx-4 mb-3 px-4 py-3 rounded-xl border-2 ${actionColors[sig.actionType] || actionColors.hold}`}>
        <div className="text-sm font-black mb-1">{sig.action}</div>
        <div className="text-xs leading-relaxed opacity-80">{sig.actionDetail}</div>
        {sig.riskReward !== '—' && (
          <div className="mt-1.5 text-xs font-black opacity-70">⚖ Risk / Reward: 1 : {sig.riskReward}</div>
        )}
      </div>

      {/* ── Price Targets ── */}
      <div className="grid grid-cols-3 gap-2 px-4 mb-3">
        {priceBoxes.map(({ label, val, color }) => (
          <div key={label} className="bg-white/70 rounded-xl px-3 py-2.5 text-center border border-white">
            <div className="text-[10px] font-black text-slate-400 uppercase mb-0.5">{label}</div>
            <div className={`text-sm font-black ${val != null ? color : 'text-slate-300'}`}>
              {val != null ? f$(val) : '—'}
            </div>
          </div>
        ))}
      </div>

      {/* ── Key Metrics Row ── */}
      <div className="grid grid-cols-4 gap-1.5 px-4 mb-3">
        {[
          ['Fwd P/E', sig.fpe != null ? `${sig.fpe.toFixed(1)}×` : null],
          ['PEG',     sig.peg != null ? sig.peg.toFixed(2) : null],
          ['Beta',    sig.beta != null ? sig.beta.toFixed(2) : null],
          ['Rev Gr',  sig.revG != null ? fPct(sig.revG * 100) : null],
        ].map(([k, v]) => (
          <div key={k} className="bg-white/50 rounded-lg px-2 py-1.5 text-center">
            <div className="text-[9px] font-black text-slate-400 uppercase">{k}</div>
            <div className="text-xs font-black text-slate-700 mt-0.5">{v || '—'}</div>
          </div>
        ))}
      </div>

      {/* ── News Section ── */}
      {sig.news && sig.news.length > 0 && (
        <div className="px-4 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">📰 Latest News</span>
            {sig.news.some(n => n.isHighImpact) && (
              <span className="text-[9px] font-black px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full border border-red-200">
                ⚡ Critical
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {sig.news.slice(0, 4).map((item, i) => {
              const bg = item.isHighImpact
                ? item.sentiment === 'negative'
                  ? 'bg-red-50 border-red-200 hover:bg-red-100'
                  : item.sentiment === 'positive'
                  ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-amber-50 border-amber-200 hover:bg-amber-100'
                : 'bg-white/70 border-slate-100 hover:bg-white'
              const icon = item.isHighImpact
                ? item.sentiment === 'negative' ? '🔴'
                  : item.sentiment === 'positive' ? '🟢' : '🟡'
                : '📄'
              const badge = item.isHighImpact
                ? item.sentiment === 'negative'
                  ? 'bg-red-100 text-red-600'
                  : item.sentiment === 'positive'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
                : 'bg-slate-100 text-slate-400'
              return (
                <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
                  className={`flex items-start gap-2 px-3 py-2 rounded-xl border transition-colors cursor-pointer ${bg}`}>
                  <span className="text-sm flex-shrink-0 mt-0.5">{icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-800 leading-snug" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {item.isHighImpact && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${badge}`}>
                          {item.sentiment === 'negative' ? '⚠ HIGH IMPACT' : item.sentiment === 'positive' ? '✦ BULLISH' : '⚡ WATCH'}
                        </span>
                      )}
                      <span className="text-[9px] text-slate-400">{item.publisher}</span>
                      <span className="text-[9px] text-slate-300">·</span>
                      <span className="text-[9px] text-slate-400">{timeAgo(item.time)}</span>
                    </div>
                  </div>
                  <span className="text-slate-300 text-xs flex-shrink-0 mt-1">↗</span>
                </a>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Expand Toggle ── */}
      <button onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-2.5 border-t border-white/50 text-xs font-bold text-slate-500 hover:bg-white/30 flex items-center justify-between transition-colors">
        <span>📊 {expanded ? 'Hide' : 'Show'} factor details · {sig.confidence}% data confidence{sig.news?.length > 4 ? ` · +${sig.news.length - 4} more news` : ''}</span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>

      {/* ── Expanded Details ── */}
      {expanded && (
        <div className="px-5 pb-4 pt-1 space-y-1.5">
          {sig.factors.filter(f => f.score !== 0 || f.hasData).map((f, i) => (
            <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg ${
              !f.hasData ? 'opacity-50' : f.pos === true ? 'bg-emerald-50' : f.pos === false ? 'bg-red-50' : ''
            }`}>
              <span className="text-sm flex-shrink-0">{f.pos === true ? '✅' : f.pos === false ? '❌' : '⚪'}</span>
              <div className="min-w-0">
                <div className={`text-sm font-bold ${f.pos === true ? 'text-emerald-800' : f.pos === false ? 'text-red-700' : 'text-slate-600'}`}>
                  {f.name}
                  <span className={`ml-2 text-xs font-black ${f.score > 0 ? 'text-emerald-600' : f.score < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                    {f.score > 0 ? `+${f.score}` : f.score < 0 ? f.score : '±0'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{f.detail} · <em>{f.value}</em></div>
              </div>
            </div>
          ))}

          {/* Extra news (5th+) */}
          {sig.news?.length > 4 && (
            <div className="mt-3 pt-3 border-t border-white/50 space-y-1.5">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">More News</div>
              {sig.news.slice(4).map((item, i) => (
                <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
                  className="flex items-start gap-2 px-3 py-2 rounded-lg bg-white/60 border border-slate-100 hover:bg-white transition-colors">
                  <span className="text-xs flex-shrink-0 mt-0.5">
                    {item.isHighImpact ? (item.sentiment === 'negative' ? '🔴' : item.sentiment === 'positive' ? '🟢' : '🟡') : '📄'}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs text-slate-700 leading-snug" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.title}
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5">{item.publisher} · {timeAgo(item.time)}</div>
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* Extra metrics */}
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/50">
            {[
              ['Op Margin', sig.opM  != null ? fPct(sig.opM * 100, false) : null],
              ['ROE',       sig.roe  != null ? fPct(sig.roe * 100, false) : null],
              ['D/E Ratio', sig.dte  != null ? sig.dte.toFixed(2) : null],
              ['Short Rat', sig.shortR != null ? sig.shortR.toFixed(1) : null],
              ['EPS Gr',    sig.epsG != null ? fPct(sig.epsG * 100) : null],
              ['Tgt High',  sig.targetUp != null ? f$(sig.target) : null],
            ].map(([k, v]) => (
              <div key={k} className="bg-white/50 rounded-lg px-2 py-2 text-center">
                <div className="text-[9px] font-black text-slate-400 uppercase">{k}</div>
                <div className="text-xs font-black text-slate-700 mt-0.5">{v || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function PortfolioSignals({ portfolios = {}, defaultPortfolioId = '' }) {
  const portfolioNames = Object.keys(portfolios)
  const initialId      = defaultPortfolioId && portfolios[defaultPortfolioId]
                           ? defaultPortfolioId
                           : portfolioNames[0] || ''

  const [selectedId,  setSelectedId]  = useState(initialId)
  const [signals,     setSignals]     = useState([])
  const [loading,     setLoading]     = useState(false)
  const [progress,    setProgress]    = useState(0)
  const [current,     setCurrent]     = useState('')
  const [lastRun,     setLastRun]     = useState(null)
  const [filter,      setFilter]      = useState('ALL')
  const [scoreModal,  setScoreModal]  = useState(null)
  const abortRef    = useRef(false)
  // keep a stable ref to the portfolios object so effects can read latest without stale closure
  const portfoliosRef = useRef(portfolios)
  useEffect(() => { portfoliosRef.current = portfolios }, [portfolios])

  // ── Core analysis runner — defined FIRST so effects below can reference it ──
  const runAnalysis = useCallback(async (holdingsToAnalyze) => {
    if (!holdingsToAnalyze || !holdingsToAnalyze.length) return
    abortRef.current = false
    setLoading(true)
    setProgress(0)
    setSignals([])
    setCurrent('')

    try {
      invalidateCache(...holdingsToAnalyze.map(h => h.ticker))
    } catch { /* ignore if no args */ }

    const results = []
    for (let i = 0; i < holdingsToAnalyze.length; i++) {
      if (abortRef.current) break
      const h = holdingsToAnalyze[i]
      setCurrent(h.ticker)
      try {
        const [priceData, fund, news] = await Promise.all([
          fetchPrice(h.ticker),
          fetchFundamentals(h.ticker),
          fetchNews(h.ticker),
        ])
        const sig = scoreEngine(h, priceData, fund)
        if (sig) {
          sig.news = news || []
          results.push(sig)
          setSignals([...results].sort((a, b) => {
            const O = { RED: 0, ORANGE: 1, GREEN: 2 }
            return O[a.signal] - O[b.signal]
          }))
        }
      } catch { /* skip failed ticker */ }
      setProgress(Math.round(((i + 1) / holdingsToAnalyze.length) * 100))
    }

    setCurrent('')
    setLastRun(new Date())
    setLoading(false)
  }, []) // no deps — reads holdings via argument, not closure

  // ── Auto-run on initial mount with the initial portfolio ──
  useEffect(() => {
    const h = portfoliosRef.current[initialId] || []
    if (h.length) runAnalysis(h)
  }, []) // eslint-disable-line

  // ── Re-run whenever selectedId changes ──
  useEffect(() => {
    if (!selectedId) return
    const h = portfoliosRef.current[selectedId] || []
    setSignals([])
    setFilter('ALL')
    setLastRun(null)
    if (h.length) runAnalysis(h)
  }, [selectedId, runAnalysis])

  // ── Switch portfolio (cancels any in-flight analysis) ──
  const handleSelectPortfolio = useCallback((id) => {
    if (id === selectedId) return
    abortRef.current = true  // cancel in-flight fetch loop
    setSelectedId(id)
  }, [selectedId])

  const displayed = filter === 'ALL' ? signals : signals.filter(s => s.signal === filter)
  const counts = {
    RED:    signals.filter(s => s.signal === 'RED').length,
    ORANGE: signals.filter(s => s.signal === 'ORANGE').length,
    GREEN:  signals.filter(s => s.signal === 'GREEN').length,
  }
  const totalEquity = signals.reduce((s, x) => s + (x.equity || 0), 0)
  const totalPL     = signals.reduce((s, x) => s + (x.pl || 0), 0)
  const avgScore    = signals.length ? Math.round(signals.reduce((s, x) => s + x.score, 0) / signals.length) : 0
  const avgSignal   = avgScore >= 63 ? 'GREEN' : avgScore <= 37 ? 'RED' : 'ORANGE'

  if (!portfolioNames.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="text-6xl">📡</div>
        <h2 className="text-xl font-black text-slate-700">No portfolios found</h2>
        <p className="text-slate-400 text-sm max-w-xs">Go to the Portfolio tab and create a portfolio with stocks first.</p>
      </div>
    )
  }

  return (
    <div className="max-w-full text-slate-900 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            📡 Portfolio Signal Engine
          </h2>
          <p className="text-sm text-slate-500 font-semibold mt-0.5">
            10-factor scoring · Live fundamentals · Confidence-weighted recommendations
          </p>
          {lastRun && !loading && (
            <p className="text-xs text-emerald-600 font-semibold mt-1">
              ✅ Analysis complete · {lastRun.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <button onClick={() => runAnalysis(portfolios[selectedId] || [])} disabled={loading || !(portfolios[selectedId] || []).length}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-700 disabled:bg-slate-300 text-white font-black px-5 py-2.5 rounded-xl text-sm transition-colors shadow">
          <span className={loading ? 'animate-spin inline-block' : ''}>⟳</span>
          {loading ? `Analyzing ${current}… ${progress}%` : 'Re-Analyze'}
        </button>
      </div>

      {/* ── Portfolio Selector ── */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm">
        <div className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
          📂 Select Portfolio to Analyze
        </div>
        {portfolioNames.length <= 5 ? (
          /* Tab-style pills for ≤5 portfolios */
          <div className="flex flex-wrap gap-2">
            {portfolioNames.map(name => {
              const count = (portfolios[name] || []).length
              const isActive = name === selectedId
              return (
                <button
                  key={name}
                  onClick={() => handleSelectPortfolio(name)}
                  disabled={loading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all ${
                    isActive
                      ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <span>{name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>{count}</span>
                </button>
              )
            })}
          </div>
        ) : (
          /* Dropdown for many portfolios */
          <select
            value={selectedId}
            onChange={e => handleSelectPortfolio(e.target.value)}
            disabled={loading}
            className="w-full max-w-sm px-4 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 bg-white focus:border-slate-500 focus:outline-none"
          >
            {portfolioNames.map(name => (
              <option key={name} value={name}>
                {name} ({(portfolios[name] || []).length} stocks)
              </option>
            ))}
          </select>
        )}
        {(portfolios[selectedId] || []).length === 0 && selectedId && (
          <p className="mt-3 text-sm text-amber-600 font-semibold">
            ⚠️ "{selectedId}" has no holdings yet — add stocks in the Portfolio tab first.
          </p>
        )}
      </div>

      {/* ── Progress bar ── */}
      {loading && (
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>Fetching price + 10-factor fundamentals for <strong>{current}</strong>…</span>
            <span className="font-bold">{progress}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2.5">
            <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* ── Portfolio Summary Band ── */}
      {signals.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl px-4 py-4 border border-slate-200 shadow-sm">
            <div className="text-xs font-black text-slate-400 uppercase tracking-wider">Portfolio Score</div>
            <div className="flex items-center gap-3 mt-2">
              <ScoreGauge score={avgScore} signal={avgSignal} size={52} />
              <div>
                <div className="text-sm font-black text-slate-700">Avg {avgScore}/100</div>
                <div className={`text-xs font-bold ${SIG[avgSignal].text}`}>{SIG[avgSignal].label}</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl px-4 py-4 border border-slate-200 shadow-sm">
            <div className="text-xs font-black text-slate-400 uppercase tracking-wider">Total Equity</div>
            <div className="text-xl font-black text-slate-800 mt-2">{f$(totalEquity, 0)}</div>
            <div className={`text-sm font-bold mt-0.5 ${totalPL >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {totalPL >= 0 ? '+' : ''}{f$(totalPL, 0)} total P&L
            </div>
          </div>
          <div className="bg-white rounded-2xl px-4 py-4 border border-slate-200 shadow-sm">
            <div className="text-xs font-black text-slate-400 uppercase tracking-wider">Signal Mix</div>
            <div className="flex items-center gap-3 mt-2">
              <div className="text-center"><div className="text-xl font-black text-red-600">{counts.RED}</div><div className="text-[9px] text-red-500 font-black">EXIT</div></div>
              <div className="text-center"><div className="text-xl font-black text-amber-500">{counts.ORANGE}</div><div className="text-[9px] text-amber-500 font-black">WATCH</div></div>
              <div className="text-center"><div className="text-xl font-black text-emerald-600">{counts.GREEN}</div><div className="text-[9px] text-emerald-500 font-black">HOLD</div></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl px-4 py-4 border border-slate-200 shadow-sm">
            <div className="text-xs font-black text-slate-400 uppercase tracking-wider">Holdings</div>
            <div className="text-xl font-black text-slate-800 mt-2">{signals.length} stocks</div>
            <div className="text-sm text-slate-400 mt-0.5 truncate" title={selectedId}>📂 {selectedId}</div>
          </div>
        </div>
      )}

      {/* ── Filter Tabs ── */}
      {signals.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {[
            ['ALL',    '📊 All',         signals.length],
            ['RED',    '🔴 Consider Exit', counts.RED],
            ['ORANGE', '🟠 Hold / Watch', counts.ORANGE],
            ['GREEN',  '🟢 Strong Hold',  counts.GREEN],
          ].map(([k, l, n]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`px-4 py-1.5 rounded-xl text-sm font-bold border transition-colors ${
                filter === k ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}>
              {l} <span className="opacity-60 ml-1">({n})</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Signal Cards ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {displayed.map(sig => (
          <SignalCard key={sig.ticker} sig={sig} onScoreClick={setScoreModal} />
        ))}
      </div>

      {/* Loading placeholders */}
      {loading && displayed.length === 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {(portfolios[selectedId] || portfolios[initialId] || []).map(h => (
            <div key={h.ticker} className="bg-white border-2 border-slate-100 rounded-2xl p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="font-black text-slate-300 text-lg">{h.ticker}</div>
                <div className="h-6 w-28 bg-slate-100 rounded-full" />
              </div>
              <div className="h-8 bg-slate-100 rounded mb-3 w-1/2" />
              <div className="h-1.5 bg-slate-100 rounded-full mb-4" />
              <div className="h-14 bg-slate-50 rounded-xl mb-3" />
              <div className="grid grid-cols-3 gap-2">
                {[0,1,2].map(i => <div key={i} className="h-14 bg-slate-50 rounded-xl" />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 text-xs text-slate-400 leading-relaxed">
        ⚠️ <strong className="text-slate-600">Not financial advice.</strong> Signals are generated from live prices and 10-factor fundamental analysis.
        Score ≥63 = Strong Hold · 37–62 = Hold/Watch · ≤37 = Consider Exit.
        Confidence % shows how much data was available for each stock.
        Stop-loss levels are starting suggestions — adjust to your own risk tolerance.
      </div>

      {/* Score modal */}
      {scoreModal && <ScoreModal sig={scoreModal} onClose={() => setScoreModal(null)} />}
    </div>
  )
}
