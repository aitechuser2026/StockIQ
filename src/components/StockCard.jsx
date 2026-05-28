import React from 'react'

const signalClass = {
  bull: 'bg-green-100 text-green-800',
  bear: 'bg-red-100 text-red-800',
  neutral: 'bg-slate-100 text-slate-600',
  options: 'bg-violet-100 text-violet-800',
}

const verdictStyle = {
  buy:  'bg-green-100 text-green-800',
  hold: 'bg-yellow-100 text-yellow-800',
  sell: 'bg-red-100 text-red-800',
}

const riskFillClass = { high: 'bg-red-500', med: 'bg-yellow-500', low: 'bg-green-500' }

export default function StockCard({ stock, fmtPrice, fmtChg, isUp }) {
  const { ticker, name, verdict, verdictClass, signals, metrics, buy, risk, riskScore, riskLevel } = stock

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:-translate-y-0.5 hover:shadow-md transition-all duration-150">
      {/* Header */}
      <div className="flex justify-between items-start mb-2.5">
        <div>
          <div className="text-xl font-extrabold text-slate-900">{ticker}</div>
          <div className="text-xs text-slate-500 mt-0.5">{name}</div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${verdictStyle[verdictClass]}`}>
          {verdict}
        </span>
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-2 mb-2.5">
        <span className="text-2xl font-bold text-slate-900">{fmtPrice(ticker)}</span>
        <span className={`text-sm font-semibold ${isUp(ticker) ? 'text-green-600' : 'text-red-500'}`}>
          {fmtChg(ticker)}
        </span>
      </div>

      {/* Signals */}
      <div className="flex flex-wrap gap-1 mb-2.5">
        {signals.map((s, i) => (
          <span key={i} className={`text-xs font-semibold px-1.5 py-0.5 rounded ${signalClass[s.type]}`}>
            {s.label}
          </span>
        ))}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-1.5 mb-2.5">
        {metrics.map((m, i) => (
          <div key={i} className="bg-slate-50 rounded-lg px-2.5 py-1.5">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{m.label}</div>
            <div className="text-sm font-bold text-slate-900 mt-0.5">{m.val}</div>
          </div>
        ))}
      </div>

      {/* Reasoning */}
      <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-700 leading-relaxed border-l-4 border-blue-400 mb-2">
        {buy}
      </div>
      <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-700 leading-relaxed border-l-4 border-red-400 mb-2">
        {risk}
      </div>

      {/* Risk bar */}
      <div className="mt-2">
        <div className="flex justify-between text-xs text-slate-500 font-semibold mb-1">
          <span>Risk</span>
          <span>{riskLevel.toUpperCase()} {riskScore}/100</span>
        </div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${riskFillClass[riskLevel]}`} style={{ width: `${riskScore}%` }} />
        </div>
      </div>
    </div>
  )
}
