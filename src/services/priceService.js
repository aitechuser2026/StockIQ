/**
 * priceService.js — Single source of truth for live stock prices.
 *
 * Used by: OptionsFlow, StockAnalyzer, useMarketData (LiveMarket page).
 *
 * Source priority (all fired in parallel — fastest valid result wins via Promise.any):
 *
 *  1. /api/quote proxy   → Yahoo v8/chart  — server-side Node.js, ZERO CORS risk.
 *                          This is the most reliable: Vite dev server (or Vercel fn in prod)
 *                          makes the request to Yahoo from the server, not the browser.
 *                          Uses v8/chart NOT v7/quote — v7 requires crumb auth, v8 does not.
 *
 *  2. Stooq.com CSV      — completely independent of Yahoo. Pure CSV, no auth, no CORS.
 *                          Covers all US-listed stocks, ETFs, and major indices.
 *                          Extremely reliable — doesn't rate-limit single requests.
 *
 *  3. Yahoo v8/chart     — direct browser call (query1 + query2 CDN nodes tried in order).
 *                          v8/chart has permissive CORS headers unlike v7/quote.
 *                          Accept: application/json header is required to get JSON, not HTML.
 *
 *  4. allorigins.win     — CORS-bypass proxy that wraps Yahoo v8/chart.
 *                          Guaranteed last resort — if the browser can reach the internet,
 *                          this works (slightly slower, ~2-4s extra).
 *
 * Cache: 30 s TTL. invalidateCache() forces fresh fetch (called on user-initiated Refresh).
 */

const CACHE  = new Map()   // KEY → { data, expiry }
const TTL_MS = 30_000      // 30 seconds

// ── Timed fetch helper ────────────────────────────────────────────────────────
function _t(url, ms = 7000, opts = {}) {
  const ctrl = new AbortController()
  const t    = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { signal: ctrl.signal, ...opts }).finally(() => clearTimeout(t))
}

// ── Parse Yahoo v8/finance/chart response → price shape ───────────────────────
function _parseMeta(meta) {
  if (!meta?.regularMarketPrice) return null
  const price = meta.regularMarketPrice
  const prev  = meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPreviousClose
  return {
    price,
    change:     prev ? price - prev : 0,
    changePct:  prev ? ((price - prev) / prev) * 100 : (meta.regularMarketChangePercent ?? 0),
    dayHigh:    meta.regularMarketDayHigh    ?? null,
    dayLow:     meta.regularMarketDayLow     ?? null,
    week52High: meta.fiftyTwoWeekHigh        ?? null,
    week52Low:  meta.fiftyTwoWeekLow         ?? null,
    marketCap:  meta.marketCap               ?? null,
    name:       meta.longName || meta.shortName || null,
    volume:     meta.regularMarketVolume     ?? null,
  }
}

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

// ── Source 1: Backend API proxy → Yahoo v8/chart (SERVER-SIDE — no CORS) ──────
async function _fromProxy(sym) {
  const url = `${API_BASE_URL}/api/quote?symbols=${encodeURIComponent(sym)}`
  const r = await _t(url, 5000)
  if (!r.ok) return null
  const meta = (await r.json())?.chart?.result?.[0]?.meta
  return _parseMeta(meta)
}

// ── Source 2: Stooq CSV — independent of Yahoo, no auth, no CORS ─────────────
// Format: https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcvp
// Columns: Symbol, Date, Time, Open, High, Low, Close, Volume, PrevClose
const STOOQ_INDEX = {        // Yahoo symbol → Stooq symbol
  '^GSPC': '^spx',  '^IXIC': '^ndq',  '^DJI': '^dji',
  '^RUT':  '^rut',  '^VIX':  '^vix',  '^TNX': '^tnx',
}
async function _fromStooq(sym) {
  const mapped = STOOQ_INDEX[sym]
  const tries  = mapped
    ? [mapped]
    : [`${sym.toLowerCase()}.us`, sym.toLowerCase()]   // US suffix first, then bare

  for (const s of tries) {
    try {
      const r = await _t(`https://stooq.com/q/l/?s=${s}&f=sd2t2ohlcvp`, 6000)
      if (!r.ok) continue
      const lines = (await r.text()).trim().split('\n')
      if (lines.length < 2) continue
      const v     = lines[1].split(',')
      const price = parseFloat(v[6])
      const prev  = parseFloat(v[8])
      if (isNaN(price) || price <= 0) continue
      return {
        price,
        change:    (!isNaN(prev) && prev > 0) ? price - prev : 0,
        changePct: (!isNaN(prev) && prev > 0) ? ((price - prev) / prev) * 100 : 0,
        dayHigh:   parseFloat(v[4]) || null,
        dayLow:    parseFloat(v[5]) || null,
        volume:    parseInt(v[7], 10) || null,
      }
    } catch (_) { /* try next suffix */ }
  }
  return null
}

// ── Source 3: Yahoo v8/chart — direct browser call ────────────────────────────
// query1 and query2 are tried in sequence; v8/chart returns Access-Control-Allow-Origin: *
async function _fromYahooChart(sym) {
  const enc = encodeURIComponent(sym)
  const jH  = { Accept: 'application/json', 'Cache-Control': 'no-cache' }
  for (const host of ['query1', 'query2']) {
    try {
      const r = await _t(
        `https://${host}.finance.yahoo.com/v8/finance/chart/${enc}?interval=1d&range=1d`,
        6000, { headers: jH }
      )
      if (!r.ok) continue
      const meta = (await r.json())?.chart?.result?.[0]?.meta
      const res  = _parseMeta(meta)
      if (res) return res
    } catch (_) { /* try next host */ }
  }
  return null
}

// ── Source 4: CNBC API — fast, independent, US stocks ───────────────────────
// Format: https://quote.cnbc.com/quote-html-webservice/quote.htm?symbols=AAPL&output=json
async function _fromCNBC(sym) {
  try {
    const r = await _t(`https://quote.cnbc.com/quote-html-webservice/quote.htm?symbols=${encodeURIComponent(sym)}&output=json`, 5000)
    if (!r.ok) return null
    const data = (await r.json())?.QuickQuoteResult?.QuickQuote
    if (!data) return null
    // CNBC might return an array if multiple symbols, or a single object
    const q = Array.isArray(data) ? data[0] : data
    const price = parseFloat(q.last)
    const prev  = parseFloat(q.previous_close)
    if (isNaN(price) || price <= 0) return null
    return {
      price,
      change:    (!isNaN(prev) && prev > 0) ? price - prev : parseFloat(q.change) || 0,
      changePct: (!isNaN(prev) && prev > 0) ? ((price - prev) / prev) * 100 : parseFloat(q.change_pct) || 0,
      name:      q.name || null,
      volume:    parseInt(q.volume, 10) || null,
      source:    'cnbc'
    }
  } catch (_) { return null }
}

// ── Source 5: allorigins.win → Yahoo v8/chart (guaranteed CORS bypass) ────────
async function _fromAllorigins(sym) {
  try {
    const target = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`
    const r = await _t(`https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`, 10000)
    if (!r.ok) return null
    const meta = (await r.json())?.chart?.result?.[0]?.meta
    return _parseMeta(meta)
  } catch (_) { return null }
}

// ── Public: fetchPrice ────────────────────────────────────────────────────────
/**
 * Fetch live price for a single symbol.
 * Fires all sources in parallel — first valid result wins immediately.
 * Result is cached 30 s; call invalidateCache() to force a fresh fetch.
 */
export async function fetchPrice(sym) {
  const KEY = sym.toUpperCase()

  const cached = CACHE.get(KEY)
  if (cached && cached.expiry > Date.now()) return cached.data

  const src = (fn) => fn().then(v => {
    if (v?.price && v.price > 0) return v
    return Promise.reject(new Error('no price'))
  })

  let data = null
  try {
    data = await Promise.any([
      src(() => _fromProxy(sym)),        // server-side — most reliable
      src(() => _fromCNBC(sym)),         // independent — fast
      src(() => _fromStooq(sym)),        // independent — reliable
      src(() => _fromYahooChart(sym)),   // direct browser
      src(() => _fromAllorigins(sym)),   // CORS proxy fallback
    ])
  } catch (_) {
    return null   // all sources failed
  }

  CACHE.set(KEY, { data, expiry: Date.now() + TTL_MS })
  return data
}

// ── Public: fetchPrices ───────────────────────────────────────────────────────
/**
 * Fetch live prices for multiple symbols in parallel.
 * Processes in batches of 6 with a 300 ms gap to avoid rate-limiting Stooq/Yahoo.
 * Returns a Map<string, priceObject> — missing entries = fetch failed for that symbol.
 */
export async function fetchPrices(symbols) {
  const BATCH = 6
  const out   = new Map()

  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch   = symbols.slice(i, i + BATCH)
    const settled = await Promise.allSettled(
      batch.map(async sym => ({ sym: sym.toUpperCase(), data: await fetchPrice(sym) }))
    )
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value.data) {
        out.set(r.value.sym, r.value.data)
      }
    }
    if (i + BATCH < symbols.length) {
      await new Promise(res => setTimeout(res, 300))
    }
  }

  return out
}

// ── Public: invalidateCache ───────────────────────────────────────────────────
/**
 * Clear cached prices.
 * Pass specific symbols to clear only those; pass nothing to clear all.
 * Call this when the user clicks a Refresh button.
 */
export function invalidateCache(...syms) {
  if (syms.length === 0) CACHE.clear()
  else syms.forEach(s => CACHE.delete(s.toUpperCase()))
}
