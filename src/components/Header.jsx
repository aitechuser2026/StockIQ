import React, { useState } from 'react'

export default function Header({ dataSource, countdown, onRefreshChange, user, onLogout, isSyncing }) {
  const [inputVal, setInputVal] = useState('')

  const handleKey = (e) => {
    if (e.key === 'Enter') {
      const val = inputVal.trim()
      const match = val.match(/^(\d+\.?\d*)\s*(s|sec|m|min|mins|minutes?)?$/i)
      if (match) {
        const num = parseFloat(match[1])
        const unit = (match[2] || 'min').toLowerCase()
        const secs = unit.startsWith('s') ? num : num * 60
        if (secs >= 10) onRefreshChange(Math.round(secs))
      }
    }
  }

  const mins = Math.floor(countdown / 60)
  const secs = countdown % 60
  const countStr = `${mins}:${String(secs).padStart(2, '0')}`

  return (
    <header style={{ background: 'linear-gradient(135deg,#0f1629 0%,#1a2744 60%,#0f1629 100%)', borderBottom: '2px solid #2d4a8a' }}
      className="text-white px-6 py-3 flex justify-between items-center flex-wrap gap-3">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-xl font-bold">📈 <span className="text-blue-400">Stock Analysis</span> Dashboard</h1>
          <p className="text-xs text-slate-400 mt-0.5">US Markets · Real-Time · May 2026</p>
        </div>
        {isSyncing && (
          <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30 animate-pulse">
            Syncing...
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Data status */}
        {dataSource === 'live' ? (
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-800">✅ Live</span>
        ) : (
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">⚠️ Cache</span>
        )}

        {/* Refresh input */}
        <div className="text-center bg-white/10 border border-white/20 rounded-lg px-3 py-1">
          <div className="text-[10px] text-slate-400 uppercase tracking-wide">Refresh</div>
          <input
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKey}
            placeholder="5m"
            className="bg-white/10 border border-white/20 rounded text-white text-xs font-semibold w-12 text-center py-0.5 outline-none focus:border-blue-400 mt-0.5"
          />
        </div>

        {/* Countdown */}
        <div className="text-center bg-white/10 border border-white/20 rounded-lg px-3 py-1 min-w-[60px]">
          <div className="text-[10px] text-slate-400 uppercase tracking-wide">Next</div>
          <div className="text-sm font-bold text-green-400 tabular-nums">{countStr}</div>
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-3 border-l border-white/10 ml-2">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-white truncate max-w-[120px]">{user.email}</div>
            <button onClick={onLogout} className="text-[10px] text-slate-400 hover:text-white transition-colors">Sign Out</button>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-sm shadow-lg border border-white/20">
            {user.email[0].toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  )
}
