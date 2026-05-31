import React, { useState, useEffect } from 'react'

function useETClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

export default function Header({ user, onLogout, isSyncing }) {
  const [showMenu, setShowMenu] = useState(false)
  const now = useETClock()

  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/New_York'
  })
  const isMarketOpen = (() => {
    const h   = parseInt(now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }))
    const m   = parseInt(now.toLocaleString('en-US', { minute: 'numeric', timeZone: 'America/New_York' }))
    const day = now.toLocaleString('en-US', { weekday: 'short', timeZone: 'America/New_York' })
    const mins = h * 60 + m
    return !['Sat','Sun'].includes(day) && mins >= 570 && mins < 960 // 9:30–4:00 ET
  })()

  return (
    <header
      style={{ background: 'linear-gradient(135deg,#0a0f1e 0%,#111827 50%,#0a0f1e 100%)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      className="text-white px-4 md:px-6 py-3 flex justify-between items-center gap-3 relative z-30">

      {/* ── Left: brand ── */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📈</span>
          <div>
            <div className="text-base font-black tracking-tight leading-none">
              Stock<span className="text-blue-400">IQ</span>
            </div>
            <div className="text-[10px] text-slate-500 leading-none mt-0.5 hidden sm:block">
              US Markets · Auto-refresh 1 min
            </div>
          </div>
        </div>

        {/* Market status pill */}
        <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
          isMarketOpen
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-slate-700/40 border-slate-600/30 text-slate-500'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isMarketOpen ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
          {isMarketOpen ? 'Market Open' : 'Market Closed'}
        </div>

        {isSyncing && (
          <span className="hidden md:inline text-[10px] bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 animate-pulse">
            Syncing…
          </span>
        )}
      </div>

      {/* ── Right: ET clock + avatar ── */}
      <div className="flex items-center gap-3">

        {/* ET clock */}
        <div className="text-right hidden sm:block">
          <div className="text-sm font-bold tabular-nums text-white">{timeStr} <span className="text-slate-500 text-[10px]">ET</span></div>
          <div className="text-[10px] text-slate-500 leading-none">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' })}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-7 bg-white/10 hidden sm:block" />

        {/* Avatar + dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(m => !m)}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-sm shadow-lg border border-white/20 flex-shrink-0 hover:scale-105 transition-transform">
            {user.email[0].toUpperCase()}
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-10 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden w-56">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <div className="font-bold text-slate-800 text-sm truncate">{user.email}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">StockIQ · Auto-refresh every 60s</div>
                </div>
                <button
                  onClick={() => { onLogout(); setShowMenu(false) }}
                  className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 transition-colors text-sm font-semibold flex items-center gap-2">
                  <span>→</span> Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
