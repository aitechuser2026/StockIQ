import React, { useState, useEffect, useCallback, useRef } from 'react'
import { fetchPrice, invalidateCache } from '../../services/priceService'

// ─────────────────────────────────────────────────────────────────────────────
// FETCH HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function _fetch(url, ms = 8000, opts = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try { const r = await fetch(url, { signal: ctrl.signal, ...opts }); clearTimeout(t); return r }
  catch (e) { clearTimeout(t); throw e }
}

async function _getFundamentals(sym) {
  const modules = 'summaryDetail,financialData,defaultKeyStatistics,summaryProfile,price,calendarEvents,earningsTrend'
  const enc = encodeURIComponent(sym)
  const parse = (res) => {
    if (!res) return null
    const ks = res.defaultKeyStatistics || {}, fd = res.financialData || {}
    const sd = res.summaryDetail || {},       sp = res.summaryProfile || {}
    const ce = res.calendarEvents  || {}
    const et = res.earningsTrend?.trend?.[0] || {}
    const earningsTs = ce.earnings?.earningsDate?.[0]?.raw
    const nextEarningsDate = earningsTs
      ? new Date(earningsTs * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : null
    return {
      name: res.price?.longName || res.price?.shortName,
      sector: sp.sector, industry: sp.industry,
      pe: sd.trailingPE?.raw,          forwardPE: sd.forwardPE?.raw,
      eps: ks.trailingEps?.raw,        beta: sd.beta?.raw,
      dividendYield: sd.dividendYield?.raw,
      revenueGrowth: fd.revenueGrowth?.raw,  grossMargin: fd.grossMargins?.raw,
      operatingMargin: fd.operatingMargins?.raw, roe: fd.returnOnEquity?.raw,
      totalRevenue: fd.totalRevenue?.raw,    debtToEquity: fd.debtToEquity?.raw,
      currentRatio: fd.currentRatio?.raw,    freeCashFlow: fd.freeCashflow?.raw,
      targetMeanPrice: fd.targetMeanPrice?.raw, recommendationKey: fd.recommendationKey,
      numberOfAnalysts: fd.numberOfAnalystOpinions?.raw,
      priceToBook: ks.priceToBook?.raw,
      pegRatio: ks.pegRatio?.raw,
      bookValuePerShare: ks.bookValue?.raw,
      nextEarningsDate,
      fwdEpsEst: et.earningsEstimate?.avg?.raw,
    }
  }
  const results = await Promise.allSettled([
    (async () => { const r = await _fetch(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${enc}?modules=${modules}&corsDomain=finance.yahoo.com`, 8000, { headers: { Accept: 'application/json' } }); return r.ok ? parse((await r.json())?.quoteSummary?.result?.[0]) : null })(),
    (async () => { const r = await _fetch(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${enc}?modules=${modules}&corsDomain=finance.yahoo.com`, 8000, { headers: { Accept: 'application/json' } }); return r.ok ? parse((await r.json())?.quoteSummary?.result?.[0]) : null })(),
    (async () => { const r = await _fetch(`/api/quote?symbols=${enc}&modules=${modules}`, 9000); return r.ok ? parse((await r.json())?.quoteSummary?.result?.[0]) : null })(),
  ])
  for (const r of results) { if (r.status === 'fulfilled' && r.value) return r.value }
  return null
}

async function _getOptionsChain(sym) {
  const enc = encodeURIComponent(sym), jH = { Accept: 'application/json' }
  const parse = (json) => {
    const chain = json?.optionChain?.result?.[0]; if (!chain) return null
    const opts = chain.options?.[0] || {}, calls = opts.calls || [], puts = opts.puts || []
    if (!calls.length && !puts.length) return null
    const callVol = calls.reduce((s,c)=>s+(c.volume||0),0), putVol = puts.reduce((s,p)=>s+(p.volume||0),0)
    const callOI  = calls.reduce((s,c)=>s+(c.openInterest||0),0), putOI = puts.reduce((s,p)=>s+(p.openInterest||0),0)
    const totalVol = callVol+putVol, totalOI = callOI+putOI
    const callPutRatio = totalVol>0 ? Math.round((callVol/totalVol)*100) : 50
    const topCall = [...calls].sort((a,b)=>(b.volume||0)-(a.volume||0))[0]
    const mid = calls.slice(Math.max(0,Math.floor(calls.length/2)-3), Math.floor(calls.length/2)+4)
    const avgIV = mid.length > 0 ? mid.reduce((s,c)=>s+(c.impliedVolatility||0),0)/mid.length : null
    const exps = chain.expirationDates || []
    const fmtExp = ts => ts ? new Date(ts*1000).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : null
    return { callVol, putVol, totalVol, callPutRatio, callOI, putOI, totalOI, topCall, avgIV,
             nextExpiryDate: fmtExp(exps[0]), twoWkExpiryDate: fmtExp(exps[1]??exps[0]), hasData: true }
  }
  const results = await Promise.allSettled([
    (async()=>{ const r=await _fetch(`https://query1.finance.yahoo.com/v7/finance/options/${enc}`,8000,{headers:jH}); return r.ok?parse(await r.json()):null })(),
    (async()=>{ const r=await _fetch(`https://query2.finance.yahoo.com/v7/finance/options/${enc}`,8000,{headers:jH}); return r.ok?parse(await r.json()):null })(),
    (async()=>{ const t=`https://query1.finance.yahoo.com/v7/finance/options/${enc}`; const r=await _fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(t)}`,10000); return r.ok?parse(await r.json()):null })(),
  ])
  for (const r of results) { if (r.status==='fulfilled'&&r.value?.hasData) return r.value }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// DYNAMIC TICKER FEED
// ─────────────────────────────────────────────────────────────────────────────
const FALLBACK_TICKERS = ['NVDA','META','GOOGL','AMZN','MSFT','AAPL','TSM','AMD','AMAT','INTU','CLS','SFM','TSLA','BABA','COIN','VMC','INTC']

const FEED_CONFIG = {
  actives:  { label: '⚡ Most Active',  desc: 'Highest volume stocks — most options liquidity', color: 'violet' },
  gainers:  { label: '📈 Day Gainers',  desc: 'Top % gainers — momentum plays', color: 'emerald' },
  trending: { label: '🔥 Trending',     desc: 'Most searched on Yahoo Finance right now', color: 'orange' },
  losers:   { label: '📉 Day Losers',   desc: 'Biggest decliners — put plays or bounces', color: 'red' },
}

async function fetchTrendingTickers(feedType = 'actives') {
  const proxy = url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
  const t = { signal: AbortSignal.timeout(12000) }
  const clean = syms => syms.filter(s => s && /^[A-Z]{1,5}$/.test(s)).slice(0, 20)
  for (const host of ['query1', 'query2']) {
    try {
      const url = feedType === 'trending'
        ? `https://${host}.finance.yahoo.com/v1/finance/trending/US?count=25&useQuotes=true`
        : `https://${host}.finance.yahoo.com/v2/finance/screener/predefined/saved?scrIds=${
            {gainers:'day_gainers',actives:'most_actives',losers:'day_losers'}[feedType]
          }&start=0&count=25`
      const r = await fetch(proxy(url), t)
      if (r.ok) {
        const data = await r.json()
        const quotes = feedType === 'trending'
          ? data?.finance?.result?.[0]?.quotes
          : data?.finance?.result?.[0]?.quotes
        const syms = (quotes || []).map(q => q.symbol)
        const cleaned = clean(syms)
        if (cleaned.length >= 5) return cleaned
      }
    } catch { /* try next */ }
  }
  return FALLBACK_TICKERS
}

// ─────────────────────────────────────────────────────────────────────────────
// STATIC FALLBACK FUNDAMENTALS
// ─────────────────────────────────────────────────────────────────────────────
const OPT_DB = {
  NVDA:  { sector:'Technology',    pe:50.2, forwardPE:28.4, beta:1.66, revenueGrowth:0.781, grossMargin:0.745, operatingMargin:0.572, targetMeanPrice:144.50, recommendationKey:'strong_buy', numberOfAnalysts:41, pegRatio:0.38 },
  AAPL:  { sector:'Technology',    pe:30.2, forwardPE:27.4, beta:1.19, revenueGrowth:0.051, grossMargin:0.462, operatingMargin:0.311, targetMeanPrice:215.00, recommendationKey:'buy',        numberOfAnalysts:38, pegRatio:2.82 },
  MSFT:  { sector:'Technology',    pe:33.1, forwardPE:28.4, beta:0.90, revenueGrowth:0.131, grossMargin:0.697, operatingMargin:0.451, targetMeanPrice:511.00, recommendationKey:'buy',        numberOfAnalysts:36, pegRatio:2.14 },
  GOOGL: { sector:'Technology',    pe:19.8, forwardPE:17.2, beta:1.04, revenueGrowth:0.154, grossMargin:0.568, operatingMargin:0.321, targetMeanPrice:201.00, recommendationKey:'strong_buy', numberOfAnalysts:44, pegRatio:1.12 },
  META:  { sector:'Technology',    pe:24.1, forwardPE:20.3, beta:1.22, revenueGrowth:0.274, grossMargin:0.813, operatingMargin:0.421, targetMeanPrice:706.00, recommendationKey:'strong_buy', numberOfAnalysts:48, pegRatio:0.74 },
  AMZN:  { sector:'Technology',    pe:38.4, forwardPE:29.1, beta:1.24, revenueGrowth:0.109, grossMargin:0.488, operatingMargin:0.108, targetMeanPrice:234.00, recommendationKey:'strong_buy', numberOfAnalysts:46, pegRatio:1.21 },
  TSLA:  { sector:'Consumer Cyclical', pe:142.3, forwardPE:89.4, beta:2.31, revenueGrowth:-0.009, grossMargin:0.171, operatingMargin:0.062, targetMeanPrice:280.00, recommendationKey:'hold', numberOfAnalysts:42 },
  TSM:   { sector:'Technology',    pe:26.4, forwardPE:21.8, beta:0.81, revenueGrowth:0.348, grossMargin:0.582, operatingMargin:0.448, targetMeanPrice:198.00, recommendationKey:'buy',        numberOfAnalysts:18, pegRatio:0.64 },
  AMD:   { sector:'Technology',    pe:88.4, forwardPE:22.1, beta:1.54, revenueGrowth:0.082, grossMargin:0.531, operatingMargin:0.048, targetMeanPrice:122.00, recommendationKey:'buy',        numberOfAnalysts:38, pegRatio:4.12 },
  AMAT:  { sector:'Technology',    pe:21.4, forwardPE:18.2, beta:1.41, revenueGrowth:0.071, grossMargin:0.492, operatingMargin:0.292, targetMeanPrice:193.00, recommendationKey:'buy',        numberOfAnalysts:30, pegRatio:2.08 },
  INTU:  { sector:'Technology',    pe:55.2, forwardPE:30.4, beta:1.21, revenueGrowth:0.128, grossMargin:0.812, operatingMargin:0.198, targetMeanPrice:715.00, recommendationKey:'buy',        numberOfAnalysts:29, pegRatio:2.08 },
  SFM:   { sector:'Consumer Defensive', pe:29.3, forwardPE:24.1, beta:0.72, revenueGrowth:0.138, grossMargin:0.372, operatingMargin:0.091, targetMeanPrice:111.00, recommendationKey:'buy',  numberOfAnalysts:14, pegRatio:1.81 },
  VMC:   { sector:'Basic Materials', pe:38.2, forwardPE:29.4, beta:0.98, revenueGrowth:0.062, grossMargin:0.281, operatingMargin:0.188, targetMeanPrice:285.00, recommendationKey:'buy',     numberOfAnalysts:20, pegRatio:2.81 },
  INTC:  { sector:'Technology',    forwardPE:31.2, beta:1.07, revenueGrowth:-0.083, grossMargin:0.324, operatingMargin:-0.048, targetMeanPrice:21.00,  recommendationKey:'hold',       numberOfAnalysts:33 },
  SNAP:  { sector:'Technology',    beta:1.38, revenueGrowth:0.141, grossMargin:0.521, operatingMargin:-0.182, targetMeanPrice:8.66,  recommendationKey:'hold', numberOfAnalysts:28 },
  BABA:  { sector:'Technology',    pe:16.2, forwardPE:11.4, beta:0.29, revenueGrowth:0.072, grossMargin:0.388, operatingMargin:0.141, targetMeanPrice:134.00, recommendationKey:'buy',  numberOfAnalysts:26, pegRatio:1.81 },
  COIN:  { sector:'Financial Services', pe:28.4, forwardPE:22.1, beta:3.61, revenueGrowth:0.284, grossMargin:0.882, operatingMargin:0.241, targetMeanPrice:284.00, recommendationKey:'hold', numberOfAnalysts:24, pegRatio:0.72 },
  CLS:   { sector:'Technology',    pe:20.1, forwardPE:16.4, beta:1.24, revenueGrowth:0.224, grossMargin:0.088, operatingMargin:0.062, targetMeanPrice:109.00, recommendationKey:'buy',  numberOfAnalysts:9,  pegRatio:0.72 },
  RIVN:  { sector:'Consumer Cyclical', beta:1.72, revenueGrowth:0.092, grossMargin:-0.441, operatingMargin:-0.782, targetMeanPrice:10.33, recommendationKey:'hold', numberOfAnalysts:22 },
}

// ─────────────────────────────────────────────────────────────────────────────
// NEWS HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const _HI = [
  'earnings','beat','miss','guidance','revenue','profit','loss','quarterly','forecast','outlook',
  'fda','approval','merger','acquisition','buyout','takeover','lawsuit','sec','investigation',
  'fraud','bankruptcy','default','layoff','ceo','cfo','resign','fired','dividend','buyback',
  'split','recall','warning','downgrade','upgrade','target price','rate','fed','inflation',
  'interest rate','tariff','sanction','results','report','crash','surge','jump','plunge',
  'rally','selloff','halt','suspension','restructuring','restatement','whistleblower','subpoena'
]
const _POS = [
  'beat','surpass','record','growth','raised','upgrade','bullish','strong','exceeds','above',
  'gain','rise','rally','soars','jumps','best','wins','approved','expands','acquires',
  'partnership','profit','outperform','better than expected','topped','record high','boosts',
  'surge','spike','breakthrough','launch','deal','contract','revenue growth','raises guidance',
  'positive','raises','buyback','dividend increase','strong demand'
]
const _NEG = [
  'miss','below','cut','downgrade','bearish','weak','disappoints','loses','falls','drops',
  'crashes','sinks','warning','concern','risk','recall','investigation','lawsuit','bankruptcy',
  'default','layoff','resign','fired','fraud','decline','lower','guidance cut','loss','reduces',
  'worse than expected','selloff','plunges','tumbles','slumps','halted','suspension','charges',
  'fine','penalty','downgrade','reduces guidance','disappointing','profit warning','writedown'
]

function _classify(title) {
  const t = title.toLowerCase()
  const isHighImpact = _HI.some(k => t.includes(k))
  const pos = _POS.filter(k => t.includes(k)).length
  const neg = _NEG.filter(k => t.includes(k)).length
  const sentiment = pos > neg ? 'positive' : neg > pos ? 'negative' : 'neutral'
  return { isHighImpact, sentiment }
}

function _ago(ms) {
  if (!ms) return ''
  const d = Date.now() - ms, h = Math.floor(d/3600000), dy = Math.floor(d/86400000)
  if (d < 120000) return 'just now'
  if (h < 1) return `${Math.floor(d/60000)}m ago`
  if (h < 24) return `${h}h ago`
  if (dy < 7) return `${dy}d ago`
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

async function _fetchNews(ticker) {
  // Multiple CORS proxies — tried in order until one works
  const PROXIES = [
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  ]

  // Two Yahoo Finance hosts × multiple proxies
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
          title: n.title,
          publisher: n.publisher || 'Yahoo Finance',
          link: n.link || '#',
          time: (n.providerPublishTime || 0) * 1000,
          ..._classify(n.title)
        }))
        .sort((a, b) => {
          if (a.isHighImpact !== b.isHighImpact) return a.isHighImpact ? -1 : 1
          return b.time - a.time
        })
    } catch { return null }
  }

  for (const baseUrl of BASE_URLS) {
    for (const makeProxy of PROXIES) {
      // Fresh AbortController per attempt — avoids sharing a timed-out signal
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 9000)
      try {
        const r = await fetch(makeProxy(baseUrl), { signal: ctrl.signal })
        clearTimeout(timer)
        if (!r.ok) continue
        const text = await r.text()
        let data
        try { data = JSON.parse(text) } catch { continue } // proxy returned HTML error page
        const result = parseNews(data)
        if (result?.length) return result
      } catch {
        clearTimeout(timer)
        /* try next proxy/host */
      }
    }
  }
  return []
}

// ─────────────────────────────────────────────────────────────────────────────
// RATING ENGINE
// ─────────────────────────────────────────────────────────────────────────────
function deriveRating(data) {
  let score = 50
  const rec = (data.recommendationKey || '').toLowerCase()
  if (rec.includes('strong_buy')) score += 25; else if (rec === 'buy') score += 14; else if (rec.includes('sell')) score -= 22
  const g = data.revenueGrowth ?? 0
  if (g > 0.20) score += 14; else if (g > 0.08) score += 6; else if (g < -0.02) score -= 14
  const fpe = data.forwardPE
  if (fpe && fpe < 18) score += 8; else if (fpe && fpe > 60) score -= 14
  const om = data.operatingMargin ?? 0
  if (om < 0) score -= 14; else if (om > 0.20) score += 6
  if (data.targetMeanPrice && data.price) {
    const up = (data.targetMeanPrice - data.price) / data.price * 100
    if (up > 20) score += 12; else if (up > 8) score += 5; else if (up < -5) score -= 18
  }
  if (score >= 75) return 'STRONG_BUY'
  if (score >= 58) return 'BUY'
  if (score >= 40) return 'NEUTRAL'
  if (score >= 26) return 'CAUTION'
  return 'AVOID'
}

const RATINGS = {
  STRONG_BUY: { label:'STRONG BUY', short:'STRONG BUY', badge:'bg-emerald-600 text-white', icon:'🟢', bar:'bg-emerald-500', ring:'ring-emerald-300' },
  BUY:        { label:'BUY',        short:'BUY',         badge:'bg-green-500 text-white',   icon:'🟩', bar:'bg-green-400',   ring:'ring-green-200'   },
  NEUTRAL:    { label:'NEUTRAL',    short:'NEUTRAL',     badge:'bg-amber-400 text-white',   icon:'🟡', bar:'bg-amber-400',   ring:'ring-amber-200'   },
  CAUTION:    { label:'CAUTION',    short:'CAUTION',     badge:'bg-orange-500 text-white',  icon:'🟠', bar:'bg-orange-400',  ring:'ring-orange-200'  },
  AVOID:      { label:'AVOID',      short:'AVOID',       badge:'bg-red-600 text-white',     icon:'🔴', bar:'bg-red-500',     ring:'ring-red-200'     },
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTIONS SCORING MODEL (0–100)
// ─────────────────────────────────────────────────────────────────────────────
function optionsScore(rating, upside, revenueGrowth, callPut, changePct, beta, avgIV, hasEarnings) {
  let s = 35
  s += { STRONG_BUY:25, BUY:15, NEUTRAL:3, CAUTION:-5, AVOID:-15 }[rating] ?? 0
  if (upside != null) { if(upside>25)s+=20; else if(upside>15)s+=12; else if(upside>5)s+=6; else if(upside>0)s+=2; else if(upside<-10)s-=12; else if(upside<0)s-=4 }
  const g = (revenueGrowth||0)*100
  if(g>25)s+=15; else if(g>10)s+=8; else if(g>0)s+=3; else if(g<-5)s-=10; else if(g<0)s-=3
  if(callPut>=70)s+=15; else if(callPut>=60)s+=8; else if(callPut<=30)s-=10; else if(callPut<=40)s-=4
  const chg = Math.abs(changePct||0)
  if(chg>4)s+=10; else if(chg>2)s+=5; else if(chg>1)s+=2
  if(beta>2||avgIV>0.60)s+=10; else if(beta>1.3||avgIV>0.35)s+=6; else if(beta<0.7)s+=3
  if(hasEarnings)s+=5
  return Math.max(0, Math.min(100, Math.round(s)))
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAY GENERATOR — specific strategy for each timeframe
// ─────────────────────────────────────────────────────────────────────────────
function getPlay(rating, safeToOwn, price, beta, avgIV, nextEarningsDate, score, changePct, weeks) {
  if (!price || price <= 0) return null
  const highIV   = (avgIV || 0) > 0.45
  const isBull   = rating === 'STRONG_BUY' || rating === 'BUY'
  const isBear   = rating === 'AVOID'
  const isNeut   = rating === 'NEUTRAL' || rating === 'CAUTION'
  const hasEarn  = !!nextEarningsDate

  const step = price > 500 ? 10 : price > 100 ? 5 : price > 20 ? 2.5 : 1
  const rnd  = p => Math.round(p / step) * step
  const atm  = rnd(price)
  const c5   = rnd(price * 1.05)
  const c8   = rnd(price * 1.08)
  const c10  = rnd(price * 1.10)
  const p5   = rnd(price * 0.95)
  const p8   = rnd(price * 0.92)
  const p3   = rnd(price * 0.97)
  const f    = n => `$${n % 1 === 0 ? n : n.toFixed(1)}`

  const expDate = d => { const dt = new Date(); dt.setDate(dt.getDate() + d); return dt.toLocaleDateString('en-US', { month:'short', day:'numeric' }) }
  const exp = expDate(weeks * 7)

  if (weeks === 1) {
    if (score < 58) return null
    if (isBull) return highIV
      ? { strategy:'Bull Call Spread', strikes:`Buy ${f(atm)} / Sell ${f(c5)} Call`, exp, risk:'Limited (net debit)', target:`Max above ${f(c5)}`, note:'High IV — spread cuts premium ~45%', dir:'bullish' }
      : { strategy:'Long Call',        strikes:`Buy ${f(atm)} Call`,                  exp, risk:'Premium paid',        target:`${f(c8)}+ by expiry`,          note:'Exit by Thu — theta spikes end of week', dir:'bullish' }
    if (isBear) return { strategy:'Long Put', strikes:`Buy ${f(atm)} Put`, exp, risk:'Premium paid', target:`Below ${f(p5)}`, note:'Fast decay — size small', dir:'bearish' }
    return null
  }

  if (weeks === 2) {
    if (score < 42) return null
    if (isBull && hasEarn) return { strategy:'Long Straddle', strikes:`Buy ${f(atm)} Call + ${f(atm)} Put`, exp, risk:'Both premiums', target:'Big move either direction', note:`Earnings catalyst: ${nextEarningsDate}`, dir:'catalyst' }
    if (isBull) return highIV
      ? { strategy:'Bull Call Spread', strikes:`Buy ${f(atm)} / Sell ${f(c5)} Call`, exp, risk:'Net debit', target:`Max at ${f(c5)}+`, note:'High IV — spread is efficient here', dir:'bullish' }
      : { strategy:'Long Call',        strikes:`Buy ${f(c5)} Call`,                   exp, risk:'Premium paid', target:`${f(c8)}+`, note:'Slightly OTM for better risk/reward', dir:'bullish' }
    if (isNeut) return { strategy:'Bull Call Spread', strikes:`Buy ${f(atm)} / Sell ${f(c5)} Call`, exp, risk:'Net debit', target:`Max at ${f(c5)}`, note:'Defined risk on mixed signal', dir:'neutral' }
    if (isBear) return { strategy:'Bear Put Spread',  strikes:`Buy ${f(atm)} / Sell ${f(p5)} Put`,  exp, risk:'Net debit', target:`Max at ${f(p5)}`, note:'Defined downside play',            dir:'bearish' }
    return null
  }

  if (weeks === 3) {
    if (score < 32) return null
    if (isBull && highIV) return { strategy:'Cash-Secured Put', strikes:`Sell ${f(p5)} Put`,                               exp, risk:'Assignment if below strike',  target:'Keep full premium if above', note:`High IV = rich premium — collect it`, dir:'bullish' }
    if (isBull)            return { strategy:'Bull Call Spread', strikes:`Buy ${f(atm)} / Sell ${f(c8)} Call`,              exp, risk:'Net debit',                    target:`Max profit at ${f(c8)}`,     note:'3W gives more room to be right',     dir:'bullish' }
    if (isNeut)            return { strategy:'Iron Condor',      strikes:`Sell ${f(p5)}P/${f(atm)}P · ${f(atm)}C/${f(c5)}C`, exp, risk:'Defined — wing spread',       target:`Stock stays ${f(p5)}–${f(c5)}`,note:'Profit from both premiums + time decay', dir:'neutral' }
    if (isBear)            return { strategy:'Bear Put Spread',  strikes:`Buy ${f(atm)} / Sell ${f(p8)} Put`,               exp, risk:'Net debit',                    target:`Max at ${f(p8)}`,             note:'3W lets thesis develop',             dir:'bearish' }
    return null
  }

  // 1 month
  if (safeToOwn) return highIV
    ? { strategy:'Cash-Secured Put', strikes:`Sell ${f(p5)} Put`,                  exp, risk:'Assignment @ strike',  target:'Premium + own at discount', note:'Get paid to buy quality stock cheaper', dir:'bullish' }
    : { strategy:'Bull Call Spread', strikes:`Buy ${f(atm)} / Sell ${f(c10)} Call`, exp, risk:'Net debit',            target:`Max at ${f(c10)}`,          note:'Monthly spread on quality name',        dir:'bullish' }
  if (isBull) return { strategy:'Bull Call Spread', strikes:`Buy ${f(atm)} / Sell ${f(c8)} Call`, exp, risk:'Net debit', target:`Max at ${f(c8)}`, note:'Monthly timeframe — less theta pressure', dir:'bullish' }
  if (isNeut) return { strategy:'Iron Condor', strikes:`${f(p5)}P/${f(p3)}P · ${f(c5)}C/${f(c8)}C`, exp, risk:'Defined (wing width)', target:`Stay inside ${f(p3)}–${f(c5)}`, note:'Collect decay from both sides', dir:'neutral' }
  return { strategy:'Protective Put', strikes:`Buy ${f(atm)} Put`, exp, risk:'Premium only', target:`Hedge below ${f(p5)}`, note:'Downside protection — avoid long exposure', dir:'bearish' }
}

// ─────────────────────────────────────────────────────────────────────────────
// COLUMN CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const COLUMNS = [
  { key:'w1', weeks:1, label:'1 WEEK',   hdr:'text-violet-700', bg:'bg-violet-50',  badge:'bg-violet-100 text-violet-800', min:58 },
  { key:'w2', weeks:2, label:'2 WEEKS',  hdr:'text-blue-700',   bg:'bg-blue-50',    badge:'bg-blue-100 text-blue-800',     min:42 },
  { key:'w3', weeks:3, label:'3 WEEKS',  hdr:'text-teal-700',   bg:'bg-teal-50',    badge:'bg-teal-100 text-teal-800',     min:32 },
  { key:'m1', weeks:4, label:'1 MONTH',  hdr:'text-slate-700',  bg:'bg-slate-50',   badge:'bg-slate-100 text-slate-700',   min:0  },
]

const DIR_STYLE = {
  bullish:  { bg:'bg-emerald-50', border:'border-emerald-200', badge:'bg-emerald-100 text-emerald-800', text:'text-emerald-700', dot:'🟢' },
  bearish:  { bg:'bg-red-50',     border:'border-red-200',     badge:'bg-red-100 text-red-800',         text:'text-red-700',     dot:'🔴' },
  neutral:  { bg:'bg-amber-50',   border:'border-amber-200',   badge:'bg-amber-100 text-amber-800',     text:'text-amber-700',   dot:'🟡' },
  catalyst: { bg:'bg-purple-50',  border:'border-purple-200',  badge:'bg-purple-100 text-purple-800',   text:'text-purple-700',  dot:'⚡' },
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function fmt2(n, d = 2) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

// ─────────────────────────────────────────────────────────────────────────────
// NEWS ARTICLE ROW
// ─────────────────────────────────────────────────────────────────────────────
function NewsRow({ n }) {
  const neg = n.isHighImpact && n.sentiment === 'negative'
  const pos = n.isHighImpact && n.sentiment === 'positive'
  const neu = n.isHighImpact && n.sentiment === 'neutral'
  const icon = neg ? '🔴' : pos ? '🟢' : neu ? '🟡' : '📄'
  const rowCls = neg
    ? 'bg-red-50 border-red-200 hover:bg-red-100'
    : pos
    ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
    : neu
    ? 'bg-amber-50 border-amber-200 hover:bg-amber-100'
    : 'bg-white border-slate-100 hover:bg-slate-50'

  return (
    <a href={n.link} target="_blank" rel="noopener noreferrer"
      className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition-colors ${rowCls}`}>
      <span className="text-base flex-shrink-0 mt-0.5 leading-none">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold text-slate-800 leading-snug flex-1"
            style={{ display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
            {n.title}
          </p>
          {n.isHighImpact && (
            <span className={`flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded-full ${
              neg ? 'bg-red-200 text-red-800' : pos ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'
            }`}>
              {neg ? '⚠ BEARISH' : pos ? '▲ BULLISH' : '⚡ KEY'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[10px] text-slate-400 font-medium">{n.publisher}</span>
          {n.time > 0 && <>
            <span className="text-slate-200">·</span>
            <span className="text-[10px] text-slate-400">{_ago(n.time)}</span>
          </>}
        </div>
      </div>
    </a>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STOCK CARD — main card with news-forward layout
// ─────────────────────────────────────────────────────────────────────────────
function StockCard({ stock }) {
  const [playsOpen, setPlaysOpen] = useState(true)
  const R   = RATINGS[stock.rating]
  const up  = (stock.changePct || 0) >= 0
  const critCount = stock.news?.filter(n => n.isHighImpact).length || 0
  const hasBreaking = stock.news?.some(n => n.isHighImpact && n.sentiment === 'negative')

  return (
    <div className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden flex flex-col ${
      hasBreaking ? 'border-red-300 shadow-red-100' : 'border-slate-200'
    }`}>

      {/* ── CARD HEADER ── */}
      <div className="px-4 pt-4 pb-3 bg-slate-50 border-b border-slate-100">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl font-black text-slate-900 tracking-tight">{stock.ticker}</span>
              <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${R.badge}`}>{R.icon} {R.short}</span>
              {stock.safeToOwn && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">⭐ QUALITY</span>
              )}
              {stock.nextEarningsDate && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                  ⚡ Earnings {stock.nextEarningsDate}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 truncate">{stock.name} · {stock.sector}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-lg font-black text-slate-900">${fmt2(stock.price)}</div>
            <div className={`text-xs font-bold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
              {up ? '+' : ''}{fmt2(stock.changePct)}%
            </div>
          </div>
        </div>

        {/* Score bar */}
        <div className="flex items-center gap-2 mt-3">
          <div className="text-[10px] font-black text-slate-400 uppercase w-20 flex-shrink-0">Options Score</div>
          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                stock.score >= 65 ? 'bg-emerald-500' : stock.score >= 45 ? 'bg-amber-400' : 'bg-orange-400'
              }`}
              style={{ width: `${stock.score}%` }}
            />
          </div>
          <div className={`text-xs font-black flex-shrink-0 ${
            stock.score >= 65 ? 'text-emerald-600' : stock.score >= 45 ? 'text-amber-500' : 'text-orange-500'
          }`}>{stock.score}/100</div>
        </div>

        {/* Quick metrics strip */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          {[
            ['Fwd P/E',   stock.forwardPE > 0 ? `${fmt2(stock.forwardPE, 1)}×` : '—'],
            ['Beta',      stock.beta != null ? fmt2(stock.beta, 2) : '—'],
            ['IV Est',    stock.avgIV != null ? `${Math.round(stock.avgIV * 100)}%` : '—'],
            ['Upside',    stock.upsidePct != null ? `${stock.upsidePct > 0 ? '+' : ''}${Math.round(stock.upsidePct)}%` : '—'],
          ].map(([k, v]) => (
            <div key={k} className="bg-white rounded-lg px-2 py-1.5 text-center border border-slate-100">
              <div className="text-[9px] font-black text-slate-400 uppercase">{k}</div>
              <div className="text-xs font-black text-slate-700 mt-0.5">{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── OPTION PLAYS STRIP ── */}
      <div className="border-b border-slate-100">
        <button
          onClick={() => setPlaysOpen(o => !o)}
          className="w-full px-4 py-2 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">📊 Option Strategies</span>
          <span className="text-[10px] text-slate-400">{playsOpen ? '▲ hide' : '▼ show'}</span>
        </button>
        {playsOpen && (
          <div className="grid grid-cols-4 divide-x divide-slate-100">
            {COLUMNS.map(col => {
              const play = stock.plays[col.key]
              const D = play ? (DIR_STYLE[play.dir] || DIR_STYLE.neutral) : null
              return (
                <div key={col.key} className={`px-2 py-2.5 ${play ? D.bg : 'bg-slate-50'}`}>
                  <div className={`text-[9px] font-black mb-1.5 ${col.hdr}`}>{col.label}</div>
                  {play ? (
                    <>
                      <div className={`text-[9px] font-black px-1.5 py-0.5 rounded-full inline-block mb-1 ${D.badge}`}>
                        {D.dot} {play.strategy.split(' ').slice(0, 2).join(' ')}
                      </div>
                      <div className="text-[9px] font-bold text-slate-700 leading-snug">{play.strikes}</div>
                      <div className="text-[9px] text-slate-400 mt-1">Exp: {play.exp}</div>
                      <div className={`text-[9px] font-bold mt-0.5 ${D.text}`}>{play.target}</div>
                      {play.note && <div className="text-[8px] text-slate-400 mt-1 italic leading-snug">{play.note}</div>}
                    </>
                  ) : (
                    <div className="text-[9px] text-slate-300 italic mt-1">Below threshold</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── NEWS SECTION — always expanded ── */}
      <div className="flex-1 px-4 py-3">
        {/* News header */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">📰 Market News</span>
            {critCount > 0 && (
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                hasBreaking ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {critCount} {hasBreaking ? '🔴 CRITICAL' : '⚡ KEY'}
              </span>
            )}
          </div>
          <div className="flex gap-1.5">
            {[
              ['Y!', `https://finance.yahoo.com/quote/${stock.ticker}`],
              ['FV', `https://finviz.com/quote.ashx?t=${stock.ticker}`],
            ].map(([l, u]) => (
              <a key={l} href={u} target="_blank" rel="noopener noreferrer"
                className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-500 rounded transition-colors">
                {l} ↗
              </a>
            ))}
          </div>
        </div>

        {/* Breaking news banner */}
        {hasBreaking && (
          <div className="bg-red-600 text-white rounded-xl px-3 py-2 mb-2.5 flex items-center gap-2">
            <span className="text-sm animate-pulse">🚨</span>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wide">Breaking / High-Impact Alert</div>
              <div className="text-[10px] opacity-80 mt-0.5">
                {stock.news.find(n => n.isHighImpact && n.sentiment === 'negative')?.title}
              </div>
            </div>
          </div>
        )}

        {/* All news articles */}
        {stock.news?.length > 0 ? (
          <div className="space-y-1.5">
            {stock.news.map((n, i) => <NewsRow key={i} n={n} />)}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="text-2xl mb-1">📭</div>
            <div className="text-xs text-slate-400">No news available</div>
          </div>
        )}
      </div>

      {/* External links footer */}
      <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50 flex items-center gap-2 flex-wrap">
        {[
          ['Yahoo Finance', `https://finance.yahoo.com/quote/${stock.ticker}`],
          ['Finviz',        `https://finviz.com/quote.ashx?t=${stock.ticker}`],
          ['MarketWatch',   `https://www.marketwatch.com/investing/stock/${stock.ticker}`],
          ['Options Chain', `https://finance.yahoo.com/quote/${stock.ticker}/options`],
        ].map(([l, u]) => (
          <a key={l} href={u} target="_blank" rel="noopener noreferrer"
            className="text-[10px] font-bold px-2 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 text-slate-500 rounded-lg border border-slate-100 transition-colors">
            {l} ↗
          </a>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH RESULT CARD
// ─────────────────────────────────────────────────────────────────────────────
function SearchResultCard({ stock }) {
  const R  = RATINGS[stock.rating]
  const up = (stock.changePct || 0) >= 0
  const hasBreaking = stock.news?.some(n => n.isHighImpact && n.sentiment === 'negative')

  return (
    <div className={`bg-white rounded-2xl border-2 shadow-md overflow-hidden mb-5 ${hasBreaking ? 'border-red-300' : 'border-blue-300'}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-2xl font-black">{stock.ticker}</span>
              <span className="text-sm font-black px-2 py-0.5 rounded-full bg-white/20">{R.icon} {R.label}</span>
              {stock.safeToOwn && <span className="text-xs font-black px-2 py-0.5 rounded-full bg-blue-300/30">⭐ QUALITY</span>}
            </div>
            <div className="text-blue-200 text-sm mt-0.5">{stock.name}</div>
            <div className="text-blue-300 text-xs mt-1">Options Score: <strong className="text-white">{stock.score}/100</strong> · {stock.sector}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black">${fmt2(stock.price)}</div>
            <div className={`text-sm font-bold ${up ? 'text-emerald-300' : 'text-red-300'}`}>{up ? '+' : ''}{fmt2(stock.changePct)}%</div>
          </div>
        </div>

        {/* Score bar */}
        <div className="flex items-center gap-2 mt-3">
          <div className="flex-1 h-2 bg-blue-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${stock.score >= 65 ? 'bg-emerald-400' : stock.score >= 45 ? 'bg-amber-400' : 'bg-orange-400'}`}
              style={{ width: `${stock.score}%` }} />
          </div>
          <span className="text-xs font-black text-white">{stock.score}/100</span>
        </div>
      </div>

      {/* 4 plays grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-100 border-b border-slate-100">
        {COLUMNS.map(col => {
          const play = stock.plays[col.key]
          const D = play ? (DIR_STYLE[play.dir] || DIR_STYLE.neutral) : null
          return (
            <div key={col.key} className={`px-3 py-3 ${play ? D.bg : 'bg-white'}`}>
              <div className={`text-[10px] font-black mb-2 ${col.hdr}`}>{col.label}</div>
              {play ? (
                <>
                  <div className={`text-[10px] font-black px-2 py-0.5 rounded-full inline-block mb-1.5 ${D.badge}`}>
                    {D.dot} {play.strategy}
                  </div>
                  <div className="text-xs font-bold text-slate-800 leading-snug">{play.strikes}</div>
                  <div className="text-[10px] text-slate-500 mt-1">Exp: {play.exp}</div>
                  <div className={`text-[10px] font-bold mt-1 ${D.text}`}>{play.target}</div>
                  {play.note && <div className="text-[9px] text-slate-400 mt-1 italic">{play.note}</div>}
                </>
              ) : (
                <div className="text-xs text-slate-400 italic">No play — score too low</div>
              )}
            </div>
          )
        })}
      </div>

      {/* News section */}
      {stock.news?.length > 0 && (
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">📰 Market News for {stock.ticker}</span>
            {stock.news.filter(n => n.isHighImpact).length > 0 && (
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${hasBreaking ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                {stock.news.filter(n => n.isHighImpact).length} KEY
              </span>
            )}
          </div>
          {hasBreaking && (
            <div className="bg-red-600 text-white rounded-xl px-3 py-2 mb-3 flex items-center gap-2">
              <span className="text-sm animate-pulse">🚨</span>
              <div className="text-[10px] font-black">
                {stock.news.find(n => n.isHighImpact && n.sentiment === 'negative')?.title}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            {stock.news.map((n, i) => <NewsRow key={i} n={n} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function OptionsFlow() {
  const [feedType,    setFeedType]    = useState('actives')
  const [feedLoading, setFeedLoading] = useState(false)
  const [running,     setRunning]     = useState(false)
  const [progress,    setProgress]    = useState({ done: 0, total: 0, current: '' })
  const [results,     setResults]     = useState([])
  const [lastRun,     setLastRun]     = useState(null)
  const [tickerList,  setTickerList]  = useState([])
  const [sortBy,      setSortBy]      = useState('score')   // 'score' | 'change' | 'news'
  const [filterRating, setFilterRating] = useState('ALL')
  const abortRef = useRef(false)

  // Search
  const [searchTicker, setSearchTicker] = useState('')
  const [searching,    setSearching]    = useState(false)
  const [searchResult, setSearchResult] = useState(null)
  const [searchError,  setSearchError]  = useState(null)

  // Build a scored stock object from raw data
  const buildScoredStock = useCallback((sym, priceData, fund, opts, news) => {
    const px = priceData?.price
    if (!px) return null
    const merged = {
      pe: priceData.pe, forwardPE: priceData.forwardPE, eps: priceData.eps,
      beta: priceData.beta, name: priceData.name, price: px,
      changePct: priceData.changePct ?? 0,
      ...( OPT_DB[sym] || {} ),
      ...( fund || {} ),
    }
    const rating    = deriveRating(merged)
    const upPct     = merged.targetMeanPrice && px ? (merged.targetMeanPrice - px) / px * 100 : null
    const callPut   = opts?.callPutRatio ?? 50
    const beta      = merged.beta ?? 1
    const avgIV     = opts?.avgIV ?? 0
    const safeToOwn = rating === 'STRONG_BUY' && (merged.operatingMargin ?? 0) > 0.08 && (upPct ?? 0) > 8
    const score     = optionsScore(rating, upPct, merged.revenueGrowth, callPut, merged.changePct ?? 0, beta, avgIV, !!merged.nextEarningsDate)
    const mkPlay    = weeks => getPlay(rating, safeToOwn, px, beta, avgIV, merged.nextEarningsDate, score, merged.changePct ?? 0, weeks)

    return {
      ticker: sym,
      name: merged.name || sym,
      sector: merged.sector || merged.industry || '—',
      price: px,
      changePct: merged.changePct ?? 0,
      rating,
      score,
      plays: { w1: mkPlay(1), w2: mkPlay(2), w3: mkPlay(3), m1: mkPlay(4) },
      news: news || [],
      safeToOwn,
      upsidePct: upPct,
      forwardPE: merged.forwardPE,
      beta,
      avgIV,
      nextEarningsDate: merged.nextEarningsDate,
      numberOfAnalysts: merged.numberOfAnalysts,
    }
  }, [])

  // Run model
  const runModel = useCallback(async (tickers) => {
    if (!tickers?.length) return
    abortRef.current = false
    setRunning(true)
    setResults([])
    setProgress({ done: 0, total: tickers.length, current: '' })

    const batch = 4
    const scored = []
    for (let i = 0; i < tickers.length; i += batch) {
      if (abortRef.current) break
      const slice = tickers.slice(i, i + batch)
      const batchRes = await Promise.allSettled(
        slice.map(async sym => {
          setProgress(p => ({ ...p, current: sym }))
          const [priceData, opts, fund, news] = await Promise.all([
            fetchPrice(sym),
            _getOptionsChain(sym),
            _getFundamentals(sym),
            _fetchNews(sym),
          ])
          return buildScoredStock(sym, priceData, fund, opts, news)
        })
      )
      for (const r of batchRes) {
        if (r.status === 'fulfilled' && r.value) {
          scored.push(r.value)
          setResults([...scored].sort((a, b) => b.score - a.score))
        }
      }
      setProgress(p => ({ ...p, done: Math.min(p.done + slice.length, tickers.length) }))
      if (i + batch < tickers.length) await new Promise(r => setTimeout(r, 250))
    }
    setProgress(p => ({ ...p, current: '' }))
    setLastRun(new Date())
    setRunning(false)
  }, [buildScoredStock])

  // Load feed
  const loadFeed = useCallback(async (feed) => {
    abortRef.current = true
    setFeedLoading(true)
    setResults([])
    setSearchResult(null)
    try {
      const tickers = await fetchTrendingTickers(feed)
      setTickerList(tickers)
      setFeedLoading(false)
      abortRef.current = false
      await runModel(tickers)
    } catch {
      setFeedLoading(false)
      abortRef.current = false
      await runModel(FALLBACK_TICKERS)
    }
  }, [runModel])

  useEffect(() => { loadFeed('actives') }, []) // eslint-disable-line

  const handleFeedChange = useCallback((feed) => {
    setFeedType(feed)
    loadFeed(feed)
  }, [loadFeed])

  // Search
  const handleSearch = async (sym) => {
    const s = (sym || searchTicker).toUpperCase().trim()
    if (!s) return
    setSearchTicker(s)
    setSearching(true)
    setSearchError(null)
    setSearchResult(null)
    try {
      const [priceData, opts, fund, news] = await Promise.all([
        fetchPrice(s), _getOptionsChain(s), _getFundamentals(s), _fetchNews(s),
      ])
      const r = buildScoredStock(s, priceData, fund, opts, news)
      if (!r) throw new Error(`No price data for "${s}". Check the symbol is a valid US ticker.`)
      setSearchResult(r)
    } catch (e) { setSearchError(e.message) }
    finally { setSearching(false) }
  }

  // Sort + filter
  const displayed = results
    .filter(s => filterRating === 'ALL' || s.rating === filterRating)
    .sort((a, b) => {
      if (sortBy === 'score')  return b.score - a.score
      if (sortBy === 'change') return Math.abs(b.changePct) - Math.abs(a.changePct)
      if (sortBy === 'news')   return (b.news?.filter(n => n.isHighImpact).length || 0) - (a.news?.filter(n => n.isHighImpact).length || 0)
      return 0
    })

  // Stats
  const totalScored = results.length
  const avgScore    = totalScored ? Math.round(results.reduce((a, s) => a + s.score, 0) / totalScored) : 0
  const bullCount   = results.filter(s => ['STRONG_BUY','BUY'].includes(s.rating)).length
  const highConv    = results.filter(s => s.score >= 65).length
  const critNewsCount = results.reduce((a, s) => a + (s.news?.filter(n => n.isHighImpact).length || 0), 0)

  return (
    <div className="space-y-4">

      {/* ── HEADER ── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl px-5 py-5 text-white shadow-xl">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
              🎯 Options Picks
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Live scoring model · Real options flow · Full news coverage per stock
            </p>
            {lastRun && !running && (
              <div className="flex flex-wrap gap-3 mt-2">
                {[
                  [`${totalScored} stocks`, 'text-white'],
                  [`Avg ${avgScore}/100`, 'text-blue-300'],
                  [`${bullCount} bullish`, 'text-emerald-400'],
                  [`${highConv} high-conviction`, 'text-violet-300'],
                  [`${critNewsCount} key news items`, 'text-amber-300'],
                ].map(([t, c]) => (
                  <span key={t} className={`text-xs font-black ${c}`}>✓ {t}</span>
                ))}
              </div>
            )}
            {running && (
              <p className="text-blue-400 text-sm font-semibold mt-2 animate-pulse">
                ⏳ Analyzing {progress.current}… {progress.done}/{progress.total}
              </p>
            )}
          </div>
          <button
            onClick={() => loadFeed(feedType)}
            disabled={running || feedLoading}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-600 text-white font-black px-5 py-2.5 rounded-xl text-sm transition-colors shadow-lg">
            <span className={(running || feedLoading) ? 'animate-spin inline-block' : ''}>⟳</span>
            {feedLoading ? 'Fetching…' : running ? `Scoring…` : 'Re-Run'}
          </button>
        </div>

        {/* Feed selector */}
        <div className="flex flex-wrap gap-2 mt-4">
          {Object.entries(FEED_CONFIG).map(([key, cfg]) => (
            <button key={key} onClick={() => handleFeedChange(key)} disabled={running || feedLoading}
              className={`px-4 py-1.5 rounded-xl text-sm font-bold border-2 transition-all ${
                feedType === key
                  ? 'bg-white border-white text-slate-900'
                  : 'bg-transparent border-slate-600 text-slate-300 hover:border-slate-400'
              }`}>
              {cfg.label}
            </button>
          ))}
        </div>

        {/* Progress bar */}
        {(running || feedLoading) && (
          <div className="mt-4">
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full transition-all duration-300"
                style={{ width: feedLoading ? '8%' : `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} />
            </div>
            {tickerList.length > 0 && (
              <div className="text-[10px] text-slate-500 mt-1.5 truncate">
                Scanning: {tickerList.join(' · ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SEARCH ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-black text-slate-700">🔍 Analyze any ticker:</span>
          <input
            value={searchTicker}
            onChange={e => setSearchTicker(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="e.g. NVDA" maxLength={8}
            className="uppercase border-2 border-slate-200 rounded-xl px-3 py-1.5 w-28 text-sm font-bold outline-none focus:border-blue-400 tracking-widest text-slate-900" />
          <button
            onClick={() => handleSearch()}
            disabled={searching || !searchTicker.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold px-5 py-1.5 rounded-xl text-sm transition-colors">
            {searching ? '⏳ Analyzing…' : 'Analyze'}
          </button>
          {['NVDA','AAPL','TSLA','META','AMD','GOOGL'].map(q => (
            <button key={q} onClick={() => handleSearch(q)}
              className="bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 font-semibold px-2.5 py-1.5 rounded-lg text-xs transition-colors">
              {q}
            </button>
          ))}
          {searchResult && (
            <button onClick={() => { setSearchResult(null); setSearchError(null); setSearchTicker('') }}
              className="text-xs text-slate-400 hover:text-slate-600 ml-auto px-2 py-1.5 rounded">✕ Clear</button>
          )}
        </div>
        {searchError && (
          <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mt-2">⚠️ {searchError}</div>
        )}
      </div>

      {/* ── SEARCH RESULT ── */}
      {searchResult && !searching && <SearchResultCard stock={searchResult} />}

      {/* ── FEED LOADING ── */}
      {feedLoading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="text-5xl animate-bounce">📡</div>
          <div className="text-slate-800 font-black text-xl">Scanning {FEED_CONFIG[feedType]?.label}…</div>
          <div className="text-slate-500 text-sm">{FEED_CONFIG[feedType]?.desc}</div>
        </div>
      )}

      {/* ── SORT & FILTER BAR ── */}
      {!feedLoading && results.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl border border-slate-200 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-slate-500 uppercase">Sort:</span>
            {[['score','⭐ Score'],['change','📊 Move'],['news','📰 News']].map(([v, l]) => (
              <button key={v} onClick={() => setSortBy(v)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  sortBy === v ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>{l}</button>
            ))}
          </div>
          <div className="w-px h-5 bg-slate-200" />
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-black text-slate-500 uppercase">Filter:</span>
            {['ALL', 'STRONG_BUY', 'BUY', 'NEUTRAL', 'CAUTION', 'AVOID'].map(r => {
              const R = r !== 'ALL' ? RATINGS[r] : null
              return (
                <button key={r} onClick={() => setFilterRating(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    filterRating === r
                      ? (R ? R.badge : 'bg-slate-900 text-white')
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {R ? `${R.icon} ${R.short}` : `All (${results.length})`}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── STOCK CARDS GRID ── */}
      {!feedLoading && (
        <>
          {/* Skeleton loading */}
          {running && results.length === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border-2 border-slate-100 overflow-hidden animate-pulse">
                  <div className="bg-slate-100 h-40" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 bg-slate-100 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                    <div className="h-3 bg-slate-100 rounded w-5/6" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Cards */}
          {displayed.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {displayed.map(stock => (
                <StockCard key={stock.ticker} stock={stock} />
              ))}
            </div>
          )}

          {/* Empty filter state */}
          {!running && results.length > 0 && displayed.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="text-4xl">🔍</div>
              <div className="text-slate-600 font-bold">No stocks match this filter</div>
              <button onClick={() => setFilterRating('ALL')} className="text-sm text-blue-600 hover:text-blue-700 font-bold">
                Clear filter
              </button>
            </div>
          )}

          {/* Summary table */}
          {results.length > 0 && !running && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between">
                <span className="text-sm font-black">⚡ Quick Reference — All Scored Stocks</span>
                <span className="text-xs text-slate-400">{results.length} stocks · sorted by score</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr className="text-[10px] text-slate-400 uppercase tracking-wide">
                      <th className="px-4 py-2.5 text-left">Ticker</th>
                      <th className="px-3 py-2.5 text-left">Rating</th>
                      <th className="px-3 py-2.5 text-center">Score</th>
                      <th className="px-3 py-2.5 text-center">1W</th>
                      <th className="px-3 py-2.5 text-center">2W</th>
                      <th className="px-3 py-2.5 text-center">3W</th>
                      <th className="px-3 py-2.5 text-center">1M</th>
                      <th className="px-3 py-2.5 text-center">Key News</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(s => {
                      const R  = RATINGS[s.rating]
                      const up = (s.changePct || 0) >= 0
                      const critN = s.news?.filter(n => n.isHighImpact).length || 0
                      return (
                        <tr key={s.ticker} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="font-black text-slate-900">{s.ticker}</div>
                            <div className={`text-[10px] font-bold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
                              {up ? '+' : ''}{fmt2(s.changePct)}%
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${R.badge}`}>{R.icon} {R.short}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className={`font-black ${s.score >= 65 ? 'text-emerald-600' : s.score >= 45 ? 'text-amber-500' : 'text-red-500'}`}>{s.score}</div>
                          </td>
                          {COLUMNS.map(col => {
                            const play = s.plays[col.key]
                            const D = play ? (DIR_STYLE[play.dir] || DIR_STYLE.neutral) : null
                            return (
                              <td key={col.key} className="px-3 py-2.5 text-center">
                                {play ? (
                                  <span className={`text-[9px] font-black px-1 py-0.5 rounded-full ${D.badge}`}>
                                    {D.dot} {play.strategy.split(' ')[0]}
                                  </span>
                                ) : <span className="text-slate-200">—</span>}
                              </td>
                            )
                          })}
                          <td className="px-3 py-2.5 text-center">
                            {critN > 0
                              ? <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${s.news?.some(n=>n.isHighImpact&&n.sentiment==='negative') ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {critN} key
                                </span>
                              : <span className="text-slate-300 text-[10px]">—</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Disclaimer */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500 leading-relaxed">
        ⚠️ <strong className="text-slate-600">Not financial advice.</strong> Options scoring uses live price, fundamentals, and options flow data from Yahoo Finance.
        Score ≥65 = high conviction · 45–64 = moderate · &lt;45 = low. Strikes are approximate — always verify with your broker.
        News impact classification is automated. Options involve significant risk and are not suitable for all investors.
      </div>
    </div>
  )
}
