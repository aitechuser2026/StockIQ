import React, { useState } from 'react'

// Impact levels: critical > high > medium > low
const IMPACT = {
  critical: {
    label: 'CRITICAL',
    dot: 'bg-purple-600',
    cell: 'bg-purple-50 border-purple-400',
    pill: 'bg-purple-100 text-purple-800 border border-purple-300',
    badge: 'bg-purple-600 text-white',
    ring: 'ring-2 ring-purple-400',
    glow: '#7c3aed',
  },
  high: {
    label: 'HIGH',
    dot: 'bg-red-500',
    cell: 'bg-red-50 border-red-300',
    pill: 'bg-red-100 text-red-800 border border-red-200',
    badge: 'bg-red-500 text-white',
    ring: 'ring-2 ring-red-400',
    glow: '#ef4444',
  },
  medium: {
    label: 'MEDIUM',
    dot: 'bg-amber-400',
    cell: 'bg-amber-50 border-amber-300',
    pill: 'bg-amber-100 text-amber-800 border border-amber-200',
    badge: 'bg-amber-400 text-white',
    ring: 'ring-1 ring-amber-300',
    glow: '#f59e0b',
  },
  low: {
    label: 'LOW',
    dot: 'bg-green-400',
    cell: 'bg-green-50 border-green-200',
    pill: 'bg-green-100 text-green-800 border border-green-200',
    badge: 'bg-green-500 text-white',
    ring: 'ring-1 ring-green-300',
    glow: '#10b981',
  },
}

// All market events keyed by YYYY-MM-DD
const EVENTS = {
  '2026-05-12': [
    { impact: 'high',     emoji: '🔴', title: 'CPI — April 2026',          desc: 'Headline YoY +3.7% — hotter than expected. Rate cut hopes faded. Bond yields rose. Tech initially pressured but AI rally continued.', time: '8:30 AM ET', status: 'released' },
  ],
  '2026-05-13': [
    { impact: 'high',     emoji: '🔴', title: 'PPI — April 2026',           desc: 'Largest monthly jump in 4 years. Confirmed sticky inflation. Rate cut in June now very unlikely.', time: '8:30 AM ET', status: 'released' },
    { impact: 'high',     emoji: '🔴', title: 'Warsh Confirmed as Fed Chair',desc: 'Senate confirms Kevin Warsh, replacing Powell. Watch for first public statements on rate policy.', time: 'Senate Vote', status: 'released' },
    { impact: 'medium',   emoji: '🟡', title: 'CSCO & BABA Earnings',       desc: 'Cisco = enterprise AI networking proxy. Alibaba = China tech bellwether. Options priced ±5.9% on BABA.', time: 'After Close', status: 'released' },
  ],
  '2026-05-14': [
    { impact: 'high',     emoji: '🔴', title: 'Retail Sales — April 2026',  desc: 'Direct read on US consumer spending post energy spike. Key input for Fed rate path.', time: '8:30 AM ET', status: 'released' },
    { impact: 'high',     emoji: '🔴', title: 'AMAT Earnings',              desc: 'Applied Materials — 6–12 month leading indicator for semiconductor capex. Options priced ±8.7% move. Directly impacts NVDA, TSM.', time: 'After Close', status: 'released' },
    { impact: 'high',     emoji: '🔴', title: 'Trump–Xi Summit Day 1',      desc: 'Trade truce, AI guardrails, chip export bans on agenda. Biggest geopolitical wildcard.', time: 'Beijing', status: 'released' },
  ],
  '2026-05-15': [
    { impact: 'critical', emoji: '🚨', title: 'Trump–Xi Summit — Final Day',desc: 'Final communiqué expected. Outcome directly impacts chip export restrictions. Positive = NVDA/TSM surge. Breakdown = broad tech selloff.', time: 'All Day', status: 'today' },
    { impact: 'high',     emoji: '🔴', title: 'UMich Consumer Sentiment',   desc: 'Preliminary read on consumer confidence. 1-yr & 5-yr inflation expectations are key. Above 4% = hawkish Fed signal. First major data under new Chair Warsh.', time: '10:00 AM ET', status: 'today' },
    { impact: 'medium',   emoji: '🟡', title: 'Powell Term Ends — Warsh Era Begins', desc: 'Jerome Powell\'s term officially ends. Warsh\'s first public remarks as Chair will set tone for bond markets.', time: 'End of Day', status: 'today' },
  ],
  '2026-05-18': [
    { impact: 'medium',   emoji: '🟡', title: 'Warsh — First Full Week',    desc: 'Any Warsh speeches or Fed governor comments dissected for shifts from Powell era. Watch language on "data dependence" vs. pre-emptive action.', time: 'All Week', status: 'upcoming' },
  ],
  '2026-05-19': [
    { impact: 'medium',   emoji: '🟡', title: 'Housing Starts & Permits — April', desc: 'New residential construction. Key for lumber, homebuilders (LEN, DHI). High rates crushing affordability.', time: '8:30 AM ET', status: 'upcoming' },
  ],
  '2026-05-20': [
    { impact: 'high',     emoji: '🔴', title: 'FOMC April Meeting Minutes', desc: 'Reveals dissenting voter arguments, debate over rate hikes, and how many members favor a June cut vs. hold vs. hike. Sets expectations for June 16–17.', time: '2:00 PM ET', status: 'upcoming' },
  ],
  '2026-05-21': [
    { impact: 'medium',   emoji: '🟡', title: 'Weekly Jobless Claims + Philly Fed', desc: 'Weekly labor market pulse. Philadelphia Fed Index = mid-Atlantic manufacturing outlook. Leading indicator for industrial activity.', time: '8:30 AM ET', status: 'upcoming' },
  ],
  '2026-05-22': [
    { impact: 'medium',   emoji: '🟡', title: 'S&P Global Flash PMI',       desc: 'First look at May business activity. PMI above 50 = expansion. Services PMI especially important given sticky services inflation.', time: '9:45 AM ET', status: 'upcoming' },
  ],
  '2026-05-27': [
    { impact: 'low',      emoji: '🟢', title: 'Markets Closed — Memorial Day', desc: 'US equity markets closed for Memorial Day.', time: 'All Day', status: 'upcoming' },
  ],
  '2026-05-28': [
    { impact: 'high',     emoji: '🔴', title: 'GDP Q1 2026 — Second Estimate', desc: 'Revised Q1 GDP growth. Includes updated consumer spending, business investment, trade balance. Downward revision = rate cut hopes revive.', time: '8:30 AM ET', status: 'upcoming' },
  ],
  '2026-05-29': [
    { impact: 'medium',   emoji: '🟡', title: 'PCE Price Index — April 2026', desc: 'Fed\'s preferred inflation gauge. Core PCE is the key metric watched by the FOMC when setting rates. Crucial ahead of June decision.', time: '8:30 AM ET', status: 'upcoming' },
  ],
  '2026-06-04': [
    { impact: 'medium',   emoji: '🟡', title: 'ISM Services PMI — May',    desc: 'Services sector activity indicator. Services make up ~80% of US economy. Sticky services inflation remains a key Fed concern.', time: '10:00 AM ET', status: 'upcoming' },
  ],
  '2026-06-06': [
    { impact: 'medium',   emoji: '🟡', title: 'May Jobs Report (NFP)',      desc: 'Non-Farm Payrolls. Strong jobs = Fed holds rates. Weak jobs = opens door for rate cut. Key input for June FOMC decision.', time: '8:30 AM ET', status: 'upcoming' },
  ],
  '2026-06-11': [
    { impact: 'high',     emoji: '🔴', title: 'CPI — May 2026',            desc: 'Last major inflation data point before the June 16–17 FOMC rate decision. Markets will be very sensitive to any surprise.', time: '8:30 AM ET', status: 'upcoming' },
  ],
  '2026-06-16': [
    { impact: 'critical', emoji: '🚨', title: 'FOMC Rate Decision — Day 1', desc: 'MOST IMPORTANT event of Q2. Current rate: 4.75–5.00%. Cut probability ~15%, Hold ~75%, Hike ~10%. Warsh\'s first rate decision as Fed Chair.', time: 'All Day', status: 'upcoming' },
  ],
  '2026-06-17': [
    { impact: 'critical', emoji: '🚨', title: 'FOMC Rate Decision — Day 2 + Press Conference', desc: 'Rate decision announced. Warsh press conference at 2:30 PM ET. Every word will be parsed for future rate path signals. Biggest market-moving event of Q2.', time: '2:00 PM ET', status: 'upcoming' },
  ],
  '2026-06-18': [
    { impact: 'medium',   emoji: '🟡', title: 'Options Expiration (OPEX)', desc: 'Major quarterly options expiration. Large gamma exposure can cause unusual price action in index and individual names.', time: 'All Day', status: 'upcoming' },
  ],
}

// Build calendar grid for a given year/month
function buildMonth(year, month) {
  const firstDay = new Date(year, month, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null) // empty padding
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function topImpact(events) {
  const order = ['critical','high','medium','low']
  for (const lvl of order) if (events.some(e => e.impact === lvl)) return lvl
  return null
}

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}

const TODAY = '2026-05-15'

export default function EventCalendar() {
  const [selected, setSelected] = useState(null) // { key, events }
  const [month, setMonth] = useState({ year: 2026, month: 4 }) // May=4

  const cells = buildMonth(month.year, month.month)

  const goPrev = () => {
    setSelected(null)
    setMonth(m => {
      const d = new Date(m.year, m.month - 1, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }
  const goNext = () => {
    setSelected(null)
    setMonth(m => {
      const d = new Date(m.year, m.month + 1, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-800">🗓️ Market Event Calendar</h2>
          <p className="text-xs text-slate-500 mt-0.5">Color-coded by market impact — click any day to see details</p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 flex-wrap">
          {[['critical','🚨 Critical'],['high','🔴 High'],['medium','🟡 Medium'],['low','🟢 Low']].map(([lvl,lbl]) => (
            <div key={lvl} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-full ${IMPACT[lvl].dot}`} />
              <span className="text-xs text-slate-600 font-medium">{lbl}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Month Nav */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <button onClick={goPrev} className="text-slate-400 hover:text-slate-700 text-xl font-bold px-2">‹</button>
          <h3 className="font-bold text-slate-800 text-base">{MONTH_NAMES[month.month]} {month.year}</h3>
          <button onClick={goNext} className="text-slate-400 hover:text-slate-700 text-xl font-bold px-2">›</button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {DAY_NAMES.map(d => (
            <div key={d} className="text-center text-xs font-bold text-slate-400 py-2 uppercase tracking-wide">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} className="min-h-[80px] bg-slate-50/50 border-r border-b border-slate-100" />

            const key = dateKey(month.year, month.month, day)
            const dayEvents = EVENTS[key] || []
            const impact = topImpact(dayEvents)
            const imp = impact ? IMPACT[impact] : null
            const isToday = key === TODAY
            const isSelected = selected?.key === key
            const isWeekend = [0, 6].includes((i) % 7)

            return (
              <div
                key={key}
                onClick={() => dayEvents.length && setSelected(isSelected ? null : { key, events: dayEvents })}
                className={`
                  min-h-[80px] p-1.5 border-r border-b border-slate-100 transition-all duration-150
                  ${dayEvents.length ? 'cursor-pointer' : ''}
                  ${isWeekend && !dayEvents.length ? 'bg-slate-50/70' : ''}
                  ${imp ? imp.cell : ''}
                  ${isSelected ? 'ring-2 ring-inset ring-blue-400 z-10' : ''}
                  ${dayEvents.length && !isSelected ? 'hover:brightness-95' : ''}
                `}
              >
                {/* Day number */}
                <div className="flex items-start justify-between">
                  <span className={`
                    text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full leading-none
                    ${isToday ? 'bg-blue-600 text-white' : isWeekend ? 'text-slate-400' : 'text-slate-700'}
                  `}>
                    {day}
                  </span>
                  {impact && (
                    <div className={`w-2 h-2 rounded-full mt-1 ${imp.dot}`} />
                  )}
                </div>

                {/* Event chips */}
                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 2).map((ev, j) => (
                    <div key={j} className={`text-xs px-1.5 py-0.5 rounded font-semibold truncate ${IMPACT[ev.impact].pill}`}>
                      {ev.emoji} {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-xs text-slate-400 px-1 font-medium">+{dayEvents.length - 2} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                {new Date(selected.key + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">{selected.events.length} market event{selected.events.length !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
          </div>

          <div className="space-y-3">
            {selected.events.map((ev, i) => {
              const imp = IMPACT[ev.impact]
              return (
                <div key={i} className={`rounded-xl p-4 border ${imp.cell}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-base">{ev.emoji}</span>
                        <span className="font-bold text-slate-900 text-sm">{ev.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${imp.badge}`}>
                          {imp.label}
                        </span>
                        {ev.status === 'released' && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-800">✅ Released</span>
                        )}
                        {ev.status === 'today' && (
                          <span className="blink text-xs px-2 py-0.5 rounded-full font-semibold bg-yellow-100 text-yellow-800">⚡ TODAY</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{ev.desc}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">{ev.time}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Upcoming high-impact summary */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="text-sm font-bold text-slate-700 mb-3">🚨 Key Dates to Watch</div>
        <div className="space-y-2">
          {Object.entries(EVENTS)
            .filter(([key]) => key >= TODAY)
            .filter(([, evs]) => topImpact(evs) === 'critical' || topImpact(evs) === 'high')
            .map(([key, evs]) => {
              const date = new Date(key + 'T12:00:00')
              const impact = topImpact(evs)
              const imp = IMPACT[impact]
              return (
                <div key={key}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border ${imp.cell} hover:brightness-95`}
                  onClick={() => setSelected({ key, events: evs })}
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${imp.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-500">
                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold uppercase ${imp.badge}`}>{imp.label}</span>
                    </div>
                    {evs.map((ev, i) => (
                      <div key={i} className="text-sm font-semibold text-slate-800 truncate">{ev.emoji} {ev.title}</div>
                    ))}
                  </div>
                </div>
              )
            })
          }
        </div>
      </div>
    </div>
  )
}
