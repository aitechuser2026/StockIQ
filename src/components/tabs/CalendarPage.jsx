import React, { useState, useMemo } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// IMPACT CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const IMPACT = {
  critical: {
    label: 'CRITICAL', dot: 'bg-purple-500',
    border: 'border-l-purple-600', ring: 'ring-purple-200',
    badge: 'bg-purple-600 text-white',
    pill:  'bg-purple-100 text-purple-800 border border-purple-200',
    tag:   'bg-purple-50 text-purple-700',
    glow:  'shadow-purple-100',
    icon:  '🚨', headerBg: 'bg-purple-900/30',
  },
  high: {
    label: 'HIGH', dot: 'bg-red-500',
    border: 'border-l-red-500', ring: 'ring-red-200',
    badge: 'bg-red-500 text-white',
    pill:  'bg-red-100 text-red-800 border border-red-200',
    tag:   'bg-red-50 text-red-700',
    glow:  'shadow-red-100',
    icon:  '🔴', headerBg: 'bg-red-900/20',
  },
  medium: {
    label: 'MEDIUM', dot: 'bg-amber-400',
    border: 'border-l-amber-400', ring: 'ring-amber-200',
    badge: 'bg-amber-400 text-white',
    pill:  'bg-amber-100 text-amber-800 border border-amber-200',
    tag:   'bg-amber-50 text-amber-700',
    glow:  'shadow-amber-100',
    icon:  '🟡', headerBg: 'bg-amber-900/10',
  },
  low: {
    label: 'LOW', dot: 'bg-emerald-400',
    border: 'border-l-emerald-400', ring: 'ring-emerald-200',
    badge: 'bg-emerald-500 text-white',
    pill:  'bg-emerald-100 text-emerald-800 border border-emerald-200',
    tag:   'bg-emerald-50 text-emerald-700',
    glow:  'shadow-emerald-100',
    icon:  '🟢', headerBg: 'bg-emerald-900/10',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENTS DATA
// ─────────────────────────────────────────────────────────────────────────────
const EVENTS = {
  '2026-05-12': [
    { impact:'high', emoji:'🔴', title:'CPI — April 2026', time:'8:30 AM ET', status:'released',
      desc:'Headline YoY +3.7% — hotter than expected. Rate cut hopes faded. Bond yields rose. Tech initially pressured but AI rally continued.',
      data:['Headline YoY: +3.7% (above 3.4% est)','Core YoY: +2.7%','MoM: +0.6%'],
      marketImpact:'📉 Hotter than expected → Rate cut hopes faded → Bond yields rose.' },
  ],
  '2026-05-13': [
    { impact:'high', emoji:'🔴', title:'PPI — April 2026', time:'8:30 AM ET', status:'released',
      desc:'Wholesale inflation validates producer-level price pressures. Largest monthly jump in 4 years.',
      data:['Result: Largest monthly jump in 4 years','Signal: Hawkish — more inflation ahead'],
      marketImpact:'📉 Confirmed sticky inflation. Rate cut in June now very unlikely.' },
    { impact:'high', emoji:'🔴', title:'Warsh Confirmed as Fed Chair', time:'Senate Vote', status:'released',
      desc:'Kevin Warsh confirmed, replacing Powell. Watch for first public statements on rate policy. Warsh seen as hawkish but data-dependent.',
      data:['New Chair: Kevin Warsh','Previous: Jerome Powell','Next FOMC: June 16–17'],
      marketImpact:"⚠️ Transition uncertainty. Watch for Warsh's first public statements." },
    { impact:'medium', emoji:'🟡', title:'CSCO & BABA Earnings', time:'After Close', status:'released',
      desc:'Cisco = enterprise AI networking proxy. Alibaba = China tech bellwether. Options priced ±5.9% on BABA.',
      data:['CSCO EPS Consensus: $0.92','BABA Revenue: ~$36B','BABA Options Move: ±5.9%'] },
  ],
  '2026-05-14': [
    { impact:'high', emoji:'🔴', title:'Retail Sales — April 2026', time:'8:30 AM ET', status:'released',
      desc:'Direct read on US consumer spending post energy spike. Key input for Fed rate path.',
      data:['Consensus: +0.5% MoM','Prior: +0.9% MoM'],
      marketImpact:'📊 Watch follow-through in consumer/retail stocks.' },
    { impact:'high', emoji:'🔴', title:'AMAT Earnings', time:'After Close', status:'released',
      desc:'Applied Materials — 6–12 month leading indicator for semiconductor capex. Directly impacts NVDA, TSM.',
      data:['EPS Consensus: $2.68 (+12% YoY)','Options Move: ±8.7%','Affects: NVDA, TSM, AMAT'],
      marketImpact:'📊 AMAT reaction setting tone for NVDA, TSM in coming sessions.' },
    { impact:'high', emoji:'🔴', title:'Trump–Xi Summit Day 1', time:'Beijing', status:'released',
      desc:'Trade truce, AI guardrails, chip export bans on agenda. Biggest geopolitical wildcard for tech sector.',
      data:['Key Issue: Chip export bans','Key Issue: AI guardrails','Key Issue: Trade truce'],
      marketImpact:'🌐 Positive = NVDA/TSM surge. Breakdown = Broad tech selloff.' },
  ],
  '2026-05-15': [
    { impact:'critical', emoji:'🚨', title:'Trump–Xi Summit — Final Day', time:'All Day', status:'released',
      desc:'Final communiqué expected. Outcome directly impacts chip export restrictions and US-China trade truce.',
      data:['Final communiqué expected','Chip export ban outcome','AI guardrails agreement?'],
      marketImpact:'🌐 Positive outcome → NVDA, TSM surge. Breakdown → Broad tech selloff.' },
    { impact:'high', emoji:'🔴', title:'UMich Consumer Sentiment', time:'10:00 AM ET', status:'released',
      desc:'Preliminary read on consumer confidence. 1-yr & 5-yr inflation expectations are key. First major data under new Chair Warsh.',
      data:['Watch: Inflation Expectations','Prior: 52.2','Consensus: ~54','Inflation exp >4% = hawkish'],
      marketImpact:'⚡ First major read under new Chair Warsh. High sensitivity.' },
    { impact:'medium', emoji:'🟡', title:'Powell Term Ends — Warsh Era Begins', time:'End of Day', status:'released',
      desc:"Jerome Powell's term officially ends. Kevin Warsh's first remarks as Chair will set tone for bond markets.",
      data:['Warsh takes chair today','Watch for any public comments','Next FOMC: June 16–17'],
      marketImpact:"⚡ Watch for any Warsh remarks — first words as Chair will set bond market tone." },
  ],
  '2026-05-18': [
    { impact:'medium', emoji:'🟡', title:'Warsh — First Full Week as Fed Chair', time:'All Week', status:'upcoming',
      desc:'Any Warsh speeches or Fed governor comments dissected for shifts from Powell era.',
      data:['Watch: Warsh speech schedule','Watch: Fed governor commentary'] },
  ],
  '2026-05-19': [
    { impact:'medium', emoji:'🟡', title:'Housing Starts & Permits — April', time:'8:30 AM ET', status:'upcoming',
      desc:'New residential construction. Key for lumber, homebuilders (LEN, DHI). High rates crushing affordability.',
      data:['Consensus: ~1.3M annualized','Affects: XHB, LEN, DHI'] },
  ],
  '2026-05-20': [
    { impact:'high', emoji:'🔴', title:'FOMC April Meeting Minutes', time:'2:00 PM ET', status:'upcoming',
      desc:'Reveals dissenting voter arguments, debate over rate hikes, and how many members favor a June cut vs. hold vs. hike.',
      data:['Context: 3 voters ready to dissent','Watch: Language on "further hikes"','Watch: Inflation threshold debate'],
      marketImpact:'🔴 HIGH IMPACT: Minutes will set expectations for the June rate decision.' },
  ],
  '2026-05-21': [
    { impact:'medium', emoji:'🟡', title:'Weekly Jobless Claims + Philly Fed', time:'8:30 AM ET', status:'upcoming',
      desc:'Weekly labor market pulse. Philadelphia Fed Index = mid-Atlantic manufacturing outlook.',
      data:['Claims Consensus: ~215K','Philly Fed Prior: 8.5'] },
  ],
  '2026-05-22': [
    { impact:'medium', emoji:'🟡', title:'S&P Global Flash PMI', time:'9:45 AM ET', status:'upcoming',
      desc:'First look at May business activity. PMI above 50 = expansion. Services PMI important for sticky services inflation.',
      data:['Services Prior: 54.4','Manufacturing Prior: 50.2','Above 50 = Expansion'] },
  ],
  '2026-05-27': [
    { impact:'low', emoji:'🟢', title:'Markets Closed — Memorial Day', time:'All Day', status:'upcoming',
      desc:'US equity markets closed for Memorial Day. No trading. Low liquidity pre/post holiday.',
      data:['NYSE & NASDAQ: Closed','Futures: Limited trading'] },
  ],
  '2026-05-28': [
    { impact:'high', emoji:'🔴', title:'GDP Q1 2026 — Second Estimate', time:'8:30 AM ET', status:'upcoming',
      desc:'Revised Q1 GDP growth. Includes updated consumer spending, business investment, trade balance.',
      data:['First Estimate: +2.1% annualized','Watch: Consumer spending sub-component'],
      marketImpact:'📊 Downward revision could revive rate cut hopes ahead of June FOMC.' },
  ],
  '2026-05-29': [
    { impact:'medium', emoji:'🟡', title:'PCE Price Index — April 2026', time:'8:30 AM ET', status:'upcoming',
      desc:"Fed's preferred inflation gauge. Core PCE is the key metric watched by FOMC when setting rates.",
      data:['Prior Core PCE YoY: 2.6%','Target: 2.0%','Critical for June FOMC'] },
  ],
  '2026-06-04': [
    { impact:'medium', emoji:'🟡', title:'ISM Services PMI — May', time:'10:00 AM ET', status:'upcoming',
      desc:'Services sector activity indicator. Services make up ~80% of US economy.',
      data:['Above 50 = Expansion','Services ~80% of US economy'] },
  ],
  '2026-06-06': [
    { impact:'high', emoji:'🔴', title:'May Jobs Report (NFP)', time:'8:30 AM ET', status:'upcoming',
      desc:'Non-Farm Payrolls. Strong jobs = Fed holds rates. Weak jobs = opens door for rate cut.',
      data:['Strong jobs = Fed holds','Weak jobs = Rate cut possible'],
      marketImpact:'📊 Key input for June FOMC decision on June 16–17.' },
  ],
  '2026-06-11': [
    { impact:'high', emoji:'🔴', title:'CPI — May 2026', time:'8:30 AM ET', status:'upcoming',
      desc:'Last major inflation data point before the June 16–17 FOMC rate decision. Markets will be very sensitive.',
      data:['Prior: 3.7% YoY','Last data before June FOMC'],
      marketImpact:'🔴 Most sensitive pre-FOMC data point. Any surprise = large moves.' },
  ],
  '2026-06-16': [
    { impact:'critical', emoji:'🚨', title:'FOMC Rate Decision — Day 1', time:'All Day', status:'upcoming',
      desc:"MOST IMPORTANT event of Q2. Current rate: 4.75–5.00%. Warsh's first rate decision as Fed Chair.",
      data:['Current Rate: 4.75–5.00%','Cut Probability: ~15%','Hold Probability: ~75%','Hike Probability: ~10%'],
      marketImpact:'🔴 CRITICAL: Most consequential market event of Q2.' },
  ],
  '2026-06-17': [
    { impact:'critical', emoji:'🚨', title:'FOMC Decision + Warsh Press Conference', time:'2:00 PM ET', status:'upcoming',
      desc:'Rate decision announced at 2 PM ET. Warsh press conference at 2:30 PM ET. Every word will be parsed for future rate path.',
      data:['Decision: 2:00 PM ET','Press Conf: 2:30 PM ET','Rate hike = broad selloff','Hold + dovish = rally'],
      marketImpact:"🚨 Biggest market-moving event of Q2. Warsh's tone defines H2 2026 direction." },
  ],
  '2026-06-18': [
    { impact:'medium', emoji:'🟡', title:'Options Expiration (OPEX)', time:'All Day', status:'upcoming',
      desc:'Major quarterly options expiration. Large gamma exposure can cause unusual price action.',
      data:['Quarterly OPEX','High gamma = volatility possible'] },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_ABBR    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const IMPACT_ORDER = ['critical','high','medium','low']

const TODAY_KEY = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) || '2026-05-17'

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function buildMonth(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
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

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  if (status === 'released') return (
    <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
      ✅ RELEASED
    </span>
  )
  if (status === 'today') return (
    <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
      ⚡ TODAY
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
      🔔 UPCOMING
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT CARD
// ─────────────────────────────────────────────────────────────────────────────
function EventCard({ ev, showDate, dateKey: dk }) {
  const [expanded, setExpanded] = useState(false)
  const imp = IMPACT[ev.impact]

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden border-l-4 ${imp.border} hover:shadow-md transition-all duration-200`}>
      {/* Card header */}
      <div className="px-4 pt-3.5 pb-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <span className="text-xl flex-shrink-0 mt-0.5">{ev.emoji}</span>
            <div className="min-w-0">
              {showDate && dk && (
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{fmtDateShort(dk)}</div>
              )}
              <div className="font-black text-slate-900 text-sm leading-snug">{ev.title}</div>
              <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${imp.badge}`}>{imp.label}</span>
                <StatusBadge status={ev.status} />
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg whitespace-nowrap">
              🕐 {ev.time}
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="px-4 pb-2.5">
        <p className="text-xs text-slate-600 leading-relaxed">{ev.desc}</p>
      </div>

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
      {/* Day labels */}
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
        {DAY_ABBR.map(d => (
          <div key={d} className="text-center text-[9px] font-black text-slate-400 py-2 uppercase tracking-wider">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) {
            return <div key={`e-${i}`} className="aspect-square bg-slate-50/40 border-r border-b border-slate-100" />
          }
          const key = dateKey(month.year, month.month, day)
          const dayEvents = EVENTS[key] || []
          const impact    = topImpact(dayEvents)
          const imp       = impact ? IMPACT[impact] : null
          const isToday   = key === TODAY_KEY
          const isSel     = selectedKey === key
          const isWeekend = (i % 7 === 0) || (i % 7 === 6)
          const hasEvents = dayEvents.length > 0

          return (
            <div
              key={key}
              onClick={() => hasEvents && onSelect(key)}
              className={[
                'aspect-square border-r border-b border-slate-100 transition-all duration-150 relative flex flex-col items-center justify-start pt-1.5 pb-1',
                hasEvents ? 'cursor-pointer' : '',
                isSel ? 'bg-slate-900' : isToday ? 'bg-blue-50' : hasEvents ? 'hover:bg-slate-50' : isWeekend ? 'bg-slate-50/30' : 'bg-white',
              ].filter(Boolean).join(' ')}
            >
              {/* Day number */}
              <span className={[
                'text-xs font-black w-6 h-6 flex items-center justify-center rounded-full',
                isSel    ? 'bg-white text-slate-900' :
                isToday  ? 'bg-blue-600 text-white shadow-sm' :
                isWeekend ? 'text-slate-400' : 'text-slate-700',
              ].join(' ')}>
                {day}
              </span>

              {/* Event dots */}
              {dayEvents.length > 0 && (
                <div className="flex gap-0.5 mt-1 flex-wrap justify-center px-0.5">
                  {dayEvents.slice(0, 3).map((ev, j) => (
                    <div key={j} className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isSel ? 'bg-white/60' : IMPACT[ev.impact].dot}`} />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className={`text-[7px] font-black ${isSel ? 'text-white/60' : 'text-slate-400'}`}>+{dayEvents.length - 3}</span>
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
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const [selectedKey, setSelectedKey] = useState(null)
  const [viewRange,   setViewRange]   = useState('week')   // 'week' | 'twoweek' | 'month'
  const [impFilter,   setImpFilter]   = useState('all')    // 'all' | impact level
  const [calMonth,    setCalMonth]    = useState(() => {
    const d = new Date(TODAY_KEY + 'T12:00:00')
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  // Navigate months
  const goPrev = () => setCalMonth(m => { const d = new Date(m.year, m.month - 1, 1); return { year: d.getFullYear(), month: d.getMonth() } })
  const goNext = () => setCalMonth(m => { const d = new Date(m.year, m.month + 1, 1); return { year: d.getFullYear(), month: d.getMonth() } })

  // All sorted event entries
  const allEntries = useMemo(() =>
    Object.entries(EVENTS).sort(([a], [b]) => a.localeCompare(b)),
  [])

  // Stats
  const stats = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, total: 0 }
    allEntries.forEach(([, evs]) => evs.forEach(ev => { counts[ev.impact]++; counts.total++ }))
    const upcoming = allEntries.find(([key]) => key >= TODAY_KEY)
    return { ...counts, nextEvent: upcoming ? { key: upcoming[0], ev: upcoming[1][0] } : null }
  }, [allEntries])

  // Range entries (for timeline view)
  const rangeEntries = useMemo(() => {
    const today = new Date(TODAY_KEY + 'T12:00:00')
    const days   = viewRange === 'week' ? 7 : viewRange === 'twoweek' ? 14 : 31
    return allEntries.filter(([key]) => {
      const d = new Date(key + 'T12:00:00')
      const diff = Math.floor((d - today) / 86400000)
      return diff >= -1 && diff < days  // include yesterday to show "today" events
    })
  }, [allEntries, viewRange])

  // Selected day events
  const selectedEvents = selectedKey ? (EVENTS[selectedKey] || []) : []

  // Filtered events for display
  const filterEvs = evs => impFilter === 'all' ? evs : evs.filter(e => e.impact === impFilter)

  const handleSelect = (key) => {
    setSelectedKey(prev => prev === key ? null : key)
  }

  const rangeLabel = viewRange === 'week' ? '7 Days' : viewRange === 'twoweek' ? '14 Days' : '31 Days'

  return (
    <div className="space-y-4">

      {/* ── HEADER ── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl px-5 py-5 text-white shadow-xl">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight">🗓️ Market Calendar</h2>
            <p className="text-slate-400 text-sm mt-1">Fed · Earnings · Economic Data · Geopolitical Events</p>
            <div className="flex flex-wrap gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                <span className="text-xs font-black text-purple-300">{stats.critical} Critical</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span className="text-xs font-black text-red-300">{stats.high} High</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span className="text-xs font-black text-amber-300">{stats.medium} Medium</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="text-xs font-black text-emerald-300">{stats.low} Low</span>
              </div>
              <div className="text-slate-400 text-xs">|</div>
              <span className="text-xs font-bold text-slate-300">{stats.total} total events tracked</span>
            </div>
          </div>

          {/* Next big event callout */}
          {stats.nextEvent && (
            <div className="bg-white/10 rounded-xl px-4 py-3 border border-white/10 flex-shrink-0">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Next Major Event</div>
              <div className="text-sm font-black text-white">{stats.nextEvent.ev.title}</div>
              <div className="text-xs text-slate-400 mt-0.5">{fmtDateShort(stats.nextEvent.key)} · {stats.nextEvent.ev.time}</div>
            </div>
          )}
        </div>
      </div>

      {/* ── FILTER + VIEW BAR ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-black text-slate-500 uppercase">Range:</span>
          {[['week','7 Days'],['twoweek','14 Days'],['month','31 Days']].map(([v, l]) => (
            <button key={v} onClick={() => { setViewRange(v); setSelectedKey(null) }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${viewRange === v && !selectedKey ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {l}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-slate-200" />

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-black text-slate-500 uppercase">Filter:</span>
          {[['all','All Events'], ...IMPACT_ORDER.map(k => [k, IMPACT[k].label])].map(([v, l]) => (
            <button key={v} onClick={() => setImpFilter(v)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                impFilter === v
                  ? v === 'all' ? 'bg-slate-900 text-white' : `${IMPACT[v]?.badge || 'bg-slate-900 text-white'}`
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {v !== 'all' && IMPACT[v]?.icon} {l}
            </button>
          ))}
        </div>

        {selectedKey && (
          <>
            <div className="w-px h-5 bg-slate-200" />
            <button onClick={() => setSelectedKey(null)}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 ml-auto">
              ← Back to {rangeLabel} view
            </button>
          </>
        )}
      </div>

      {/* ── MAIN GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

        {/* ── LEFT: CALENDAR ── */}
        <div className="lg:col-span-4 xl:col-span-4 space-y-4">

          {/* Month navigation */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
              <button onClick={goPrev}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-800 hover:bg-white transition-colors text-lg font-black">‹</button>
              <span className="text-sm font-black text-slate-800 uppercase tracking-wide">
                {MONTH_NAMES[calMonth.month]} {calMonth.year}
              </span>
              <button onClick={goNext}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-800 hover:bg-white transition-colors text-lg font-black">›</button>
            </div>

            <CalendarGrid month={calMonth} onSelect={handleSelect} selectedKey={selectedKey} />
          </div>

          {/* Legend */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">Impact Scale</div>
            <div className="space-y-2">
              {IMPACT_ORDER.map(key => {
                const imp = IMPACT[key]
                return (
                  <button key={key} onClick={() => setImpFilter(prev => prev === key ? 'all' : key)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left ${
                      impFilter === key ? `${imp.badge} border-transparent` : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                    }`}>
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${imp.dot}`} />
                    <div className="flex-1">
                      <div className={`text-xs font-black ${impFilter === key ? 'text-white' : 'text-slate-700'}`}>{imp.label}</div>
                    </div>
                    <div className={`text-[10px] font-black ${impFilter === key ? 'text-white/70' : 'text-slate-400'}`}>
                      {stats[key]}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Strategy note */}
          <div className="bg-slate-900 rounded-2xl p-4 text-white">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">💡 Strategy Note</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Watch for <strong className="text-white">IV crush</strong> in options after Critical events release. Sell premium before earnings, buy volatility before Fed decisions.
            </p>
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-black text-slate-500">Live calendar · {stats.total} events</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT: EVENTS PANEL ── */}
        <div className="lg:col-span-8 xl:col-span-8">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

            {/* Panel header */}
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <div>
                {selectedKey ? (
                  <>
                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-wider mb-0.5">Selected Day</div>
                    <h3 className="text-base font-black text-slate-900">{fmtDateLabel(selectedKey)}</h3>
                  </>
                ) : (
                  <>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Upcoming Catalyst Stream</div>
                    <h3 className="text-base font-black text-slate-900">Next {rangeLabel}</h3>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {selectedKey && selectedEvents.length > 0 && (
                  <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-slate-900 text-white">
                    {selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}
                  </span>
                )}
                {!selectedKey && (
                  <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700">
                    {rangeEntries.reduce((a, [, evs]) => a + filterEvs(evs).length, 0)} events
                  </span>
                )}
              </div>
            </div>

            {/* Events content */}
            <div className="p-4 overflow-y-auto max-h-[700px]">

              {/* ── SINGLE DAY VIEW ── */}
              {selectedKey && (
                <>
                  {filterEvs(selectedEvents).length > 0 ? (
                    <div className="space-y-3">
                      {filterEvs(selectedEvents).map((ev, i) => (
                        <EventCard key={i} ev={ev} showDate={false} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="text-4xl mb-3">🔕</div>
                      <div className="text-sm font-black text-slate-700">No events match this filter</div>
                      <button onClick={() => setImpFilter('all')} className="mt-2 text-xs text-blue-600 font-bold hover:text-blue-700">Clear filter</button>
                    </div>
                  )}
                </>
              )}

              {/* ── RANGE TIMELINE VIEW ── */}
              {!selectedKey && (
                rangeEntries.length > 0 ? (
                  <div className="space-y-6">
                    {rangeEntries.map(([key, evs]) => {
                      const visible = filterEvs(evs)
                      if (!visible.length) return null
                      const isToday = key === TODAY_KEY
                      const isPast  = key < TODAY_KEY

                      return (
                        <div key={key}>
                          {/* Date divider */}
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl flex-shrink-0 ${
                              isToday ? 'bg-blue-600 text-white' : isPast ? 'bg-slate-100 text-slate-500' : 'bg-slate-900 text-white'
                            }`}>
                              {isToday && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                              <span className="text-xs font-black uppercase tracking-wide">
                                {isToday ? '⚡ TODAY — ' : ''}{fmtDateShort(key)}
                              </span>
                            </div>
                            <div className="flex-1 h-px bg-slate-100" />
                            {/* Impact dots for the day */}
                            <div className="flex gap-1 flex-shrink-0">
                              {visible.map((ev, j) => (
                                <div key={j} className={`w-2 h-2 rounded-full ${IMPACT[ev.impact].dot}`} />
                              ))}
                            </div>
                          </div>

                          {/* Events for this day */}
                          <div className="space-y-3 pl-2">
                            {visible.map((ev, i) => (
                              <EventCard key={i} ev={ev} showDate={false} dateKey={key} />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="text-5xl mb-4">🌵</div>
                    <div className="text-base font-black text-slate-700">Quiet Period</div>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                      No major market-moving catalysts detected for this {rangeLabel} window.
                    </p>
                    <button onClick={() => setViewRange('month')} className="mt-3 text-xs text-blue-600 font-bold hover:text-blue-700">
                      Expand to 31-day view
                    </button>
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
