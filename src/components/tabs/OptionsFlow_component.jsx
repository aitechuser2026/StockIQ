// ── Main page ──────────────────────────────────────────────────────────────────
export default function OptionsFlow() {
  const [filter,   setFilter]   = useState('ALL')
  const [sort,     setSort]     = useState('rating')
  const [expanded, setExpanded] = useState(null)

  // Per-card state: { ticker, status: 'loading'|'loaded'|'error', card: object|null }
  const [stockStates, setStockStates] = useState(() =>
    TICKER_LIST.map(ticker => ({ ticker, status: 'loading', card: null }))
  )
  const [lastUpdated, setLastUpdated] = useState(null)
  const [refreshing,  setRefreshing]  = useState(false)

  // ── Fetch one ticker and update its card in state ──────────────────────────
  const fetchOneTicker = useCallback(async (sym) => {
    setStockStates(prev => prev.map(s =>
      s.ticker === sym ? { ...s, status: 'loading' } : s
    ))
    try {
      const [priceData, optsData] = await Promise.all([
        fetchPrice(sym),
        _getOptionsChain(sym),
      ])

      if (!priceData?.price) {
        setStockStates(prev => prev.map(s =>
          s.ticker === sym ? { ...s, status: 'error', card: null } : s
        ))
        return
      }

      const fund   = OPT_DB[sym] || {}
      const merged = {
        pe: priceData.pe, forwardPE: priceData.forwardPE,
        eps: priceData.eps, beta: priceData.beta,
        dividendYield: priceData.dividendYield,
        name: priceData.name,
        ...fund,
      }
      const card = buildOptionsCard(sym, priceData, merged, optsData)

      setStockStates(prev => prev.map(s =>
        s.ticker === sym ? { ...s, status: 'loaded', card } : s
      ))
    } catch (_) {
      setStockStates(prev => prev.map(s =>
        s.ticker === sym ? { ...s, status: 'error', card: null } : s
      ))
    }
  }, [])

  // ── Fetch all tickers in parallel batches ──────────────────────────────────
  const fetchAllLive = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      invalidateCache()
      setRefreshing(true)
      // Reset all to loading
      setStockStates(TICKER_LIST.map(ticker => ({ ticker, status: 'loading', card: null })))
    }

    const BATCH = 5
    const tickers = TICKER_LIST
    for (let i = 0; i < tickers.length; i += BATCH) {
      const batch = tickers.slice(i, i + BATCH)
      await Promise.allSettled(batch.map(sym => fetchOneTicker(sym)))
      if (i + BATCH < tickers.length) await new Promise(r => setTimeout(r, 250))
    }

    setLastUpdated(new Date())
    setRefreshing(false)
  }, [fetchOneTicker])

  // ── Individual card retry ──────────────────────────────────────────────────
  const retryCard = useCallback((sym) => {
    invalidateCache(sym)
    fetchOneTicker(sym)
  }, [fetchOneTicker])

  // Auto-fetch on mount
  useEffect(() => { fetchAllLive(false) }, [fetchAllLive])

  // ── Custom ticker search ───────────────────────────────────────────────────
  const [searchTicker, setSearchTicker] = useState('')
  const [searching,    setSearching]    = useState(false)
  const [searchResult, setSearchResult] = useState(null)
  const [searchError,  setSearchError]  = useState(null)

  const handleSearch = async (sym) => {
    const s = (sym || searchTicker).toUpperCase().trim()
    if (!s) return
    setSearchTicker(s)
    setSearching(true)
    setSearchError(null)
    setSearchResult(null)
    try {
      const [priceR, fundR, optsR] = await Promise.all([
        fetchPrice(s),
        (async () => OPT_DB[s] ?? await _getFundamentals(s))(),
        _getOptionsChain(s),
      ])
      if (!priceR?.price) throw new Error(`No price data found for "${s}". Check the ticker is a valid US exchange symbol.`)
      const mergedFund = {
        pe: priceR.pe, forwardPE: priceR.forwardPE,
        eps: priceR.eps, beta: priceR.beta, dividendYield: priceR.dividendYield,
        name: priceR.name,
        ...(fundR || {}),
      }
      setSearchResult(buildOptionsCard(s, priceR, mergedFund, optsR))
    } catch (e) {
      setSearchError(e.message)
    } finally {
      setSearching(false)
    }
  }

  const clearSearch = () => { setSearchResult(null); setSearchError(null); setSearchTicker('') }

  // ── Derived data for filters / sort ───────────────────────────────────────
  const loadedCards  = stockStates.filter(s => s.status === 'loaded').map(s => s.card)
  const FILTERS      = buildFilters(loadedCards)
  const loadingCount = stockStates.filter(s => s.status === 'loading').length
  const errorCount   = stockStates.filter(s => s.status === 'error').length

  const filtered = stockStates.filter(s => {
    if (filter === 'ALL') return true
    if (s.status !== 'loaded') return false
    return s.card?.rating === filter
  })

  const sorted = [...filtered].sort((a, b) => {
    // Loaded cards first, then loading, then error
    const rank = s => s.status === 'loaded' ? 0 : s.status === 'loading' ? 1 : 2
    if (rank(a) !== rank(b)) return rank(a) - rank(b)
    if (a.status !== 'loaded' || b.status !== 'loaded') return 0
    if (sort === 'upside')  return parseFloat(b.card.upside) - parseFloat(a.card.upside)
    if (sort === 'callput') return b.card.callPut - a.card.callPut
    const order = { STRONG_BUY: 0, BUY: 1, NEUTRAL: 2, CAUTION: 3, AVOID: 4 }
    return (order[a.card.rating] ?? 9) - (order[b.card.rating] ?? 9)
  })

  const toggleExpand = (ticker) => setExpanded(prev => prev === ticker ? null : ticker)

  // Summary counts (from loaded cards only)
  const safeCount  = loadedCards.filter(s => s.safeToOwn).length
  const avoidCount = loadedCards.filter(s => s.rating === 'AVOID').length
  const bullCount  = loadedCards.filter(s => ['STRONG_BUY', 'BUY'].includes(s.rating)).length

  return (
    <div>
      {/* ── Ticker search box ── */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-sm font-bold text-slate-700">🔍 Analyze any ticker:</span>
          <input
            value={searchTicker}
            onChange={e => setSearchTicker(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="e.g. AAPL"
            maxLength={8}
            className="uppercase border-2 border-slate-200 rounded-lg px-3 py-1.5 w-28 text-sm font-bold outline-none focus:border-blue-400 tracking-widest text-slate-900"
          />
          <button
            onClick={() => handleSearch()}
            disabled={searching || !searchTicker.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold px-5 py-1.5 rounded-lg text-sm transition-colors"
          >
            {searching ? 'Fetching…' : 'Analyze'}
          </button>
          {['AAPL','MSFT','COIN','AMD','TSM'].map(q => (
            <button key={q} onClick={() => handleSearch(q)}
              className="bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-600 font-semibold px-2.5 py-1.5 rounded-lg text-xs transition-colors">
              {q}
            </button>
          ))}
          {searchResult && (
            <button onClick={clearSearch}
              className="text-xs text-slate-400 hover:text-slate-600 ml-auto px-2 py-1.5 rounded">
              ✕ Clear
            </button>
          )}
        </div>
        {searchError && (
          <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-1">
            ⚠️ {searchError}
          </div>
        )}
        {searching && (
          <div className="text-xs text-blue-500 mt-1 animate-pulse">
            ⏳ Fetching {searchTicker} from live sources…
          </div>
        )}
      </div>

      {/* ── Search result card ── */}
      {searchResult && !searching && (
        <div className="mb-5">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            📊 Live Analysis — {searchResult.ticker}
          </div>
          <StockCard
            stock={searchResult}
            expanded={expanded === searchResult.ticker}
            onToggle={() => toggleExpand(searchResult.ticker)}
          />
        </div>
      )}

      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-slate-800">🎯 Options Flow — Trending Stocks</h2>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {loadingCount > 0 && (
              <span className="text-xs text-blue-500 font-semibold animate-pulse">
                ⏳ Loading {loadingCount} stock{loadingCount !== 1 ? 's' : ''}…
              </span>
            )}
            {errorCount > 0 && loadingCount === 0 && (
              <span className="text-xs text-orange-500 font-semibold">
                ⚠️ {errorCount} failed — use retry buttons below
              </span>
            )}
            {lastUpdated && loadingCount === 0 && errorCount === 0 && (
              <span className="text-xs text-emerald-600 font-semibold">
                ✅ All live · {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            {lastUpdated && loadingCount === 0 && errorCount > 0 && (
              <span className="text-xs text-slate-400">
                Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="text-slate-400 font-semibold">Sort:</span>
          {[['rating','By Rating'],['upside','By Upside'],['callput','By Flow']].map(([k,l]) => (
            <button key={k} onClick={() => setSort(k)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${sort === k ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
              {l}
            </button>
          ))}
          <button
            onClick={() => fetchAllLive(true)}
            disabled={refreshing || loadingCount > 0}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold px-3 py-1 rounded-lg transition-colors ml-1"
          >
            <span className={refreshing ? 'animate-spin inline-block' : ''}>⟳</span>
            {refreshing ? 'Refreshing…' : 'Refresh All'}
          </button>
        </div>
      </div>

      {/* ── Summary band (only shows when cards are loaded) ── */}
      {loadedCards.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-emerald-700 text-white rounded-xl px-4 py-3 text-center">
            <div className="text-2xl font-black">{safeCount}</div>
            <div className="text-xs font-semibold opacity-90">Safe to Own</div>
          </div>
          <div className="bg-amber-500 text-white rounded-xl px-4 py-3 text-center">
            <div className="text-2xl font-black">{bullCount - safeCount}</div>
            <div className="text-xs font-semibold opacity-90">Options Play Only</div>
          </div>
          <div className="bg-red-600 text-white rounded-xl px-4 py-3 text-center">
            <div className="text-2xl font-black">{avoidCount}</div>
            <div className="text-xs font-semibold opacity-90">Avoid</div>
          </div>
        </div>
      )}

      {/* ── Legend ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 shadow-sm">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">Rating Key</div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {Object.entries(RATINGS).map(([key, R]) => (
            <div key={key} className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${R.whyBg}`}>
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${R.dot}`} />
              <div>
                <div className="text-xs font-bold">{R.label}</div>
                <div className="text-xs opacity-70 leading-tight">
                  {key === 'STRONG_BUY' ? 'Own stock safely' :
                   key === 'BUY'        ? 'Options play' :
                   key === 'NEUTRAL'    ? 'Wait & watch' :
                   key === 'CAUTION'    ? 'Tight stops' : 'Stay away'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              filter === f.key
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}>
            {f.label} <span className="ml-1 opacity-70">({f.count})</span>
          </button>
        ))}
      </div>

      {/* ── Stock cards grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
        {sorted.map(({ ticker, status, card }) => {
          if (status === 'loading') return <LoadingCard key={ticker} ticker={ticker} />
          if (status === 'error')   return <ErrorCard   key={ticker} ticker={ticker} onRetry={() => retryCard(ticker)} />
          return (
            <StockCard
              key={ticker}
              stock={card}
              expanded={expanded === ticker}
              onToggle={() => toggleExpand(ticker)}
            />
          )
        })}
      </div>

      {/* ── Quick reference table (loaded cards only) ── */}
      {loadedCards.filter(c => ['STRONG_BUY','BUY'].includes(c.rating)).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
          <div className="px-5 py-3 bg-slate-800 text-white text-sm font-bold flex items-center justify-between">
            <span>⚡ Quick Reference — 2-Week Option Plays</span>
            {lastUpdated && (
              <span className="text-xs font-normal text-slate-300">
                Live · {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left">Ticker</th>
                  <th className="px-4 py-2.5 text-left">Price</th>
                  <th className="px-4 py-2.5 text-left">Rating</th>
                  <th className="px-4 py-2.5 text-left">Play</th>
                  <th className="px-4 py-2.5 text-left">Upside</th>
                </tr>
              </thead>
              <tbody>
                {loadedCards
                  .filter(c => ['STRONG_BUY','BUY'].includes(c.rating))
                  .map(s => {
                    const R = RATINGS[s.rating]
                    return (
                      <tr key={s.ticker} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className="font-black text-slate-900">{s.ticker}</span>
                          <span className="text-xs text-slate-400 ml-1.5">{(s.name || '').split(' ')[0]}</span>
                        </td>
                        <td className="px-4 py-2.5 font-bold text-slate-800">
                          ${fmt(s.price)}
                          <span className={`text-xs ml-1 ${s.changePct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {sign(s.changePct)}{fmt(s.changePct)}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${R.badge}`}>{R.icon} {R.label}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-600 max-w-[180px] truncate">{s.play}</td>
                        <td className={`px-4 py-2.5 font-bold text-sm ${parseFloat(s.upside) > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {s.upside}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-500 leading-relaxed">
        ⚠️ Options involve significant risk and are not suitable for all investors. This is not financial advice. All data is for educational purposes only. Always do your own research and consult a financial advisor before trading options.
      </div>
    </div>
  )
}
