import React, { useState } from 'react'

export default function Header({ dataSource, countdown, onRefreshChange, user, onLogout, isSyncing }) {
  const [inputVal,    setInputVal]    = useState('')
  const [showMenu,    setShowMenu]    = useState(false)

  const handleKey = (e) => {
    if (e.key === 'Enter') {
      const val = inputVal.trim()
      const match = val.match(/^(\d+\.?\d*)\s*(s|sec|m|min|mins|minutes?)?$/i)
      if (match) {
        const num  = parseFloat(match[1])
        const unit = (match[2] || 'min').toLowerCase()
        const secs = unit.startsWith('s') ? num : num * 60
        if (secs >= 10) onRefreshChange(Math.round(secs))
      }
    }
  }

  const mins     = Math.floor(countdown / 60)
  const secs     = countdown % 60
  const countStr = `${mins}:${String(secs).padStart(2, '0')}`

  return (
    <header
      style={{ background: 'linear-gradient(135deg,#0f1629 0%,#1a2744 60%,#0f1629 100%)', borderBottom: '2px solid #2d4a8a' }}
      className="text-white px-4 md:px-6 py-2 md:py-3 flex justify-between items-center gap-2 relative z-30">

      {/* ── Left: brand ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <h1 className="text-base md:text-xl font-bold leading-tight whitespace-nowrap">
            📈 <span className="text-blue-400">StockIQ</span>
          </h1>
          <p className="text-[10px] md:text-xs text-slate-400 hidden sm:block">US Markets · Real-Time · May 2026</p>
        </div>
        {isSyncing && (
          <span className="hidden sm:inline text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30 animate-pulse whitespace-nowrap">
            Syncing…
          </span>
        )}
      </div>

      {/* ── Right: controls ───────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 md:gap-3">

        {/* Live/Cache badge — always visible */}
        {dataSource === 'live' ? (
          <span className="text-[10px] md:text-xs font-semibold px-2 py-0.5 md:py-1 rounded-full bg-green-100 text-green-800 whitespace-nowrap">✅ Live</span>
        ) : (
          <span className="text-[10px] md:text-xs font-semibold px-2 py-0.5 md:py-1 rounded-full bg-yellow-100 text-yellow-800 whitespace-nowrap">⚠️ Cache</span>
        )}

        {/* Countdown — always visible */}
        <div className="text-center bg-white/10 border border-white/20 rounded-lg px-2 md:px-3 py-1 min-w-[48px]">
          <div className="text-[9px] md:text-[10px] text-slate-400 uppercase tracking-wide leading-none">Next</div>
          <div className="text-xs md:text-sm font-bold text-green-400 tabular-nums">{countStr}</div>
        </div>

        {/* Refresh input — hidden on mobile */}
        <div className="hidden md:block text-center bg-white/10 border border-white/20 rounded-lg px-3 py-1">
          <div className="text-[10px] text-slate-400 uppercase tracking-wide">Refresh</div>
          <input
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKey}
            placeholder="5m"
            className="bg-white/10 border border-white/20 rounded text-white text-xs font-semibold w-12 text-center py-0.5 outline-none focus:border-blue-400 mt-0.5"
          />
        </div>

        {/* User avatar + dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(m => !m)}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-sm shadow-lg border border-white/20 flex-shrink-0">
            {user.email[0].toUpperCase()}
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-10 z-50 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 w-52 text-sm">
                <div className="px-4 py-2 border-b border-slate-100">
                  <div className="font-semibold text-slate-800 truncate">{user.email}</div>
                  <div className="text-xs text-slate-400 mt-0.5">StockIQ account</div>
                </div>
                {/* Refresh control in menu on mobile */}
                <div className="md:hidden px-4 py-2 border-b border-slate-100">
                  <div className="text-xs text-slate-500 mb-1">Refresh interval</div>
                  <input
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    onKeyDown={e => { handleKey(e); if (e.key === 'Enter') setShowMenu(false) }}
                    placeholder="e.g. 5m or 30s"
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <button
                  onClick={() => { onLogout(); setShowMenu(false) }}
                  className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 transition-colors font-medium">
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
