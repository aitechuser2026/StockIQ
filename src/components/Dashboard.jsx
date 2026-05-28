import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import SPSeasonality from './SPSeasonality'

// ── Market overview cards (static context — swap with live API later) ─────────
const MARKET_CARDS = [
  { label: 'S&P 500',    symbol: '^GSPC', value: '5,892', change: '+1.2%', up: true,  color: 'indigo' },
  { label: 'Nasdaq',     symbol: '^IXIC', value: '21,450', change: '+1.8%', up: true,  color: 'blue'   },
  { label: 'VIX',        symbol: '^VIX',  value: '17.8',   change: '-3.1%', up: false, color: 'violet' },
  { label: '10-Yr Yield',symbol: '^TNX',  value: '4.35%',  change: '+0.02',  up: true,  color: 'orange' },
]

const COLOR_MAP = {
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  violet: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', dot: 'bg-violet-500' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500' },
}

// ── Suggestion chips ───────────────────────────────────────────────────────────
const SUGGESTIONS = ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'META', 'AMZN', 'TSLA', 'PLTR', 'CRDO', 'XOM', 'JPM', 'SPY']

export default function Dashboard({ user }) {
  const [watchlist,  setWatchlist]  = useState([])
  const [ticker,     setTicker]     = useState('')
  const [company,    setCompany]    = useState('')
  const [notes,      setNotes]      = useState('')
  const [adding,     setAdding]     = useState(false)
  const [showForm,   setShowForm]   = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [deleting,   setDeleting]   = useState(null)
  const [toast,      setToast]      = useState(null)
  const [activeTab,  setActiveTab]  = useState('watchlist')   // 'watchlist' | 'picks'
  const [profile,    setProfile]    = useState(null)

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const flash = (type, text) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Load data ─────────────────────────────────────────────────────────────────
  const loadWatchlist = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('watchlists')
      .select('*')
      .order('added_at', { ascending: false })

    if (!error) setWatchlist(data || [])
    setLoading(false)
  }, [])

  const loadProfile = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('display_name, risk_tolerance')
      .eq('id', user.id)
      .single()
    if (data) setProfile(data)
  }, [user.id])

  useEffect(() => {
    loadWatchlist()
    loadProfile()
  }, [loadWatchlist, loadProfile])

  // ── Add to watchlist ──────────────────────────────────────────────────────────
  async function handleAdd(e) {
    e.preventDefault()
    if (!ticker.trim()) return
    setAdding(true)

    const { error } = await supabase.from('watchlists').insert({
      user_id: user.id,
      ticker:  ticker.trim().toUpperCase(),
      company: company.trim() || null,
      notes:   notes.trim() || null,
    })

    if (error) {
      flash('error', error.code === '23505' ? `${ticker.toUpperCase()} is already in your watchlist.` : error.message)
    } else {
      flash('success', `✅ ${ticker.toUpperCase()} added to watchlist!`)
      setTicker(''); setCompany(''); setNotes('')
      setShowForm(false)
      loadWatchlist()
    }
    setAdding(false)
  }

  // ── Remove from watchlist ─────────────────────────────────────────────────────
  async function handleRemove(id, sym) {
    setDeleting(id)
    const { error } = await supabase.from('watchlists').delete().eq('id', id)
    if (error) flash('error', error.message)
    else {
      flash('success', `🗑️ ${sym} removed.`)
      setWatchlist(prev => prev.filter(w => w.id !== id))
    }
    setDeleting(null)
  }

  // ── Sign out ──────────────────────────────────────────────────────────────────
  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📈</span>
            <div>
              <h1 className="text-lg font-black text-slate-800 leading-none">StockIQ</h1>
              <p className="text-xs text-slate-400 leading-none mt-0.5">Personal Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1.5">
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                {(profile?.display_name || user.email || 'U')[0].toUpperCase()}
              </div>
              <div className="text-xs">
                <div className="font-semibold text-slate-700">{profile?.display_name || 'Investor'}</div>
                <div className="text-slate-400">{profile?.risk_tolerance || 'Moderate'} risk</div>
              </div>
            </div>
            <button onClick={handleSignOut}
              className="text-xs text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-300 px-3 py-1.5 rounded-full transition-all font-medium">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ── Toast ───────────────────────────────────────────────────────────── */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 rounded-xl shadow-lg px-5 py-3 text-sm font-semibold transition-all ${
            toast.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-emerald-600 text-white'
          }`}>
            {toast.text}
          </div>
        )}

        {/* ── Market Overview ──────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Market Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {MARKET_CARDS.map(card => {
              const c = COLOR_MAP[card.color]
              return (
                <div key={card.symbol} className={`rounded-2xl border ${c.bg} ${c.border} p-4`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`w-2 h-2 rounded-full ${c.dot}`} />
                    <span className="text-xs font-semibold text-slate-500">{card.label}</span>
                  </div>
                  <div className="text-xl font-black text-slate-800">{card.value}</div>
                  <div className={`text-sm font-bold ${card.up ? 'text-emerald-600' : 'text-red-500'}`}>
                    {card.up ? '▲' : '▼'} {card.change}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap bg-white border border-slate-200 rounded-2xl p-1 shadow-sm w-fit gap-1">
          {[
            { key: 'watchlist',   label: '👁️ Watchlist' },
            { key: 'picks',       label: '⭐ My Picks' },
            { key: 'seasonality', label: '📅 Seasonality' },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === t.key
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-500 hover:text-slate-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── WATCHLIST TAB ────────────────────────────────────────────────────── */}
        {activeTab === 'watchlist' && (
          <section className="space-y-4">
            {/* Add button / form */}
            {!showForm ? (
              <button onClick={() => setShowForm(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-indigo-200 transition-all active:scale-[.98]">
                <span className="text-lg">+</span> Add to Watchlist
              </button>
            ) : (
              <form onSubmit={handleAdd}
                className="bg-white rounded-2xl border border-indigo-200 shadow-md p-5 space-y-3">
                <h3 className="font-bold text-slate-700">Add a Stock</h3>

                {/* Suggestion chips */}
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map(s => (
                    <button key={s} type="button"
                      onClick={() => setTicker(s)}
                      className={`text-xs px-2.5 py-1 rounded-full border font-semibold transition-all ${
                        ticker === s
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:border-indigo-400'
                      }`}>
                      {s}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                      Ticker *
                    </label>
                    <input
                      required value={ticker}
                      onChange={e => setTicker(e.target.value.toUpperCase())}
                      placeholder="e.g. NVDA"
                      maxLength={10}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                      Company (optional)
                    </label>
                    <input value={company} onChange={e => setCompany(e.target.value)}
                      placeholder="e.g. NVIDIA Corp"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                      Notes (optional)
                    </label>
                    <input value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder="e.g. AI play, watch $220"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={adding}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-60">
                    {adding ? 'Saving…' : '✅ Save to Watchlist'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)}
                    className="border border-slate-200 text-slate-600 hover:bg-slate-100 px-4 py-2 rounded-xl text-sm font-medium transition-all">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Watchlist items */}
            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="h-16 bg-slate-200 animate-pulse rounded-2xl" />
                ))}
              </div>
            ) : watchlist.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center">
                <div className="text-4xl mb-3">📋</div>
                <h3 className="font-bold text-slate-600">Your watchlist is empty</h3>
                <p className="text-sm text-slate-400 mt-1">Add stocks above to start tracking them.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="grid grid-cols-[2fr_3fr_1fr] text-xs font-bold text-slate-400 uppercase tracking-wide px-5 py-3 border-b border-slate-100">
                  <span>Ticker</span>
                  <span>Notes</span>
                  <span className="text-right">Action</span>
                </div>
                {watchlist.map((item, idx) => (
                  <div key={item.id}
                    className={`grid grid-cols-[2fr_3fr_1fr] items-center px-5 py-4 ${
                      idx < watchlist.length - 1 ? 'border-b border-slate-50' : ''
                    } hover:bg-slate-50 transition-colors`}>

                    <div>
                      <div className="font-black text-slate-800 text-base font-mono">{item.ticker}</div>
                      {item.company && (
                        <div className="text-xs text-slate-400 mt-0.5">{item.company}</div>
                      )}
                    </div>

                    <div className="text-sm text-slate-600 truncate pr-4">
                      {item.notes || <span className="text-slate-300 italic">No notes</span>}
                    </div>

                    <div className="text-right">
                      <button
                        onClick={() => handleRemove(item.id, item.ticker)}
                        disabled={deleting === item.id}
                        className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-all font-semibold disabled:opacity-40">
                        {deleting === item.id ? '…' : 'Remove'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Count badge */}
            {watchlist.length > 0 && (
              <p className="text-xs text-slate-400">
                {watchlist.length} stock{watchlist.length !== 1 ? 's' : ''} in your watchlist · saved to your account
              </p>
            )}
          </section>
        )}

        {/* ── SAVED PICKS TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'picks' && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
            <div className="text-4xl mb-3">⭐</div>
            <h3 className="font-bold text-slate-700 text-lg">Saved Picks coming soon</h3>
            <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto">
              You'll be able to save stocks from the Growth, Value, and Earnings pages with
              your own target price, stop-loss, and notes — all stored in your account.
            </p>
          </section>
        )}

        {/* ── SEASONALITY TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'seasonality' && (
          <section>
            <SPSeasonality />
          </section>
        )}

        {/* ── Footer ───────────────────────────────────────────────────────────── */}
        <footer className="text-center text-xs text-slate-400 pb-4 pt-2">
          StockIQ · Powered by Supabase + Vercel · Data for educational purposes only
        </footer>
      </main>
    </div>
  )
}
