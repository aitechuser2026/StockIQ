import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useLivePrices } from '../../hooks/useLivePrices'

// ─────────────────────────────────────────────────────────────────────────────
// IMPACT CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const IMPACT = {
  critical: {
    label: 'CRITICAL', dot: 'bg-purple-500',
    border: 'border-l-purple-600',
    badge: 'bg-purple-600 text-white',
    pill:  'bg-purple-100 text-purple-800 border border-purple-200',
    alertBg: 'bg-purple-900', alertBorder: 'border-purple-500',
    icon:  '🚨', glow: 'shadow-purple-200/60',
    ring: 'ring-2 ring-purple-300',
  },
  high: {
    label: 'HIGH', dot: 'bg-red-500',
    border: 'border-l-red-500',
    badge: 'bg-red-500 text-white',
    pill:  'bg-red-100 text-red-800 border border-red-200',
    alertBg: 'bg-red-900', alertBorder: 'border-red-500',
    icon:  '🔴', glow: 'shadow-red-200/60',
    ring: 'ring-2 ring-red-300',
  },
  medium: {
    label: 'MEDIUM', dot: 'bg-amber-400',
    border: 'border-l-amber-400',
    badge: 'bg-amber-500 text-white',
    pill:  'bg-amber-100 text-amber-800 border border-amber-200',
    alertBg: 'bg-amber-800', alertBorder: 'border-amber-400',
    icon:  '🟡', glow: 'shadow-amber-200/60',
    ring: 'ring-2 ring-amber-300',
  },
  low: {
    label: 'LOW', dot: 'bg-emerald-400',
    border: 'border-l-emerald-400',
    badge: 'bg-emerald-600 text-white',
    pill:  'bg-emerald-100 text-emerald-800 border border-emerald-200',
    alertBg: 'bg-emerald-900', alertBorder: 'border-emerald-500',
    icon:  '🟢', glow: 'shadow-emerald-200/60',
    ring: 'ring-2 ring-emerald-300',
  },
}

const CATEGORY_META = {
  fed:         { icon: '🏛️', label: 'Fed',          color: 'bg-purple-100 text-purple-800' },
  economic:    { icon: '📈', label: 'Economic',     color: 'bg-blue-100 text-blue-800' },
  earnings:    { icon: '💰', label: 'Earnings',     color: 'bg-green-100 text-green-800' },
  ipo:         { icon: '🚀', label: 'IPO',          color: 'bg-pink-100 text-pink-800' },
  geopolitical:{ icon: '🌐', label: 'Geopolitical', color: 'bg-indigo-100 text-indigo-800' },
  holiday:     { icon: '🏖️', label: 'Holiday',      color: 'bg-slate-100 text-slate-500' },
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENTS — comprehensive calendar
// ─────────────────────────────────────────────────────────────────────────────
const EVENTS = {
  '2026-05-12': [
    { impact:'high', cat:'economic', emoji:'🔴', title:'CPI — April 2026', time:'8:30 AM ET', status:'released',
      desc:'Headline YoY +3.7% — hotter than expected. Rate cut hopes faded. Bond yields rose.',
      data:['Headline YoY: +3.7% (above 3.4% est)','Core YoY: +2.7%','MoM: +0.6%'],
      marketImpact:'📉 Hotter than expected → Rate cut hopes faded → Bond yields rose.' },
  ],
  '2026-05-13': [
    { impact:'high', cat:'economic', emoji:'🔴', title:'PPI — April 2026', time:'8:30 AM ET', status:'released',
      desc:'Wholesale inflation validates producer-level price pressures. Largest monthly jump in 4 years.',
      data:['Result: Largest monthly jump in 4 years'],
      marketImpact:'📉 Confirmed sticky inflation. Rate cut in June now very unlikely.' },
    { impact:'high', cat:'fed', emoji:'🏛️', title:'Warsh Confirmed as Fed Chair', time:'Senate Vote', status:'released',
      desc:'Kevin Warsh confirmed, replacing Powell. Watch for first public statements on rate policy.',
      data:['New Chair: Kevin Warsh','Next FOMC: June 16–17'],
      marketImpact:"⚠️ Transition uncertainty. Watch for Warsh's first public statements." },
    { impact:'medium', cat:'earnings', emoji:'💰', title:'CSCO & BABA Earnings', time:'After Close', status:'released',
      tickers:['CSCO','BABA'],
      desc:'Cisco = enterprise AI networking proxy. Alibaba = China tech bellwether.',
      data:['CSCO EPS: $0.92','BABA Options Move: ±5.9%'] },
  ],
  '2026-05-14': [
    { impact:'high', cat:'economic', emoji:'🔴', title:'Retail Sales — April 2026', time:'8:30 AM ET', status:'released',
      desc:'Direct read on US consumer spending post energy spike.',
      data:['Consensus: +0.5% MoM','Prior: +0.9% MoM'],
      marketImpact:'📊 Watch follow-through in consumer/retail stocks.' },
    { impact:'high', cat:'earnings', emoji:'💰', title:'AMAT Earnings', time:'After Close', status:'released',
      tickers:['AMAT'],
      desc:'Applied Materials — 6–12 month leading indicator for semiconductor capex.',
      data:['EPS Consensus: $2.68 (+12% YoY)','Options Move: ±8.7%'],
      marketImpact:'📊 AMAT reaction setting tone for NVDA, TSM in coming sessions.' },
    { impact:'high', cat:'geopolitical', emoji:'🌐', title:'Trump–Xi Summit Day 1', time:'Beijing', status:'released',
      desc:'Trade truce, AI guardrails, chip export bans on agenda.',
      data:['Chip export bans','AI guardrails','Trade truce'],
      marketImpact:'🌐 Positive = NVDA/TSM surge. Breakdown = Broad tech selloff.' },
  ],
  '2026-05-15': [
    { impact:'critical', cat:'geopolitical', emoji:'🌐', title:'Trump–Xi Summit — Final Day', time:'All Day', status:'released',
      desc:'Final communiqué expected. Outcome directly impacts chip export restrictions.',
      data:['Final communiqué expected','Chip export ban outcome'],
      marketImpact:'🌐 Positive outcome → NVDA, TSM surge. Breakdown → Broad tech selloff.' },
    { impact:'high', cat:'economic', emoji:'🔴', title:'UMich Consumer Sentiment', time:'10:00 AM ET', status:'released',
      desc:'Preliminary read on consumer confidence.',
      data:['Prior: 52.2','Consensus: ~54','Inflation exp >4% = hawkish'],
      marketImpact:'⚡ First major read under new Chair Warsh. High sensitivity.' },
  ],
  '2026-05-19': [
    { impact:'medium', cat:'economic', emoji:'🟡', title:'Housing Starts & Permits — April', time:'8:30 AM ET', status:'released',
      desc:'New residential construction. Key for lumber, homebuilders.',
      data:['Consensus: ~1.3M annualized','Affects: XHB, LEN, DHI'] },
  ],
  '2026-05-20': [
    { impact:'high', cat:'fed', emoji:'🏛️', title:'FOMC April Meeting Minutes', time:'2:00 PM ET', status:'released',
      desc:'Reveals dissenting voter arguments, debate over rate hikes.',
      data:['Watch: Language on "further hikes"','Watch: Inflation threshold debate'],
      marketImpact:'🔴 HIGH IMPACT: Minutes set expectations for the June rate decision.' },
    { impact:'critical', cat:'earnings', emoji:'💰', title:'NVDA Earnings — Q1 FY2027', time:'After Close', status:'released',
      tickers:['NVDA'],
      desc:'NVIDIA crushed estimates. Record revenue of $81.6B (+85% YoY). Data Center revenue $75.2B (+92% YoY). Announced $80B buyback and raised dividend 25×.',
      data:['Revenue: $81.6B (record, +85% YoY)','Data Center: $75.2B (+92% YoY)','GAAP EPS: $2.39','Non-GAAP EPS: $1.87','$80B buyback authorized','Dividend: $0.25/share'],
      marketImpact:'🚀 Massive beat. AI demand remains insatiable. Blackwell ramp fully underway.' },
  ],
  '2026-05-21': [
    { impact:'medium', cat:'economic', emoji:'🟡', title:'Weekly Jobless Claims + Philly Fed', time:'8:30 AM ET', status:'released',
      desc:'Weekly labor market pulse.',
      data:['Claims Consensus: ~215K','Philly Fed Prior: 8.5'] },
  ],
  '2026-05-22': [
    { impact:'medium', cat:'economic', emoji:'🟡', title:'S&P Global Flash PMI', time:'9:45 AM ET', status:'released',
      desc:'First look at May business activity.',
      data:['Services Prior: 54.4','Manufacturing Prior: 50.2'] },
  ],
  '2026-05-25': [
    { impact:'low', cat:'holiday', emoji:'🏖️', title:'Markets Closed — Memorial Day', time:'All Day', status:'released',
      desc:'US equity markets closed for Memorial Day. No trading.',
      data:['NYSE & NASDAQ: Closed','Futures: Limited trading'] },
  ],
  '2026-05-27': [
    { impact:'medium', cat:'earnings', emoji:'💰', title:'CRM (Salesforce) Earnings — Q1 FY2027', time:'After Close', status:'released',
      tickers:['CRM'],
      desc:'Salesforce beat estimates by a wide margin. Revenue $11.1B (+13% YoY). Agentforce AI platform driving deal acceleration. Raised full-year guidance.',
      data:['Revenue: $11.1B (+13% YoY)','GAAP EPS: $2.42 (+52% YoY)','Non-GAAP EPS: $3.88 (beat $2.96 est by 31%)','FY27 Revenue Guide: $45.9–$46.2B (+11%)'],
      marketImpact:'📈 Strong beat. Agentforce adoption inflecting. Enterprise AI narrative validated.' },
    { impact:'medium', cat:'earnings', emoji:'💰', title:'MRVL (Marvell) Earnings — Q1 FY2027', time:'After Close', status:'released',
      tickers:['MRVL'],
      desc:'Marvell posted record revenue of $2.418B (+28% YoY), beating estimates. Custom AI ASIC demand from hyperscalers remains strong.',
      data:['Revenue: $2.418B (record, +28% YoY)','Non-GAAP EPS: $0.80 (beat $0.75 est)','GAAP Gross Margin: 52.1%','Non-GAAP Gross Margin: 58.9%'],
      marketImpact:'📈 Record revenue. AI networking demand confirmed strong into H2 2026.' },
  ],
  '2026-05-28': [
    { impact:'high', cat:'economic', emoji:'🔴', title:'GDP Q1 2026 — Second Estimate', time:'8:30 AM ET', status:'upcoming',
      desc:'Revised Q1 GDP growth.',
      data:['First Estimate: +2.1% annualized','Watch: Consumer spending sub-component'],
      marketImpact:'📊 Downward revision could revive rate cut hopes ahead of June FOMC.' },
  ],
  '2026-05-29': [
    { impact:'medium', cat:'economic', emoji:'🟡', title:'PCE Price Index — April 2026', time:'8:30 AM ET', status:'upcoming',
      desc:"Fed's preferred inflation gauge. Core PCE is the key FOMC metric.",
      data:['Prior Core PCE YoY: 2.6%','Target: 2.0%','Critical for June FOMC'] },
  ],
  '2026-06-03': [
    { impact:'medium', cat:'earnings', emoji:'💰', title:'AVGO (Broadcom) Earnings — Q2 FY2026', time:'After Close', status:'upcoming',
      tickers:['AVGO'],
      desc:'Broadcom Q2 FY2026 — custom AI ASIC revenue (Google TPU, Meta MTIA) and VMware integration update. Company guided revenue of ~$22B (+47% YoY).',
      data:['EPS Consensus: $2.40 (37 analysts)','Revenue Guidance: ~$22.0B (+47% YoY)','Gross Margin: ~77%','Adj. EBITDA: ~68% of revenue','Call: 2 PM PT / 5 PM ET'],
      marketImpact:'📊 Custom ASIC demand signals health of hyperscaler AI spending for H2 2026.' },
  ],
  '2026-06-04': [
    { impact:'medium', cat:'economic', emoji:'🟡', title:'ISM Services PMI — May', time:'10:00 AM ET', status:'upcoming',
      desc:'Services sector activity. Services make up ~80% of US economy.',
      data:['Above 50 = Expansion','Services ~80% of US economy'] },
  ],
  '2026-06-05': [
    { impact:'medium', cat:'ipo', emoji:'🚀', title:'Klarna IPO — Expected Week', time:'NYSE', status:'upcoming',
      desc:'Swedish BNPL fintech Klarna expected to price its US IPO this week. Valuation ~$15B.',
      data:['Valuation: ~$15B','Sector: Fintech / BNPL','Ticker: KLAR'],
      marketImpact:'📊 Large fintech IPO could revive risk appetite for unprofitable growth names.' },
  ],
  '2026-06-06': [
    { impact:'high', cat:'economic', emoji:'🔴', title:'May Jobs Report (NFP)', time:'8:30 AM ET', status:'upcoming',
      desc:'Non-Farm Payrolls. Strong jobs = Fed holds. Weak jobs = rate cut possible.',
      data:['Prior: 177K','Watch: Unemployment rate','Watch: Wage growth YoY'],
      marketImpact:'📊 Key input for June 16–17 FOMC decision.' },
  ],
  '2026-06-11': [
    { impact:'high', cat:'economic', emoji:'🔴', title:'CPI — May 2026', time:'8:30 AM ET', status:'upcoming',
      desc:'Last major inflation data before June 16–17 FOMC rate decision.',
      data:['Prior: 3.7% YoY','Last data before June FOMC'],
      marketImpact:'🔴 Most sensitive pre-FOMC data point. Any surprise = large moves.' },
  ],
  '2026-06-12': [
    { impact:'medium', cat:'economic', emoji:'🟡', title:'PPI — May 2026', time:'8:30 AM ET', status:'upcoming',
      desc:'Producer price inflation for May. Confirms or contradicts CPI print.',
      data:['Watch: Services PPI','Prior: +0.5% MoM'] },
  ],
  '2026-06-16': [
    { impact:'critical', cat:'fed', emoji:'🚨', title:'FOMC Rate Decision — Day 1', time:'All Day', status:'upcoming',
      desc:"MOST IMPORTANT event of Q2. Warsh's first rate decision. Current rate: 4.75–5.00%.",
      data:['Current Rate: 4.75–5.00%','Cut Probability: ~15%','Hold Probability: ~75%','Hike Probability: ~10%'],
      marketImpact:'🔴 CRITICAL: Most consequential market event of Q2.' },
  ],
  '2026-06-17': [
    { impact:'critical', cat:'fed', emoji:'🚨', title:'FOMC Decision + Warsh Press Conference', time:'2:00 PM ET', status:'upcoming',
      desc:"Rate announced 2 PM ET. Warsh press conference 2:30 PM ET. Every word will be parsed.",
      data:['Decision: 2:00 PM ET','Press Conf: 2:30 PM ET','Rate hike = broad selloff','Hold + dovish = rally'],
      marketImpact:"🚨 Biggest market-moving event of Q2. Warsh's tone defines H2 2026 direction." },
  ],
  '2026-06-23': [
    { impact:'medium', cat:'economic', emoji:'🟡', title:'S&P Global Flash PMI — June', time:'9:45 AM ET', status:'upcoming',
      desc:'First look at June business activity across manufacturing and services.',
      data:['Services Prior: 54.4','Manufacturing Prior: 50.2'] },
  ],
  '2026-06-25': [
    { impact:'medium', cat:'economic', emoji:'🟡', title:'PCE Price Index — May 2026', time:'8:30 AM ET', status:'upcoming',
      desc:"Fed's preferred inflation measure for May. Will show if June FOMC was right.",
      data:['Prior Core PCE YoY: 2.6%','Watch: Post-FOMC validation'] },
  ],
  '2026-07-01': [
    { impact:'medium', cat:'economic', emoji:'🟡', title:'ISM Manufacturing PMI — June', time:'10:00 AM ET', status:'upcoming',
      desc:'Manufacturing sector health check for June.',
      data:['Above 50 = expansion','Prior: 48.7 (contraction)'] },
  ],
  '2026-07-03': [
    { impact:'high', cat:'economic', emoji:'🔴', title:'June Jobs Report (NFP)', time:'8:30 AM ET', status:'upcoming',
      desc:'Non-Farm Payrolls for June. Pre-holiday release (markets close early Jul 4).',
      data:['Early release: 8:30 AM ET','Markets close at 1 PM ET for July 4'],
      marketImpact:'📊 Low-liquidity print. Can cause outsized moves.' },
  ],
  '2026-07-04': [
    { impact:'low', cat:'holiday', emoji:'🏖️', title:'Markets Closed — Independence Day', time:'All Day', status:'upcoming',
      desc:'US equity markets closed for 4th of July. No trading.',
      data:['NYSE & NASDAQ: Closed'] },
  ],
  '2026-07-15': [
    { impact:'critical', cat:'earnings', emoji:'💰', title:'Big Banks Earnings Kick-Off', time:'Pre-Market', status:'upcoming',
      tickers:['JPM','WFC','C'],
      desc:'JPM, WFC, C report Q2 earnings — traditional start of US earnings season.',
      data:['JPM EPS Consensus: $4.48','WFC EPS Consensus: $1.35','Sector: Financials'],
      marketImpact:'📊 Bank results set tone for Q2 earnings season.' },
  ],
  '2026-07-16': [
    { impact:'critical', cat:'earnings', emoji:'💰', title:'NFLX Earnings', time:'After Close', status:'upcoming',
      tickers:['NFLX'],
      desc:'Netflix Q2 2026 — subscriber growth, ad-tier momentum, and content slate performance.',
      data:['Options Move: ±8%','Ad-tier subs watch','Global content slate'],
      marketImpact:'📊 NFLX ad revenue ramp is the key metric this cycle.' },
  ],
  '2026-07-28': [
    { impact:'critical', cat:'earnings', emoji:'💰', title:'GOOGL & MSFT Earnings', time:'After Close', status:'upcoming',
      tickers:['GOOGL','MSFT'],
      desc:'Alphabet and Microsoft Q2 2026. Cloud growth, AI monetization, and capex guidance are the key metrics.',
      data:['GOOGL Cloud growth watch: 28%+','MSFT Azure AI revenue?','Both Options Move: ~6–7%'],
      marketImpact:'📊 Cloud duo results = barometer for enterprise AI spending.' },
  ],
  '2026-07-29': [
    { impact:'critical', cat:'earnings', emoji:'💰', title:'TSLA & META Earnings', time:'After Close', status:'upcoming',
      tickers:['TSLA','META'],
      desc:'Tesla Q2 2026 deliveries + margins. Meta Platforms AI ad revenue, Llama 4 update, Reality Labs.',
      data:['TSLA Options Move: ±11%','META Options Move: ±7%','TSLA Deliveries: ~520K est','META Revenue: ~$45B est'],
      marketImpact:'🔴 TSLA ±10% moves are common on earnings. META ad revenue = health of digital advertising.' },
  ],
  '2026-07-29': [
    { impact:'critical', cat:'fed', emoji:'🏛️', title:'FOMC Rate Decision — July', time:'2:00 PM ET', status:'upcoming',
      desc:"Second Warsh FOMC. Will June's data force a cut, hold, or surprise hike?",
      data:['Watch: Post-June CPI trajectory','Cut probability: TBD after June data'],
      marketImpact:'🔴 CRITICAL: Second rate decision under Warsh. Path for H2 2026 set here.' },
  ],
  '2026-07-30': [
    { impact:'critical', cat:'earnings', emoji:'💰', title:'AAPL Earnings', time:'After Close', status:'upcoming',
      tickers:['AAPL'],
      desc:'Apple Q3 FY2026. iPhone 18 pre-launch demand signals, India manufacturing, AI features.',
      data:['Revenue Consensus: ~$97B','iPhone unit watch','Options Move: ±5%'],
      marketImpact:'📊 AAPL is 7%+ of SPY — moves market.' },
    { impact:'critical', cat:'earnings', emoji:'💰', title:'AMZN Earnings', time:'After Close', status:'upcoming',
      tickers:['AMZN'],
      desc:'Amazon Q2 2026. AWS growth rate, AI infrastructure spend, advertising revenue.',
      data:['AWS Growth Watch: 22%+','Ads Revenue: ~$16B est','Options Move: ±6%'],
      marketImpact:'📊 AWS guidance = proxy for cloud + AI capex environment.' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_ABBR    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const IMPACT_ORDER = ['critical','high','medium','low']

const TODAY_KEY = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function buildMonth(year, month) {
  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

function topImpact(events) {
  for (const lvl of IMPACT_ORDER) if (events.some(e => e.impact === lvl)) return lvl
  return null
}

function fmtDateLabel(key) {
  return new Date(key + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function fmtDateShort(key) {
  return new Date(key + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function daysUntil(key) {
  const today = new Date(TODAY_KEY + 'T00:00:00')
  const target = new Date(key + 'T00:00:00')
  return Math.round((target - today) / 86400000)
}

function urgencyLabel(diff) {
  if (diff < 0)  return { label: 'Past',        color: 'text-slate-400' }
  if (diff === 0) return { label: 'TODAY',       color: 'text-red-400 font-black animate-pulse' }
  if (diff === 1) return { label: 'Tomorrow',    color: 'text-orange-400 font-black' }
  if (diff <= 3) return { label: `In ${diff}d`,  color: 'text-amber-400 font-semibold' }
  if (diff <= 7) return { label: `In ${diff}d`,  color: 'text-yellow-300 font-semibold' }
  return              { label: `In ${diff}d`,    color: 'text-slate-400' }
}

// ─────────────────────────────────────────────────────────────────────────────
// COUNTDOWN HOOK — live countdown to next upcoming event
// ─────────────────────────────────────────────────────────────────────────────
function useCountdown(targetKey) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  if (!targetKey) return null
  const now    = new Date()
  const target = new Date(targetKey + 'T09:30:00-04:00') // assume market open
  const diff   = Math.max(0, target - now)

  const days  = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins  = Math.floor((diff % 3600000)  / 60000)
  const secs  = Math.floor((diff % 60000)    / 1000)

  return { days, hours, mins, secs, diff }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUSH NOTIFICATION STRIP
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// LIVE ECONOMIC NEWS FEED
// ─────────────────────────────────────────────────────────────────────────────
const NEWS_RSS = 'https://feeds.marketwatch.com/marketwatch/realtimeheadlines/'

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const mins = Math.floor((Date.now() - new Date(dateStr)) / 60000)
  if (mins < 2)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function LiveNewsFeed() {
  const [headlines, setHeadlines] = useState([])
  const [loading,   setLoading]   = useState(true)

  const load = useCallback(async () => {
    try {
      const res  = await fetch(
        `https://api.allorigins.win/raw?url=${encodeURIComponent(NEWS_RSS)}`,
        { signal: AbortSignal.timeout(8000) }
      )
      const text = await res.text()
      const xml  = new DOMParser().parseFromString(text, 'application/xml')
      const items = [...xml.querySelectorAll('item')].slice(0, 14).map(item => {
        const title   = item.querySelector('title')?.textContent?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || ''
        const linkEl  = item.querySelector('link')
        const link    = linkEl?.nextSibling?.nodeValue?.trim() || linkEl?.textContent?.trim() || '#'
        const pubDate = item.querySelector('pubDate')?.textContent || ''
        return { title, link, pubDate }
      }).filter(h => h.title.length > 8)
      if (items.length) setHeadlines(items)
    } catch { /* silent fail */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 5 * 60 * 1000) // refresh every 5 min
    return () => clearInterval(t)
  }, [load])

  if (loading && !headlines.length) return (
    <div className="flex items-center gap-2 py-1.5 px-1">
      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
      <span className="text-[10px] text-slate-400 italic">Loading market news…</span>
    </div>
  )

  if (!headlines.length) return null

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-1.5 px-1"
      style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>

      {/* Label */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">News</span>
      </div>

      {/* Headline pills */}
      {headlines.map((h, i) => (
        <a key={i} href={h.link} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 flex-shrink-0 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl px-3 py-1.5 transition-colors group no-underline">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold text-slate-700 group-hover:text-blue-700 leading-tight truncate max-w-[180px] sm:max-w-[260px]">
              {h.title}
            </div>
            {h.pubDate && (
              <div className="text-[9px] text-slate-400 mt-0.5 leading-none">{timeAgo(h.pubDate)}</div>
            )}
          </div>
        </a>
      ))}

      <button onClick={load}
        className="text-[10px] font-bold text-blue-400 hover:text-blue-600 whitespace-nowrap flex-shrink-0 transition-colors ml-1">
        ↻
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PUSH ALERT STRIP — economic / fed / macro events only (no earnings)
// ─────────────────────────────────────────────────────────────────────────────
function PushAlertStrip({ allEntries }) {
  const [dismissed, setDismissed] = useState(new Set())

  const alerts = useMemo(() => {
    const items = []
    allEntries.forEach(([key, evs]) => {
      const diff = daysUntil(key)
      if (diff >= 0 && diff <= 3) {
        evs.forEach((ev, i) => {
          if (ev.cat === 'earnings') return          // earnings shown on cards, not here
          const id = `${key}-${i}`
          if (!dismissed.has(id)) items.push({ id, key, ev, diff })
        })
      }
    })
    return items.sort((a, b) => {
      const impA = IMPACT_ORDER.indexOf(a.ev.impact)
      const impB = IMPACT_ORDER.indexOf(b.ev.impact)
      return impA !== impB ? impA - impB : a.key.localeCompare(b.key)
    })
  }, [allEntries, dismissed])

  if (alerts.length === 0) return null

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-1.5 px-1"
      style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
      {/* Pulse dot + label */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">72h</span>
      </div>

      {/* Compact alert pills */}
      {alerts.map(({ id, key, ev, diff }) => {
        const imp = IMPACT[ev.impact]
        const urg = urgencyLabel(diff)
        return (
          <div key={id}
            className={`flex items-center gap-2 flex-shrink-0 bg-slate-900 border ${imp.alertBorder} rounded-xl px-3 py-1.5`}
            style={{ borderLeftWidth: '3px' }}>
            <span className="text-sm leading-none">{ev.emoji}</span>
            <div className="min-w-0">
              <div className="text-[10px] font-black text-white leading-none truncate max-w-[140px] sm:max-w-[200px]">
                {ev.title}
              </div>
              <div className="text-[9px] text-white/50 mt-0.5 whitespace-nowrap">
                {fmtDateShort(key)} · <span className={urg.color}>{urg.label}</span>
              </div>
            </div>
            <button onClick={() => setDismissed(s => new Set([...s, id]))}
              className="text-white/30 hover:text-white/70 text-base leading-none flex-shrink-0 ml-1 transition-colors">
              ×
            </button>
          </div>
        )
      })}

      {alerts.length > 1 && (
        <button onClick={() => setDismissed(new Set(alerts.map(a => a.id)))}
          className="text-[9px] text-slate-500 hover:text-slate-300 font-bold whitespace-nowrap flex-shrink-0 transition-colors">
          Clear all
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COUNTDOWN DISPLAY
// ─────────────────────────────────────────────────────────────────────────────
function NextEventCountdown({ nextKey, nextEvent }) {
  const cd = useCountdown(nextKey)
  if (!cd || !nextKey || !nextEvent) return null

  return (
    <div className="flex items-center gap-3 bg-white/10 rounded-2xl px-4 py-3 border border-white/10 flex-shrink-0 min-w-0">
      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Next Event</div>
        <div className="text-xs font-black text-white truncate">{nextEvent.title}</div>
        <div className="text-[10px] text-slate-400">{fmtDateShort(nextKey)} · {nextEvent.time}</div>
      </div>
      {/* Countdown clock */}
      {cd.diff > 0 && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {cd.days > 0 && (
            <div className="text-center">
              <div className="text-lg font-black text-white tabular-nums leading-none">{cd.days}</div>
              <div className="text-[8px] text-slate-500 uppercase">days</div>
            </div>
          )}
          {cd.days > 0 && <div className="text-slate-600 font-black">:</div>}
          <div className="text-center">
            <div className="text-lg font-black text-white tabular-nums leading-none">{String(cd.hours).padStart(2,'0')}</div>
            <div className="text-[8px] text-slate-500 uppercase">hrs</div>
          </div>
          <div className="text-slate-600 font-black">:</div>
          <div className="text-center">
            <div className="text-lg font-black text-white tabular-nums leading-none">{String(cd.mins).padStart(2,'0')}</div>
            <div className="text-[8px] text-slate-500 uppercase">min</div>
          </div>
          {cd.days === 0 && (
            <>
              <div className="text-slate-600 font-black">:</div>
              <div className="text-center">
                <div className="text-lg font-black text-green-400 tabular-nums leading-none animate-pulse">{String(cd.secs).padStart(2,'0')}</div>
                <div className="text-[8px] text-slate-500 uppercase">sec</div>
              </div>
            </>
          )}
        </div>
      )}
      {cd.diff === 0 && (
        <div className="text-xs font-black text-red-400 animate-pulse flex-shrink-0">NOW</div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────────────────────
function StatusBadge({ status, dateKey: dk }) {
  const diff = dk ? daysUntil(dk) : null
  if (status === 'released' || (diff !== null && diff < 0)) return (
    <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
      ✅ RELEASED
    </span>
  )
  if (diff === 0) return (
    <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200 animate-pulse">
      ⚡ TODAY
    </span>
  )
  if (diff === 1) return (
    <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
      🔔 TOMORROW
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
      📅 UPCOMING
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT CARD
// ─────────────────────────────────────────────────────────────────────────────
function EventCard({ ev, dk, earningsPrices }) {
  const [expanded, setExpanded] = useState(false)
  const imp = IMPACT[ev.impact]
  const cat = CATEGORY_META[ev.cat] || CATEGORY_META.economic
  const diff = dk ? daysUntil(dk) : -1
  const urg  = diff >= 0 ? urgencyLabel(diff) : null

  // Build live price chips for earnings events
  const livePriceChips = useMemo(() => {
    if (!ev.tickers || !earningsPrices) return []
    return ev.tickers.map(ticker => {
      const p = earningsPrices[ticker]
      if (!p) return { ticker, price: null, changePct: null }
      return { ticker, price: p.price, changePct: p.changePct }
    })
  }, [ev.tickers, earningsPrices])

  return (
    <div
      onClick={() => setExpanded(x => !x)}
      className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden border-l-4 ${imp.border} cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.99] ${expanded ? imp.ring : ''}`}>

      {/* Card header */}
      <div className="px-4 pt-3.5 pb-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <span className="text-xl flex-shrink-0 mt-0.5">{ev.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="font-black text-slate-900 text-sm leading-snug">{ev.title}</div>
              <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${imp.badge}`}>{imp.label}</span>
                <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${cat.color}`}>{cat.icon} {cat.label}</span>
                <StatusBadge status={ev.status} dateKey={dk} />
                {urg && diff >= 0 && diff <= 7 && (
                  <span className={`text-[9px] ${urg.color}`}>{urg.label}</span>
                )}
              </div>

              {/* Live price chips — shown inline for earnings events */}
              {livePriceChips.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {livePriceChips.map(({ ticker, price, changePct }) => {
                    const up = changePct !== null && changePct >= 0
                    return (
                      <div key={ticker}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[9px] font-black ${
                          price !== null
                            ? up
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : 'bg-red-50 border-red-200 text-red-600'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}>
                        <span>{ticker}</span>
                        {price !== null ? (
                          <>
                            <span className="font-normal text-slate-400 mx-0.5">·</span>
                            <span>${price.toFixed(2)}</span>
                            <span className="font-normal opacity-70 ml-0.5">
                              {up ? '+' : ''}{changePct?.toFixed(2)}%
                            </span>
                          </>
                        ) : (
                          <span className="font-normal text-slate-400 ml-0.5">…</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <div className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg whitespace-nowrap">
              🕐 {ev.time}
            </div>
            <div className={`text-[10px] text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>▾</div>
          </div>
        </div>
      </div>

      {/* Description — always visible */}
      <div className="px-4 pb-2.5">
        <p className="text-xs text-slate-600 leading-relaxed">{ev.desc}</p>
      </div>

      {/* Expanded content */}
      {expanded && (
        <>
          {/* Data pills */}
          {ev.data?.length > 0 && (
            <div className="px-4 pb-2.5 flex flex-wrap gap-1.5">
              {ev.data.map((d, i) => (
                <span key={i} className={`text-[10px] font-semibold px-2 py-1 rounded-lg border ${imp.pill}`}>{d}</span>
              ))}
            </div>
          )}

          {/* Market impact */}
          {ev.marketImpact && (
            <div className="mx-4 mb-3 px-3 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-semibold leading-relaxed flex items-start gap-2">
              <span className="flex-shrink-0">📡</span>
              <span>{ev.marketImpact}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CALENDAR GRID
// ─────────────────────────────────────────────────────────────────────────────
function CalendarGrid({ month, onSelect, selectedKey }) {
  const cells = buildMonth(month.year, month.month)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
        {DAY_ABBR.map(d => (
          <div key={d} className="text-center text-[9px] font-black text-slate-400 py-2 uppercase tracking-wider">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) {
            return <div key={`e-${i}`} className="aspect-square bg-slate-50/40 border-r border-b border-slate-100" />
          }
          const key      = dateKey(month.year, month.month, day)
          const dayEvents = EVENTS[key] || []
          const impact   = topImpact(dayEvents)
          const imp      = impact ? IMPACT[impact] : null
          const isToday  = key === TODAY_KEY
          const isSel    = selectedKey === key
          const isWeekend = (i % 7 === 0) || (i % 7 === 6)
          const hasEvents = dayEvents.length > 0
          const diff     = daysUntil(key)
          const isNear   = diff >= 0 && diff <= 3

          return (
            <div
              key={key}
              onClick={() => hasEvents && onSelect(key)}
              className={[
                'aspect-square border-r border-b border-slate-100 transition-all duration-150 relative flex flex-col items-center justify-start pt-1.5 pb-1',
                hasEvents ? 'cursor-pointer' : '',
                isSel    ? 'bg-slate-900' :
                isToday  ? 'bg-blue-50 ring-inset ring-2 ring-blue-400' :
                isNear && hasEvents ? 'bg-amber-50' :
                hasEvents ? 'hover:bg-slate-50' :
                isWeekend ? 'bg-slate-50/30' : 'bg-white',
              ].filter(Boolean).join(' ')}
            >
              <span className={[
                'text-[10px] sm:text-xs font-black w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full',
                isSel    ? 'bg-white text-slate-900' :
                isToday  ? 'bg-blue-600 text-white shadow-sm' :
                isWeekend ? 'text-slate-400' : 'text-slate-700',
              ].join(' ')}>
                {day}
              </span>

              {dayEvents.length > 0 && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center px-0.5">
                  {dayEvents.slice(0, 3).map((ev, j) => (
                    <div key={j} className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full flex-shrink-0 ${isSel ? 'bg-white/60' : IMPACT[ev.impact].dot}`} />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className={`text-[6px] sm:text-[7px] font-black ${isSel ? 'text-white/60' : 'text-slate-400'}`}>+{dayEvents.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// QUICK FILTER CHIPS
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORIES = Object.keys(CATEGORY_META)

// ─────────────────────────────────────────────────────────────────────────────
// EARNINGS WATCHLIST — live price strip for all earnings tickers
// ─────────────────────────────────────────────────────────────────────────────
// Pre-compute all unique earnings tickers from EVENTS (stable, no hook needed)
const ALL_EARNINGS_TICKERS = (() => {
  const set = new Set()
  Object.values(EVENTS).forEach(evs =>
    evs.forEach(ev => { if (ev.tickers) ev.tickers.forEach(t => set.add(t)) })
  )
  return [...set]
})()

// Map ticker → { dateKey, status } for "days until" display
const TICKER_EVENT_META = (() => {
  const map = {}
  Object.entries(EVENTS).forEach(([key, evs]) => {
    evs.forEach(ev => {
      if (ev.tickers) ev.tickers.forEach(t => {
        if (!map[t]) map[t] = { dateKey: key, status: ev.status }
      })
    })
  })
  return map
})()

function EarningsWatchlist({ prices, loading, lastUpdated, refresh }) {

  return (
    <div className="space-y-1.5">
      {/* Header row */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">💰 Earnings Watchlist</span>
          <span className="text-[9px] text-slate-400">— live prices · auto-refresh 60s</span>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[9px] text-slate-400">
              Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })} ET
            </span>
          )}
          <button
            onClick={refresh}
            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg transition-colors">
            ↻
          </button>
        </div>
      </div>

      {/* Horizontal scroll of ticker cards */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {ALL_EARNINGS_TICKERS.map(ticker => {
          const p    = prices[ticker]
          const meta = TICKER_EVENT_META[ticker]
          const diff = meta ? daysUntil(meta.dateKey) : null
          const urg  = diff !== null ? urgencyLabel(diff) : null
          const isUp = p ? p.changePct >= 0 : null
          const isReleased = meta?.status === 'released'

          return (
            <div key={ticker}
              className={`flex-shrink-0 bg-white rounded-2xl border shadow-sm px-3 py-2.5 min-w-[100px] transition-all ${
                loading && !p ? 'opacity-50 animate-pulse' : ''
              } ${isUp === true ? 'border-emerald-200' : isUp === false ? 'border-red-200' : 'border-slate-200'}`}>

              {/* Ticker + event timing */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-black text-slate-800">{ticker}</span>
                {urg && diff !== null && (
                  <span className={`text-[8px] font-black ${urg.color}`}>
                    {isReleased ? '✅' : urg.label}
                  </span>
                )}
              </div>

              {/* Price */}
              {p ? (
                <>
                  <div className={`text-sm font-black tabular-nums ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
                    ${p.price?.toFixed(2) ?? '—'}
                  </div>
                  <div className={`text-[10px] font-bold tabular-nums ${isUp ? 'text-emerald-500' : 'text-red-400'}`}>
                    {isUp ? '+' : ''}{p.changePct?.toFixed(2) ?? '—'}%
                    <span className="text-slate-400 font-normal ml-1">
                      {isUp ? '▲' : '▼'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-400 font-semibold">{loading ? '…' : 'N/A'}</div>
              )}

              {/* Earnings date label */}
              {meta && (
                <div className="text-[8px] text-slate-400 mt-1 leading-none">
                  {fmtDateShort(meta.dateKey)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const [selectedKey, setSelectedKey] = useState(null)
  const [viewRange,   setViewRange]   = useState('week')
  const [catFilter,   setCatFilter]   = useState('all')
  const [impFilter,   setImpFilter]   = useState('all')
  const [calMonth,    setCalMonth]    = useState(() => {
    const d = new Date(TODAY_KEY + 'T12:00:00')
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  // Live prices for all earnings tickers — single shared fetch, 60s auto-refresh
  const { prices: earningsPrices } = useLivePrices(ALL_EARNINGS_TICKERS, 60_000)

  const goPrev = () => setCalMonth(m => { const d = new Date(m.year, m.month - 1, 1); return { year: d.getFullYear(), month: d.getMonth() } })
  const goNext = () => setCalMonth(m => { const d = new Date(m.year, m.month + 1, 1); return { year: d.getFullYear(), month: d.getMonth() } })

  const allEntries = useMemo(() =>
    Object.entries(EVENTS).sort(([a], [b]) => a.localeCompare(b)),
  [])

  const stats = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, total: 0 }
    allEntries.forEach(([, evs]) => evs.forEach(ev => { counts[ev.impact]++; counts.total++ }))
    return counts
  }, [allEntries])

  const rangeEntries = useMemo(() => {
    const today = new Date(TODAY_KEY + 'T12:00:00')
    const days  = viewRange === 'week' ? 7 : viewRange === 'twoweek' ? 14 : 30
    return allEntries.filter(([key]) => {
      const d    = new Date(key + 'T12:00:00')
      const diff = Math.floor((d - today) / 86400000)
      return diff >= -1 && diff < days
    })
  }, [allEntries, viewRange])

  const selectedEvents = selectedKey ? (EVENTS[selectedKey] || []) : []

  const filterEvs = evs => evs.filter(e => {
    if (impFilter !== 'all' && e.impact !== impFilter) return false
    if (catFilter !== 'all' && e.cat !== catFilter) return false
    return true
  })

  const handleSelect = (key) => setSelectedKey(prev => prev === key ? null : key)

  const rangeLabel = viewRange === 'week' ? '7 Days' : viewRange === 'twoweek' ? '14 Days' : '30 Days'

  return (
    <div className="space-y-4">

      {/* ══ LIVE ECONOMIC NEWS FEED ═══════════════════════════════════════════ */}
      <LiveNewsFeed />

      {/* ══ PUSH ALERT STRIP — macro/fed/economic events only ════════════════ */}
      <PushAlertStrip allEntries={allEntries} />

      {/* ══ HEADER ════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl px-4 py-2.5 text-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-base">🗓️</span>
          <span className="text-sm font-black tracking-tight">Market Calendar</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {IMPACT_ORDER.map(k => {
            const active = impFilter === k
            return (
              <button key={k}
                onClick={() => { setImpFilter(prev => prev === k ? 'all' : k); setSelectedKey(null) }}
                className={`flex items-center gap-1.5 flex-shrink-0 px-2.5 py-1 rounded-lg transition-all ${
                  active ? `${IMPACT[k].badge}` : 'hover:bg-white/10'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${IMPACT[k].dot}`} />
                <span className={`text-[10px] font-semibold whitespace-nowrap ${active ? 'text-white' : 'text-slate-400'}`}>
                  {IMPACT[k].label.charAt(0) + IMPACT[k].label.slice(1).toLowerCase()}
                  <span className={`ml-1 font-black ${active ? 'text-white' : 'text-slate-500'}`}>{stats[k]}</span>
                </span>
              </button>
            )
          })}
          {impFilter !== 'all' && (
            <button onClick={() => setImpFilter('all')}
              className="text-[9px] text-slate-500 hover:text-white ml-1 flex-shrink-0 transition-colors">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ══ FILTER + VIEW BAR ═════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Range */}
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Range:</span>
          {[['week','7d'],['twoweek','14d'],['month','30d']].map(([v, l]) => (
            <button key={v} onClick={() => { setViewRange(v); setSelectedKey(null) }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${viewRange === v && !selectedKey ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {l}
            </button>
          ))}

          <div className="w-px h-4 bg-slate-200" />

          {/* Category filter — scrollable, always clears selectedKey so range view shows */}
          <div className="flex items-center gap-1.5 overflow-x-auto flex-1" style={{ scrollbarWidth: 'none' }}>
            <button onClick={() => { setCatFilter('all'); setSelectedKey(null) }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap flex-shrink-0 transition-colors ${catFilter === 'all' && !selectedKey ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              All
            </button>
            {CATEGORIES.map(cat => {
              const m = CATEGORY_META[cat]
              const active = catFilter === cat && !selectedKey
              return (
                <button key={cat}
                  onClick={() => { setCatFilter(prev => prev === cat ? 'all' : cat); setSelectedKey(null) }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap flex-shrink-0 flex items-center gap-1 transition-colors ${active ? 'bg-slate-900 text-white' : `${m.color} hover:opacity-80`}`}>
                  {m.icon} {m.label}
                </button>
              )
            })}
          </div>

          {selectedKey && (
            <button onClick={() => setSelectedKey(null)}
              className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 flex-shrink-0 ml-auto">
              ← All
            </button>
          )}
        </div>
      </div>

      {/* ══ MAIN LAYOUT ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

        {/* ── LEFT: CALENDAR ─────────────────────────────────────────────── */}
        <div className="lg:col-span-4 space-y-4">
          {/* Month nav */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
              <button onClick={goPrev} className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-800 hover:bg-white transition-colors text-lg font-black">‹</button>
              <span className="text-sm font-black text-slate-800 uppercase tracking-wide">
                {MONTH_NAMES[calMonth.month]} {calMonth.year}
              </span>
              <button onClick={goNext} className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-800 hover:bg-white transition-colors text-lg font-black">›</button>
            </div>
            <CalendarGrid month={calMonth} onSelect={handleSelect} selectedKey={selectedKey} />
            {/* Mini legend */}
            <div className="px-3 py-2 border-t border-slate-100 flex items-center gap-4 bg-slate-50/50">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-amber-50 border border-amber-200" />
                <span className="text-[9px] text-slate-400">Alert zone</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-blue-50 ring-2 ring-blue-400" />
                <span className="text-[9px] text-slate-400">Today</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-slate-900" />
                <span className="text-[9px] text-slate-400">Selected</span>
              </div>
            </div>
          </div>

        </div>

        {/* ── RIGHT: EVENTS PANEL ─────────────────────────────────────────── */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

            {/* Panel header */}
            <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <div>
                {selectedKey ? (
                  <>
                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-wider mb-0.5">Selected Day</div>
                    <h3 className="text-sm md:text-base font-black text-slate-900">{fmtDateLabel(selectedKey)}</h3>
                  </>
                ) : (
                  <>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Catalyst Stream</div>
                    <h3 className="text-sm md:text-base font-black text-slate-900">Next {rangeLabel}</h3>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!selectedKey && (
                  <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700">
                    {rangeEntries.reduce((a, [, evs]) => a + filterEvs(evs).length, 0)} events
                  </span>
                )}
                {selectedKey && (
                  <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-slate-900 text-white">
                    {filterEvs(selectedEvents).length} event{filterEvs(selectedEvents).length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Events content */}
            <div className="p-4 overflow-y-auto max-h-[680px] space-y-6">

              {/* SINGLE DAY VIEW */}
              {selectedKey && (
                filterEvs(selectedEvents).length > 0 ? (
                  <div className="space-y-3">
                    {filterEvs(selectedEvents).map((ev, i) => (
                      <EventCard key={i} ev={ev} dk={selectedKey} earningsPrices={earningsPrices} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="text-4xl mb-3">🔕</div>
                    <div className="text-sm font-black text-slate-700">No events match this filter</div>
                    <button onClick={() => { setImpFilter('all'); setCatFilter('all') }}
                      className="mt-2 text-xs text-blue-600 font-bold hover:text-blue-700">Clear filters</button>
                  </div>
                )
              )}

              {/* RANGE TIMELINE VIEW */}
              {!selectedKey && (
                rangeEntries.length > 0 ? (
                  rangeEntries.map(([key, evs]) => {
                    const visible = filterEvs(evs)
                    if (!visible.length) return null
                    const isToday = key === TODAY_KEY
                    const isPast  = key < TODAY_KEY
                    const diff    = daysUntil(key)
                    const isNear  = diff >= 0 && diff <= 3

                    return (
                      <div key={key}>
                        {/* Date divider */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl flex-shrink-0 ${
                            isToday ? 'bg-blue-600 text-white' :
                            isNear  ? 'bg-amber-500 text-white' :
                            isPast  ? 'bg-slate-100 text-slate-500' :
                                      'bg-slate-900 text-white'
                          }`}>
                            {isToday && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                            <span className="text-xs font-black uppercase tracking-wide">
                              {isToday ? '⚡ TODAY — ' : isNear ? '🔔 ' : ''}{fmtDateShort(key)}
                            </span>
                          </div>
                          <div className="flex-1 h-px bg-slate-100" />
                          <div className="flex gap-1 flex-shrink-0">
                            {visible.map((ev, j) => (
                              <div key={j} className={`w-2 h-2 rounded-full ${IMPACT[ev.impact].dot}`} />
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3 pl-1">
                          {visible.map((ev, i) => (
                            <EventCard key={i} ev={ev} dk={key} earningsPrices={earningsPrices} />
                          ))}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="text-4xl mb-3">🔍</div>
                    <div className="text-sm font-black text-slate-700">
                      No {catFilter !== 'all' ? CATEGORY_META[catFilter]?.label : ''} {impFilter !== 'all' ? IMPACT[impFilter]?.label : ''} events in this window
                    </div>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                      Try expanding the date range or clearing filters.
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      {viewRange !== 'month' && (
                        <button onClick={() => setViewRange('month')}
                          className="text-xs text-blue-600 font-bold hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg">
                          Expand to 30 days
                        </button>
                      )}
                      {(catFilter !== 'all' || impFilter !== 'all') && (
                        <button onClick={() => { setImpFilter('all'); setCatFilter('all') }}
                          className="text-xs text-slate-500 font-bold hover:text-slate-700">
                          Clear filters
                        </button>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
