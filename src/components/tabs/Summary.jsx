import React, { useState, useEffect, useCallback, useRef } from 'react'
import { fetchPrice } from '../../services/priceService'

// ─────────────────────────────────────────────────────────────────────────────
// FETCH HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function _getFundamentals(sym) {
  const enc = encodeURIComponent(sym)
  const modules = 'summaryDetail,financialData,defaultKeyStatistics,summaryProfile,price,calendarEvents'
  const parse = (res) => {
    if (!res) return null
    const fd = res.financialData || {}, sd = res.summaryDetail || {}
    const ks = res.defaultKeyStatistics || {}, sp = res.summaryProfile || {}
    const ce = res.calendarEvents || {}
    const earningsTs = ce.earnings?.earningsDate?.[0]?.raw
    return {
      name:             res.price?.longName || res.price?.shortName || sym,
      sector:           sp.sector || sp.industry || '—',
      targetMeanPrice:  fd.targetMeanPrice?.raw,
      recommendationKey:fd.recommendationKey,
      numberOfAnalysts: fd.numberOfAnalystOpinions?.raw,
      revenueGrowth:    fd.revenueGrowth?.raw,
      grossMargin:      fd.grossMargins?.raw,
      operatingMargin:  fd.operatingMargins?.raw,
      forwardPE:        sd.forwardPE?.raw,
      beta:             sd.beta?.raw,
      dividendYield:    sd.dividendYield?.raw,
      freeCashFlow:     fd.freeCashflow?.raw,
      debtToEquity:     fd.debtToEquity?.raw,
      currentRatio:     fd.currentRatio?.raw,
      pegRatio:         ks.pegRatio?.raw,
      nextEarningsDate: earningsTs
        ? new Date(earningsTs * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : null,
    }
  }
  const results = await Promise.allSettled([
    (async () => { const r = await fetch(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${enc}?modules=${modules}&corsDomain=finance.yahoo.com`, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } }); return r.ok ? parse((await r.json())?.quoteSummary?.result?.[0]) : null })(),
    (async () => { const r = await fetch(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${enc}?modules=${modules}&corsDomain=finance.yahoo.com`, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } }); return r.ok ? parse((await r.json())?.quoteSummary?.result?.[0]) : null })(),
    (async () => { const r = await fetch(`/api/quote?symbols=${enc}&modules=${modules}`, { signal: AbortSignal.timeout(9000) }); return r.ok ? parse((await r.json())?.quoteSummary?.result?.[0]) : null })(),
  ])
  for (const r of results) { if (r.status === 'fulfilled' && r.value) return r.value }
  return null
}

async function _getIV(sym) {
  const enc = encodeURIComponent(sym)
  const parse = (json) => {
    const chain = json?.optionChain?.result?.[0]; if (!chain) return null
    const opts = chain.options?.[0] || {}, calls = opts.calls || [], puts = opts.puts || []
    const mid = calls.slice(Math.max(0, Math.floor(calls.length / 2) - 3), Math.floor(calls.length / 2) + 4)
    const avgIV = mid.length > 0 ? mid.reduce((s, c) => s + (c.impliedVolatility || 0), 0) / mid.length : null
    const callVol = calls.reduce((s, c) => s + (c.volume || 0), 0)
    const putVol  = puts.reduce((s, p) => s + (p.volume || 0), 0)
    const totalVol = callVol + putVol
    return { avgIV, callPutRatio: totalVol > 0 ? Math.round((callVol / totalVol) * 100) : 50, hasData: true }
  }
  const results = await Promise.allSettled([
    (async () => { const r = await fetch(`https://query1.finance.yahoo.com/v7/finance/options/${enc}`, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } }); return r.ok ? parse(await r.json()) : null })(),
    (async () => { const url = `https://query1.finance.yahoo.com/v7/finance/options/${enc}`; const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(10000) }); return r.ok ? parse(await r.json()) : null })(),
  ])
  for (const r of results) { if (r.status === 'fulfilled' && r.value?.hasData) return r.value }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// NEWS
// ─────────────────────────────────────────────────────────────────────────────
const _HI = [
  'earnings','beat','miss','guidance','revenue','profit','loss','quarterly','forecast','outlook',
  'fda','approval','merger','acquisition','buyout','lawsuit','sec','investigation','fraud',
  'bankruptcy','default','layoff','ceo','cfo','resign','fired','dividend','buyback','split',
  'recall','warning','downgrade','upgrade','rate','fed','inflation','tariff','results','report',
  'crash','surge','jump','plunge','rally','selloff','halt','restructuring','restatement'
]
const _POS = ['beat','surpass','record','growth','raised','upgrade','bullish','strong','exceeds','above','gain','rise','rally','soars','jumps','best','wins','approved','expands','acquires','partnership','profit','outperform','better than expected','topped','record high','boosts','surge','breakthrough','launch','deal','contract','raises guidance','dividend increase']
const _NEG = ['miss','below','cut','downgrade','bearish','weak','disappoints','loses','falls','drops','crashes','sinks','warning','concern','risk','recall','investigation','lawsuit','bankruptcy','default','layoff','resign','fired','fraud','decline','lower','guidance cut','loss','reduces','worse than expected','selloff','plunges','tumbles','slumps','halted','charges','fine','penalty','reduces guidance','profit warning','writedown']

function _classify(title) {
  const t = title.toLowerCase()
  const isHighImpact = _HI.some(k => t.includes(k))
  const pos = _POS.filter(k => t.includes(k)).length
  const neg = _NEG.filter(k => t.includes(k)).length
  return { isHighImpact, sentiment: pos > neg ? 'positive' : neg > pos ? 'negative' : 'neutral' }
}

function _ago(ms) {
  if (!ms) return ''
  const d = Date.now() - ms, h = Math.floor(d / 3600000), dy = Math.floor(d / 86400000)
  if (d < 120000) return 'just now'
  if (h < 1) return `${Math.floor(d / 60000)}m ago`
  if (h < 24) return `${h}h ago`
  if (dy < 7) return `${dy}d ago`
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

async function _fetchNews(ticker) {
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
      const items = data?.news || []; if (!items.length) return null
      return items.filter(n => n.title).slice(0, 8).map(n => ({
        title: n.title, publisher: n.publisher || 'Yahoo Finance',
        link: n.link || '#', time: (n.providerPublishTime || 0) * 1000,
        ..._classify(n.title)
      })).sort((a, b) => { if (a.isHighImpact !== b.isHighImpact) return a.isHighImpact ? -1 : 1; return b.time - a.time })
    } catch { return null }
  }
  for (const baseUrl of BASE_URLS) {
    for (const makeProxy of PROXIES) {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 9000)
      try {
        const r = await fetch(makeProxy(baseUrl), { signal: ctrl.signal })
        clearTimeout(timer)
        if (!r.ok) continue
        const text = await r.text()
        let data; try { data = JSON.parse(text) } catch { continue }
        const result = parseNews(data)
        if (result?.length) return result
      } catch { clearTimeout(timer) }
    }
  }
  return []
}

// ─────────────────────────────────────────────────────────────────────────────
// DYNAMIC TICKER FEED
// ─────────────────────────────────────────────────────────────────────────────
const FALLBACK_TICKERS = ['AAPL','MSFT','NVDA','GOOGL','META','AMZN','JPM','V','MA','JNJ','PG','KO','ABBV','MRK','UNH','HD','WMT','CVX','XOM','TSM']

const FEED_CONFIG = {
  quality:  { label: '⭐ Quality Stocks',  desc: 'Blue-chip + dividend payers — ideal for premium selling' },
  actives:  { label: '⚡ Most Active',     desc: 'Highest volume — rich options premiums' },
  gainers:  { label: '📈 Day Gainers',     desc: 'Momentum stocks — elevated IV = higher premiums' },
  trending: { label: '🔥 Trending',        desc: 'Most searched — popular names with options activity' },
}

const QUALITY_TICKERS = ['AAPL','MSFT','GOOGL','META','AMZN','NVDA','JPM','V','MA','JNJ','PG','KO','ABBV','MRK','UNH','HD','WMT','CVX','XOM','TSM']

async function fetchFeedTickers(feedType) {
  if (feedType === 'quality') return QUALITY_TICKERS
  const proxy = url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
  const clean = syms => syms.filter(s => s && /^[A-Z]{1,5}$/.test(s)).slice(0, 18)
  for (const host of ['query1', 'query2']) {
    try {
      const url = feedType === 'trending'
        ? `https://${host}.finance.yahoo.com/v1/finance/trending/US?count=25&useQuotes=true`
        : `https://${host}.finance.yahoo.com/v2/finance/screener/predefined/saved?scrIds=${feedType === 'gainers' ? 'day_gainers' : 'most_actives'}&start=0&count=25`
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 12000)
      try {
        const r = await fetch(proxy(url), { signal: ctrl.signal })
        clearTimeout(timer)
        if (r.ok) {
          const data = await r.json()
          const quotes = data?.finance?.result?.[0]?.quotes || []
          const cleaned = clean(quotes.map(q => q.symbol))
          if (cleaned.length >= 5) return cleaned
        }
      } finally { clearTimeout(timer) }
    } catch { /* next */ }
  }
  return FALLBACK_TICKERS
}

// ─────────────────────────────────────────────────────────────────────────────
// SAFE PREMIUM STRATEGY ENGINE
// ─────────────────────────────────────────────────────────────────────────────
function premiumScore(data) {
  // Higher score = better candidate for selling premium (covered calls, cash-secured puts)
  let s = 40
  const rec = (data.recommendationKey || '').toLowerCase()
  if (rec.includes('strong_buy')) s += 20
  else if (rec === 'buy') s += 12
  else if (rec.includes('sell')) s -= 20

  // Quality fundamentals
  const om = data.operatingMargin ?? 0
  if (om > 0.25) s += 12; else if (om > 0.10) s += 6; else if (om < 0) s -= 15

  const g = data.revenueGrowth ?? 0
  if (g > 0.20) s += 10; else if (g > 0.05) s += 5; else if (g < -0.05) s -= 10

  const pe = data.forwardPE
  if (pe && pe > 0 && pe < 20) s += 8
  else if (pe && pe > 50) s -= 8

  // Upside to analyst target
  if (data.targetMeanPrice && data.price) {
    const up = (data.targetMeanPrice - data.price) / data.price * 100
    if (up > 15) s += 12; else if (up > 5) s += 6; else if (up < -5) s -= 12
  }

  // IV boosts premium income but too high = risky
  const iv = data.avgIV ?? 0
  if (iv > 0.25 && iv < 0.60) s += 10   // sweet spot
  else if (iv >= 0.60) s += 5           // high IV is good but more risk
  else if (iv < 0.15) s -= 5            // very low IV = thin premium

  // Call/put sentiment
  const cp = data.callPutRatio ?? 50
  if (cp >= 60) s += 8; else if (cp <= 35) s -= 8

  // Financial safety (D/E, current ratio)
  if (data.debtToEquity != null && data.debtToEquity < 1) s += 5
  if (data.currentRatio != null && data.currentRatio > 1.5) s += 5

  return Math.max(0, Math.min(100, Math.round(s)))
}

function buildStrategies(ticker, price, fund, opts) {
  if (!price || price <= 0) return []
  const iv      = opts?.avgIV ?? 0.30
  const highIV  = iv > 0.45
  const upPct   = fund?.targetMeanPrice ? (fund.targetMeanPrice - price) / price * 100 : null
  const rec     = (fund?.recommendationKey || '').toLowerCase()
  const isBull  = rec.includes('strong_buy') || rec === 'buy'
  const hasDivs = (fund?.dividendYield ?? 0) > 0

  // Strike rounding
  const step = price > 500 ? 10 : price > 100 ? 5 : price > 20 ? 2.5 : 1
  const rnd  = p => Math.round(p / step) * step
  const f    = n => `$${n % 1 === 0 ? n : n.toFixed(1)}`
  const atm  = rnd(price)
  const p5   = rnd(price * 0.95)
  const p8   = rnd(price * 0.92)
  const p10  = rnd(price * 0.90)
  const c5   = rnd(price * 1.05)
  const c8   = rnd(price * 1.08)

  // Estimated annual premium income
  const monthlyPct = iv * 0.4 * (1 / Math.sqrt(12))
  const monthlyEst = price * monthlyPct

  // Expiry dates
  const addDays = d => { const dt = new Date(); dt.setDate(dt.getDate() + d); return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
  const exp21 = addDays(21)
  const exp30 = addDays(30)
  const exp45 = addDays(45)

  const strategies = []

  // 1. Cash-Secured Put — best for stocks you want to own at a discount
  const cspStrike = isBull ? p5 : p8
  const cspPremium = price * iv * 0.38 * Math.sqrt(21 / 365)
  strategies.push({
    type: 'CASH-SECURED PUT',
    icon: '💰',
    color: 'emerald',
    tagline: 'Get paid to buy at a discount',
    strike: f(cspStrike),
    expiry: exp21,
    premium: `$${cspPremium.toFixed(2)}`,
    breakEven: f(rnd(cspStrike - cspPremium)),
    prob: highIV ? '72%' : '82%',
    annualized: `~${Math.round((cspPremium * 12 / price) * 100)}%`,
    maxGain: `$${cspPremium.toFixed(2)} per contract × 100`,
    risk: `Own ${ticker} at ${f(rnd(cspStrike - cspPremium))}`,
    note: `You keep premium if ${ticker} stays above ${f(cspStrike)}. Only take assignment on quality stocks.`,
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    cardBg: 'bg-emerald-50',
    cardBorder: 'border-emerald-200',
  })

  // 2. Covered Call — for stocks already held
  const ccStrike = isBull ? c8 : c5
  const ccPremium = price * iv * 0.32 * Math.sqrt(30 / 365)
  strategies.push({
    type: 'COVERED CALL',
    icon: '📞',
    color: 'blue',
    tagline: 'Collect rent on shares you own',
    strike: f(ccStrike),
    expiry: exp30,
    premium: `$${ccPremium.toFixed(2)}`,
    breakEven: f(rnd(price - ccPremium)),
    prob: '78%',
    annualized: `~${Math.round((ccPremium * 12 / price) * 100)}%`,
    maxGain: `$${(ccPremium + (ccStrike - price)).toFixed(2)} per share`,
    risk: `Capped upside above ${f(ccStrike)}`,
    note: `${hasDivs ? 'Stack with dividend income. ' : ''}Generate monthly income while holding shares.`,
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    cardBg: 'bg-blue-50',
    cardBorder: 'border-blue-200',
  })

  // 3. Iron Condor — for neutral/range-bound stocks
  strategies.push({
    type: 'IRON CONDOR',
    icon: '🦅',
    color: 'violet',
    tagline: 'Profit if stock stays in range',
    strike: `${f(p8)}P/${f(p5)}P · ${f(c5)}C/${f(c8)}C`,
    expiry: exp45,
    premium: `$${(price * iv * 0.22 * Math.sqrt(45 / 365)).toFixed(2)}`,
    breakEven: `${f(p5)} – ${f(c5)}`,
    prob: '65%',
    annualized: `~${Math.round((monthlyEst * 0.7 * 12 / price) * 100)}%`,
    maxGain: 'Full net credit received',
    risk: 'Defined — width of wings',
    note: `Profit zone: ${f(p5)} to ${f(c5)}. Max loss capped at wing width minus credit.`,
    badge: 'bg-violet-100 text-violet-800 border-violet-200',
    cardBg: 'bg-violet-50',
    cardBorder: 'border-violet-200',
  })

  return strategies
}

// ─────────────────────────────────────────────────────────────────────────────
// NEWS ROW COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function NewsRow({ n }) {
  const neg = n.isHighImpact && n.sentiment === 'negative'
  const pos = n.isHighImpact && n.sentiment === 'positive'
  const neu = n.isHighImpact && n.sentiment === 'neutral'
  const icon = neg ? '🔴' : pos ? '🟢' : neu ? '🟡' : '📄'
  const cls  = neg ? 'bg-red-50 border-red-200 hover:bg-red-100'
              : pos ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
              : neu ? 'bg-amber-50 border-amber-200 hover:bg-amber-100'
              : 'bg-white border-slate-100 hover:bg-slate-50'
  return (
    <a href={n.link} target="_blank" rel="noopener noreferrer"
      className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition-colors ${cls}`}>
      <span className="text-base flex-shrink-0 mt-0.5 leading-none">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="text-xs font-semibold text-slate-800 leading-snug flex-1"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
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
          <span className="text-[10px] text-slate-400">{n.publisher}</span>
          {n.time > 0 && <><span className="text-slate-200">·</span><span className="text-[10px] text-slate-400">{_ago(n.time)}</span></>}
        </div>
      </div>
    </a>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STRATEGY MINI CARD
// ─────────────────────────────────────────────────────────────────────────────
function StrategyCard({ s }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`rounded-2xl border-2 ${s.cardBorder} ${s.cardBg} overflow-hidden`}>
      <div className="px-3.5 py-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div>
            <div className={`text-[10px] font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1 border ${s.badge}`}>
              {s.icon} {s.type}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 italic">{s.tagline}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-base font-black text-slate-900">{s.premium}</div>
            <div className="text-[9px] text-slate-400 font-bold">/ contract</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {[
            ['Strike', s.strike],
            ['Expiry', s.expiry],
            ['Prob Win', s.prob],
            ['Ann. Yield', s.annualized],
          ].map(([k, v]) => (
            <div key={k} className="bg-white/70 rounded-xl px-2 py-1.5">
              <div className="text-[9px] font-black text-slate-400 uppercase">{k}</div>
              <div className="text-[11px] font-black text-slate-800 mt-0.5">{v}</div>
            </div>
          ))}
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          <div className="bg-white/70 rounded-xl px-2 py-1.5">
            <div className="text-[9px] font-black text-slate-400 uppercase">Max Gain</div>
            <div className="text-[10px] font-bold text-emerald-700 mt-0.5 leading-snug">{s.maxGain}</div>
          </div>
          <div className="bg-white/70 rounded-xl px-2 py-1.5">
            <div className="text-[9px] font-black text-slate-400 uppercase">Risk</div>
            <div className="text-[10px] font-bold text-slate-600 mt-0.5 leading-snug">{s.risk}</div>
          </div>
        </div>

        <button onClick={() => setOpen(o => !o)}
          className="w-full mt-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 flex items-center justify-between transition-colors">
          <span>Tactical note {open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <div className="mt-1.5 text-[10px] text-slate-600 leading-relaxed bg-white/60 rounded-xl px-2.5 py-2">
            {s.note}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STOCK PICK CARD
// ─────────────────────────────────────────────────────────────────────────────
function PickCard({ stock }) {
  const up          = (stock.changePct || 0) >= 0
  const hasBreaking = stock.news?.some(n => n.isHighImpact && n.sentiment === 'negative')
  const critCount   = stock.news?.filter(n => n.isHighImpact).length || 0
  const scoreColor  = stock.score >= 65 ? 'text-emerald-600' : stock.score >= 45 ? 'text-amber-500' : 'text-orange-500'
  const scoreBg     = stock.score >= 65 ? 'bg-emerald-500' : stock.score >= 45 ? 'bg-amber-400' : 'bg-orange-400'

  return (
    <div className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden flex flex-col ${
      hasBreaking ? 'border-red-300 shadow-red-100' : 'border-slate-200'
    }`}>

      {/* ── CARD HEADER ── */}
      <div className="px-4 pt-4 pb-3 bg-slate-50 border-b border-slate-100">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl font-black text-slate-900">{stock.ticker}</span>
              {stock.safeForPremium && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">✅ SAFE TO SELL</span>
              )}
              {stock.nextEarningsDate && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">⚡ Earnings {stock.nextEarningsDate}</span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 truncate">{stock.name} · {stock.sector}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-lg font-black text-slate-900">${Number(stock.price).toFixed(2)}</div>
            <div className={`text-xs font-bold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
              {up ? '+' : ''}{Number(stock.changePct).toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Premium Score */}
        <div className="flex items-center gap-2 mt-3">
          <div className="text-[10px] font-black text-slate-400 uppercase w-24 flex-shrink-0">Premium Score</div>
          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${scoreBg}`} style={{ width: `${stock.score}%` }} />
          </div>
          <span className={`text-xs font-black flex-shrink-0 ${scoreColor}`}>{stock.score}/100</span>
        </div>

        {/* Quick metrics */}
        <div className="grid grid-cols-4 gap-1.5 mt-3">
          {[
            ['IV Est',    stock.avgIV != null ? `${Math.round(stock.avgIV * 100)}%` : '—'],
            ['Beta',      stock.beta != null ? Number(stock.beta).toFixed(2) : '—'],
            ['Fwd P/E',   stock.forwardPE > 0 ? `${Number(stock.forwardPE).toFixed(1)}×` : '—'],
            ['Upside',    stock.upsidePct != null ? `${stock.upsidePct > 0 ? '+' : ''}${Math.round(stock.upsidePct)}%` : '—'],
          ].map(([k, v]) => (
            <div key={k} className="bg-white rounded-lg px-2 py-1.5 text-center border border-slate-100">
              <div className="text-[9px] font-black text-slate-400 uppercase">{k}</div>
              <div className="text-xs font-black text-slate-700 mt-0.5">{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── STRATEGIES ── */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2.5">💎 Safe Premium Strategies</div>
        <div className="grid grid-cols-1 gap-2.5">
          {stock.strategies.map((s, i) => <StrategyCard key={i} s={s} />)}
        </div>
      </div>

      {/* ── NEWS SECTION — always expanded ── */}
      <div className="flex-1 px-4 py-3">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">📰 Market News</span>
            {critCount > 0 && (
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                hasBreaking ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {critCount} {hasBreaking ? '🔴 CRITICAL' : '⚡ KEY'}
              </span>
            )}
          </div>
          <div className="flex gap-1.5">
            {[['Y!', `https://finance.yahoo.com/quote/${stock.ticker}`], ['Opts', `https://finance.yahoo.com/quote/${stock.ticker}/options`]].map(([l, u]) => (
              <a key={l} href={u} target="_blank" rel="noopener noreferrer"
                className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-500 rounded transition-colors">
                {l} ↗
              </a>
            ))}
          </div>
        </div>

        {/* Breaking banner */}
        {hasBreaking && (
          <div className="bg-red-600 text-white rounded-xl px-3 py-2 mb-2.5 flex items-center gap-2">
            <span className="text-sm animate-pulse">🚨</span>
            <div>
              <div className="text-[10px] font-black uppercase">Breaking Alert</div>
              <div className="text-[10px] opacity-80 leading-snug mt-0.5">
                {stock.news.find(n => n.isHighImpact && n.sentiment === 'negative')?.title}
              </div>
            </div>
          </div>
        )}

        {stock.news?.length > 0 ? (
          <div className="space-y-1.5">
            {stock.news.map((n, i) => <NewsRow key={i} n={n} />)}
          </div>
        ) : (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="text-2xl mb-1">📭</div>
            <div className="text-xs text-slate-400">No news available</div>
          </div>
        )}
      </div>

      {/* Footer links */}
      <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50 flex flex-wrap gap-2">
        {[
          ['Yahoo Finance', `https://finance.yahoo.com/quote/${stock.ticker}`],
          ['Options Chain', `https://finance.yahoo.com/quote/${stock.ticker}/options`],
          ['Finviz',        `https://finviz.com/quote.ashx?t=${stock.ticker}`],
          ['MarketWatch',   `https://www.marketwatch.com/investing/stock/${stock.ticker}`],
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
function SearchPickCard({ stock }) {
  const up = (stock.changePct || 0) >= 0
  const hasBreaking = stock.news?.some(n => n.isHighImpact && n.sentiment === 'negative')
  return (
    <div className={`bg-white rounded-2xl border-2 shadow-md overflow-hidden mb-5 ${hasBreaking ? 'border-red-300' : 'border-emerald-300'}`}>
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-700 text-white px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl font-black">{stock.ticker}</span>
              {stock.safeForPremium && <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 font-black">✅ SAFE TO SELL</span>}
            </div>
            <div className="text-emerald-200 text-sm mt-0.5">{stock.name} · {stock.sector}</div>
            <div className="text-emerald-300 text-xs mt-1">Premium Score: <strong className="text-white">{stock.score}/100</strong></div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black">${Number(stock.price).toFixed(2)}</div>
            <div className={`text-sm font-bold ${up ? 'text-emerald-300' : 'text-red-300'}`}>{up ? '+' : ''}{Number(stock.changePct).toFixed(2)}%</div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <div className="flex-1 h-2 bg-emerald-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${stock.score >= 65 ? 'bg-emerald-400' : stock.score >= 45 ? 'bg-amber-400' : 'bg-orange-400'}`} style={{ width: `${stock.score}%` }} />
          </div>
          <span className="text-xs font-black text-white">{stock.score}/100</span>
        </div>
      </div>

      <div className="p-4">
        <div className="text-xs font-black text-slate-500 uppercase mb-3">💎 Safe Premium Strategies</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {stock.strategies.map((s, i) => <StrategyCard key={i} s={s} />)}
        </div>

        {stock.news?.length > 0 && (
          <div>
            <div className="text-xs font-black text-slate-400 uppercase mb-2">📰 Latest News</div>
            {hasBreaking && (
              <div className="bg-red-600 text-white rounded-xl px-3 py-2 mb-2 flex items-center gap-2">
                <span className="animate-pulse">🚨</span>
                <div className="text-[10px] font-black">{stock.news.find(n => n.isHighImpact && n.sentiment === 'negative')?.title}</div>
              </div>
            )}
            <div className="space-y-1.5">
              {stock.news.map((n, i) => <NewsRow key={i} n={n} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function Summary() {
  const [feedType,    setFeedType]    = useState('quality')
  const [feedLoading, setFeedLoading] = useState(false)
  const [running,     setRunning]     = useState(false)
  const [progress,    setProgress]    = useState({ done: 0, total: 0, current: '' })
  const [results,     setResults]     = useState([])
  const [lastRun,     setLastRun]     = useState(null)
  const [tickerList,  setTickerList]  = useState([])
  const [sortBy,      setSortBy]      = useState('score')
  const abortRef = useRef(false)

  // Search
  const [searchTicker, setSearchTicker] = useState('')
  const [searching,    setSearching]    = useState(false)
  const [searchResult, setSearchResult] = useState(null)
  const [searchError,  setSearchError]  = useState(null)

  const buildStock = useCallback((sym, priceData, fund, opts, news) => {
    const price = priceData?.price
    if (!price) return null
    const upsidePct = fund?.targetMeanPrice ? (fund.targetMeanPrice - price) / price * 100 : null
    const avgIV     = opts?.avgIV ?? null
    const callPutRatio = opts?.callPutRatio ?? 50
    const scoreData = {
      ...fund, price, avgIV, callPutRatio,
      recommendationKey: fund?.recommendationKey,
    }
    const score        = premiumScore(scoreData)
    const safeForPremium = score >= 60 && (fund?.operatingMargin ?? 0) > 0.05
    const strategies   = buildStrategies(sym, price, { ...fund, avgIV }, opts)

    return {
      ticker: sym,
      name: fund?.name || priceData.name || sym,
      sector: fund?.sector || '—',
      price,
      changePct: priceData.changePct ?? 0,
      score,
      safeForPremium,
      strategies,
      news: news || [],
      avgIV,
      beta: fund?.beta ?? priceData.beta ?? null,
      forwardPE: fund?.forwardPE ?? priceData.forwardPE ?? null,
      upsidePct,
      nextEarningsDate: fund?.nextEarningsDate ?? null,
    }
  }, [])

  const runModel = useCallback(async (tickers) => {
    if (!tickers?.length) return
    abortRef.current = false
    setRunning(true)
    setResults([])
    setProgress({ done: 0, total: tickers.length, current: '' })

    const batch = 4, scored = []
    for (let i = 0; i < tickers.length; i += batch) {
      if (abortRef.current) break
      const slice = tickers.slice(i, i + batch)
      const batchRes = await Promise.allSettled(
        slice.map(async sym => {
          setProgress(p => ({ ...p, current: sym }))
          const [priceData, fund, opts, news] = await Promise.all([
            fetchPrice(sym), _getFundamentals(sym), _getIV(sym), _fetchNews(sym),
          ])
          return buildStock(sym, priceData, fund, opts, news)
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
  }, [buildStock])

  const loadFeed = useCallback(async (feed) => {
    abortRef.current = true
    setFeedLoading(true)
    setResults([])
    setSearchResult(null)
    try {
      const tickers = await fetchFeedTickers(feed)
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

  useEffect(() => { loadFeed('quality') }, []) // eslint-disable-line

  const handleFeedChange = useCallback((feed) => {
    setFeedType(feed)
    loadFeed(feed)
  }, [loadFeed])

  const handleSearch = async (sym) => {
    const s = (sym || searchTicker).toUpperCase().trim()
    if (!s) return
    setSearchTicker(s)
    setSearching(true)
    setSearchError(null)
    setSearchResult(null)
    try {
      const [priceData, fund, opts, news] = await Promise.all([fetchPrice(s), _getFundamentals(s), _getIV(s), _fetchNews(s)])
      const r = buildStock(s, priceData, fund, opts, news)
      if (!r) throw new Error(`No price data for "${s}". Check the symbol is a valid US ticker.`)
      setSearchResult(r)
    } catch (e) { setSearchError(e.message) }
    finally { setSearching(false) }
  }

  const displayed = [...results].sort((a, b) => {
    if (sortBy === 'score')  return b.score - a.score
    if (sortBy === 'safe')   return (b.safeForPremium ? 1 : 0) - (a.safeForPremium ? 1 : 0)
    if (sortBy === 'news')   return (b.news?.filter(n => n.isHighImpact).length || 0) - (a.news?.filter(n => n.isHighImpact).length || 0)
    return 0
  })

  const safeCount  = results.filter(s => s.safeForPremium).length
  const avgScore   = results.length ? Math.round(results.reduce((a, s) => a + s.score, 0) / results.length) : 0
  const critNews   = results.reduce((a, s) => a + (s.news?.filter(n => n.isHighImpact).length || 0), 0)

  return (
    <div className="space-y-4">

      {/* ── HEADER ── */}
      <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 rounded-2xl px-5 py-5 text-white shadow-xl">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
              🎯 Options Picks
              <span className="text-sm font-bold px-2.5 py-1 rounded-xl bg-emerald-600/40 text-emerald-300">Safe Premium Selling</span>
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Cash-Secured Puts · Covered Calls · Iron Condors · Live news per stock
            </p>
            {lastRun && !running && (
              <div className="flex flex-wrap gap-3 mt-2">
                {[
                  [`${results.length} stocks`, 'text-white'],
                  [`${safeCount} safe to sell`, 'text-emerald-400'],
                  [`Avg score ${avgScore}/100`, 'text-blue-300'],
                  [`${critNews} key news items`, 'text-amber-300'],
                ].map(([t, c]) => (
                  <span key={t} className={`text-xs font-black ${c}`}>✓ {t}</span>
                ))}
              </div>
            )}
            {running && (
              <p className="text-emerald-400 text-sm font-semibold mt-2 animate-pulse">
                ⏳ Analyzing {progress.current}… {progress.done}/{progress.total}
              </p>
            )}
          </div>
          <button onClick={() => loadFeed(feedType)} disabled={running || feedLoading}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-600 text-white font-black px-5 py-2.5 rounded-xl text-sm transition-colors shadow-lg">
            <span className={(running || feedLoading) ? 'animate-spin inline-block' : ''}>⟳</span>
            {feedLoading ? 'Fetching…' : running ? 'Scoring…' : 'Re-Run'}
          </button>
        </div>

        {/* Feed selector */}
        <div className="flex flex-wrap gap-2 mt-4">
          {Object.entries(FEED_CONFIG).map(([key, cfg]) => (
            <button key={key} onClick={() => handleFeedChange(key)} disabled={running || feedLoading}
              className={`px-4 py-1.5 rounded-xl text-sm font-bold border-2 transition-all ${
                feedType === key ? 'bg-white border-white text-slate-900' : 'bg-transparent border-slate-600 text-slate-300 hover:border-slate-400'
              }`}>
              {cfg.label}
            </button>
          ))}
        </div>

        {/* Progress */}
        {(running || feedLoading) && (
          <div className="mt-4">
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full transition-all duration-300"
                style={{ width: feedLoading ? '8%' : `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} />
            </div>
            {tickerList.length > 0 && (
              <div className="text-[10px] text-slate-500 mt-1.5 truncate">Scanning: {tickerList.join(' · ')}</div>
            )}
          </div>
        )}
      </div>

      {/* Safety info bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: '💰', title: 'Cash-Secured Put', desc: 'Sell a put below current price — get paid to potentially buy at a discount. Keep premium if stock stays flat or rises.', color: 'emerald' },
          { icon: '📞', title: 'Covered Call',     desc: 'Sell a call above current price on shares you own — collect "rent" every month while you hold.', color: 'blue' },
          { icon: '🦅', title: 'Iron Condor',      desc: 'Sell both a put spread and call spread — profit if the stock trades in a range. Fully defined risk.', color: 'violet' },
        ].map(s => (
          <div key={s.title} className={`bg-${s.color}-50 border border-${s.color}-100 rounded-xl p-3`}>
            <div className="text-lg mb-1">{s.icon}</div>
            <div className="text-xs font-black text-slate-700">{s.title}</div>
            <div className="text-[10px] text-slate-500 mt-1 leading-relaxed">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* ── SEARCH ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-black text-slate-700">🔍 Analyze any ticker:</span>
          <input value={searchTicker} onChange={e => setSearchTicker(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="e.g. AAPL" maxLength={8}
            className="uppercase border-2 border-slate-200 rounded-xl px-3 py-1.5 w-28 text-sm font-bold outline-none focus:border-emerald-400 tracking-widest text-slate-900" />
          <button onClick={() => handleSearch()} disabled={searching || !searchTicker.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold px-5 py-1.5 rounded-xl text-sm transition-colors">
            {searching ? '⏳ Analyzing…' : 'Analyze'}
          </button>
          {['AAPL','MSFT','JPM','KO','V','PG'].map(q => (
            <button key={q} onClick={() => handleSearch(q)}
              className="bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 font-semibold px-2.5 py-1.5 rounded-lg text-xs transition-colors">{q}</button>
          ))}
          {searchResult && (
            <button onClick={() => { setSearchResult(null); setSearchError(null); setSearchTicker('') }}
              className="text-xs text-slate-400 hover:text-slate-600 ml-auto">✕ Clear</button>
          )}
        </div>
        {searchError && <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mt-2">⚠️ {searchError}</div>}
      </div>

      {/* ── SEARCH RESULT ── */}
      {searchResult && !searching && <SearchPickCard stock={searchResult} />}

      {/* ── FEED LOADING ── */}
      {feedLoading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="text-5xl animate-bounce">💎</div>
          <div className="text-slate-800 font-black text-xl">Scanning {FEED_CONFIG[feedType]?.label}…</div>
          <div className="text-slate-500 text-sm">{FEED_CONFIG[feedType]?.desc}</div>
        </div>
      )}

      {/* ── SORT BAR ── */}
      {!feedLoading && results.length > 0 && (
        <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200 px-4 py-3 flex-wrap">
          <span className="text-xs font-black text-slate-500 uppercase">Sort:</span>
          {[['score','⭐ Premium Score'],['safe','✅ Safe First'],['news','📰 Key News']].map(([v, l]) => (
            <button key={v} onClick={() => setSortBy(v)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                sortBy === v ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>{l}</button>
          ))}
          <span className="text-xs text-slate-400 ml-auto">{displayed.length} stocks · {safeCount} safe to sell</span>
        </div>
      )}

      {/* ── STOCK CARDS ── */}
      {!feedLoading && (
        <>
          {running && results.length === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border-2 border-slate-100 overflow-hidden animate-pulse">
                  <div className="bg-slate-100 h-36" />
                  <div className="p-4 space-y-2">
                    {[...Array(4)].map((_, j) => <div key={j} className="h-3 bg-slate-100 rounded" />)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {displayed.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {displayed.map(stock => <PickCard key={stock.ticker} stock={stock} />)}
            </div>
          )}
        </>
      )}

      {/* ── DISCLAIMER ── */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 leading-relaxed">
        ⚠️ <strong>Not financial advice.</strong> Premium yields, strikes, and probabilities are estimates based on live IV data.
        Always verify strikes and expiries with your broker before trading. Selling options involves real risk including full assignment of cash-secured puts.
        Only sell puts on stocks you genuinely want to own at the strike price.
      </div>
    </div>
  )
}
