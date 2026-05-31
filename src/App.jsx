import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, isConfigured } from './supabaseClient'

import Header           from './components/Header'
import Sidebar          from './components/Sidebar'
import Auth             from './components/Auth'

import CalendarPage     from './components/tabs/CalendarPage'
import LiveMarket       from './components/tabs/LiveMarket'
import OptionsFlow      from './components/tabs/OptionsFlow'
import Summary          from './components/tabs/Summary'
import StockAnalyzer    from './components/tabs/StockAnalyzer'
import PortfolioAnalyzer from './components/tabs/PortfolioAnalyzer'
import PortfolioSignals  from './components/tabs/PortfolioSignals'
import SPSeasonality    from './components/tabs/SPSeasonality'
import GrowthPicks      from './components/tabs/GrowthPicks'
import ValuePicks       from './components/tabs/ValuePicks'
import OptionsPlays     from './components/tabs/OptionsPlays'
import SectorRotation   from './components/tabs/SectorRotation'
import MacroDashboard   from './components/tabs/MacroDashboard'
import EarningsPlays    from './components/tabs/EarningsPlays'

import { useStockData } from './hooks/useStockData'
import { loadUserSettings, saveUserSettings, saveLocalNow } from './services/portfolioService'

const DEFAULT_PORTFOLIOS   = { 'My Portfolio': [] }
const DEFAULT_PORTFOLIO_ID = 'My Portfolio'

// ── Setup screen (shown when .env keys are missing) ───────────────────────────
function SetupScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-8 space-y-5">
        <div className="text-center">
          <div className="text-5xl mb-3">📈</div>
          <h1 className="text-2xl font-black text-slate-800">StockIQ — Setup Required</h1>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <strong>Missing Supabase credentials.</strong> Copy <code className="bg-amber-100 px-1 rounded">.env.example</code> to <code className="bg-amber-100 px-1 rounded">.env</code> and fill in your <code className="bg-amber-100 px-1 rounded">VITE_SUPABASE_URL</code> and <code className="bg-amber-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code>, then restart <code className="bg-amber-100 px-1 rounded">npm run dev</code>.
        </div>
        <p className="text-xs text-slate-500 text-center">
          Get your keys: <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline">supabase.com</a> → Your Project → Settings → API
        </p>
      </div>
    </div>
  )
}

// ── Full dashboard (shown when logged in) ─────────────────────────────────────
function Dashboard({ user, onLogout }) {
  const [activeTab,         setActiveTab]         = useState('calendar')
  const [refreshSecs,       setRefreshSecs]       = useState(60)   // auto every 60s, not user-controlled
  const [watchedTickers,    setWatchedTickers]    = useState([])
  const [portfolios,        setPortfolios]        = useState(DEFAULT_PORTFOLIOS)
  const [activePortfolioId, setActivePortfolioId] = useState(DEFAULT_PORTFOLIO_ID)
  const [isSyncing,         setIsSyncing]         = useState(false)
  const [dbLoading,         setDbLoading]         = useState(true)

  const hasLoaded = useRef(false)
  const fsTimer   = useRef(null)

  const { marketData, dataSource, countdown, fmtPrice, fmtChg, isUp } =
    useStockData(refreshSecs, watchedTickers)

  const holdings    = portfolios[activePortfolioId] || []
  const setHoldings = useCallback((updaterOrValue) => {
    setPortfolios(prev => {
      const current = prev[activePortfolioId] || []
      const next    = typeof updaterOrValue === 'function' ? updaterOrValue(current) : updaterOrValue
      return { ...prev, [activePortfolioId]: next }
    })
  }, [activePortfolioId])

  // ── Load from DB on mount ───────────────────────────────────────────────────
  useEffect(() => {
    hasLoaded.current = false
    setDbLoading(true)
    ;(async () => {
      try {
        const s = await loadUserSettings()
        if (s?.portfolios && Object.keys(s.portfolios).length > 0) {
          setPortfolios(s.portfolios)
          if (s.activePortfolioId) setActivePortfolioId(s.activePortfolioId)
        }
        if (s?.watchedTickers?.length) setWatchedTickers(s.watchedTickers)
        if (s?.activeTab)              setActiveTab(s.activeTab)
      } finally {
        hasLoaded.current = true
        setDbLoading(false)
      }
    })()
  }, [user.id]) // eslint-disable-line

  // ── Save: localStorage immediately, Supabase debounced ─────────────────────
  useEffect(() => {
    if (!hasLoaded.current) return
    const data = { portfolios, activePortfolioId, watchedTickers, activeTab }
    saveLocalNow(data)
    if (fsTimer.current) clearTimeout(fsTimer.current)
    fsTimer.current = setTimeout(async () => {
      setIsSyncing(true)
      try { await saveUserSettings(data) } finally { setIsSyncing(false) }
    }, 3000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolios, activePortfolioId, watchedTickers, refreshSecs, activeTab])

  // Safety net: flush on tab close
  useEffect(() => {
    const flush = () => {
      if (!hasLoaded.current) return
      saveLocalNow({ portfolios, activePortfolioId, watchedTickers, refreshSecs, activeTab })
    }
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolios, activePortfolioId, watchedTickers, refreshSecs, activeTab])

  const onAddTicker = (ticker) => {
    setWatchedTickers(prev => Array.from(new Set([...prev, ticker.toUpperCase()])))
  }

  if (dbLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 gap-3">
        <div className="text-3xl animate-spin">⟳</div>
        <div className="text-slate-400 text-sm font-semibold">Loading your portfolio…</div>
      </div>
    )
  }

  const stockProps = { marketData, fmtPrice, fmtChg, isUp, onAddTicker }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Header
        user={{ email: user.email }}
        onLogout={onLogout}
        isSyncing={isSyncing}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar active={activeTab} onChange={setActiveTab} />

        <main className="flex-1 overflow-y-auto">
          <div className="p-3 md:p-6 max-w-[1300px] mx-auto pb-24 md:pb-6">
            {activeTab === 'calendar'     && <CalendarPage />}
            {activeTab === 'overview'     && <LiveMarket />}
            {activeTab === 'options'      && <OptionsFlow />}
            {activeTab === 'summary'      && <Summary {...stockProps} />}
            {activeTab === 'portfolio'    && (
              <PortfolioAnalyzer
                {...stockProps}
                holdings={holdings}
                setHoldings={setHoldings}
                portfolios={portfolios}
                setPortfolios={setPortfolios}
                activePortfolioId={activePortfolioId}
                setActivePortfolioId={setActivePortfolioId}
              />
            )}
            {activeTab === 'signals'      && (
              <PortfolioSignals
                portfolios={portfolios}
                defaultPortfolioId={activePortfolioId}
              />
            )}
            {activeTab === 'seasonality'  && <SPSeasonality />}
            {activeTab === 'growth'       && <GrowthPicks />}
            {activeTab === 'value'        && <ValuePicks />}
            {activeTab === 'optionsplays' && <OptionsPlays />}
            {activeTab === 'sectors'      && <SectorRotation />}
            {activeTab === 'macro'        && <MacroDashboard />}
            {activeTab === 'earnings'     && <EarningsPlays />}
            {activeTab === 'analyzer'     && <StockAnalyzer />}
          </div>

          <footer className="text-center py-4 text-xs text-slate-400 border-t border-slate-200 bg-white mt-4 mb-16 md:mb-0">
            StockIQ · {user.email} · Data: Yahoo Finance · May 2026
          </footer>
        </main>
      </div>
    </div>
  )
}

// ── Auth shell — handles login state ─────────────────────────────────────────
function AuthenticatedApp() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">📈</div>
          <div className="text-white font-bold text-lg">Loading StockIQ…</div>
          <div className="mt-3 flex justify-center gap-1">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!session) return <Auth />

  return <Dashboard user={session.user} onLogout={handleLogout} />
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  if (!isConfigured) return <SetupScreen />
  return <AuthenticatedApp />
}
