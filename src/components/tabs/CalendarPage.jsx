import React, { useState, useMemo } from 'react'

// ─── Impact config ────────────────────────────────────────────────────────────
const IMPACT = {
  critical: {
    label: 'CRITICAL',
    icon: '🚨',
    dot: 'bg-purple-500',
    badge: 'bg-purple-600 text-white',
    border: 'border-l-purple-600',
    cardBg: 'bg-purple-50',
    pill: 'bg-purple-100 text-purple-800',
    ring: 'ring-1 ring-purple-300',
    textColor: 'text-purple-700',
  },
  high: {
    label: 'HIGH',
    icon: '🔴',
    dot: 'bg-red-500',
    badge: 'bg-red-500 text-white',
    border: 'border-l-red-500',
    cardBg: 'bg-red-50',
    pill: 'bg-red-100 text-red-800',
    ring: 'ring-1 ring-red-200',
    textColor: 'text-red-700',
  },
  medium: {
    label: 'MEDIUM',
    icon: '🟡',
    dot: 'bg-amber-400',
    badge: 'bg-amber-500 text-white',
    border: 'border-l-amber-400',
    cardBg: 'bg-amber-50',
    pill: 'bg-amber-100 text-amber-800',
    ring: 'ring-1 ring-amber-200',
    textColor: 'text-amber-700',
  },
  holiday: {
    label: 'HOLIDAY',
    icon: '🏛️',
    dot: 'bg-slate-400',
    badge: 'bg-slate-500 text-white',
    border: 'border-l-slate-400',
    cardBg: 'bg-slate-50',
    pill: 'bg-slate-100 text-slate-700',
    ring: 'ring-1 ring-slate-200',
    textColor: 'text-slate-600',
  },
}

// ─── Category meta ─────────────────────────────────────────────────────────────
const CAT = {
  fed:       { icon: '🏛️', label: 'Fed / FOMC',      color: 'bg-purple-100 text-purple-800' },
  inflation: { icon: '📊', label: 'Inflation',       color: 'bg-red-100 text-red-800' },
  jobs:      { icon: '👷', label: 'Jobs',            color: 'bg-blue-100 text-blue-800' },
  gdp:       { icon: '📈', label: 'GDP',             color: 'bg-emerald-100 text-emerald-800' },
  consumer:  { icon: '🛍️', label: 'Consumer',       color: 'bg-orange-100 text-orange-800' },
  earnings:  { icon: '💰', label: 'Earnings',        color: 'bg-yellow-100 text-yellow-800' },
  housing:   { icon: '🏠', label: 'Housing',         color: 'bg-teal-100 text-teal-800' },
  trade:     { icon: '🌐', label: 'Trade / Geopo',   color: 'bg-indigo-100 text-indigo-800' },
  pmi:       { icon: '🏭', label: 'PMI / Mfg',       color: 'bg-cyan-100 text-cyan-800' },
  holiday:   { icon: '🏛️', label: 'Market Holiday',  color: 'bg-slate-100 text-slate-700' },
}

// ─── Market events data ───────────────────────────────────────────────────────
// Today = June 16, 2026 (FOMC Day 1)
const EVENTS = [
  // ── JUNE 2026 ───────────────────────────────────────────────────────────────
  {
    id: 'e1', date: '2026-06-16', impact: 'critical', category: 'fed',
    title: 'FOMC Rate Decision — June 2026',
    time: 'Jun 16–17 · Decision at 2:00 PM ET (Jun 17)',
    desc: 'Most important Fed event of Q2. With CPI elevated, the market is pricing a hold. Kevin Warsh chairs this meeting — his first rate decision as Fed Chair.',
    details: ['Current Rate: 4.75–5.00%', 'Cut Probability: ~15%', 'Hold Probability: ~75%', 'Hike Probability: ~10%'],
    impact_note: 'Rate hike = broad selloff. Hawkish hold = tech pressure. Dovish hold = risk rally.',
  },
  {
    id: 'e2', date: '2026-06-17', impact: 'critical', category: 'fed',
    title: 'Fed Press Conference — Chair Warsh',
    time: 'Jun 17 · 2:30 PM ET',
    desc: "Kevin Warsh's first post-FOMC press conference. Every word on inflation, tariffs, and the future rate path will be parsed by markets.",
    details: ['First Warsh presser', 'Watch: "Data dependent" language', 'Watch: Dot plot revisions', 'Watch: 2026 rate path signals'],
    impact_note: 'Hawkish surprise → S&P down 1–3%. Dovish pivot signals → mega rally.',
  },
  {
    id: 'e3', date: '2026-06-25', impact: 'high', category: 'gdp',
    title: 'GDP Q1 2026 — Final Estimate',
    time: 'Jun 25 · 8:30 AM ET',
    desc: 'Third and final estimate of Q1 2026 GDP. Confirms consumer spending, business investment, and net exports sub-components.',
    details: ['Advance Estimate: +2.1%', 'Second Estimate: TBD', 'Watch: Consumer spending revision'],
    impact_note: 'Downward revision below 1.5% would trigger recession fears.',
  },
  {
    id: 'e4', date: '2026-06-30', impact: 'high', category: 'inflation',
    title: 'Core PCE Price Index — May 2026',
    time: 'Jun 30 · 8:30 AM ET',
    desc: "The Fed's preferred inflation gauge. Released alongside personal income and spending. Critical input for the July FOMC decision.",
    details: ['Prior Core PCE YoY: 2.8%', "Fed's Target: 2.0%", 'Consensus: ~2.7%'],
    impact_note: 'Above 3% = no cuts this year. Below 2.5% = rate cut odds surge significantly.',
  },
  // ── JULY 2026 ───────────────────────────────────────────────────────────────
  {
    id: 'e5', date: '2026-07-02', impact: 'high', category: 'jobs',
    title: 'Nonfarm Payrolls (NFP) — June 2026',
    time: 'Jul 2 · 8:30 AM ET',
    desc: 'Monthly jobs report — the single most market-moving regular data release. Headline + unemployment rate + wage growth all move markets instantly.',
    details: ['Consensus: ~175K jobs', 'Prior: 178K', 'Unemployment Rate: ~4.1%', 'Avg Hourly Earnings MoM: +0.3%'],
    impact_note: 'Blowout jobs = more rate hike risk. Weak jobs = rate cut hopes return.',
  },
  {
    id: 'h1', date: '2026-07-03', impact: 'holiday', category: 'holiday',
    title: 'Independence Day (Observed) — Market Closed',
    time: 'All Day · Friday',
    desc: 'NYSE & NASDAQ closed. July 4 falls on a Saturday in 2026; markets observe the holiday on Friday July 3.',
    details: ['NYSE: CLOSED', 'NASDAQ: CLOSED', 'Bond Market: CLOSED'],
    impact_note: '',
  },
  {
    id: 'e6', date: '2026-07-14', impact: 'high', category: 'inflation',
    title: 'CPI — June 2026',
    time: 'Jul 14 · 8:30 AM ET',
    desc: 'Consumer Price Index for June. Pivotal inflation print ahead of the July 28–29 FOMC meeting.',
    details: ['Prior Headline YoY: ~3.5%', 'Prior Core YoY: ~3.1%', 'Consensus: ~3.3% YoY', 'Watch: Energy base effects'],
    impact_note: 'Hot print locks in hold or hike. Cool print opens July cut debate.',
  },
  {
    id: 'e7', date: '2026-07-15', impact: 'high', category: 'inflation',
    title: 'PPI — June 2026',
    time: 'Jul 15 · 8:30 AM ET',
    desc: 'Producer Price Index — a leading indicator for future CPI. Watch for pipeline inflation from tariffs feeding into producer prices.',
    details: ['Prior PPI YoY: ~3.2%', 'Watch: Core goods ex-food/energy', 'Tariff impact: Watch closely'],
    impact_note: 'Elevated PPI → CPI expected to stay sticky → no rate cuts near term.',
  },
  {
    id: 'e8', date: '2026-07-16', impact: 'medium', category: 'consumer',
    title: 'Retail Sales — June 2026',
    time: 'Jul 16 · 8:30 AM ET',
    desc: 'Measures consumer spending at retail outlets. Key gauge of economic momentum heading into Q3.',
    details: ['Prior: +0.4% MoM', 'Consensus: +0.3% MoM', 'Affects: XRT, consumer discretionary'],
    impact_note: 'Strong retail = resilient economy. Weak = slowdown fears accelerate.',
  },
  {
    id: 'e9', date: '2026-07-28', impact: 'critical', category: 'fed',
    title: 'FOMC Rate Decision — July 2026',
    time: 'Jul 28–29 · Decision at 2:00 PM ET (Jul 29)',
    desc: "Second FOMC under Chair Warsh. July CPI print will set the stage. This is the last meeting before Q3 earnings season kicks off in earnest.",
    details: ['Watch: June CPI heading into this', 'SEP Projections: NOT updated', 'Press Conference: YES'],
    impact_note: 'Any cut here would be a major market surprise and a strong rally trigger.',
  },
  {
    id: 'e10', date: '2026-07-30', impact: 'high', category: 'gdp',
    title: 'GDP Q2 2026 — Advance Estimate',
    time: 'Jul 30 · 8:30 AM ET',
    desc: 'First look at Q2 2026 economic growth. Released just one day after the FOMC decision — a critical economic double-header.',
    details: ['Q1 Final: ~2.1%', 'Consensus Q2: ~1.8%', 'Below 1%: Recession watch', 'Watch: Consumer spending'],
    impact_note: 'Recession signal (<1%) one day after FOMC = potential panic sell across markets.',
  },
  // ── AUGUST 2026 ─────────────────────────────────────────────────────────────
  {
    id: 'e11', date: '2026-08-07', impact: 'high', category: 'jobs',
    title: 'Nonfarm Payrolls (NFP) — July 2026',
    time: 'Aug 7 · 8:30 AM ET',
    desc: 'July jobs report. Summer labor market health check — key data for the September FOMC debate on rate cuts.',
    details: ['Consensus: ~170K', 'Watch: Unemployment rate trend', 'Watch: Labor force participation'],
    impact_note: 'Rising unemployment trend → September cut odds jump significantly.',
  },
  {
    id: 'e12', date: '2026-08-12', impact: 'high', category: 'inflation',
    title: 'CPI — July 2026',
    time: 'Aug 12 · 8:30 AM ET',
    desc: 'July CPI. Sets the tone for the September 15–16 FOMC decision. Key inflation mid-year checkpoint.',
    details: ['Watch: Energy prices post-summer', 'Watch: Shelter/housing CPI component', 'Prior: ~3.3% YoY'],
    impact_note: 'Below 3% YoY = September cut becomes a live, priced option.',
  },
  {
    id: 'e13', date: '2026-08-22', impact: 'high', category: 'fed',
    title: 'Jackson Hole Economic Symposium',
    time: 'Aug 21–23 · Jackson Hole, Wyoming',
    desc: "Annual Fed summit. Chair Warsh's keynote speech will be the most scrutinized central banking speech of the year. Hints at the rate path for 2027.",
    details: ['Key Speaker: Chair Warsh', 'Global CB governors attend', 'Theme: TBA', 'Watch: Every word on rate path'],
    impact_note: 'Hawkish surprise = major bond selloff + equity pressure. Dovish = relief rally.',
  },
  {
    id: 'e14', date: '2026-08-28', impact: 'medium', category: 'consumer',
    title: 'Consumer Confidence — August 2026',
    time: 'Aug 28 · 10:00 AM ET',
    desc: 'Conference Board Consumer Confidence. Important read on household sentiment after summer inflation data.',
    details: ['Prior: ~97.5', 'Watch: "Jobs hard to get" sub-index', 'Watch: 6-month outlook'],
    impact_note: 'Sharp drop → consumer spending concerns → defensive sector rotation.',
  },
  // ── SEPTEMBER 2026 ──────────────────────────────────────────────────────────
  {
    id: 'e15', date: '2026-09-04', impact: 'high', category: 'jobs',
    title: 'Nonfarm Payrolls (NFP) — August 2026',
    time: 'Sep 4 · 8:30 AM ET',
    desc: 'August jobs report, released the Friday before Labor Day. Last major labor data before the September FOMC decision.',
    details: ['Critical pre-FOMC data point', 'Consensus: ~165K', 'Watch: Any negative revision to prior'],
    impact_note: 'Weak report dramatically increases September rate cut probability.',
  },
  {
    id: 'h2', date: '2026-09-07', impact: 'holiday', category: 'holiday',
    title: 'Labor Day — Market Closed',
    time: 'All Day · Monday',
    desc: 'NYSE & NASDAQ closed for Labor Day. First Monday of September 2026.',
    details: ['NYSE: CLOSED', 'NASDAQ: CLOSED'],
    impact_note: '',
  },
  {
    id: 'e16', date: '2026-09-11', impact: 'high', category: 'inflation',
    title: 'CPI — August 2026',
    time: 'Sep 11 · 8:30 AM ET',
    desc: 'August CPI — the last inflation print before the Sep 15–16 FOMC decision. Will define whether the Fed cuts, holds, or signals a hike.',
    details: ['Most critical inflation print of H2 2026', 'Watch: Month-over-month trend', 'Prior: ~3.2% YoY'],
    impact_note: 'This single print could be the catalyst for the first rate cut in years.',
  },
  {
    id: 'e17', date: '2026-09-15', impact: 'critical', category: 'fed',
    title: 'FOMC Rate Decision — September 2026',
    time: 'Sep 15–16 · Decision at 2:00 PM ET (Sep 16)',
    desc: 'Includes updated Summary of Economic Projections (dot plot) and press conference. Potentially the most significant FOMC of 2026 if inflation has cooled sufficiently.',
    details: ['Dot Plot: YES (updated)', 'Press Conference: YES', 'First possible cut meeting', 'Watch: 2026 and 2027 dot revisions'],
    impact_note: 'First rate cut here = historic rally trigger. Surprise hike = crash risk. This is THE meeting.',
  },
  {
    id: 'e18', date: '2026-09-25', impact: 'medium', category: 'gdp',
    title: 'GDP Q2 2026 — Third Estimate',
    time: 'Sep 25 · 8:30 AM ET',
    desc: 'Final revision to Q2 GDP. Includes comprehensive income, corporate profits, and savings data.',
    details: ['Advance was July 30', 'Final confirmation of Q2 strength/weakness'],
    impact_note: '',
  },
  // ── OCTOBER 2026 ────────────────────────────────────────────────────────────
  {
    id: 'e19', date: '2026-10-02', impact: 'high', category: 'jobs',
    title: 'Nonfarm Payrolls (NFP) — September 2026',
    time: 'Oct 2 · 8:30 AM ET',
    desc: 'September jobs report. First major data point of Q4. Sets tone for the November 4–5 FOMC meeting.',
    details: ['Consensus: ~160K', 'Watch: Post-summer seasonal adjustments'],
    impact_note: '',
  },
  {
    id: 'e20', date: '2026-10-13', impact: 'medium', category: 'earnings',
    title: 'Q3 2026 Earnings Season Begins',
    time: 'Mid-Oct through early Nov',
    desc: 'Major banks kick off Q3 earnings. JPM, GS, MS report first. Tech megacaps (AAPL, MSFT, NVDA, META, AMZN, GOOGL) follow 2–3 weeks later.',
    details: ['Banks: Oct 13–17', 'Tech mega-caps: Oct 27 – Nov 7', 'Watch: AI capex guidance from hyperscalers', 'Watch: Consumer spending trends'],
    impact_note: 'NVDA & MSFT guidance on AI = single biggest market mover of Q4.',
  },
  {
    id: 'e21', date: '2026-10-14', impact: 'high', category: 'inflation',
    title: 'CPI — September 2026',
    time: 'Oct 14 · 8:30 AM ET',
    desc: 'September CPI. Key inflation print for the November FOMC meeting. Midpoint of year-end policy decisions.',
    details: ['Prior: TBD', 'Watch: Energy base effects (Q4)', 'Watch: Services inflation'],
    impact_note: '',
  },
  {
    id: 'e22', date: '2026-10-29', impact: 'high', category: 'gdp',
    title: 'GDP Q3 2026 — Advance Estimate',
    time: 'Oct 29 · 8:30 AM ET',
    desc: 'First look at Q3 2026 economic growth. Ahead of November FOMC. The recession vs. soft-landing debate culminates here.',
    details: ['Consensus: ~2.0%', 'Below 0%: Recession call', 'Above 2.5%: No-cut pressure', 'Watch: Consumer spending sub-component'],
    impact_note: 'Negative Q3 GDP = instant rate cut pricing surge. Strong GDP = hold stays through year-end.',
  },
  // ── NOVEMBER 2026 ───────────────────────────────────────────────────────────
  {
    id: 'e23', date: '2026-11-03', impact: 'critical', category: 'trade',
    title: 'US Midterm Elections',
    time: 'Nov 3 · Election Day (All Day)',
    desc: '2026 midterm elections. Senate and House races determine the legislative balance of power through 2028 — directly impacting fiscal, tax, and regulatory policy.',
    details: ['Senate: 33 seats up for grabs', 'House: All 435 seats contested', 'Watch: Tax policy implications', 'Watch: Defense and healthcare spending'],
    impact_note: 'Election results shift expected fiscal policy. Defense, healthcare, energy stocks most impacted.',
  },
  {
    id: 'e24', date: '2026-11-04', impact: 'critical', category: 'fed',
    title: 'FOMC Rate Decision — November 2026',
    time: 'Nov 4–5 · Decision at 2:00 PM ET (Nov 5)',
    desc: 'Post-election FOMC. The Fed will have full Q3 GDP, October CPI, and election results in hand. A pivotal meeting for the 2026 year-end policy path.',
    details: ['Dot Plot: NOT updated', 'Press Conference: YES', 'Watch: Election policy uncertainty language', 'Back-to-back with election results'],
    impact_note: 'Back-to-back political + monetary policy catalysts within 48 hours.',
  },
  {
    id: 'e25', date: '2026-11-06', impact: 'high', category: 'jobs',
    title: 'Nonfarm Payrolls (NFP) — October 2026',
    time: 'Nov 6 · 8:30 AM ET',
    desc: 'October jobs report — released just 1 day after the FOMC decision. The window Nov 3–6 features elections, FOMC, and NFP — extreme volatility expected.',
    details: ['Consensus: ~155K', 'EXTREME volatility window: Nov 3–6', 'Watch: 3-way catalyst compound effect'],
    impact_note: 'Triple catalyst window: Elections + FOMC + Jobs within 4 trading days.',
  },
  {
    id: 'e26', date: '2026-11-12', impact: 'high', category: 'inflation',
    title: 'CPI — October 2026',
    time: 'Nov 12 · 8:30 AM ET',
    desc: 'October CPI. Last full inflation print before the December FOMC decision. Sets the year-end inflation narrative.',
    details: ['Prior: TBD', 'Year-end inflation trend setter', 'Watch: Holiday demand seasonal effects'],
    impact_note: '',
  },
  {
    id: 'h3', date: '2026-11-26', impact: 'holiday', category: 'holiday',
    title: 'Thanksgiving Day — Market Closed',
    time: 'All Day · Thursday',
    desc: 'NYSE & NASDAQ closed for Thanksgiving. 4th Thursday of November 2026.',
    details: ['NYSE: CLOSED', 'NASDAQ: CLOSED'],
    impact_note: '',
  },
  {
    id: 'h4', date: '2026-11-27', impact: 'holiday', category: 'holiday',
    title: 'Day After Thanksgiving — Early Close 1 PM ET',
    time: 'Closes 1:00 PM ET · Friday',
    desc: 'NYSE & NASDAQ close at 1:00 PM ET. Historically the lowest-volume trading day of the year. Avoid reading too much into price moves.',
    details: ['NYSE: Closes 1:00 PM ET', 'NASDAQ: Closes 1:00 PM ET', 'Volume: Historically very thin'],
    impact_note: 'Low liquidity = exaggerated moves. Not a reliable signal for direction.',
  },
  // ── DECEMBER 2026 ───────────────────────────────────────────────────────────
  {
    id: 'e27', date: '2026-12-04', impact: 'high', category: 'jobs',
    title: 'Nonfarm Payrolls (NFP) — November 2026',
    time: 'Dec 4 · 8:30 AM ET',
    desc: 'November jobs report. Last major labor data before the December FOMC year-end decision.',
    details: ['Year-end labor market read', 'Consensus: ~150K', 'Watch: Holiday hiring seasonal boost'],
    impact_note: '',
  },
  {
    id: 'e28', date: '2026-12-08', impact: 'critical', category: 'fed',
    title: 'FOMC Rate Decision — December 2026 (Year-End)',
    time: 'Dec 8–9 · Decision at 2:00 PM ET (Dec 9)',
    desc: "The year's final FOMC meeting. Includes updated dot plot with 2027 rate projections and quarterly economic forecasts. Markets will price the entire 2027 rate path off this decision.",
    details: ['Dot Plot: YES (2027 projections)', 'Press Conference: YES', '2027 rate path: Critically important', 'SEP projections fully updated'],
    impact_note: 'Year-end rate path sets the 2027 market narrative. Most consequential December FOMC in years.',
  },
  {
    id: 'e29', date: '2026-12-11', impact: 'high', category: 'inflation',
    title: 'CPI — November 2026',
    time: 'Dec 11 · 8:30 AM ET',
    desc: 'November CPI — released 2 days after the December FOMC decision. Sets the final 2026 inflation scorecard and 2027 narrative.',
    details: ['Consensus: TBD', 'Year-end inflation scorecard', 'Watch: Holiday demand effects on goods'],
    impact_note: '',
  },
  {
    id: 'h5', date: '2026-12-25', impact: 'holiday', category: 'holiday',
    title: 'Christmas Day — Market Closed',
    time: 'All Day · Friday',
    desc: 'NYSE & NASDAQ closed for Christmas Day. December 25 falls on a Friday in 2026.',
    details: ['NYSE: CLOSED', 'NASDAQ: CLOSED', 'Bond Market: CLOSED'],
    impact_note: '',
  },
  {
    id: 'e30', date: '2026-12-31', impact: 'medium', category: 'consumer',
    title: 'Year-End Window Dressing & Rebalancing',
    time: 'Dec 31 · All Day (Normal Close 4 PM ET)',
    desc: 'Final trading day of 2026. Institutional investors rebalance and window-dress portfolios. Tax-loss harvesting wraps up. Historically thin volume can amplify moves.',
    details: ['Watch: Tax-loss harvesting selloffs', 'Watch: Fund rebalancing flows', 'Watch: January effect pre-positioning', 'Markets close at 4 PM ET normally'],
    impact_note: 'Unusual moves in small/mid caps are common in final days. Not a fundamental signal.',
  },
]

// ─── NYSE Holidays 2026 full list ─────────────────────────────────────────────
const HOLIDAYS_2026 = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-01-19', name: 'MLK Jr. Day' },
  { date: '2026-02-16', name: "Presidents' Day" },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-05-25', name: 'Memorial Day' },
  { date: '2026-07-03', name: 'Independence Day (obs.)' },
  { date: '2026-09-07', name: 'Labor Day' },
  { date: '2026-11-26', name: 'Thanksgiving' },
  { date: '2026-12-25', name: 'Christmas' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TODAY = '2026-06-16'

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatMonthYear(year, month) {
  return new Date(year, month, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

function toDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// ─── Event Card ───────────────────────────────────────────────────────────────
function EventCard({ event }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = IMPACT[event.impact]
  const cat = CAT[event.category]
  const dateObj = parseDate(event.date)
  const today = parseDate(TODAY)
  const isToday = event.date === TODAY
  const isPast = dateObj < today && !isToday

  const dayName = dateObj.toLocaleString('en-US', { weekday: 'short' })
  const dayNum  = dateObj.getDate()
  const monthShort = dateObj.toLocaleString('en-US', { month: 'short' })

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      className={`
        relative flex gap-2 md:gap-3 rounded-xl border-l-4 p-2.5 md:p-3.5 mb-2 cursor-pointer
        transition-all duration-150 hover:shadow-md select-none
        ${cfg.border}
        ${isToday
          ? 'bg-yellow-50 shadow-md ring-2 ring-yellow-300'
          : event.impact === 'holiday'
          ? 'bg-slate-50'
          : cfg.cardBg}
        ${isPast ? 'opacity-55' : ''}
      `}
    >
      {/* Date block */}
      <div className={`flex-shrink-0 w-12 md:w-14 text-center rounded-lg py-1.5 ${isToday ? 'bg-yellow-200' : 'bg-white border border-slate-200'}`}>
        <div className="text-xs font-bold uppercase text-slate-500 leading-tight">{dayName}</div>
        <div className={`text-lg md:text-xl font-black leading-tight ${isToday ? 'text-yellow-700' : 'text-slate-800'}`}>{dayNum}</div>
        <div className="text-xs font-semibold text-slate-500 uppercase leading-tight">{monthShort}</div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
            {cfg.icon} {cfg.label}
          </span>
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cat.color}`}>
            {cat.icon} {cat.label}
          </span>
          {isToday && (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-400 text-yellow-900 animate-pulse">
              ⚡ TODAY
            </span>
          )}
          {isPast && (
            <span className="text-xs text-slate-400 font-medium px-1">✓ Past</span>
          )}
        </div>

        <div className="font-bold text-slate-900 text-sm mt-1.5 leading-snug pr-4">{event.title}</div>
        <div className="text-xs text-slate-500 mt-0.5">{event.time}</div>

        {expanded && (
          <div className="mt-2.5 space-y-2">
            <p className="text-xs text-slate-600 leading-relaxed">{event.desc}</p>
            {event.details?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {event.details.map((d, i) => (
                  <span key={i} className="text-xs bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-700">{d}</span>
                ))}
              </div>
            )}
            {event.impact_note && (
              <div className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 ${cfg.pill}`}>
                💡 {event.impact_note}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expand toggle */}
      <div className="absolute top-3.5 right-3 text-slate-300 text-xs">{expanded ? '▲' : '▼'}</div>
    </div>
  )
}

// ─── Mini Calendar ────────────────────────────────────────────────────────────
function MiniCalendar({ year, month, events, onSelectDate, selectedDate }) {
  const eventsByDate = useMemo(() => {
    const map = {}
    events.forEach(e => {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    })
    return map
  }, [events])

  const days = daysInMonth(year, month)
  const firstDay = firstDayOfMonth(year, month)

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= days; d++) cells.push(d)

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-center text-xs font-bold text-slate-400 py-1">{d}</div>
        ))}
      </div>
      <div className="space-y-0.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-0.5">
            {week.map((day, di) => {
              if (!day) return <div key={di} />
              const dateStr = toDateStr(year, month, day)
              const evts = eventsByDate[dateStr] || []
              const isToday = dateStr === TODAY
              const isSelected = dateStr === selectedDate
              const impactPriority = evts.find(e => e.impact === 'critical') ? 'critical'
                : evts.find(e => e.impact === 'high') ? 'high'
                : evts.find(e => e.impact === 'medium') ? 'medium'
                : evts.find(e => e.impact === 'holiday') ? 'holiday'
                : null

              return (
                <button
                  key={di}
                  onClick={() => onSelectDate(dateStr)}
                  className={`
                    relative flex flex-col items-center py-1 rounded-lg text-xs font-semibold transition-all
                    ${isToday ? 'bg-yellow-400 text-yellow-900 font-black' : ''}
                    ${isSelected && !isToday ? 'bg-indigo-100 text-indigo-800 ring-2 ring-indigo-400' : ''}
                    ${!isToday && !isSelected ? 'hover:bg-slate-100 text-slate-700' : ''}
                  `}
                >
                  {day}
                  {impactPriority && (
                    <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${IMPACT[impactPriority].dot}`} />
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const todayObj = parseDate(TODAY)
  const [viewYear, setViewYear]     = useState(todayObj.getFullYear())
  const [viewMonth, setViewMonth]   = useState(todayObj.getMonth())
  const [filter, setFilter]         = useState('all')
  const [selectedDate, setSelectedDate] = useState(null)
  const [listScope, setListScope]   = useState('upcoming')

  // Stats: count upcoming events by impact
  const counts = useMemo(() => {
    const today = parseDate(TODAY)
    return EVENTS.reduce((acc, e) => {
      if (parseDate(e.date) >= today) acc[e.impact] = (acc[e.impact] || 0) + 1
      return acc
    }, {})
  }, [])

  // Events for the displayed calendar month
  const monthStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
  const monthEvents = useMemo(() => EVENTS.filter(e => e.date.startsWith(monthStr)), [monthStr])

  // Filtered list
  const listEvents = useMemo(() => {
    const today = parseDate(TODAY)
    let evts = [...EVENTS]

    if (listScope === 'upcoming')   evts = evts.filter(e => parseDate(e.date) >= today)
    else if (listScope === 'thismonth') evts = evts.filter(e => e.date.startsWith(monthStr))

    if (filter !== 'all') evts = evts.filter(e => e.impact === filter)
    if (selectedDate)     evts = evts.filter(e => e.date === selectedDate)

    return evts.sort((a, b) => a.date.localeCompare(b.date))
  }, [filter, listScope, selectedDate, monthStr])

  const todayEvents = EVENTS.filter(e => e.date === TODAY)

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const FILTERS = [
    { key: 'all',      label: 'All Events',  active: 'bg-slate-800 text-white',    inactive: 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50' },
    { key: 'critical', label: '🚨 Critical', active: 'bg-purple-600 text-white',   inactive: 'bg-white border border-purple-200 text-purple-700 hover:bg-purple-50' },
    { key: 'high',     label: '🔴 High',     active: 'bg-red-500 text-white',      inactive: 'bg-white border border-red-200 text-red-600 hover:bg-red-50' },
    { key: 'medium',   label: '🟡 Medium',   active: 'bg-amber-500 text-white',    inactive: 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-50' },
    { key: 'holiday',  label: '🏛️ Holidays', active: 'bg-slate-500 text-white',    inactive: 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50' },
  ]

  return (
    <div className="space-y-4">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Market Event Calendar</h1>
          <p className="text-sm text-slate-500 mt-0.5">Critical, High &amp; Medium impact events · NYSE Holidays · 2026</p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Today</div>
          <div className="text-sm font-black text-indigo-700">June 16, 2026</div>
        </div>
      </div>

      {/* ── TODAY alert ── */}
      {todayEvents.length > 0 && (
        <div className="rounded-2xl overflow-hidden border-2 border-yellow-400 shadow-lg">
          <div className="bg-yellow-400 px-4 py-2 flex items-center gap-2">
            <span className="text-lg animate-pulse">⚡</span>
            <span className="font-black text-yellow-900 text-sm uppercase tracking-wide">
              Today — {todayEvents.length} market-moving event{todayEvents.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="bg-yellow-50 px-4 pb-3 pt-2 space-y-1.5">
            {todayEvents.map(e => (
              <div key={e.id} className="flex items-start gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${IMPACT[e.impact].dot}`} />
                <div>
                  <div className="font-bold text-sm text-slate-800">{e.title}</div>
                  <div className="text-xs text-slate-500">{e.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}



      {/* ── Main: calendar + list ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 items-start">

        {/* Left: calendar — pushed below events on mobile via order */}
        <div className="space-y-3 order-2 lg:order-1">
          {/* Month nav */}
          <div className="flex items-center justify-between">
            <button onClick={prevMonth} className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600 text-base font-bold shadow-sm">‹</button>
            <span className="text-sm font-black text-slate-800">{formatMonthYear(viewYear, viewMonth)}</span>
            <button onClick={nextMonth} className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600 text-base font-bold shadow-sm">›</button>
          </div>

          <MiniCalendar
            year={viewYear}
            month={viewMonth}
            events={EVENTS}
            selectedDate={selectedDate}
            onSelectDate={(d) => {
              setSelectedDate(prev => prev === d ? null : d)
              if (selectedDate !== d) setListScope('all')
            }}
          />

          {/* Legend */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2">
            <div className="text-xs font-black text-slate-600 uppercase tracking-wider mb-1">Impact Legend</div>
            {[
              { k: 'critical', desc: 'Systemic — moves all markets' },
              { k: 'high',     desc: 'Major volatility expected' },
              { k: 'medium',   desc: 'Moderate market impact' },
              { k: 'holiday',  desc: 'Market closed — no trading' },
            ].map(({ k, desc }) => (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${IMPACT[k].dot}`} />
                <span className={`font-bold w-16 ${IMPACT[k].textColor}`}>{IMPACT[k].label}</span>
                <span className="text-slate-500">{desc}</span>
              </div>
            ))}
          </div>

          {/* Categories */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5">
            <div className="text-xs font-black text-slate-600 uppercase tracking-wider mb-2">Event Categories</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(CAT).map(([k, v]) => (
                <span key={k} className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${v.color}`}>
                  {v.icon} {v.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right: event list — shown first on mobile */}
        <div className="order-1 lg:order-2">
          {/* Filters */}
          <div className="space-y-2 mb-3">
            {/* Impact filters */}
            <div className="flex flex-wrap gap-1">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => { setFilter(f.key); setSelectedDate(null) }}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all ${filter === f.key ? f.active : f.inactive}`}
                >
                  {f.label}
                  {f.key !== 'all' && counts[f.key] > 0
                    ? <span className="ml-1 opacity-70">({counts[f.key]})</span>
                    : null}
                </button>
              ))}
            </div>
            {/* Scope switcher — full width row on mobile */}
            <div className="flex gap-1">
              {[
                { key: 'upcoming',  label: 'Upcoming' },
                { key: 'thismonth', label: 'This Month' },
                { key: 'all',       label: 'All 2026' },
              ].map(s => (
                <button
                  key={s.key}
                  onClick={() => { setListScope(s.key); setSelectedDate(null) }}
                  className={`flex-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all text-center ${listScope === s.key ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date filter banner */}
          {selectedDate && (
            <div className="mb-2 flex items-center gap-2 text-xs text-indigo-700 font-semibold bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
              📅 Showing: {parseDate(selectedDate).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              <button onClick={() => { setSelectedDate(null); setListScope('upcoming') }} className="ml-auto text-indigo-400 hover:text-indigo-700 font-bold">✕ Clear</button>
            </div>
          )}

          {/* Events */}
          {listEvents.length === 0 ? (
            <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
              <div className="text-4xl mb-3">📭</div>
              <div className="font-semibold text-slate-600">No events match your filters</div>
              <button
                onClick={() => { setFilter('all'); setSelectedDate(null); setListScope('upcoming') }}
                className="mt-3 text-sm text-indigo-600 underline"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <>
              {(() => {
                // Group by month
                const groups = {}
                listEvents.forEach(e => {
                  const key = e.date.slice(0, 7)
                  if (!groups[key]) groups[key] = []
                  groups[key].push(e)
                })
                return Object.entries(groups).map(([monthKey, evts]) => {
                  const [y, m] = monthKey.split('-').map(Number)
                  const label = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
                  const isCurrent = monthKey === `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}`
                  return (
                    <div key={monthKey}>
                      <div className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest mb-2 mt-3 first:mt-0 ${isCurrent ? 'text-indigo-600' : 'text-slate-400'}`}>
                        <div className={`h-px flex-1 ${isCurrent ? 'bg-indigo-200' : 'bg-slate-200'}`} />
                        {label}
                        {isCurrent && (
                          <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs normal-case font-bold">Current</span>
                        )}
                        <div className={`h-px flex-1 ${isCurrent ? 'bg-indigo-200' : 'bg-slate-200'}`} />
                      </div>
                      {evts.map(e => <EventCard key={e.id} event={e} />)}
                    </div>
                  )
                })
              })()}
              <div className="text-center text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">
                {listEvents.length} event{listEvents.length !== 1 ? 's' : ''} shown · Click any card to expand details
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Disclaimer ── */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500 leading-relaxed">
        ⚠️ Event dates are estimates based on historical release schedules and may shift. Always verify with{' '}
        <a href="https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm" target="_blank" rel="noreferrer" className="text-indigo-600 underline">FederalReserve.gov</a>,{' '}
        <a href="https://www.bls.gov/schedule/news_release/cpi.htm" target="_blank" rel="noreferrer" className="text-indigo-600 underline">BLS.gov</a>, and{' '}
        <a href="https://www.nyse.com/markets/hours-calendars" target="_blank" rel="noreferrer" className="text-indigo-600 underline">NYSE.com</a>.
        Not financial advice.
      </div>
    </div>
  )
}
