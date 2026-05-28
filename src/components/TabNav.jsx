import React from 'react'

const TABS = [
  { id: 'eventcal',   label: '🗓️ Event Calendar' },
  { id: 'calendar',   label: '📅 Market Calendar' },
  { id: 'overview',   label: '📊 Live Market' },
  { id: 'aggressive', label: '🔥 Aggressive Picks' },
  { id: 'balanced',   label: '⚖️ Balanced Picks' },
  { id: 'options',    label: '🎯 Options Flow' },
  { id: 'summary',    label: '🎯 Options Picks' },
  { id: 'portfolio',  label: '💼 Portfolio Analyzer' },
  { id: 'analyzer',   label: '🔍 Stock Analyzer' },
]

export default function TabNav({ active, onChange }) {
  return (
    <nav className="tabs-scroll bg-white border-b border-slate-200 px-6 flex gap-0.5 overflow-x-auto">
      {TABS.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors duration-150 ${
            active === t.id
              ? 'text-blue-600 border-blue-600'
              : t.id === 'analyzer'
              ? 'text-violet-600 border-transparent hover:text-violet-800'
              : 'text-slate-500 border-transparent hover:text-blue-800'
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  )
}
