/**
 * useMarketData.js — Central data engine for Live Market page.
 * Strategy:
 *   1. Render immediately with hardcoded static baseline (page is NEVER empty)
 *   2. Fetch live data in background from Stooq (primary) + Yahoo v8 (fallback)
 *   3. Replace static data with live data as it arrives
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchPrice, invalidateCache } from '../services/priceService'

// ── Market status ──────────────────────────────────────────────────────────────
function getMarketStatus() {
  const etStr = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
  const et = new Date(etStr)
  const day = et.getDay()
  const totalMin = et.getHours() * 60 + et.getMinutes()
  const isWeekend = day === 0 || day === 6
  let session = 'closed'
  if (!isWeekend) {
    if (totalMin >= 240 && totalMin < 570)  session = 'pre'
    else if (totalMin >= 570 && totalMin < 960) session = 'open'
    else if (totalMin >= 960 && totalMin < 1200) session = 'after'
  }
  return { session, isOpen: session === 'open', isWeekend, et }
}

// ── Static baseline (always shown first, replaced by live data) ───────────────
// Values from May 15, 2026 — update periodically
const STATIC_INDICES = [
  { sym: '^GSPC',  short: 'SPX', label: 'S&P 500',    price: 5892.58, changePct:  1.47, change:  85.29 },
  { sym: '^IXIC',  short: 'NDX', label: 'NASDAQ',     price: 19026.39,changePct:  1.83, change: 341.92 },
  { sym: '^DJI',   short: 'DJI', label: 'Dow Jones',  price: 42348.12,changePct:  0.78, change: 327.19 },
  { sym: '^RUT',   short: 'RUT', label: 'Russell 2K', price: 2118.43, changePct:  0.62, change:  13.07 },
  { sym: '^VIX',   short: 'VIX', label: 'VIX',        price: 17.42,   changePct: -8.21, change:  -1.56 },
  { sym: '^TNX',   short: '10Y', label: '10Y Yield',  price: 4.437,   changePct:  0.45, change:   0.02 },
]
const STATIC_SECTORS = [
  { sym: 'XLC',  label: 'Comm Svcs',    icon: '📡', price: 91.24,  changePct:  1.92 },
  { sym: 'XLK',  label: 'Technology',   icon: '💻', price: 232.18, changePct:  2.31 },
  { sym: 'XLV',  label: 'Health Care',  icon: '🏥', price: 143.62, changePct: -0.34 },
  { sym: 'XLI',  label: 'Industrials',  icon: '🏭', price: 128.74, changePct:  0.87 },
  { sym: 'XLF',  label: 'Financials',   icon: '🏦', price: 51.33,  changePct:  1.12 },
  { sym: 'XLY',  label: 'Cons Discr',   icon: '🛍️', price: 196.82, changePct:  1.63 },
  { sym: 'XLP',  label: 'Cons Staples', icon: '🛒', price: 82.14,  changePct:  0.21 },
  { sym: 'XLE',  label: 'Energy',       icon: '⚡', price: 88.47,  changePct: -0.58 },
  { sym: 'XLB',  label: 'Materials',    icon: '⛏️', price: 91.03,  changePct:  0.44 },
  { sym: 'XLRE', label: 'Real Estate',  icon: '🏠', price: 38.29,  changePct: -0.27 },
  { sym: 'XLU',  label: 'Utilities',    icon: '💡', price: 76.18,  changePct:  0.33 },
]

// ── Indices + sectors config ──────────────────────────────────────────────────
export const INDICES = [
  { sym: '^GSPC',  stooq: '^spx', label: 'S&P 500',    short: 'SPX' },
  { sym: '^IXIC',  stooq: '^ndq', label: 'NASDAQ',     short: 'NDX' },
  { sym: '^DJI',   stooq: '^dji', label: 'Dow Jones',  short: 'DJI' },
  { sym: '^RUT',   stooq: '^rut', label: 'Russell 2K', short: 'RUT' },
  { sym: '^VIX',   stooq: '^vix', label: 'VIX',        short: 'VIX' },
  { sym: '^TNX',   stooq: '^tnx', label: '10Y Yield',  short: '10Y' },
]
export const SECTORS = [
  { sym: 'XLC',  stooq: 'xlc.us',  label: 'Comm Svcs',    icon: '📡' },
  { sym: 'XLK',  stooq: 'xlk.us',  label: 'Technology',   icon: '💻' },
  { sym: 'XLV',  stooq: 'xlv.us',  label: 'Health Care',  icon: '🏥' },
  { sym: 'XLI',  stooq: 'xli.us',  label: 'Industrials',  icon: '🏭' },
  { sym: 'XLF',  stooq: 'xlf.us',  label: 'Financials',   icon: '🏦' },
  { sym: 'XLY',  stooq: 'xly.us',  label: 'Cons Discr',   icon: '🛍️' },
  { sym: 'XLP',  stooq: 'xlp.us',  label: 'Cons Staples', icon: '🛒' },
  { sym: 'XLE',  stooq: 'xle.us',  label: 'Energy',       icon: '⚡' },
  { sym: 'XLB',  stooq: 'xlb.us',  label: 'Materials',    icon: '⛏️' },
  { sym: 'XLRE', stooq: 'xlre.us', label: 'Real Estate',  icon: '🏠' },
  { sym: 'XLU',  stooq: 'xlu.us',  label: 'Utilities',    icon: '💡' },
]

// ── Fear & Greed ──────────────────────────────────────────────────────────────
export function calcFearGreed(vixPrice, spxChangePct) {
  if (!vixPrice) return null
  let score
  if (vixPrice < 12)      score = 85
  else if (vixPrice < 14) score = 75
  else if (vixPrice < 16) score = 65
  else if (vixPrice < 18) score = 55
  else if (vixPrice < 20) score = 45
  else if (vixPrice < 24) score = 35
  else if (vixPrice < 28) score = 25
  else if (vixPrice < 35) score = 15
  else                     score = 5
  if (spxChangePct != null) {
    score = Math.min(100, Math.max(0, score + Math.min(10, Math.max(-10, spxChangePct * 3))))
  }
  let label, color, emoji
  if (score >= 75)      { label = 'Extreme Greed'; color = '#16a34a'; emoji = '🤑' }
  else if (score >= 55) { label = 'Greed';         color = '#65a30d'; emoji = '😀' }
  else if (score >= 45) { label = 'Neutral';       color = '#ca8a04'; emoji = '😐' }
  else if (score >= 25) { label = 'Fear';          color = '#ea580c'; emoji = '😨' }
  else                  { label = 'Extreme Fear';  color = '#dc2626'; emoji = '😱' }
  return { score: Math.round(score), label, color, emoji }
}

// ── Earnings DB ───────────────────────────────────────────────────────────────
const EARNINGS_DB = [
  { sym: 'WMT',  name: 'Walmart',        date: '2026-05-15', timing: 'pre',  est: 0.58 },
  { sym: 'DE',   name: 'John Deere',     date: '2026-05-15', timing: 'pre',  est: 6.30 },
  { sym: 'AMAT', name: 'Applied Matls',  date: '2026-05-15', timing: 'post', est: 2.31 },
  { sym: 'NVDA', name: 'NVIDIA',         date: '2026-05-28', timing: 'post', est: 8.93 },
  { sym: 'CRM',  name: 'Salesforce',     date: '2026-05-28', timing: 'post', est: 2.61 },
  { sym: 'COST', name: 'Costco',         date: '2026-05-29', timing: 'post', est: 4.25 },
  { sym: 'DELL', name: 'Dell',           date: '2026-05-29', timing: 'post', est: 1.97 },
  { sym: 'AAPL', name: 'Apple',          date: '2026-07-31', timing: 'post', est: 1.42 },
  { sym: 'MSFT', name: 'Microsoft',      date: '2026-07-29', timing: 'post', est: 3.56 },
  { sym: 'GOOGL', name: 'Alphabet',      date: '2026-07-29', timing: 'post', est: 2.18 },
  { sym: 'META', name: 'Meta',           date: '2026-07-30', timing: 'post', est: 6.50 },
  { sym: 'TSLA', name: 'Tesla',          date: '2026-07-23', timing: 'post', est: 0.48 },
]

function toDateStr(d) { return d.toISOString().slice(0, 10) }
function nextBizDay(d) {
  const r = new Date(d)
  do { r.setDate(r.getDate() + 1) } while (r.getDay() === 0 || r.getDay() === 6)
  return r
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────
function timedFetch(url, ms = 8000) {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(id))
}

function parseStooqCsv(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return null
  const vals = lines[1].split(',')
  const price = parseFloat(vals[6])
  const prev  = parseFloat(vals[8])
  if (isNaN(price) || price === 0) return null
  const change    = (!isNaN(prev) && prev > 0) ? price - prev : 0
  const changePct = (!isNaN(prev) && prev > 0) ? (change / prev) * 100 : 0
  return {
    price, change, changePct,
    dayHigh:  parseFloat(vals[4]),
    dayLow:   parseFloat(vals[5]),
    volume:   parseInt(vals[7], 10),
    prevClose: prev,
    source: 'stooq',
    live: true,
  }
}

// Try multiple Stooq URL formats for a symbol
async function fromStooq(stooqSym) {
  // Stooq needs raw ^ (not %5E) for index symbols
  // We construct the URL with raw special chars, letting the browser encode as needed
  const urls = [
    `https://stooq.com/q/l/?s=${stooqSym}&f=sd2t2ohlcvp`,
  ]
  // For ETF/stock symbols also try without exchange suffix
  if (!stooqSym.startsWith('^')) {
    const bare = stooqSym.replace('.us', '')
    urls.push(`https://stooq.com/q/l/?s=${bare}&f=sd2t2ohlcvp`)
  }
  for (const url of urls) {
    try {
      const res = await timedFetch(url, 7000)
      if (!res.ok) continue
      const text = await res.text()
      const parsed = parseStooqCsv(text)
      if (parsed) return parsed
    } catch { /* try next */ }
  }
  return null
}

async function fromYahooV8(yahooSym) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=1d&range=5d`
    const res = await timedFetch(url, 8000)
    if (!res.ok) return null
    const json = await res.json()
    const r = json?.chart?.result?.[0]
    if (!r) return null
    const meta = r.meta || {}
    const price = meta.regularMarketPrice
    const prev  = meta.chartPreviousClose || meta.previousClose
    if (!price) return null
    const change    = prev ? price - prev : 0
    const changePct = prev ? (change / prev) * 100 : 0
    return {
      price, change, changePct,
      dayHigh: meta.regularMarketDayHigh,
      dayLow:  meta.regularMarketDayLow,
      volume:  meta.regularMarketVolume,
      prevClose: prev,
      source: 'yahoo',
      live: true,
    }
  } catch { return null }
}

// fetchLiveQuote now delegates to the shared priceService
// (Yahoo v8 chart ×2 + Stooq + allorigins in parallel — first valid wins)
async function fetchLiveQuote(yahooSym) {
  return fetchPrice(yahooSym)
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useMarketData() {
  // Initialise IMMEDIATELY with static data so page is never blank
  const [marketStatus, setMarketStatus] = useState(getMarketStatus)
  const [indices,    setIndices]    = useState(STATIC_INDICES)
  const [sectors,    setSectors]    = useState(STATIC_SECTORS)
  const [fearGreed,  setFearGreed]  = useState(() => {
    const vix = STATIC_INDICES.find(i => i.sym === '^VIX')
    const spx = STATIC_INDICES.find(i => i.sym === '^GSPC')
    return calcFearGreed(vix?.price, spx?.changePct)
  })
  const [earnings,   setEarnings]   = useState({ today: [], tomorrow: [] })
  const [lastUpdated,setLastUpdated]= useState(null)
  const [liveStatus, setLiveStatus] = useState('static') // 'static' | 'loading' | 'live' | 'error'
  const timerRef = useRef(null)

  // Build earnings for today/tomorrow
  function refreshEarnings() {
    try {
      const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
      const todayStr    = toDateStr(nowET)
      const tomorrowStr = toDateStr(nextBizDay(nowET))
      setEarnings({
        today:    EARNINGS_DB.filter(e => e.date === todayStr),
        tomorrow: EARNINGS_DB.filter(e => e.date === tomorrowStr),
        todayStr, tomorrowStr,
      })
    } catch { /* ignore */ }
  }

  const refresh = useCallback(async (isManual = false) => {
    setLiveStatus('loading')
    refreshEarnings()
    if (isManual) invalidateCache() // force-fresh prices on manual refresh button click

    try {
      const allItems = [
        ...INDICES.map(i => ({ ...i, kind: 'index' })),
        ...SECTORS.map(s => ({ ...s, kind: 'sector' })),
      ]

      // Fetch all items via shared priceService — parallel, cached, multi-source
      const settled = await Promise.allSettled(
        allItems.map(item =>
          fetchLiveQuote(item.sym)
            .then(q => ({ ...item, quote: q }))
        )
      )

      const newIndices = []
      const newSectors = []
      let anyLive = false

      settled.forEach(r => {
        if (r.status !== 'fulfilled') return
        const { kind, sym, label, short, icon, quote } = r.value
        if (!quote) {
          // Keep static baseline for this symbol
          const staticEntry = kind === 'index'
            ? STATIC_INDICES.find(x => x.sym === sym)
            : STATIC_SECTORS.find(x => x.sym === sym)
          if (staticEntry) {
            const entry = { ...staticEntry, label, short, icon, source: 'static' }
            kind === 'index' ? newIndices.push(entry) : newSectors.push(entry)
          }
        } else {
          anyLive = true
          const entry = {
            sym, label: label || sym, short, icon,
            price: quote.price,
            change: quote.change,
            changePct: quote.changePct,
            dayHigh: quote.dayHigh,
            dayLow:  quote.dayLow,
            volume:  quote.volume,
            source:  quote.source,
          }
          kind === 'index' ? newIndices.push(entry) : newSectors.push(entry)
        }
      })

      // Preserve original order
      const sortedIndices = INDICES.map(i => newIndices.find(x => x.sym === i.sym)).filter(Boolean)
      const sortedSectors = SECTORS.map(s => newSectors.find(x => x.sym === s.sym)).filter(Boolean)

      if (sortedIndices.length) setIndices(sortedIndices)
      if (sortedSectors.length) setSectors(sortedSectors)

      const vix = sortedIndices.find(i => i.sym === '^VIX')
      const spx = sortedIndices.find(i => i.sym === '^GSPC')
      if (vix) setFearGreed(calcFearGreed(vix.price, spx?.changePct))

      setLastUpdated(new Date())
      setLiveStatus(anyLive ? 'live' : 'static')
    } catch (err) {
      setLiveStatus('error')
    }

    setMarketStatus(getMarketStatus())
  }, [])

  // Smart auto-refresh
  useEffect(() => {
    refreshEarnings()
    refresh()
    function scheduleNext() {
      const s = getMarketStatus()
      const delay = s.isOpen ? 30_000 : s.session !== 'closed' ? 120_000 : 300_000
      timerRef.current = setTimeout(() => { refresh(); scheduleNext() }, delay)
    }
    scheduleNext()
    return () => clearTimeout(timerRef.current)
  }, [refresh])

  useEffect(() => {
    const id = setInterval(() => setMarketStatus(getMarketStatus()), 60_000)
    return () => clearInterval(id)
  }, [])

  return { marketStatus, indices, sectors, fearGreed, earnings, lastUpdated, liveStatus, refresh }
}
