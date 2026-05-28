import React, { useState } from 'react'
import { fetchPrice, invalidateCache } from '../../services/priceService'

const QUICK = ['NVDA','AAPL','MSFT','TSLA','AMZN','GOOGL','META','TSM','CLS','INTU']

// ── formatting helpers ─────────────────────────────────────────────────────────
function fmt(n, d = 2) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function fmtLarge(n) {
  if (n == null || isNaN(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (abs >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`
  return `$${Number(n).toLocaleString()}`
}
function pct(n) {
  if (n == null || isNaN(n)) return '—'
  return `${(n * 100).toFixed(1)}%`
}

function getVerdict(data) {
  if (!data?.price) return { label: '—', cls: 'bg-slate-100 text-slate-500' }
  const rec = (data.recommendationKey || '').toLowerCase()
  if (rec.includes('strong_buy') || rec === 'buy') return { label: 'BUY',        cls: 'bg-green-100 text-green-800' }
  if (rec.includes('sell'))                         return { label: 'SELL',       cls: 'bg-red-100 text-red-800' }
  if (rec.includes('hold') || rec.includes('neutral')) return { label: 'HOLD',   cls: 'bg-yellow-100 text-yellow-800' }
  // heuristic fallback
  const growth = data.revenueGrowth ?? 0
  if (growth > 0.15) return { label: 'BUY',  cls: 'bg-green-100 text-green-800' }
  if (growth < -0.1) return { label: 'SELL', cls: 'bg-red-100 text-red-800' }
  return { label: 'HOLD', cls: 'bg-yellow-100 text-yellow-800' }
}

function MetricRow({ label, val }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-slate-50 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold text-slate-900 text-right max-w-[55%] break-words">{val ?? '—'}</span>
    </div>
  )
}

// ── data sources ───────────────────────────────────────────────────────────────

async function timedFetch(url, ms = 7000, opts = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctrl.signal, ...opts })
    clearTimeout(t)
    return res
  } catch (e) { clearTimeout(t); throw e }
}


// Parse a quoteSummary result object into our flat data shape
function parseQuoteSummaryResult(r) {
  const ks = r.defaultKeyStatistics || {}
  const fd = r.financialData        || {}
  const sd = r.summaryDetail        || {}
  const sp = r.summaryProfile       || {}
  const pr = r.price                || {}
  const ce = r.calendarEvents       || {}
  const et = r.earningsTrend?.trend?.[0] || {}

  // Next earnings date
  const earningsTs = ce.earnings?.earningsDate?.[0]?.raw
  const nextEarningsDate = earningsTs
    ? new Date(earningsTs * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  // Market Cap - Try multiple reliable fields
  const marketCap = sd.marketCap?.raw || pr.marketCap?.raw || ks.marketCap?.raw

  return {
    // Identity
    name:               pr.longName || pr.shortName,
    sector:             sp.sector,
    industry:           sp.industry,
    website:            sp.website,
    description:        sp.longBusinessSummary,
    // Size & Market Cap
    marketCap,
    // Classic valuation
    pe:                 sd.trailingPE?.raw,
    forwardPE:          sd.forwardPE?.raw,
    eps:                ks.trailingEps?.raw,
    forwardEps:         ks.forwardEps?.raw,
    beta:               sd.beta?.raw,
    dividendYield:      sd.dividendYield?.raw,
    // Growth & margins
    revenueGrowth:      fd.revenueGrowth?.raw,
    grossMargin:        fd.grossMargins?.raw,
    operatingMargin:    fd.operatingMargins?.raw,
    roe:                fd.returnOnEquity?.raw,
    // Size & leverage
    totalRevenue:       fd.totalRevenue?.raw,
    debtToEquity:       fd.debtToEquity?.raw,
    currentRatio:       fd.currentRatio?.raw,
    // Cash
    freeCashFlow:       fd.freeCashflow?.raw,
    operatingCashFlow:  fd.operatingCashflow?.raw,
    totalCash:          fd.totalCash?.raw,
    totalDebt:          fd.totalDebt?.raw,
    // Analyst
    targetMeanPrice:    fd.targetMeanPrice?.raw,
    recommendationKey:  fd.recommendationKey,
    numberOfAnalysts:   fd.numberOfAnalystOpinions?.raw,
    // Multi-metric valuation (from defaultKeyStatistics)
    priceToBook:        ks.priceToBook?.raw,
    priceToSales:       ks.priceToSalesTrailing12Months?.raw,
    evToEbitda:         ks.enterpriseToEbitda?.raw,
    evToRevenue:        ks.enterpriseToRevenue?.raw,
    bookValuePerShare:  ks.bookValue?.raw,
    pegRatio:           ks.pegRatio?.raw,
    annualReturn52w:    ks['52WeekChange']?.raw,
    // Earnings details
    nextEarningsDate,
    expectedEPS:        et.earningsEstimate?.avg?.raw,
    earningsHistory:    r.earnings?.financialsChart?.quarterly || [],
  }
}

// Source C: Yahoo Finance quoteSummary — tries direct browser call first, then Vite proxy
async function fromYahooSummary(sym) {
  const modules = 'summaryDetail,financialData,defaultKeyStatistics,summaryProfile,price,calendarEvents,earningsTrend,earnings'

  // Try 1: Direct browser call to Yahoo v10 (works when CORS allows)
  for (const host of ['https://query2.finance.yahoo.com', 'https://query1.finance.yahoo.com']) {
    try {
      const url = `${host}/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=${encodeURIComponent(modules)}&corsDomain=finance.yahoo.com`
      const res = await timedFetch(url, 7000, { headers: { Accept: 'application/json' } })
      if (!res.ok) continue
      const json = await res.json()
      const r = json?.quoteSummary?.result?.[0]
      if (r) return parseQuoteSummaryResult(r)
    } catch (_) { continue }
  }

  // Try 2: Via Vite dev proxy (modules param must NOT be encoded here — proxy handles it)
  try {
    const res = await timedFetch(
      `/api/quote?symbols=${encodeURIComponent(sym)}&modules=${modules}`,
      8000
    )
    if (res.ok) {
      const json = await res.json()
      const r = json?.quoteSummary?.result?.[0]
      if (r) return parseQuoteSummaryResult(r)
    }
  } catch (_) { /* fall through */ }

  return null
}

// ── Static fundamentals DB — guarantees Valuation/Financials/Risk always load ──
// Data as of May 2026. Fallback when live APIs fail. Includes multi-method valuation fields.
// Fields: pe, forwardPE, eps, beta, dividendYield, revenueGrowth, grossMargin, operatingMargin,
//         roe, totalRevenue, debtToEquity, currentRatio, targetMeanPrice, recommendationKey,
//         numberOfAnalysts, priceToBook, priceToSales, evToEbitda, pegRatio, bookValuePerShare,
//         freeCashFlow, sector, industry, name
const FUNDAMENTALS_DB = {
  NVDA: {
    name:'NVIDIA Corp', sector:'Technology', industry:'Semiconductors',
    pe:50.2, forwardPE:28.4, eps:2.94, beta:1.66, dividendYield:0.0003,
    revenueGrowth:0.781, grossMargin:0.745, operatingMargin:0.572, roe:1.231,
    totalRevenue:130.5e9, debtToEquity:42.1, currentRatio:4.17,
    targetMeanPrice:144.50, recommendationKey:'strong_buy', numberOfAnalysts:41,
    priceToBook:35.2, priceToSales:28.1, evToEbitda:42.3, pegRatio:0.38,
    bookValuePerShare:2.20, freeCashFlow:60.8e9,
  },
  AAPL: {
    name:'Apple Inc', sector:'Technology', industry:'Consumer Electronics',
    pe:30.2, forwardPE:27.4, eps:6.42, beta:1.19, dividendYield:0.0044,
    revenueGrowth:0.051, grossMargin:0.462, operatingMargin:0.311, roe:1.720,
    totalRevenue:391.0e9, debtToEquity:180.4, currentRatio:1.04,
    targetMeanPrice:215.00, recommendationKey:'buy', numberOfAnalysts:38,
    priceToBook:54.8, priceToSales:8.5, evToEbitda:24.1, pegRatio:2.82,
    bookValuePerShare:4.05, freeCashFlow:108.0e9,
  },
  MSFT: {
    name:'Microsoft Corp', sector:'Technology', industry:'Software—Infrastructure',
    pe:33.1, forwardPE:28.4, eps:13.14, beta:0.90, dividendYield:0.0070,
    revenueGrowth:0.131, grossMargin:0.697, operatingMargin:0.451, roe:0.385,
    totalRevenue:245.1e9, debtToEquity:82.1, currentRatio:1.32,
    targetMeanPrice:511.00, recommendationKey:'buy', numberOfAnalysts:36,
    priceToBook:12.1, priceToSales:13.2, evToEbitda:23.8, pegRatio:2.14,
    bookValuePerShare:38.40, freeCashFlow:70.2e9,
  },
  GOOGL: {
    name:'Alphabet Inc', sector:'Technology', industry:'Internet Content & Info',
    pe:19.8, forwardPE:17.2, eps:8.52, beta:1.04, dividendYield:null,
    revenueGrowth:0.154, grossMargin:0.568, operatingMargin:0.321, roe:0.312,
    totalRevenue:350.0e9, debtToEquity:10.4, currentRatio:2.18,
    targetMeanPrice:201.00, recommendationKey:'strong_buy', numberOfAnalysts:44,
    priceToBook:6.5, priceToSales:6.8, evToEbitda:17.9, pegRatio:1.12,
    bookValuePerShare:28.20, freeCashFlow:72.0e9,
  },
  META: {
    name:'Meta Platforms', sector:'Technology', industry:'Internet Content & Info',
    pe:24.1, forwardPE:20.3, eps:24.81, beta:1.22, dividendYield:0.0030,
    revenueGrowth:0.274, grossMargin:0.813, operatingMargin:0.421, roe:0.388,
    totalRevenue:164.5e9, debtToEquity:26.1, currentRatio:2.74,
    targetMeanPrice:706.00, recommendationKey:'strong_buy', numberOfAnalysts:48,
    priceToBook:8.4, priceToSales:8.8, evToEbitda:16.9, pegRatio:0.74,
    bookValuePerShare:68.20, freeCashFlow:58.0e9,
  },
  AMZN: {
    name:'Amazon.com Inc', sector:'Technology', industry:'Internet Retail',
    pe:38.4, forwardPE:29.1, eps:5.12, beta:1.24, dividendYield:null,
    revenueGrowth:0.109, grossMargin:0.488, operatingMargin:0.108, roe:0.226,
    totalRevenue:638.0e9, debtToEquity:71.3, currentRatio:1.11,
    targetMeanPrice:234.00, recommendationKey:'strong_buy', numberOfAnalysts:46,
    priceToBook:9.2, priceToSales:3.8, evToEbitda:21.8, pegRatio:1.21,
    bookValuePerShare:25.10, freeCashFlow:38.0e9,
  },
  TSLA: {
    name:'Tesla Inc', sector:'Consumer Cyclical', industry:'Auto Manufacturers',
    pe:142.3, forwardPE:89.4, eps:2.31, beta:2.31, dividendYield:null,
    revenueGrowth:-0.009, grossMargin:0.171, operatingMargin:0.062, roe:0.089,
    totalRevenue:97.7e9, debtToEquity:22.1, currentRatio:1.84,
    targetMeanPrice:280.00, recommendationKey:'hold', numberOfAnalysts:42,
    priceToBook:14.2, priceToSales:9.2, evToEbitda:52.4, pegRatio:null,
    bookValuePerShare:24.10, freeCashFlow:2.5e9,
  },
  TSM: {
    name:'Taiwan Semiconductor', sector:'Technology', industry:'Semiconductors',
    pe:26.4, forwardPE:21.8, eps:6.54, beta:0.81, dividendYield:0.0120,
    revenueGrowth:0.348, grossMargin:0.582, operatingMargin:0.448, roe:0.291,
    totalRevenue:98.4e9, debtToEquity:32.4, currentRatio:2.48,
    targetMeanPrice:198.00, recommendationKey:'buy', numberOfAnalysts:18,
    priceToBook:5.2, priceToSales:7.8, evToEbitda:14.8, pegRatio:0.64,
    bookValuePerShare:22.40, freeCashFlow:28.0e9,
  },
  CLS: {
    name:'Celestica Inc', sector:'Technology', industry:'Electronic Components',
    pe:20.1, forwardPE:16.4, eps:4.39, beta:1.24, dividendYield:null,
    revenueGrowth:0.224, grossMargin:0.088, operatingMargin:0.062, roe:0.221,
    totalRevenue:10.9e9, debtToEquity:48.1, currentRatio:1.42,
    targetMeanPrice:109.00, recommendationKey:'buy', numberOfAnalysts:9,
    priceToBook:4.8, priceToSales:1.2, evToEbitda:15.1, pegRatio:0.72,
    bookValuePerShare:19.20, freeCashFlow:0.48e9,
  },
  INTU: {
    name:'Intuit Inc', sector:'Technology', industry:'Software—Application',
    pe:55.2, forwardPE:30.4, eps:11.58, beta:1.21, dividendYield:0.0060,
    revenueGrowth:0.128, grossMargin:0.812, operatingMargin:0.198, roe:0.172,
    totalRevenue:17.4e9, debtToEquity:38.2, currentRatio:1.24,
    targetMeanPrice:715.00, recommendationKey:'buy', numberOfAnalysts:29,
    priceToBook:18.2, priceToSales:14.1, evToEbitda:41.8, pegRatio:2.08,
    bookValuePerShare:24.30, freeCashFlow:4.2e9,
  },
  SFM: {
    name:'Sprouts Farmers Mkt', sector:'Consumer Defensive', industry:'Grocery Stores',
    pe:29.3, forwardPE:24.1, eps:3.34, beta:0.72, dividendYield:null,
    revenueGrowth:0.138, grossMargin:0.372, operatingMargin:0.091, roe:0.332,
    totalRevenue:7.8e9, debtToEquity:18.4, currentRatio:0.98,
    targetMeanPrice:111.00, recommendationKey:'buy', numberOfAnalysts:14,
    priceToBook:12.1, priceToSales:1.8, evToEbitda:21.9, pegRatio:1.81,
    bookValuePerShare:8.20, freeCashFlow:0.62e9,
  },
  AMD: {
    name:'Advanced Micro Devices', sector:'Technology', industry:'Semiconductors',
    pe:88.4, forwardPE:22.1, eps:1.23, beta:1.54, dividendYield:null,
    revenueGrowth:0.082, grossMargin:0.531, operatingMargin:0.048, roe:0.036,
    totalRevenue:25.8e9, debtToEquity:4.8, currentRatio:2.62,
    targetMeanPrice:122.00, recommendationKey:'buy', numberOfAnalysts:38,
    priceToBook:4.2, priceToSales:9.8, evToEbitda:44.8, pegRatio:4.12,
    bookValuePerShare:28.40, freeCashFlow:1.8e9,
  },
  AMAT: {
    name:'Applied Materials', sector:'Technology', industry:'Semiconductor Equipment',
    pe:21.4, forwardPE:18.2, eps:8.34, beta:1.41, dividendYield:0.0090,
    revenueGrowth:0.071, grossMargin:0.492, operatingMargin:0.292, roe:0.442,
    totalRevenue:27.2e9, debtToEquity:60.3, currentRatio:2.84,
    targetMeanPrice:193.00, recommendationKey:'buy', numberOfAnalysts:30,
    priceToBook:8.2, priceToSales:5.8, evToEbitda:15.8, pegRatio:2.08,
    bookValuePerShare:22.10, freeCashFlow:5.4e9,
  },
  INTC: {
    name:'Intel Corp', sector:'Technology', industry:'Semiconductors',
    pe:null, forwardPE:31.2, eps:-4.21, beta:1.07, dividendYield:null,
    revenueGrowth:-0.083, grossMargin:0.324, operatingMargin:-0.048, roe:-0.128,
    totalRevenue:53.1e9, debtToEquity:94.8, currentRatio:1.47,
    targetMeanPrice:21.00, recommendationKey:'hold', numberOfAnalysts:33,
    priceToBook:1.8, priceToSales:2.1, evToEbitda:18.2, pegRatio:null,
    bookValuePerShare:12.40, freeCashFlow:-4.2e9,
  },
  VMC: {
    name:'Vulcan Materials', sector:'Basic Materials', industry:'Building Materials',
    pe:38.2, forwardPE:29.4, eps:6.84, beta:0.98, dividendYield:0.0080,
    revenueGrowth:0.062, grossMargin:0.281, operatingMargin:0.188, roe:0.148,
    totalRevenue:7.7e9, debtToEquity:71.2, currentRatio:2.14,
    targetMeanPrice:285.00, recommendationKey:'buy', numberOfAnalysts:20,
    priceToBook:5.8, priceToSales:4.9, evToEbitda:22.1, pegRatio:2.81,
    bookValuePerShare:45.20, freeCashFlow:1.2e9,
  },
  SNAP: {
    name:'Snap Inc', sector:'Technology', industry:'Internet Content & Info',
    pe:null, forwardPE:null, eps:-0.82, beta:1.38, dividendYield:null,
    revenueGrowth:0.141, grossMargin:0.521, operatingMargin:-0.182, roe:-0.621,
    totalRevenue:5.4e9, debtToEquity:null, currentRatio:3.82,
    targetMeanPrice:8.66, recommendationKey:'hold', numberOfAnalysts:28,
    priceToBook:8.5, priceToSales:3.2, evToEbitda:null, pegRatio:null,
    bookValuePerShare:1.24, freeCashFlow:0.18e9,
  },
  RIVN: {
    name:'Rivian Automotive', sector:'Consumer Cyclical', industry:'Auto Manufacturers',
    pe:null, forwardPE:null, eps:-4.84, beta:1.72, dividendYield:null,
    revenueGrowth:0.092, grossMargin:-0.441, operatingMargin:-0.782, roe:-0.782,
    totalRevenue:5.1e9, debtToEquity:null, currentRatio:4.21,
    targetMeanPrice:10.33, recommendationKey:'hold', numberOfAnalysts:22,
    priceToBook:1.8, priceToSales:2.4, evToEbitda:null, pegRatio:null,
    bookValuePerShare:8.10, freeCashFlow:-2.8e9,
  },
  BABA: {
    name:'Alibaba Group', sector:'Technology', industry:'Internet Retail',
    pe:16.2, forwardPE:11.4, eps:7.72, beta:0.29, dividendYield:null,
    revenueGrowth:0.072, grossMargin:0.388, operatingMargin:0.141, roe:0.118,
    totalRevenue:130.2e9, debtToEquity:18.2, currentRatio:1.81,
    targetMeanPrice:134.00, recommendationKey:'buy', numberOfAnalysts:26,
    priceToBook:1.8, priceToSales:2.2, evToEbitda:10.2, pegRatio:1.81,
    bookValuePerShare:48.30, freeCashFlow:18.0e9,
  },
  COIN: {
    name:'Coinbase Global', sector:'Financial Services', industry:'Capital Markets',
    pe:28.4, forwardPE:22.1, eps:8.92, beta:3.61, dividendYield:null,
    revenueGrowth:0.284, grossMargin:0.882, operatingMargin:0.241, roe:0.284,
    totalRevenue:6.6e9, debtToEquity:84.2, currentRatio:1.48,
    targetMeanPrice:284.00, recommendationKey:'hold', numberOfAnalysts:24,
    priceToBook:4.8, priceToSales:8.2, evToEbitda:22.4, pegRatio:0.72,
    bookValuePerShare:52.10, freeCashFlow:1.4e9,
  },
  SPY: {
    name:'SPDR S&P 500 ETF', sector:'ETF', industry:'Broad Market ETF',
    pe:22.1, forwardPE:20.4, eps:null, beta:1.00, dividendYield:0.0120,
    revenueGrowth:null, grossMargin:null, operatingMargin:null, roe:null,
    totalRevenue:null, debtToEquity:null, currentRatio:null,
    targetMeanPrice:null, recommendationKey:null, numberOfAnalysts:null,
    priceToBook:null, priceToSales:null, evToEbitda:null, pegRatio:null,
    bookValuePerShare:null, freeCashFlow:null,
  },
  QQQ: {
    name:'Invesco QQQ ETF', sector:'ETF', industry:'Technology ETF',
    pe:28.4, forwardPE:24.8, eps:null, beta:1.12, dividendYield:0.0060,
    revenueGrowth:null, grossMargin:null, operatingMargin:null, roe:null,
    totalRevenue:null, debtToEquity:null, currentRatio:null,
    targetMeanPrice:null, recommendationKey:null, numberOfAnalysts:null,
    priceToBook:null, priceToSales:null, evToEbitda:null, pegRatio:null,
    bookValuePerShare:null, freeCashFlow:null,
  },
}

// Source D: allorigins CORS proxy → Yahoo Finance v8 chart
async function fromAllOrigins(sym) {
  try {
    const target = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`
    const res = await timedFetch(
      `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
      8000
    )
    if (!res.ok) return null
    const json = await res.json()
    const meta = json?.chart?.result?.[0]?.meta
    if (!meta?.regularMarketPrice) return null
    return {
      price:     meta.regularMarketPrice,
      changePct: meta.regularMarketChangePercent ?? 0,
      week52High:meta.fiftyTwoWeekHigh,
      week52Low: meta.fiftyTwoWeekLow,
      marketCap: meta.marketCap,
      name:      meta.longName || meta.shortName,
    }
  } catch (_) { return null }
}

// ── Source E: Financial Modeling Prep (free tier, 250 req/day) ────────────────
// Get a free API key at financialmodelingprep.com and paste it below.
// Without a key this source is skipped — the DB fallback still covers top tickers.
const FMP_KEY = '' // ← paste your key here for richer live data

async function fromFMP(sym) {
  if (!FMP_KEY) return null
  try {
    const base = 'https://financialmodelingprep.com/api/v3'
    const [qRes, kRes] = await Promise.all([
      timedFetch(`${base}/quote/${encodeURIComponent(sym)}?apikey=${FMP_KEY}`, 7000),
      timedFetch(`${base}/key-metrics-ttm/${encodeURIComponent(sym)}?apikey=${FMP_KEY}`, 7000),
    ])
    const q  = qRes.ok  ? (await qRes.json())?.[0]  : null
    const km = kRes.ok  ? (await kRes.json())?.[0]  : null
    if (!q?.price) return null
    return {
      // price data
      price:            q.price,
      changePct:        q.changesPercentage,
      dayHigh:          q.dayHigh,
      dayLow:           q.dayLow,
      week52High:       q.yearHigh,
      week52Low:        q.yearLow,
      marketCap:        q.marketCap,
      volume:           q.volume,
      pe:               q.pe,
      eps:              q.eps,
      name:             q.name,
      // valuation multiples from key-metrics
      priceToBook:      km?.pbRatioTTM,
      priceToSales:     km?.priceToSalesRatioTTM,
      evToEbitda:       km?.evToEBITDATTM,
      pegRatio:         km?.pegRatioTTM,
      freeCashFlow:     km?.freeCashFlowTTM,
      bookValuePerShare:km?.bookValuePerShareTTM,
      revenueGrowth:    km?.revenueGrowthTTM,
      grossMargin:      km?.grossProfitMarginTTM,
      operatingMargin:  km?.operatingProfitMarginTTM,
      roe:              km?.returnOnEquityTTM,
      debtToEquity:     km?.debtToEquityTTM,
      currentRatio:     km?.currentRatioTTM,
    }
  } catch (_) { return null }
}

// ── insight engine ─────────────────────────────────────────────────────────────
function generateInsights(data) {
  if (!data?.price) return null

  const { symbol, price, beta, pe, forwardPE, week52High, week52Low,
          revenueGrowth, grossMargin, operatingMargin, roe, debtToEquity,
          marketCap, targetMeanPrice, recommendationKey, dividendYield } = data

  const upside   = targetMeanPrice ? ((targetMeanPrice - price) / price * 100) : null
  const rangePos = week52High && week52Low
    ? ((price - week52Low) / (week52High - week52Low) * 100) : null
  const hasBeta  = beta != null && !isNaN(beta)

  // ── 1. Safe Options Play (2–3 weeks) ───────────────────────────────────────
  let optionsPlay = null
  const strikeDown  = price ? `$${(price * 0.93).toFixed(0)}`  : '—'
  const strikeCur   = price ? `$${Math.round(price / 5) * 5}`   : '—'
  const strikeUp5   = price ? `$${(price * 1.05).toFixed(0)}`   : '—'
  const strikeUp8   = price ? `$${(price * 1.08).toFixed(0)}`   : '—'

  if (!hasBeta || beta < 0.8) {
    optionsPlay = {
      strategy:  'Sell Cash-Secured Put',
      risk:      'Low',
      riskColor: 'text-green-700',
      detail: `${symbol} is low-volatility${hasBeta ? ` (beta ${beta.toFixed(2)})` : ''} — ideal for selling a put 5–8% below current price (strike ≈ ${strikeDown}), expiring 2–3 weeks out. You collect premium upfront. If shares stay above the strike, you keep it all. If they dip below, you buy at an effective cost below today's price.`,
      steps: [
        `Sell 1× ${symbol} put at ${strikeDown} strike, expiry ~3 weeks`,
        'Collect premium immediately (income strategy)',
        `Max risk: owning ${symbol} at ${strikeDown} — still below today's price`,
        'Set a buy-to-close order at 50% of premium received to lock in profit early',
      ],
    }
  } else if (beta < 1.5) {
    if (upside && upside > 12) {
      optionsPlay = {
        strategy:  'Buy Call Option (ATM)',
        risk:      'Medium',
        riskColor: 'text-yellow-700',
        detail: `Analysts see ${upside.toFixed(1)}% upside to $${fmt(targetMeanPrice)}. With moderate beta (${hasBeta ? beta.toFixed(2) : 'n/a'}), buy a call at or near the money (strike ≈ ${strikeCur}) expiring 3 weeks out. Risk is capped at the premium paid. VIX at historical lows keeps options premiums cheap right now.`,
        steps: [
          `Buy 1× ${symbol} call at ${strikeCur} strike, expiry ~3 weeks`,
          'Max loss = premium paid (defined risk)',
          `Target: close position if up 80–100% on the option`,
          `Stop: exit if stock closes below ${(price * 0.96).toFixed(0)} (4% below entry)`,
        ],
      }
    } else {
      optionsPlay = {
        strategy:  'Bull Call Spread',
        risk:      'Medium',
        riskColor: 'text-yellow-700',
        detail: `Buy a call at ${strikeCur} and simultaneously sell a call at ${strikeUp5}. This cuts your premium cost by 40–50% vs. a naked call while keeping defined upside. Best for a moderate move over 2–3 weeks without paying full premium.`,
        steps: [
          `Buy 1× ${symbol} call at ${strikeCur} strike`,
          `Sell 1× ${symbol} call at ${strikeUp5} strike (same expiry, ~3 weeks)`,
          `Max profit: spread width minus net debit paid`,
          'Max loss: net debit paid — fully defined risk',
        ],
      }
    }
  } else {
    optionsPlay = {
      strategy:  'Bull Call Spread (High-Vol Version)',
      risk:      'High — use small size',
      riskColor: 'text-red-700',
      detail: `High beta (${hasBeta ? beta.toFixed(2) : 'n/a'}) = expensive premiums. Never buy a naked call here — use a spread instead. Buy a call at ${strikeCur}, sell a call at ${strikeUp8}. This cuts premium cost in half. Keep position size to max 1–2% of portfolio given the volatility.`,
      steps: [
        `Buy 1× ${symbol} call at ${strikeCur} strike`,
        `Sell 1× ${symbol} call at ${strikeUp8} strike (same expiry, ~2–3 weeks)`,
        '⚠️ Size to max 1–2% of portfolio — beta amplifies losses',
        `Wait for AMAT/market confirmation before entering — avoid day-of news`,
      ],
    }
  }

  // ── 2. Value Assessment ────────────────────────────────────────────────────
  const valueBullets = []
  let valueSentiment = 'neutral'

  if (forwardPE != null) {
    if      (forwardPE < 12) { valueBullets.push({ good: true,  text: `Forward P/E ${forwardPE.toFixed(1)}× — deeply undervalued vs. market average of ~20×. Rare opportunity if fundamentals are intact.` }); valueSentiment = 'bull' }
    else if (forwardPE < 20) { valueBullets.push({ good: true,  text: `Forward P/E ${forwardPE.toFixed(1)}× — fair value. You're not overpaying, with room to re-rate higher if growth accelerates.` }); valueSentiment = 'bull' }
    else if (forwardPE < 35) { valueBullets.push({ good: null,  text: `Forward P/E ${forwardPE.toFixed(1)}× — moderate premium. Growth needs to keep up to justify; any miss = multiple compression.` }) }
    else                      { valueBullets.push({ good: false, text: `Forward P/E ${forwardPE.toFixed(1)}× — expensive. Priced for perfection. A single guidance cut could trigger a 15–25% repricing.` }); valueSentiment = 'bear' }
  }

  if (revenueGrowth != null) {
    const g = (revenueGrowth * 100).toFixed(1)
    if      (revenueGrowth > 0.25) { valueBullets.push({ good: true,  text: `Revenue +${g}% YoY — exceptional growth that can justify a premium multiple.` }); valueSentiment = valueSentiment === 'bear' ? 'neutral' : 'bull' }
    else if (revenueGrowth > 0.10) { valueBullets.push({ good: true,  text: `Revenue +${g}% YoY — solid growth; business has real momentum.` }) }
    else if (revenueGrowth > 0)    { valueBullets.push({ good: null,  text: `Revenue growing at only +${g}% — slowing. Watch next quarter for further deceleration.` }) }
    else                            { valueBullets.push({ good: false, text: `Revenue shrinking ${g}% YoY — this is the #1 red flag for any valuation argument.` }); valueSentiment = 'bear' }
  }

  if (upside != null) {
    if      (upside > 20) valueBullets.push({ good: true,  text: `Analysts' mean target implies ${upside.toFixed(1)}% upside — strong conviction from ${data.numberOfAnalysts ?? '?'} analysts.` })
    else if (upside > 8)  valueBullets.push({ good: true,  text: `${upside.toFixed(1)}% to analyst mean target — reasonable upside with professional backing.` })
    else if (upside > 0)  valueBullets.push({ good: null,  text: `Only ${upside.toFixed(1)}% to analyst mean target — limited near-term upside priced in.` })
    else                  valueBullets.push({ good: false, text: `Stock is ${Math.abs(upside).toFixed(1)}% above analyst mean target — currently overvalued vs. consensus.` })
  }

  if (rangePos != null) {
    if      (rangePos < 25) valueBullets.push({ good: true,  text: `Near 52-week low (${rangePos.toFixed(0)}% of range) — potential value entry with asymmetric upside.` })
    else if (rangePos > 85) valueBullets.push({ good: false, text: `Near 52-week high (${rangePos.toFixed(0)}% of range) — limited margin of safety at current price.` })
    else                    valueBullets.push({ good: null,  text: `Mid-range (${rangePos.toFixed(0)}% of 52-week band) — balanced positioning, neither a bargain nor excessive.` })
  }

  if (grossMargin != null && grossMargin > 0.5) {
    valueBullets.push({ good: true, text: `Gross margin ${(grossMargin*100).toFixed(1)}% — strong pricing power and competitive moat.` })
  }

  // ── 3. Red Flags for Mid-Range Risk Taker ─────────────────────────────────
  const risks = []

  if (hasBeta && beta > 1.5) {
    risks.push({ severity: 'critical', text: `Beta ${beta.toFixed(2)}: This stock swings ${beta.toFixed(1)}× harder than the market. A 5% S&P 500 drop = an 8–12% loss here overnight. For a mid-range risk taker this volatility erodes conviction and leads to panic-selling at the bottom.` })
  } else if (hasBeta && beta > 1.2) {
    risks.push({ severity: 'high', text: `Beta ${beta.toFixed(2)}: Meaningfully more volatile than the broader market. One macro shock or Fed surprise and this stock will react harder than you expect. Size positions accordingly.` })
  }

  if (forwardPE != null && forwardPE > 45) {
    risks.push({ severity: 'critical', text: `Forward P/E ${forwardPE.toFixed(1)}×: You're paying an extreme premium that requires flawless execution every single quarter. One earnings miss, one guidance cut, one margin disappointment — and the stock reprices 20–30% lower in a single session. Mid-range risk takers can't stomach that drawdown.` })
  } else if (forwardPE != null && forwardPE > 30) {
    risks.push({ severity: 'high', text: `Forward P/E ${forwardPE.toFixed(1)}×: Elevated valuation leaves little room for error. If growth slows even slightly, multiple compression alone — without any earnings change — can cut 15–20% off the share price.` })
  }

  if (debtToEquity != null && debtToEquity > 200) {
    risks.push({ severity: 'critical', text: `Debt/Equity ${debtToEquity.toFixed(0)}%: Dangerously leveraged. In a rising-rate environment, interest expense balloons and refinancing risk grows. If earnings disappoint, the company has little cushion — bondholders get paid before you do.` })
  } else if (debtToEquity != null && debtToEquity > 100) {
    risks.push({ severity: 'high', text: `Debt/Equity ${debtToEquity.toFixed(0)}%: Above-average leverage. Higher-rate environment directly pressures earnings. Monitor interest coverage ratio closely.` })
  }

  if (rangePos != null && rangePos > 88) {
    risks.push({ severity: 'high', text: `Trading at ${rangePos.toFixed(0)}% of its 52-week range — you're buying near the top of its historical band. Upside to the 52-week high is only $${fmt(week52High - price)}, while potential downside to the low is $${fmt(price - week52Low)}. The math favors the bears.` })
  }

  if (revenueGrowth != null && revenueGrowth < 0) {
    risks.push({ severity: 'critical', text: `Revenue declining ${(revenueGrowth*100).toFixed(1)}% YoY: You'd be paying a premium for a shrinking business. In a rising-rate environment, growth investors abandon these names fast and value investors won't step in until the P/E is much lower. Classic value trap risk.` })
  }

  if (operatingMargin != null && operatingMargin < 0) {
    risks.push({ severity: 'critical', text: `Negative operating margin (${(operatingMargin*100).toFixed(1)}%): The company is losing money on core operations. Every quarter is a burn — and the market will punish any slippage in the path to profitability. Not suitable for moderate risk tolerance.` })
  }

  if ((!dividendYield || dividendYield < 0.005) && hasBeta && beta > 1.2) {
    risks.push({ severity: 'medium', text: `No dividend + high beta: Zero income cushion during drawdowns. If this stock falls 25%, you wait with no yield to offset the pain. At least dividend payers give you something while you hold through volatility.` })
  }

  if (marketCap != null && marketCap < 2e9) {
    risks.push({ severity: 'high', text: `Small-cap ($${fmtLarge(marketCap)} market cap): Institutional liquidity is thin. When institutions exit, the spread widens and you can't get out at the price you see on screen. Mid-range risk takers should stick to stocks with >$5B market cap for reliable liquidity.` })
  }

  if (upside != null && upside < 3 && upside >= 0) {
    risks.push({ severity: 'medium', text: `Only ${upside.toFixed(1)}% analyst upside: That's barely worth the equity risk. A money-market fund or short-duration bond gives you 4–5% with zero volatility. Why take full stock risk for less return?` })
  }

  // Universal position sizing reminder
  risks.push({ severity: 'info', text: `Position sizing rule for mid-range risk takers: Never allocate more than 3–5% of total portfolio to any single stock, regardless of conviction. Even the best thesis can be derailed by macro events, sector rotation, or management missteps.` })

  return { optionsPlay, valueBullets, valueSentiment, risks }
}

// ── Multi-method valuation engine ──────────────────────────────────────────────
// Each method scores 0–100 (100 = cheapest). Weighted composite = overall verdict.
function calculateValuationScore(data) {
  const methods = []
  const add = (method, score, detail, weight = 1) =>
    methods.push({ method, score: Math.round(Math.min(100, Math.max(0, score))), detail, weight })

  // 1. Forward P/E vs market average ~20× (weight ×2)
  if (data.forwardPE != null && data.forwardPE > 0) {
    const f = data.forwardPE
    const s = f < 10 ? 95 : f < 15 ? 85 : f < 20 ? 72 : f < 25 ? 58 : f < 35 ? 38 : f < 50 ? 22 : 8
    add('Forward P/E', s, `${f.toFixed(1)}× (market avg ~20×)`, 2)
  }

  // 2. PEG Ratio — blends PE with growth quality (weight ×2)
  const peg = data.pegRatio ??
    ((data.forwardPE && data.revenueGrowth > 0) ? data.forwardPE / (data.revenueGrowth * 100) : null)
  if (peg != null && peg > 0) {
    const s = peg < 0.5 ? 95 : peg < 1.0 ? 82 : peg < 1.5 ? 66 : peg < 2.0 ? 48 : peg < 3.0 ? 28 : 12
    add('PEG Ratio', s, `${peg.toFixed(2)}  (< 1.0 = growth at fair price)`, 2)
  }

  // 3. EV/EBITDA — enterprise-level view, ignores capital structure (weight ×2)
  if (data.evToEbitda != null && data.evToEbitda > 0) {
    const ev = data.evToEbitda
    const s = ev < 8 ? 92 : ev < 12 ? 78 : ev < 18 ? 60 : ev < 25 ? 40 : ev < 40 ? 22 : 8
    add('EV / EBITDA', s, `${ev.toFixed(1)}× (< 12× = attractive)`, 2)
  }

  // 4. Analyst consensus target upside (weight ×2)
  if (data.targetMeanPrice && data.price) {
    const up = (data.targetMeanPrice - data.price) / data.price * 100
    const s = up > 30 ? 95 : up > 20 ? 82 : up > 10 ? 68 : up > 5 ? 52 : up > 0 ? 36 : up > -10 ? 20 : 8
    add('Analyst Target', s, `${up > 0 ? '+' : ''}${up.toFixed(1)}% to mean target $${fmt(data.targetMeanPrice)}`, 2)
  }

  // 5. Price / Sales (weight ×1)
  if (data.priceToSales != null && data.priceToSales > 0) {
    const ps = data.priceToSales
    const s = ps < 1 ? 92 : ps < 3 ? 76 : ps < 6 ? 58 : ps < 10 ? 38 : ps < 20 ? 20 : 8
    add('Price / Sales', s, `${ps.toFixed(2)}× (< 3× = good value)`)
  }

  // 6. Price / Book (weight ×1)
  if (data.priceToBook != null && data.priceToBook > 0) {
    const pb = data.priceToBook
    const s = pb < 1 ? 92 : pb < 2 ? 80 : pb < 4 ? 66 : pb < 8 ? 46 : pb < 15 ? 28 : 12
    add('Price / Book', s, `${pb.toFixed(2)}× (< 4× = reasonable)`)
  }

  // 7. Revenue growth quality (weight ×1)
  if (data.revenueGrowth != null) {
    const g = data.revenueGrowth
    const s = g > 0.30 ? 90 : g > 0.15 ? 76 : g > 0.05 ? 58 : g > 0 ? 40 : g > -0.05 ? 22 : 8
    add('Revenue Growth', s, `${(g * 100).toFixed(1)}% YoY (> 15% = strong)`)
  }

  // 8. Graham Number — classic deep value check (weight ×1)
  if (data.eps > 0 && data.bookValuePerShare > 0 && data.price) {
    const g = Math.sqrt(22.5 * data.eps * data.bookValuePerShare)
    const disc = (g - data.price) / data.price * 100
    const s = disc > 30 ? 95 : disc > 15 ? 80 : disc > 0 ? 63 : disc > -15 ? 44 : disc > -30 ? 26 : 10
    add('Graham Number', s, `Intrinsic ≈ $${g.toFixed(2)} (${disc > 0 ? '+' : ''}${disc.toFixed(1)}% vs price)`)
  }

  // 9. Gross margin quality — moat indicator (weight ×1)
  if (data.grossMargin != null) {
    const gm = data.grossMargin
    const s = gm > 0.70 ? 88 : gm > 0.50 ? 74 : gm > 0.35 ? 58 : gm > 0.20 ? 42 : gm > 0.10 ? 28 : 12
    add('Gross Margin', s, `${(gm * 100).toFixed(1)}% (> 50% = wide moat)`)
  }

  if (methods.length === 0) return null

  const totalWeight = methods.reduce((s, m) => s + m.weight, 0)
  const composite   = Math.round(methods.reduce((s, m) => s + m.score * m.weight, 0) / totalWeight)

  let verdict, color, summary
  if (composite >= 72) {
    verdict = 'Undervalued'; color = 'green'
    summary = 'Multiple metrics suggest this stock is trading below fair value — a potential buying opportunity if the thesis holds.'
  } else if (composite >= 55) {
    verdict = 'Fairly Valued'; color = 'blue'
    summary = 'Price is broadly in line with fundamentals. No screaming bargain, but not overpriced either — look for a catalyst or dip.'
  } else if (composite >= 38) {
    verdict = 'Slightly Overvalued'; color = 'amber'
    summary = 'Valuation is stretched but not extreme. Consider trimming on strength or waiting for a pullback before adding.'
  } else {
    verdict = 'Overvalued'; color = 'red'
    summary = 'Most metrics flash expensive. Risk/reward is unfavorable at current prices — high bar for new money in here.'
  }

  return { composite, methods, verdict, color, summary }
}

// ── Merge results — priceService result for price, summary/FMP for fundamentals
function mergeData(sym, price, summary, allorigins, fmp = null) {
  // priceService already raced Yahoo v8 ×2 + Stooq + allorigins — use it directly
  const priceSource = price || allorigins || fmp
  if (!priceSource?.price) return null

  // Fundamentals: live summary → FMP → static DB → empty object (never null)
  const fund = summary || fmp || FUNDAMENTALS_DB[sym] || {}

  return {
    symbol:           sym,
    name:             fund.name || price?.name || allorigins?.name || fmp?.name || sym,
    sector:           fund.sector || '—',
    industry:         fund.industry || '—',
    description:      fund.description,
    // Price & daily — all from priceService's result
    price:            priceSource.price,
    changePct:        priceSource.changePct,
    dayHigh:          priceSource.dayHigh    ?? allorigins?.dayHigh,
    dayLow:           priceSource.dayLow     ?? allorigins?.dayLow,
    prevClose:        price?.prevClose,
    week52High:       price?.week52High      ?? allorigins?.week52High ?? fmp?.week52High,
    week52Low:        price?.week52Low       ?? allorigins?.week52Low  ?? fmp?.week52Low,
    marketCap:        price?.marketCap       ?? allorigins?.marketCap  ?? fmp?.marketCap,
    volume:           priceSource.volume,
    exchange:         price?.exchange,
    // Classic valuation
    pe:               fund.pe             ?? fmp?.pe,
    forwardPE:        fund.forwardPE,
    eps:              fund.eps            ?? fmp?.eps,
    beta:             fund.beta,
    dividendYield:    fund.dividendYield,
    // Financials
    revenueGrowth:    fund.revenueGrowth  ?? fmp?.revenueGrowth,
    grossMargin:      fund.grossMargin    ?? fmp?.grossMargin,
    operatingMargin:  fund.operatingMargin ?? fmp?.operatingMargin,
    roe:              fund.roe            ?? fmp?.roe,
    totalRevenue:     fund.totalRevenue,
    debtToEquity:     fund.debtToEquity   ?? fmp?.debtToEquity,
    currentRatio:     fund.currentRatio   ?? fmp?.currentRatio,
    freeCashFlow:     fund.freeCashFlow   ?? fmp?.freeCashFlow,
    // Analyst
    targetMeanPrice:  fund.targetMeanPrice,
    recommendationKey:fund.recommendationKey,
    numberOfAnalysts: fund.numberOfAnalysts,
    // Multi-method valuation fields
    priceToBook:      fund.priceToBook    ?? fmp?.priceToBook,
    priceToSales:     fund.priceToSales   ?? fmp?.priceToSales,
    evToEbitda:       fund.evToEbitda     ?? fmp?.evToEbitda,
    pegRatio:         fund.pegRatio       ?? fmp?.pegRatio,
    bookValuePerShare:fund.bookValuePerShare ?? fmp?.bookValuePerShare,
    // Earnings
    nextEarningsDate: fund.nextEarningsDate,
    expectedEPS:      fund.expectedEPS,
    earningsHistory:  fund.earningsHistory,
  }
}

function EarningsHighlights({ data }) {
  const highlights = []
  const alerts = []

  // 1. Check recent earnings vs estimates
  if (data.earningsHistory?.length > 0) {
    const last = data.earningsHistory[data.earningsHistory.length - 1]
    const actual = last.actual?.raw
    const estimate = last.estimate?.raw
    if (actual != null && estimate != null) {
      const diff = actual - estimate
      if (diff > 0) highlights.push(`Earnings Beat: Reported $${fmt(actual)} vs $${fmt(estimate)} estimate last quarter.`)
      else if (diff < 0) alerts.push(`Earnings Miss: Reported $${fmt(actual)} vs $${fmt(estimate)} estimate last quarter.`)
    }
  }

  // 2. Growth highlights
  if (data.revenueGrowth > 0.20) highlights.push(`High Growth: Revenue expanding at ${pct(data.revenueGrowth)} YoY.`)
  else if (data.revenueGrowth < 0) alerts.push(`Declining Revenue: Sales shrinking ${pct(data.revenueGrowth)} year-over-year.`)

  // 3. Margin highlights
  if (data.operatingMargin > 0.25) highlights.push(`Efficient Ops: Strong operating margins at ${pct(data.operatingMargin)}.`)
  else if (data.operatingMargin < 0.05 && data.operatingMargin !== '—') alerts.push(`Thin Margins: Operating margin is only ${pct(data.operatingMargin)}, leaving little room for error.`)

  // 4. Financial health
  if (data.debtToEquity > 150) alerts.push(`High Leverage: Debt-to-Equity is ${fmt(data.debtToEquity, 0)}%, indicating high financial risk.`)
  if (data.currentRatio < 1.0 && data.currentRatio !== '—') alerts.push(`Liquidity Risk: Current ratio below 1.0 (${fmt(data.currentRatio, 2)}) suggests potential short-term funding issues.`)

  if (highlights.length === 0 && alerts.length === 0) return null

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 mb-4">
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4 pb-2 border-b border-slate-100">📢 Recent Earnings & Performance Highlights</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {highlights.length > 0 && (
          <div className="space-y-2">
            {highlights.map((h, i) => (
              <div key={i} className="flex items-start gap-2 text-sm bg-emerald-50 text-emerald-800 p-3 rounded-lg border border-emerald-100">
                <span className="mt-0.5">✅</span>
                <span className="font-semibold">{h}</span>
              </div>
            ))}
          </div>
        )}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-sm bg-red-50 text-red-800 p-3 rounded-lg border border-red-100">
                <span className="mt-0.5">🚨</span>
                <span className="font-semibold">{a}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Valuation Engine UI ────────────────────────────────────────────────────────
function ValuationEngine({ data }) {
  const val = calculateValuationScore(data)
  if (!val) return null

  const C = {
    green: { wrap: 'bg-emerald-50 border-emerald-300', title: 'text-emerald-800', sub: 'text-emerald-600', score: 'text-emerald-700', badge: 'bg-emerald-600 text-white', bar: 'bg-emerald-500', track: 'bg-emerald-100' },
    blue:  { wrap: 'bg-blue-50 border-blue-300',       title: 'text-blue-800',    sub: 'text-blue-600',    score: 'text-blue-700',    badge: 'bg-blue-600 text-white',    bar: 'bg-blue-500',    track: 'bg-blue-100'   },
    amber: { wrap: 'bg-amber-50 border-amber-300',     title: 'text-amber-800',   sub: 'text-amber-600',   score: 'text-amber-700',   badge: 'bg-amber-500 text-white',   bar: 'bg-amber-400',   track: 'bg-amber-100'  },
    red:   { wrap: 'bg-red-50 border-red-300',         title: 'text-red-800',     sub: 'text-red-600',     score: 'text-red-700',     badge: 'bg-red-600 text-white',     bar: 'bg-red-500',     track: 'bg-red-100'    },
  }[val.color]

  const barColor = (s) =>
    s >= 70 ? 'bg-emerald-500' : s >= 52 ? 'bg-blue-400' : s >= 36 ? 'bg-amber-400' : 'bg-red-400'

  // Needle arc for the gauge (value 0–100 → -90° to +90°)
  const needleDeg = -90 + val.composite * 1.8
  const toRad = (d) => (d * Math.PI) / 180
  const cx = 100, cy = 90, r = 72
  const needleX = cx + r * 0.78 * Math.cos(toRad(needleDeg))
  const needleY = cy + r * 0.78 * Math.sin(toRad(needleDeg))

  return (
    <div className={`rounded-xl border-2 p-5 mb-4 ${C.wrap}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <div className={`text-sm font-bold ${C.title}`}>🏦 Multi-Method Valuation Engine</div>
          <div className={`text-xs mt-0.5 ${C.sub}`}>
            Composite of {val.methods.length} independent methods · {val.methods.reduce((s, m) => s + m.weight, 0)} weighted signals
          </div>
        </div>

        {/* Score gauge */}
        <div className="text-center flex-shrink-0">
          <svg viewBox="0 0 200 110" className="w-40 h-20">
            {/* Background arcs: red → amber → blue → green */}
            {[
              { start: -90, end: -54, color: '#ef4444' },
              { start: -54, end: -18, color: '#f59e0b' },
              { start: -18, end: 18,  color: '#60a5fa' },
              { start: 18,  end: 90,  color: '#10b981' },
            ].map(({ start, end, color }, i) => {
              const x1 = cx + r * Math.cos(toRad(start))
              const y1 = cy + r * Math.sin(toRad(start))
              const x2 = cx + r * Math.cos(toRad(end))
              const y2 = cy + r * Math.sin(toRad(end))
              const lg = Math.abs(end - start) > 180 ? 1 : 0
              return (
                <path key={i}
                  d={`M ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2}`}
                  fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" opacity="0.3" />
              )
            })}
            {/* Needle */}
            <line x1={cx} y1={cy} x2={needleX} y2={needleY}
              stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
            <circle cx={cx} cy={cy} r="5" fill="#1e293b" />
            {/* Score text */}
            <text x={cx} y={cy + 22} textAnchor="middle" fontSize="22" fontWeight="800" fill="#1e293b">
              {val.composite}
            </text>
            <text x={cx} y={cy + 34} textAnchor="middle" fontSize="8" fill="#64748b">out of 100</text>
          </svg>
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${C.badge}`}>
            {val.verdict}
          </span>
        </div>
      </div>

      {/* Overall bar */}
      <div className="mb-4">
        <div className={`h-2.5 rounded-full overflow-hidden ${C.track}`}>
          <div className={`h-full rounded-full ${C.bar}`} style={{ width: `${val.composite}%` }} />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>0 · Overvalued</span><span>50 · Fair</span><span>100 · Cheap</span>
        </div>
      </div>

      {/* Summary sentence */}
      <p className={`text-sm leading-relaxed mb-4 font-medium ${C.title}`}>{val.summary}</p>

      {/* Method breakdown */}
      <div className="bg-white/50 rounded-lg p-3 space-y-2.5">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Breakdown by method</div>
        {val.methods.map((m, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-32 text-xs text-slate-600 font-semibold flex-shrink-0 leading-tight">{m.method}</div>
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor(m.score)}`}
                style={{ width: `${m.score}%` }} />
            </div>
            <div className={`w-7 text-xs font-bold text-right flex-shrink-0 ${
              m.score >= 70 ? 'text-emerald-600' : m.score >= 52 ? 'text-blue-600' : m.score >= 36 ? 'text-amber-600' : 'text-red-600'
            }`}>{m.score}</div>
            <div className="text-xs text-slate-400 hidden md:block min-w-0 truncate max-w-[200px]">{m.detail}</div>
          </div>
        ))}
      </div>

      <div className={`text-xs mt-3 ${C.sub} opacity-75`}>
        ⚡ Weighted composite — Forward P/E, PEG, EV/EBITDA and Analyst Target count 2× · other methods 1×
      </div>
    </div>
  )
}

// ── component ──────────────────────────────────────────────────────────────────
export default function StockAnalyzer() {
  const [ticker, setTicker]   = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState(null)
  const [sources, setSources] = useState(null)

  const analyze = async (sym) => {
    const s = (sym || ticker).toUpperCase().trim()
    if (!s) return
    setTicker(s)
    setLoading(true)
    setError(null)
    setResult(null)
    setSources(null)

    try {
      // fetchPrice = shared priceService (Yahoo v8 chart ×2 + Stooq + allorigins in parallel)
      // summaryR   = fundamentals (PE, margins, analyst targets, etc.)
      // fmpR       = optional Financial Modeling Prep extra metrics
      invalidateCache(s) // always force-fresh on explicit analyze
      const [priceR, summaryR, allOriginsR, fmpR] = await Promise.allSettled([
        fetchPrice(s),
        fromYahooSummary(s),
        fromAllOrigins(s),
        fromFMP(s),
      ]).then(rs => rs.map(r => r.status === 'fulfilled' ? r.value : null))

      setSources({
        price:      !!priceR,
        summary:    !!summaryR,
        allorigins: !!allOriginsR,
        fmp:        !!fmpR,
      })

      const data = mergeData(s, priceR, summaryR, allOriginsR, fmpR)

      if (!data) {
        throw new Error(
          `"${s}" returned no price data from any source. ` +
          'Double-check the ticker is a valid US exchange symbol. ' +
          'International stocks may need an exchange suffix (e.g. CLS for NYSE, not CLS.TO for TSX).'
        )
      }

      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const verdict     = getVerdict(result)
  const insights    = generateInsights(result)
  const upside      = result?.targetMeanPrice && result?.price
    ? (((result.targetMeanPrice - result.price) / result.price) * 100).toFixed(1)
    : null

  return (
    <div>
      {/* Search box */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 mb-5">
        <h2 className="text-base font-bold text-slate-800 mb-3">🔍 Deep Stock Analyzer</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && analyze()}
            placeholder="e.g. NVDA"
            maxLength={10}
            className="text-xl font-bold uppercase border-2 border-slate-200 rounded-lg px-3 py-2 w-36 outline-none focus:border-blue-400 tracking-widest text-slate-900"
          />
          <button onClick={() => analyze()} disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold px-6 py-2.5 rounded-lg transition-colors text-sm">
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1">
          {QUICK.map(q => (
            <button key={q} onClick={() => analyze(q)}
              className="bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-600 font-semibold px-2.5 py-1 rounded-lg text-xs transition-colors">
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200 text-center">
          <div className="text-4xl mb-3 inline-block animate-spin">⚙️</div>
          <div className="text-sm font-semibold text-slate-700">
            Fetching <strong className="text-blue-600">{ticker}</strong> from multiple sources…
          </div>
          <div className="text-xs text-slate-400 mt-1">Stooq · Yahoo Chart · Yahoo Summary · FMP · allorigins · 6 parallel sources</div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="font-bold text-red-700 text-sm mb-1">⚠️ Could not load data</div>
          <div className="text-red-600 text-sm mb-2">{error}</div>
          {sources && (
            <div className="flex gap-3 text-xs">
              {Object.entries(sources).map(([k, v]) => (
                <span key={k} className={v ? 'text-green-600' : 'text-red-400'}>
                  {v ? '✅' : '❌'} {k}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div>
          {/* Header */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 mb-4">
            <div className="flex justify-between items-start flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-3xl font-extrabold text-slate-900">{result.symbol}</span>
                  {result.exchange && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-medium">{result.exchange}</span>}
                </div>
                <div className="text-base text-slate-600 font-medium mt-0.5">{result.name}</div>
                {result.sector !== '—' && (
                  <div className="text-xs text-slate-400 mt-0.5">{result.sector}{result.industry !== '—' ? ` · ${result.industry}` : ''}</div>
                )}
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-slate-900 tabular-nums">${fmt(result.price)}</div>
                <div className={`text-base font-semibold mt-0.5 ${(result.changePct ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {(result.changePct ?? 0) >= 0 ? '▲' : '▼'} {Math.abs(result.changePct ?? 0).toFixed(2)}% today
                </div>
                {result.dayHigh && (
                  <div className="text-xs text-slate-400 mt-0.5 tabular-nums">
                    H: ${fmt(result.dayHigh)} · L: ${fmt(result.dayLow)}
                  </div>
                )}
                <span className={`inline-block mt-2 px-4 py-1 rounded-full text-sm font-bold ${verdict.cls}`}>
                  {verdict.label}
                </span>
              </div>
            </div>

            {/* 52-week range bar */}
            {result.week52High && result.week52Low && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>52-wk Low: ${fmt(result.week52Low)}</span>
                  <span>52-wk High: ${fmt(result.week52High)}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${Math.min(100, ((result.price - result.week52Low) / (result.week52High - result.week52Low)) * 100)}%` }} />
                </div>
                <div className="text-xs text-slate-400 mt-1 text-center">
                  Current price is {(((result.price - result.week52Low) / (result.week52High - result.week52Low)) * 100).toFixed(0)}% of 52-week range
                </div>
              </div>
            )}
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 pb-2 border-b border-slate-100">💰 Valuation</div>
              <MetricRow label="Market Cap"       val={fmtLarge(result.marketCap)} />
              <MetricRow label="Trailing P/E"     val={result.pe        ? fmt(result.pe, 1) + '×'       : '—'} />
              <MetricRow label="Forward P/E"      val={result.forwardPE ? fmt(result.forwardPE, 1) + '×' : '—'} />
              <MetricRow label="EPS (TTM)"        val={result.eps       ? `$${fmt(result.eps)}`          : '—'} />
              <MetricRow label="Dividend Yield"   val={result.dividendYield ? `${(result.dividendYield * 100).toFixed(2)}%` : 'None'} />
              <MetricRow label="PEG Ratio"        val={fmt(result.pegRatio, 2)} />
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 pb-2 border-b border-slate-100">📊 Financials</div>
              <MetricRow label="Revenue (TTM)"    val={fmtLarge(result.totalRevenue)} />
              <MetricRow label="Revenue Growth"   val={result.revenueGrowth   ? pct(result.revenueGrowth)   : '—'} />
              <MetricRow label="Gross Margin"     val={result.grossMargin     ? pct(result.grossMargin)     : '—'} />
              <MetricRow label="Operating Margin" val={result.operatingMargin ? pct(result.operatingMargin) : '—'} />
              <MetricRow label="ROE"              val={result.roe             ? pct(result.roe)             : '—'} />
              <MetricRow label="Free Cash Flow"   val={fmtLarge(result.freeCashFlow)} />
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 pb-2 border-b border-slate-100">📈 Catalysts & Risk</div>
              <MetricRow label="Next Earning"     val={result.nextEarningsDate} />
              <MetricRow label="Expected EPS"     val={result.expectedEPS ? `$${fmt(result.expectedEPS)}` : '—'} />
              <MetricRow label="Analyst Target"   val={result.targetMeanPrice ? `$${fmt(result.targetMeanPrice)}` : '—'} />
              <MetricRow label="Upside"           val={upside ? `${Number(upside) > 0 ? '+' : ''}${upside}%` : '—'} />
              <MetricRow label="Beta (Risk)"      val={result.beta ? fmt(result.beta) : '—'} />
              <MetricRow label="Debt / Equity"    val={result.debtToEquity ? fmt(result.debtToEquity, 2) : '—'} />
            </div>
          </div>

          {/* Earnings Highlights */}
          <EarningsHighlights data={result} />

          {/* Analyst verdict */}
          {(result.recommendationKey || result.targetMeanPrice) && (
            <div className={`rounded-xl p-4 border mb-4 ${
              verdict.label === 'BUY'  ? 'bg-green-50 border-green-200' :
              verdict.label === 'SELL' ? 'bg-red-50 border-red-200' :
                                         'bg-yellow-50 border-yellow-200'}`}>
              <div className="font-bold text-sm mb-1">🔍 Analyst Consensus · {result.numberOfAnalysts ?? '?'} analysts</div>
              {result.recommendationKey && (
                <span className={`inline-block px-3 py-0.5 rounded-full text-sm font-bold capitalize ${verdict.cls}`}>
                  {result.recommendationKey.replace(/_/g, ' ')}
                </span>
              )}
              {upside && (
                <div className="text-xs text-slate-600 mt-2">
                  Mean price target <strong>${fmt(result.targetMeanPrice)}</strong> — {Number(upside) >= 0 ? '📈' : '📉'} {Number(upside) > 0 ? '+' : ''}{upside}% from current price
                </div>
              )}
            </div>
          )}

          {/* ── VALUATION ENGINE ── */}
          <ValuationEngine data={result} />

          {/* ── INSIGHT PANELS ── */}
          {insights && (
            <div className="space-y-4 mb-4">

              {/* 1. Safe Options Play */}
              {insights.optionsPlay && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">🎯</span>
                    <div>
                      <div className="font-bold text-emerald-800 text-sm">Safe Options Play — Next 2–3 Weeks</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-extrabold text-emerald-900">{insights.optionsPlay.strategy}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white/60 ${insights.optionsPlay.riskColor}`}>
                          Risk: {insights.optionsPlay.risk}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-emerald-800 leading-relaxed mb-3">{insights.optionsPlay.detail}</p>
                  <div className="bg-white/60 rounded-lg p-3">
                    <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2">Step-by-step</div>
                    <ol className="space-y-1">
                      {insights.optionsPlay.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-emerald-800">
                          <span className="font-bold text-emerald-500 flex-shrink-0">{i + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}

              {/* 2. Value Assessment */}
              {insights.valueBullets?.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">💰</span>
                    <div>
                      <div className="font-bold text-blue-800 text-sm">Value Assessment — Is It Worth Buying Now?</div>
                      <div className={`text-xs font-bold mt-0.5 ${
                        insights.valueSentiment === 'bull' ? 'text-green-700' :
                        insights.valueSentiment === 'bear' ? 'text-red-600' : 'text-slate-500'
                      }`}>
                        {insights.valueSentiment === 'bull' ? '📈 Overall: Reasonably valued / attractive'
                       : insights.valueSentiment === 'bear' ? '📉 Overall: Caution — valuation stretched'
                       : '⚖️ Overall: Mixed signals — selective entry'}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {insights.valueBullets.map((b, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="flex-shrink-0 mt-0.5">
                          {b.good === true ? '✅' : b.good === false ? '⚠️' : '➡️'}
                        </span>
                        <p className="text-sm text-blue-900 leading-relaxed">{b.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Red Risk Warnings — Mid-Range Risk Taker */}
              {insights.risks?.length > 0 && (
                <div className="bg-red-50 border-2 border-red-300 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">🚨</span>
                    <div>
                      <div className="font-bold text-red-800 text-sm">Why You Should Be Careful — Mid-Range Risk Taker</div>
                      <div className="text-xs text-red-500 mt-0.5">Read these before putting money in</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {insights.risks.map((r, i) => {
                      const styles = {
                        critical: 'bg-red-100 border-red-400 text-red-900',
                        high:     'bg-red-50  border-red-300 text-red-800',
                        medium:   'bg-orange-50 border-orange-300 text-orange-800',
                        info:     'bg-slate-50 border-slate-300 text-slate-700',
                      }
                      const icons = { critical: '🔴', high: '🟠', medium: '🟡', info: 'ℹ️' }
                      return (
                        <div key={i} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${styles[r.severity]}`}>
                          <span className="flex-shrink-0 text-base mt-0.5">{icons[r.severity]}</span>
                          <p className="text-sm leading-relaxed">{r.text}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Business description */}
          {result.description && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-4">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">About {result.symbol}</div>
              <p className="text-sm text-slate-600 leading-relaxed line-clamp-4">{result.description}</p>
            </div>
          )}

          {/* Source debug badges */}
          {sources && (
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="text-xs text-slate-400">Data sources:</span>
              {Object.entries(sources).map(([k, v]) => (
                <span key={k} className={`text-xs px-2 py-0.5 rounded-full font-medium ${v ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                  {v ? '✅' : '○'} {k}
                </span>
              ))}
            </div>
          )}

          <div className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg p-3">
            ⚠️ Data from Yahoo Finance. For informational purposes only — not financial advice.
          </div>
        </div>
      )}
    </div>
  )
}
