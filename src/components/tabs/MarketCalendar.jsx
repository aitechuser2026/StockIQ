import React from 'react'

const impactColor = { high: 'bg-red-500', med: 'bg-yellow-500', low: 'bg-green-500' }

const statusPill = {
  released: 'bg-green-100 text-green-800',
  today:    'blink bg-yellow-100 text-yellow-800',
  upcoming: 'bg-slate-100 text-slate-600',
}

function CalEvent({ day, dayColor, num, numColor, numSize, time, impact, title, desc, data, marketImpact, status, statusLabel, highlight, highlightBorder }) {
  return (
    <div className={`flex items-start gap-3 bg-white rounded-xl p-3.5 mb-2 shadow-sm border transition-shadow hover:shadow-md ${highlight ? 'border-yellow-400 bg-yellow-50/60' : 'border-slate-200'}`}
      style={highlightBorder ? { borderLeft: `3px solid ${highlightBorder}` } : {}}>
      {/* Date */}
      <div className={`min-w-[70px] text-center px-2 py-1.5 rounded-lg ${highlight ? 'bg-yellow-100' : 'bg-slate-50'}`}>
        <div className="text-xs font-bold uppercase" style={{ color: dayColor || '#64748b' }}>{day}</div>
        <div className="font-extrabold leading-none mt-0.5" style={{ fontSize: numSize || '1.25rem', color: numColor || '#1a202c' }}>{num}</div>
        <div className="text-xs text-slate-400 mt-0.5">{time}</div>
      </div>

      {/* Impact dot */}
      <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${impactColor[impact]}`} />

      {/* Content */}
      <div className="flex-1">
        <div className="text-sm font-bold text-slate-900" dangerouslySetInnerHTML={{ __html: title }} />
        <div className="text-xs text-slate-500 mt-1 leading-relaxed">{desc}</div>
        {data && (
          <div className="flex flex-wrap gap-2 mt-1.5">
            {data.map((d, i) => (
              <span key={i} className="text-xs bg-slate-50 px-2 py-0.5 rounded-md text-slate-700" dangerouslySetInnerHTML={{ __html: d }} />
            ))}
          </div>
        )}
        {marketImpact && <div className="text-xs font-semibold text-violet-700 mt-1.5 flex items-center gap-1">{marketImpact}</div>}
      </div>

      {/* Status */}
      <div className="flex-shrink-0">
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap ${statusPill[status]}`}>
          {statusLabel}
        </span>
      </div>
    </div>
  )
}

function WeekTitle({ icon, label, badge, badgeClass }) {
  return (
    <div className="flex items-center gap-2 text-base font-bold text-slate-800 mt-4 mb-2.5">
      {icon} {label}
      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide ${badgeClass}`}>{badge}</span>
    </div>
  )
}

export default function MarketCalendar() {
  return (
    <div>
      {/* Key event banner */}
      <div className="flex items-center gap-3 text-white text-sm rounded-xl p-3.5 mb-4" style={{ background: 'linear-gradient(90deg,#1e40af,#3b82f6)' }}>
        <span className="text-2xl">🚨</span>
        <div>
          <strong>TODAY (May 15):</strong> U of Michigan Consumer Sentiment at 10:00 AM ET · Powell's term ends — Kevin Warsh Era officially begins · Trump–Xi Summit Day 2 in Beijing — final communiqué expected today.
        </div>
      </div>

      <WeekTitle icon="📅" label="This Week" badge="May 11–16, 2026" badgeClass="bg-blue-100 text-blue-800" />

      <CalEvent day="Tue" num="12" numColor="#ef4444" time="8:30 AM ET" dayColor="#ef4444" impact="high"
        title="🔴 Consumer Price Index (CPI) — April 2026"
        desc="The single most market-moving event of the week. Inflation data that sets Fed policy expectations for the June 16–17 FOMC rate decision."
        data={['Headline MoM: <strong style="color:#ef4444">+0.6%</strong>', 'Headline YoY: <strong style="color:#ef4444">+3.7%</strong>', 'Core YoY: <strong style="color:#ef4444">+2.7%</strong>', 'Consensus: 0.3% MoM']}
        marketImpact="📉 Market Impact: Hotter than expected → Rate cut hopes faded → Bond yields rose."
        status="released" statusLabel="✅ Released" />

      <CalEvent day="Wed" num="13" numColor="#ef4444" time="8:30 AM ET" dayColor="#ef4444" impact="high"
        title="🔴 Producer Price Index (PPI) — April 2026"
        desc="Wholesale inflation — validates if producer-level price pressures are bleeding into consumer prices. Leads CPI by 1–2 months."
        data={['Result: <strong style="color:#ef4444">Largest monthly jump in 4 years</strong>', 'Signal: Hawkish — more inflation ahead']}
        marketImpact="📉 Impact: Confirmed sticky inflation. Rate cut in June now very unlikely."
        status="released" statusLabel="✅ Released" />

      <CalEvent day="Wed" num="13" numColor="#ef4444" time="Senate Vote" dayColor="#ef4444" impact="high"
        title="🔴 Kevin Warsh Confirmed as Federal Reserve Chair"
        desc="Replaced Jerome Powell (term expires May 15). Warsh seen as hawkish but potentially more open to rate cuts if inflation cools."
        data={['Previous Chair: Powell', 'New Chair: Kevin Warsh', 'Next FOMC: June 16–17']}
        marketImpact="⚠️ Impact: Transition uncertainty. Watch for Warsh's first public statements."
        status="released" statusLabel="✅ Confirmed" />

      <CalEvent day="Wed" num="13" numColor="#ef4444" time="After Close" dayColor="#ef4444" impact="med"
        title="🟡 Cisco (CSCO) &amp; Alibaba (BABA) Earnings"
        desc="CSCO = enterprise AI networking capex proxy. BABA = China tech bellwether. Options priced ±5.9% move on BABA."
        data={['CSCO EPS Consensus: $0.92', 'BABA Revenue: ~$36B', 'BABA Options Move: ±5.9%']}
        status="released" statusLabel="✅ Released" />

      <CalEvent day="Thu" num="14" numColor="#ef4444" time="8:30 AM ET" dayColor="#ef4444" impact="high"
        title="🔴 Retail Sales — April 2026"
        desc="Critical read on US consumer spending after the energy price spike. Strong consumer = Fed stays higher for longer."
        data={['Consensus: +0.5% MoM', 'Prior: +0.9% MoM']}
        marketImpact="📊 Released May 14 — watch follow-through in consumer/retail stocks."
        status="released" statusLabel="✅ Released" />

      <CalEvent day="Thu" num="14" numColor="#ef4444" time="After Close" dayColor="#ef4444" impact="high"
        title="🔴 Applied Materials (AMAT) Earnings"
        desc="AMAT sells fab equipment to TSMC, Samsung, Intel, Micron. Its guidance is a 6–12 month leading indicator for semiconductor capex."
        data={['EPS Consensus: $2.68 (+12% YoY)', 'Options Move Priced: ±8.7%', 'Impact: NVDA, TSM, AMAT']}
        marketImpact="📊 Released May 14 after close — AMAT reaction setting tone for NVDA, TSM."
        status="released" statusLabel="✅ Released" />

      <CalEvent day="Thu–Fri" num="14–15" numColor="#d97706" time="Beijing" dayColor="#d97706" numSize="1.1rem" impact="high"
        title='🔴 Trump–Xi Summit Day 2 — Beijing <span style="background:#fef3c7;color:#d97706;padding:1px 6px;border-radius:6px;font-size:0.68rem;font-weight:700;margin-left:4px;">⚡ TODAY · FINAL DAY</span>'
        desc="Trade truce negotiations, AI guardrails between US & China, Iran conflict spillover on agenda."
        data={['Key Issue: Chip export bans', 'Key Issue: AI guardrails', 'Key Issue: Trade truce', 'Iran: $300B shock risk']}
        marketImpact="🌐 Positive outcome → NVDA, TSM, QCOM surge. Breakdown → Broad tech selloff."
        status="today" statusLabel="⚡ ONGOING" highlight />

      <CalEvent day="Fri" num="15" numColor="#d97706" time="10:00 AM ET" dayColor="#d97706" numSize="1.4rem" impact="high"
        title='🔴 U of Michigan Consumer Sentiment <span style="background:#fef3c7;color:#d97706;padding:1px 6px;border-radius:6px;font-size:0.68rem;font-weight:700;margin-left:4px;">⚡ TODAY</span>'
        desc="Measures forward-looking consumer confidence. Includes 1-year and 5-year inflation expectations."
        data={['Watch: Inflation Expectations', 'Prior: 52.2', 'Consensus: ~54']}
        marketImpact="⚡ Inflation expectations >4% = hawkish Fed signal. First major read under new Chair Warsh."
        status="today" statusLabel="⚡ TODAY" highlight />

      <CalEvent day="Fri" num="15" numColor="#d97706" time="End of Day" dayColor="#d97706" numSize="1.4rem" impact="med"
        title='🟡 Jerome Powell&#39;s Term Ends — Kevin Warsh Era Begins <span style="background:#fef3c7;color:#d97706;padding:1px 6px;border-radius:6px;font-size:0.68rem;font-weight:700;margin-left:4px;">⚡ TODAY</span>'
        desc="Formal transition of Fed Chair today. Markets will parse Warsh's first public statements on policy direction."
        data={['Warsh: More hawkish background', 'But: Open to rate cuts if data allows', 'Next FOMC: June 16–17']}
        marketImpact="⚡ Watch for any Warsh remarks today — his first words as Chair will set bond market tone."
        status="today" statusLabel="⚡ TODAY" highlight />

      <WeekTitle icon="🔮" label="Next Week" badge="May 18–22, 2026" badgeClass="bg-purple-100 text-purple-800" />

      <CalEvent day="Mon" num="18" time="All Day" impact="med"
        title="🟡 Fed Chair Warsh's First Full Week — Policy Signal Watch"
        desc="Any speeches, interviews, or Fed governor comments will be dissected for shifts in tone from the Powell era."
        data={['Watch: Warsh speech schedule', 'Watch: Fed governor commentary']}
        status="upcoming" statusLabel="📅 UPCOMING" />

      <CalEvent day="Tue" num="19" time="8:30 AM ET" impact="med"
        title="🟡 Housing Starts &amp; Building Permits — April 2026"
        desc="Measures new residential construction activity. Key indicator for lumber, homebuilders (LEN, DHI)."
        data={['Consensus: ~1.3M annualized', 'Affects: XHB, LEN, DHI, lumber']}
        status="upcoming" statusLabel="📅 UPCOMING" />

      <CalEvent day="Wed" num="20" time="2:00 PM ET" impact="high" highlightBorder="#7c3aed"
        title="🔴 FOMC Meeting Minutes (April Meeting)"
        desc="Detailed record of the April FOMC meeting — reveals dissenting voter arguments, debate over future rate hikes."
        data={['Context: 3 voters ready to dissent', 'Watch: Language on "further hikes"', 'Watch: Inflation threshold debate', 'Next FOMC: June 16–17']}
        marketImpact="🔴 HIGH IMPACT: Minutes will set expectations for the June rate decision."
        status="upcoming" statusLabel="📅 UPCOMING" />

      <CalEvent day="Thu" num="21" time="8:30 AM ET" impact="med"
        title="🟡 Weekly Jobless Claims + Philadelphia Fed Index"
        desc="Weekly pulse on labor market health. Philadelphia Fed Index measures mid-Atlantic manufacturing outlook."
        data={['Claims Consensus: ~215K', 'Philly Fed Prior: 8.5']}
        status="upcoming" statusLabel="📅 UPCOMING" />

      <CalEvent day="Fri" num="22" time="9:45 AM ET" impact="med"
        title="🟡 S&amp;P Global Flash PMI (Manufacturing + Services)"
        desc="First look at May business activity. PMI above 50 = expansion. Below 50 = contraction."
        data={['Services Prior: 54.4', 'Manufacturing Prior: 50.2', 'Above 50 = Expansion']}
        status="upcoming" statusLabel="📅 UPCOMING" />

      <WeekTitle icon="🗓️" label="Coming Up" badge="Late May / June 2026" badgeClass="bg-slate-100 text-slate-600" />

      <CalEvent day="Thu" num="28" time="May · 8:30 AM" impact="high"
        title="🔴 GDP Growth Rate Q1 2026 — Second Estimate"
        desc="Revised Q1 GDP. Includes updated consumer spending, business investment, and trade balance data."
        data={['First Est: +2.1% annualized', 'Watch: Consumer spending sub-component']}
        status="upcoming" statusLabel="📅 MAY 28" />

      <CalEvent day="Tue–Wed" num="Jun 16–17" numSize="1rem" numColor="#ef4444" time="Rate Decision" impact="high" highlightBorder="#ef4444"
        title="🔴 FOMC Rate Decision — June 2026 (MOST IMPORTANT EVENT)"
        desc="The most consequential market event of Q2. With CPI at 3.7% and PPI surging, a rate cut is unlikely."
        data={['Current Rate: 4.75–5.00%', 'Cut Probability: Low (~15%)', 'Hold Probability: High (~75%)', 'Hike Probability: Moderate (~10%)']}
        marketImpact="🔴 CRITICAL: Rate hike = broad selloff. Hold with hawkish tone = tech pressure. Hold with dovish tone = rally."
        status="upcoming" statusLabel="📅 JUNE 16–17" />

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-500 leading-relaxed mt-4">
        ⚠️ Economic calendar data sourced from BLS, Federal Reserve, Gotrade Weekly Outlook, and Market Intelligence Shot (May 14, 2026). Always verify with official BLS.gov and FederalReserve.gov calendars before trading.
      </div>
    </div>
  )
}
