import React, { useState } from 'react'

const NAV_ITEMS = [
  { id: 'calendar',     icon: '🗓️',  label: 'Calendar',           sub: 'Events · May–Jun 2026' },
  { id: 'macro',        icon: '🌐',  label: 'Macro Dashboard',    sub: 'Fed · Yields · Regime' },
  { id: 'overview',     icon: '📊',  label: 'Live Market',        sub: 'Indices · Sectors · F&G' },
  { id: 'sectors',      icon: '🔄',  label: 'Sector Rotation',    sub: 'Leading vs Lagging' },
  { id: 'growth',       icon: '🚀',  label: 'Growth Picks',       sub: 'AI · Tech · Momentum' },
  { id: 'value',        icon: '💎',  label: 'Value Picks',        sub: 'Undervalued · Dividend' },
  { id: 'optionsplays', icon: '🎯',  label: 'Options Plays',      sub: '1–3 week setups' },
  { id: 'earnings',     icon: '📣',  label: 'Earnings Plays',     sub: 'Jun 2026 movers' },
  { id: 'seasonality',  icon: '📅',  label: 'S&P Seasonality',    sub: 'Monthly dip analysis' },
  { id: 'options',      icon: '🎯',  label: 'Options Flow',       sub: 'Trending · 2-week plays' },
  { id: 'summary',      icon: '📋',  label: 'Options Picks',      sub: 'Safe premium picks' },
  { id: 'portfolio',    icon: '💼',  label: 'Portfolio',          sub: 'Track & Optimize' },
  { id: 'signals',      icon: '📡',  label: 'Signal Engine',      sub: 'Red · Orange · Green' },
  { id: 'analyzer',     icon: '🔍',  label: 'Stock Analyzer',     sub: 'Deep dive any ticker' },
]

const SECTION_LABELS = {
  calendar:     'Market',
  macro:        'Market',
  overview:     'Market',
  sectors:      'Research',
  growth:       'Research',
  value:        'Research',
  optionsplays: 'Research',
  earnings:     'Research',
  seasonality:  'Research',
  options:      'Analysis',
  summary:      'Analysis',
  portfolio:    'Portfolio',
  signals:      'Portfolio',
  analyzer:     'Analysis',
}

export default function Sidebar({ active, onChange }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* ── Mobile top bar (shown on small screens) ── */}
      <div className="md:hidden flex items-center gap-3 bg-white border-b border-slate-200 px-4 py-2.5">
        <button onClick={() => setMobileOpen(o => !o)}
          className="text-slate-600 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="font-bold text-slate-700 text-sm">
          {NAV_ITEMS.find(n => n.id === active)?.icon} {NAV_ITEMS.find(n => n.id === active)?.label}
        </span>
      </div>

      {/* ── Mobile overlay drawer ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="bg-black/40 absolute inset-0" onClick={() => setMobileOpen(false)} />
          <nav className="relative w-64 bg-white h-full shadow-2xl flex flex-col z-10">
            <div className="px-4 py-4 border-b border-slate-100">
              <div className="font-bold text-slate-800 text-sm">Navigation</div>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {NAV_ITEMS.map(item => (
                <button key={item.id}
                  onClick={() => { onChange(item.id); setMobileOpen(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    active === item.id
                      ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-600'
                      : 'text-slate-600 hover:bg-slate-50 border-r-4 border-transparent'
                  }`}>
                  <span className="text-xl w-7 flex-shrink-0">{item.icon}</span>
                  <div>
                    <div className={`text-sm font-semibold ${active === item.id ? 'text-blue-700' : 'text-slate-700'}`}>
                      {item.label}
                    </div>
                    <div className="text-xs text-slate-400">{item.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </nav>
        </div>
      )}

      {/* ── Desktop sidebar ── */}
      <aside className={`hidden md:flex flex-col bg-white border-r border-slate-200 flex-shrink-0 transition-all duration-200 ${collapsed ? 'w-16' : 'w-56'}`}>
        {/* Collapse toggle */}
        <div className={`flex items-center border-b border-slate-100 px-3 py-3 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Navigation</span>}
          <button onClick={() => setCollapsed(c => !c)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-50 transition-colors flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {collapsed
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              }
            </svg>
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {/* Section dividers when expanded */}
          {(() => {
            const rendered = []
            let lastSection = null
            NAV_ITEMS.forEach(item => {
              const section = SECTION_LABELS[item.id]
              if (!collapsed && section !== lastSection) {
                lastSection = section
                rendered.push(
                  <div key={`divider-${section}`} className="px-3 pt-3 pb-1">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-widest">{section}</div>
                  </div>
                )
              }
              rendered.push(
                <button key={item.id} onClick={() => onChange(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 transition-colors group relative
                    ${collapsed ? 'justify-center px-0 py-3' : 'px-3 py-2.5'}
                    ${active === item.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                    }`}>
                  {/* Active indicator */}
                  {active === item.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r-full" />
                  )}
                  <span className={`flex-shrink-0 ${collapsed ? 'text-2xl' : 'text-lg w-6 text-center'}`}>
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <div className="min-w-0">
                      <div className={`text-sm font-semibold truncate leading-tight ${active === item.id ? 'text-blue-700' : ''}`}>
                        {item.label}
                      </div>
                      <div className="text-xs text-slate-400 truncate leading-tight mt-0.5">{item.sub}</div>
                    </div>
                  )}
                  {/* Tooltip on collapsed */}
                  {collapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                      {item.label}
                    </div>
                  )}
                </button>
              )
            })
            return rendered
          })()}
        </nav>

        {/* Bottom: data badge */}
        {!collapsed && (
          <div className="p-3 border-t border-slate-100">
            <div className="text-xs text-slate-400 text-center leading-relaxed">
              Data: Yahoo Finance<br />
              <span className="text-slate-300">15-min delayed</span>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
