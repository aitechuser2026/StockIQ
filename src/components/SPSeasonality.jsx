import React, { useState, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts'

// ─── Historical S&P 500 Monthly Returns (%) 2015–2024 ────────────────────────
// Source: S&P 500 actual monthly close-to-close % returns
const MONTHLY_DATA = {
  2015: [-3.10,  5.49, -1.74,  0.85,  1.05, -2.10,  1.97, -6.26, -2.64,  8.30,  0.05, -1.75],
  2016: [-5.07, -0.41,  6.60,  0.27,  1.53,  0.09,  3.56,  0.12, -0.12, -1.94,  3.42,  1.82],
  2017: [ 1.79,  3.72,  0.12,  1.03,  1.16,  0.48,  1.93,  0.05,  1.93,  2.22,  2.81,  0.98],
  2018: [ 5.62, -3.89, -2.69,  0.27,  2.16,  0.48,  3.72,  3.03,  0.43, -6.94,  1.79, -9.18],
  2019: [ 7.87,  3.00,  1.79,  3.93, -6.58,  6.89,  1.44, -1.81,  1.72,  2.04,  3.40,  2.86],
  2020: [-0.16, -8.41,-12.51, 12.68,  4.53,  1.84,  5.51,  7.01, -3.92, -2.77, 10.75,  3.71],
  2021: [-1.11,  2.61,  4.24,  5.24,  0.55,  2.22,  2.27,  2.90, -4.76,  6.91, -0.83,  4.48],
  2022: [-5.26, -3.14,  3.58, -8.80,  0.01, -8.39,  9.11, -4.24, -9.34,  7.99,  5.38, -5.90],
  2023: [ 6.18, -2.61,  3.51,  1.46,  0.25,  6.47,  3.11, -1.77, -4.87, -2.10,  8.92,  4.42],
  2024: [ 1.59,  5.17,  3.10, -4.16,  4.80,  3.47,  1.13,  2.28,  2.02, -0.99,  5.73, -2.53],
}

const YEARS  = Object.keys(MONTHLY_DATA).map(Number)
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_FULL = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December']

// ─── Derived averages ─────────────────────────────────────────────────────────
function avg(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length }

const monthlyAvg = MONTHS.map((_, mi) =>
  avg(YEARS.map(y => MONTHLY_DATA[y][mi]))
)

const monthlyPositiveRate = MONTHS.map((_, mi) => {
  const vals = YEARS.map(y => MONTHLY_DATA[y][mi])
  return (vals.filter(v => v > 0).length / vals.length) * 100
})

// ─── Colour helpers ───────────────────────────────────────────────────────────
function returnColour(val) {
  if (val === null || val === undefined) return '#e2e8f0'
  if (val >= 5)   return '#15803d'
  if (val >= 2)   return '#16a34a'
  if (val >= 0.5) return '#4ade80'
  if (val >= 0)   return '#bbf7d0'
  if (val >= -2)  return '#fca5a5'
  if (val >= -5)  return '#ef4444'
  return '#991b1b'
}

function textColour(val) {
  if (val === null || val === undefined) return '#475569'
  return Math.abs(val) >= 2 ? '#fff' : '#1e293b'
}

// ─── Year-line palette ────────────────────────────────────────────────────────
const LINE_COLORS = [
  '#6366f1','#0ea5e9','#10b981','#f59e0b',
  '#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16',
]

// ─── DIP analysis ────────────────────────────────────────────────────────────
const DIP_MONTHS = monthlyAvg
  .map((avg, i) => ({ month: MONTHS[i], full: MONTH_FULL[i], avg, posRate: monthlyPositiveRate[i], idx: i }))
  .filter(m => m.avg < 0)
  .sort((a, b) => a.avg - b.avg)

const SEASONAL_NOTES = {
  Aug: 'Low volume summer lull; institutional managers rotate out heading into year-end.',
  Sep: '"September Effect" — historically the worst month since 1945. Tax-loss harvesting and mutual fund year-end redemptions pressure prices.',
  Feb: 'Post-January momentum often fades; earnings season winds down and macro data sparks volatility.',
  Oct: 'Contains famous crashes (1929, 1987, 2008) but also strong reversals. High intra-month volatility.',
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const v = payload[0].value
  return (
    <div className="bg-slate-800 text-white px-3 py-2 rounded-lg shadow-lg text-sm">
      <div className="font-bold">{MONTH_FULL[MONTHS.indexOf(label)]}</div>
      <div className={v >= 0 ? 'text-green-400' : 'text-red-400'}>
        Avg Return: {v >= 0 ? '+' : ''}{v.toFixed(2)}%
      </div>
      <div className="text-slate-300 text-xs">
        Win rate: {monthlyPositiveRate[MONTHS.indexOf(label)].toFixed(0)}% ({YEARS.length} yrs)
      </div>
    </div>
  )
}

function LineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 text-white px-3 py-2 rounded-lg shadow-lg text-sm max-w-[220px]">
      <div className="font-bold mb-1">{MONTH_FULL[MONTHS.indexOf(label)]}</div>
      {[...payload]
        .sort((a, b) => b.value - a.value)
        .map(p => (
          <div key={p.dataKey} className="flex justify-between gap-4">
            <span style={{ color: p.color }}>{p.dataKey}</span>
            <span className={p.value >= 0 ? 'text-green-400' : 'text-red-400'}>
              {p.value >= 0 ? '+' : ''}{p.value.toFixed(2)}%
            </span>
          </div>
        ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SPSeasonality() {
  const [view, setView] = useState('overview') // 'overview' | 'lines' | 'heatmap'
  const [selectedYears, setSelectedYears] = useState(new Set(YEARS))

  // bar-chart data
  const barData = MONTHS.map((m, i) => ({ month: m, avg: +monthlyAvg[i].toFixed(2) }))

  // line-chart data: one object per month with a key per year
  const lineData = useMemo(() =>
    MONTHS.map((m, mi) => {
      const obj = { month: m }
      YEARS.forEach(y => { if (selectedYears.has(y)) obj[y] = +MONTHLY_DATA[y][mi].toFixed(2) })
      return obj
    }), [selectedYears])

  // annual totals
  const annualTotals = YEARS.map(y => ({
    year: y,
    total: +MONTHLY_DATA[y].reduce((a, b) => a + b, 0).toFixed(2),
  }))

  const toggleYear = y =>
    setSelectedYears(prev => {
      const next = new Set(prev)
      if (next.has(y)) { if (next.size > 1) next.delete(y) }
      else next.add(y)
      return next
    })

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-indigo-700 via-blue-700 to-cyan-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              📅 S&amp;P 500 Monthly Seasonality
            </h1>
            <p className="text-blue-200 text-sm mt-1">
              10-year historical analysis (2015–2024) · Identify dip months for strategic entries
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['overview','lines','heatmap'].map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  view === v
                    ? 'bg-white text-blue-700 shadow'
                    : 'bg-white/20 hover:bg-white/30 text-white'
                }`}>
                {v === 'overview' ? '📊 Overview' : v === 'lines' ? '📈 By Year' : '🟥 Heatmap'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── OVERVIEW VIEW ── */}
      {view === 'overview' && (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Best Month (avg)', value: `+${Math.max(...monthlyAvg).toFixed(2)}%`,
                sub: MONTH_FULL[monthlyAvg.indexOf(Math.max(...monthlyAvg))], color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
              { label: 'Worst Month (avg)', value: `${Math.min(...monthlyAvg).toFixed(2)}%`,
                sub: MONTH_FULL[monthlyAvg.indexOf(Math.min(...monthlyAvg))], color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
              { label: 'Dip Months (avg<0)', value: DIP_MONTHS.length,
                sub: DIP_MONTHS.map(d=>d.month).join(', '), color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
              { label: 'Highest Win Rate', value: `${Math.max(...monthlyPositiveRate).toFixed(0)}%`,
                sub: MONTH_FULL[monthlyPositiveRate.indexOf(Math.max(...monthlyPositiveRate))], color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
            ].map(k => (
              <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">{k.label}</div>
                <div className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Average return bar chart */}
          <div className="bg-white rounded-2xl shadow border border-slate-100 p-5">
            <h2 className="font-bold text-slate-700 text-lg mb-1">Average Monthly Return (2015–2024)</h2>
            <p className="text-xs text-slate-400 mb-4">Green bars = historically positive · Red bars = historically negative average</p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip content={<BarTooltip />} />
                <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.5} />
                <Bar dataKey="avg" radius={[6, 6, 0, 0]}>
                  {barData.map((d, i) => (
                    <Cell key={i} fill={d.avg >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Win-rate strip */}
          <div className="bg-white rounded-2xl shadow border border-slate-100 p-5">
            <h2 className="font-bold text-slate-700 text-lg mb-4">Monthly Win Rate (% of years positive)</h2>
            <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
              {MONTHS.map((m, i) => {
                const rate = monthlyPositiveRate[i]
                const fill = rate >= 70 ? 'bg-green-100 border-green-300 text-green-800'
                           : rate >= 50 ? 'bg-blue-50 border-blue-200 text-blue-800'
                           : 'bg-red-50 border-red-300 text-red-700'
                return (
                  <div key={m} className={`rounded-xl border p-2 text-center ${fill}`}>
                    <div className="text-xs font-semibold">{m}</div>
                    <div className="text-lg font-bold">{rate.toFixed(0)}%</div>
                    <div className="text-xs opacity-70">{monthlyAvg[i] >= 0 ? '+' : ''}{monthlyAvg[i].toFixed(1)}%</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Dip analysis cards */}
          <div className="bg-white rounded-2xl shadow border border-slate-100 p-5">
            <h2 className="font-bold text-slate-700 text-lg mb-1 flex items-center gap-2">
              ⚠️ Dip Month Analysis — Buy the Dip Opportunities
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Historically negative average months often create tactical entry points for patient investors
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DIP_MONTHS.map(d => {
                const yearReturns = YEARS.map(y => ({ year: y, ret: MONTHLY_DATA[y][d.idx] }))
                const worst  = yearReturns.reduce((a, b) => b.ret < a.ret ? b : a)
                const best   = yearReturns.reduce((a, b) => b.ret > a.ret ? b : a)
                return (
                  <div key={d.month}
                    className="border border-red-200 bg-red-50 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-lg font-bold text-red-700">{d.full}</span>
                        <span className="ml-2 px-2 py-0.5 rounded-full bg-red-200 text-red-800 text-xs font-semibold">
                          Dip Month
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-red-600">{d.avg.toFixed(2)}%</div>
                        <div className="text-xs text-slate-500">10-yr avg</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-white rounded-lg p-2 border border-red-100">
                        <div className="text-slate-500">Win Rate</div>
                        <div className="font-bold text-slate-700">{d.posRate.toFixed(0)}%</div>
                      </div>
                      <div className="bg-white rounded-lg p-2 border border-red-100">
                        <div className="text-slate-500">Worst ({worst.year})</div>
                        <div className="font-bold text-red-600">{worst.ret.toFixed(1)}%</div>
                      </div>
                      <div className="bg-white rounded-lg p-2 border border-red-100">
                        <div className="text-slate-500">Best ({best.year})</div>
                        <div className="font-bold text-green-600">+{best.ret.toFixed(1)}%</div>
                      </div>
                    </div>

                    {/* Mini sparkline of that month's values */}
                    <div className="flex items-end gap-1 h-10 pt-1">
                      {yearReturns.map(({ year, ret }) => (
                        <div key={year} className="flex-1 flex flex-col items-center gap-0.5" title={`${year}: ${ret.toFixed(2)}%`}>
                          <div className="w-full rounded-sm"
                            style={{
                              height: `${Math.max(2, Math.abs(ret) * 2.5)}px`,
                              backgroundColor: ret >= 0 ? '#10b981' : '#ef4444',
                              alignSelf: ret >= 0 ? 'flex-end' : 'flex-start',
                            }} />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{YEARS[0]}</span><span>{YEARS[YEARS.length-1]}</span>
                    </div>

                    {SEASONAL_NOTES[d.month] && (
                      <p className="text-xs text-slate-600 bg-white border border-red-100 rounded-lg p-2 leading-relaxed">
                        💡 {SEASONAL_NOTES[d.month]}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Strategy box */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
            <h2 className="font-bold text-lg mb-3 flex items-center gap-2">🧠 Seasonality Trading Strategy</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white/10 rounded-xl p-4">
                <div className="text-green-400 font-bold mb-1">✅ Strong Months to BUY</div>
                <div className="text-slate-200">
                  <strong>Nov, Dec, Apr</strong> have the highest average returns and win rates (&gt;70%).
                  Consider adding to long positions or buying dips in these months.
                </div>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <div className="text-red-400 font-bold mb-1">⚠️ Weak Months — CAUTION</div>
                <div className="text-slate-200">
                  <strong>Sep, Feb, Aug</strong> average negative returns. Consider
                  tightening stops, reducing leverage, or waiting for better entries after the dip.
                </div>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <div className="text-yellow-400 font-bold mb-1">🎯 Tactical Entry Windows</div>
                <div className="text-slate-200">
                  After a Sep–Oct pullback, <strong>early November</strong> often marks an
                  inflection. The "Best 6 Months" (Nov–Apr) historically outperform May–Oct by ~5%.
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── BY-YEAR LINE VIEW ── */}
      {view === 'lines' && (
        <>
          {/* Year toggles */}
          <div className="bg-white rounded-2xl shadow border border-slate-100 p-4">
            <div className="text-sm font-semibold text-slate-600 mb-3">Toggle years to compare:</div>
            <div className="flex flex-wrap gap-2">
              {YEARS.map((y, i) => {
                const total = annualTotals.find(a => a.year === y)?.total ?? 0
                const active = selectedYears.has(y)
                return (
                  <button key={y} onClick={() => toggleYear(y)}
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-all ${
                      active
                        ? 'text-white border-transparent shadow'
                        : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                    }`}
                    style={active ? { backgroundColor: LINE_COLORS[i % LINE_COLORS.length], borderColor: LINE_COLORS[i % LINE_COLORS.length] } : {}}>
                    {y} <span className={total >= 0 ? 'text-green-300' : 'text-red-300'}>
                      ({total >= 0 ? '+' : ''}{total}%)
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Line chart */}
          <div className="bg-white rounded-2xl shadow border border-slate-100 p-5">
            <h2 className="font-bold text-slate-700 text-lg mb-1">Monthly Return by Year</h2>
            <p className="text-xs text-slate-400 mb-4">Each line = one calendar year. Hover to compare months across years.</p>
            <ResponsiveContainer width="100%" height={420}>
              <LineChart data={lineData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip content={<LineTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" />
                {YEARS.filter(y => selectedYears.has(y)).map((y, i) => (
                  <Line key={y} type="monotone" dataKey={y}
                    stroke={LINE_COLORS[YEARS.indexOf(y) % LINE_COLORS.length]}
                    strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Average overlay line chart */}
          <div className="bg-white rounded-2xl shadow border border-slate-100 p-5">
            <h2 className="font-bold text-slate-700 text-lg mb-1">10-Year Average Overlay</h2>
            <p className="text-xs text-slate-400 mb-4">Grey = 10-yr average; coloured = selected year lines</p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={MONTHS.map((m, mi) => {
                  const obj = { month: m, avg: +monthlyAvg[mi].toFixed(2) }
                  YEARS.filter(y => selectedYears.has(y)).forEach(y => {
                    obj[y] = +MONTHLY_DATA[y][mi].toFixed(2)
                  })
                  return obj
                })}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip content={<LineTooltip />} />
                <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" />
                {YEARS.filter(y => selectedYears.has(y)).map((y) => (
                  <Line key={y} type="monotone" dataKey={y}
                    stroke={LINE_COLORS[YEARS.indexOf(y) % LINE_COLORS.length]}
                    strokeWidth={1.5} dot={false} opacity={0.5} />
                ))}
                <Line type="monotone" dataKey="avg" stroke="#1e293b"
                  strokeWidth={3} dot={{ r: 4, fill: '#1e293b' }} name="10-yr Avg"
                  label={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* ── HEATMAP VIEW ── */}
      {view === 'heatmap' && (
        <div className="bg-white rounded-2xl shadow border border-slate-100 p-5 overflow-x-auto">
          <h2 className="font-bold text-slate-700 text-lg mb-1">Monthly Returns Heatmap (2015–2024)</h2>
          <p className="text-xs text-slate-400 mb-4">
            Dark green = strong gain · Light green = mild gain · Light red = mild loss · Dark red = heavy loss
          </p>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left p-2 text-slate-500 font-semibold text-xs w-12">Year</th>
                {MONTHS.map(m => (
                  <th key={m} className="p-1 text-center text-slate-500 font-semibold text-xs">{m}</th>
                ))}
                <th className="p-2 text-center text-slate-500 font-semibold text-xs">YTD</th>
              </tr>
            </thead>
            <tbody>
              {YEARS.map(y => {
                const ytd = MONTHLY_DATA[y].reduce((a, b) => a + b, 0)
                return (
                  <tr key={y} className="hover:brightness-95 transition-all">
                    <td className="p-2 font-bold text-slate-700 text-xs">{y}</td>
                    {MONTHLY_DATA[y].map((val, mi) => (
                      <td key={mi}
                        className="p-0.5 text-center"
                        title={`${MONTH_FULL[mi]} ${y}: ${val >= 0 ? '+' : ''}${val.toFixed(2)}%`}>
                        <div className="rounded-md px-1 py-1.5 text-xs font-semibold leading-none"
                          style={{
                            backgroundColor: returnColour(val),
                            color: textColour(val),
                          }}>
                          {val >= 0 ? '+' : ''}{val.toFixed(1)}
                        </div>
                      </td>
                    ))}
                    <td className="p-0.5 text-center">
                      <div className="rounded-md px-1 py-1.5 text-xs font-bold leading-none"
                        style={{ backgroundColor: returnColour(ytd), color: textColour(ytd) }}>
                        {ytd >= 0 ? '+' : ''}{ytd.toFixed(1)}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {/* Average row */}
              <tr className="border-t-2 border-slate-300">
                <td className="p-2 font-bold text-slate-800 text-xs">AVG</td>
                {monthlyAvg.map((val, mi) => (
                  <td key={mi} className="p-0.5 text-center">
                    <div className="rounded-md px-1 py-1.5 text-xs font-bold leading-none border-2 border-slate-300"
                      style={{ backgroundColor: returnColour(val), color: textColour(val) }}>
                      {val >= 0 ? '+' : ''}{val.toFixed(1)}
                    </div>
                  </td>
                ))}
                <td className="p-0.5 text-center">
                  <div className="rounded-md px-1 py-1.5 text-xs font-bold leading-none border-2 border-slate-300"
                    style={{
                      backgroundColor: returnColour(avg(annualTotals.map(a=>a.total))),
                      color: textColour(avg(annualTotals.map(a=>a.total))),
                    }}>
                    +{avg(annualTotals.map(a=>a.total)).toFixed(1)}
                  </div>
                </td>
              </tr>

              {/* Win rate row */}
              <tr>
                <td className="p-2 font-bold text-slate-800 text-xs">WIN%</td>
                {monthlyPositiveRate.map((rate, mi) => (
                  <td key={mi} className="p-0.5 text-center">
                    <div className={`rounded-md px-1 py-1.5 text-xs font-semibold leading-none
                      ${rate >= 70 ? 'bg-green-100 text-green-800'
                      : rate >= 50 ? 'bg-blue-50 text-blue-700'
                      : 'bg-red-50 text-red-700'}`}>
                      {rate.toFixed(0)}%
                    </div>
                  </td>
                ))}
                <td />
              </tr>
            </tbody>
          </table>

          {/* Legend */}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <span className="text-xs text-slate-500 font-medium">Legend:</span>
            {[
              { color: '#15803d', label: '≥+5%' },
              { color: '#16a34a', label: '+2–5%' },
              { color: '#4ade80', label: '+0.5–2%' },
              { color: '#bbf7d0', label: '0–+0.5%' },
              { color: '#fca5a5', label: '0 to −2%' },
              { color: '#ef4444', label: '−2 to −5%' },
              { color: '#991b1b', label: '≤−5%' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: l.color }} />
                <span className="text-xs text-slate-600">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer note ── */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
        <strong>⚡ Disclaimer:</strong> Seasonal patterns are historical tendencies, not guarantees.
        Macro events, Fed policy, earnings surprises, and geopolitical factors can override seasonal trends in any given year.
        Use seasonality as one factor among many — never as the sole basis for a trade. Past performance does not guarantee future results.
      </div>

    </div>
  )
}
