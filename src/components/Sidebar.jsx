import React, { useState } from 'react'

const NAV_ITEMS = [
  { id: 'calendar',     icon: '🗓️',  label: 'Calendar',        sub: 'Events · May–Jun 2026' },
  { id: 'macro',        icon: '🌐',  label: 'Macro',           sub: 'Fed · Yields · Regime' },
  { id: 'overview',     icon: '📊',  label: 'Live Market',     sub: 'Indices · Sectors · F&G' },
  { id: 'sectors',      icon: '🔄',  label: 'Sectors',         sub: 'Leading vs Lagging' },
  { id: 'growth',       icon: '🚀',  label: 'Growth',          sub: 'AI · Tech · Momentum' },
  { id: 'value',        icon: '💎',  label: 'Value',           sub: 'Undervalued · Dividend' },
  { id: 'optionsplays', icon: '🎯',  label: 'Options Plays',   sub: '1–3 week setups' },
  { id: 'earnings',     icon: '📣',  label: 'Earnings',        sub: 'Jun 2026 movers' },
  { id: 'seasonality',  icon: '📅',  label: 'Seasonality',     sub: 'Monthly dip analysis' },
  { id: 'options',      icon: '🎰',  label: 'Options Flow',    sub: 'Trending · 2-week plays' },
  { id: 'summary',      icon: '📋',  label: 'Options Picks',   sub: 'Safe premium picks' },
  { id: 'portfolio',    icon: '💼',  label: 'Portfolio',       sub: 'Track & Optimize' },
  { id: 'signals',      icon: '📡',  label: 'Signals',         sub: 'Red · Orange · Green' },
  { id: 'analyzer',     icon: '🔍',  label: 'Analyzer',        sub: 'Deep dive any ticker' },
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

// Compact label for bottom bar (max ~7 chars)
const BOTTOM_LABEL = {
  calendar: 'Calendar', macro: 'Macro', overview: 'Market',
  sectors: 'Sectors', growth: 'Growth', value: 'Value',
  optionsplays: 'Options', earnings: 'Earnings', seasonality: 'Season',
  options: 'Flow', summary: 'Picks', portfolio: 'Portfolio',
  signals: 'Signals', analyzer: 'Analyze',
}

export default function Sidebar({ active, onChange }) {
  const [collapsed,   setCollapsed]   = useState(false)
  const [drawerOpen,  setDrawerOpen]  = useState(false)

  // Pinned tabs shown in the bottom bar (most commonly used)
  const PINNED = ['overview', 'growth', 'value', 'optionsplays', 'portfolio']
  // "More" drawer shows the rest

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════
          MOBILE — Fixed bottom tab bar + slide-up "More" drawer
      ═══════════════════════════════════════════════════════════════════ */}

      {/* Bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-stretch h-16">
          {PINNED.map(id => {
            const item = NAV_ITEMS.find(n => n.id === id)
            if (!item) return null
            const isActive = active === id
            return (
              <button key={id} onClick={() => onChange(id)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors min-w-0 ${
                  isActive ? 'text-blue-600' : 'text-slate-500'
                }`}>
                <span className="text-xl leading-none">{item.icon}</span>
                <span className={`text-[9px] font-semibold leading-none truncate w-full text-center px-0.5 ${
                  isActive ? 'text-blue-600' : 'text-slate-400'
                }`}>{BOTTOM_LABEL[id]}</span>
                {isActive && <div className="absolute bottom-0 h-0.5 w-8 bg-blue-600 rounded-t-full" />}
              </button>
            )
          })}
          {/* More button */}
          <button onClick={() => setDrawerOpen(o => !o)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors min-w-0 ${
              !PINNED.includes(active) ? 'text-blue-600' : 'text-slate-500'
            }`}>
            <span className="text-xl leading-none">
              {!PINNED.includes(active)
                ? NAV_ITEMS.find(n => n.id === active)?.icon ?? '☰'
                : '☰'}
            </span>
            <span className={`text-[9px] font-semibold leading-none ${
              !PINNED.includes(active) ? 'text-blue-600' : 'text-slate-400'
            }`}>
              {!PINNED.includes(active)
                ? BOTTOM_LABEL[active] ?? 'More'
                : 'More'}
            </span>
          </button>
        </div>
      </nav>

      {/* Slide-up "More" drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="relative bg-white rounded-t-2xl shadow-2xl overflow-hidden"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4rem)' }}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>
            <div className="px-4 pb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">All Pages</span>
              <button onClick={() => setDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1 px-3 pb-4 overflow-y-auto max-h-[60vh]">
              {NAV_ITEMS.map(item => {
                const isActive = active === item.id
                return (
                  <button key={item.id}
                    onClick={() => { onChange(item.id); setDrawerOpen(false) }}
                    className={`flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-xl transition-colors ${
                      isActive
                        ? 'bg-blue-50 ring-2 ring-blue-400'
                        : 'hover:bg-slate-50 active:bg-slate-100'
                    }`}>
                    <span className="text-2xl leading-none">{item.icon}</span>
                    <span className={`text-[10px] font-semibold text-center leading-tight ${
                      isActive ? 'text-blue-700' : 'text-slate-600'
                    }`}>{BOTTOM_LABEL[item.id]}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          DESKTOP — Collapsible left sidebar (unchanged)
      ═══════════════════════════════════════════════════════════════════ */}
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
