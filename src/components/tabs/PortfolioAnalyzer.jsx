import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { fetchPrices, invalidateCache } from '../../services/priceService'

// ── Smart paste parser — handles Robinhood, CSV, TSV, plain text ──────────────
function parsePortfolioText(rawText) {
  const cleanNum = (str) => {
    if (str == null) return NaN
    return parseFloat(String(str).replace(/[$,%\s]/g, '').replace(/,/g, '').replace(/\((.+)\)/, '-$1'))
  }

  // ── Step 1: Strip Robinhood markdown links: [value](url) → value ────────────
  const stripped = rawText.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  const lines    = stripped.trim().split(/\r?\n/).map(l => l.trim()).filter(l => l)
  if (!lines.length) return { holdings: [], warnings: [] }

  // ── Step 2: Detect Robinhood vertical format ─────────────────────────────────
  // Robinhood web copies as 7-line blocks per stock:
  //   Name / Symbol / Shares / Price / Average Cost / Total Return / Equity
  // The header appears once at the top as plain text keywords.
  const RH_KEYWORDS = ['name', 'symbol', 'shares', 'price', 'average cost', 'total return', 'equity']
  const BLOCK_SIZE  = RH_KEYWORDS.length  // 7

  // Find where the header is (could be at start, or user pasted without header)
  let headerEnd = -1
  for (let i = 0; i <= Math.min(lines.length - BLOCK_SIZE, 10); i++) {
    const window = lines.slice(i, i + BLOCK_SIZE).map(l => l.toLowerCase())
    const matches = RH_KEYWORDS.filter((kw, j) => window[j]?.includes(kw.split(' ')[0])).length
    if (matches >= 5) { headerEnd = i + BLOCK_SIZE; break }
  }

  if (headerEnd >= 0) {
    // ── Robinhood vertical format ──
    const dataLines = lines.slice(headerEnd)
    const holdings  = []
    const warnings  = []

    for (let i = 0; i + BLOCK_SIZE - 1 < dataLines.length; i += BLOCK_SIZE) {
      const block = dataLines.slice(i, i + BLOCK_SIZE)
      // block[0]=Name, [1]=Symbol, [2]=Shares, [3]=CurrentPrice, [4]=AvgCost, [5]=Return, [6]=Equity
      const ticker = block[1]?.replace(/[^A-Za-z.]/g, '').toUpperCase()
      const shares = cleanNum(block[2])
      const cost   = cleanNum(block[4])  // Average cost PER SHARE

      if (!ticker || ticker.length < 1 || ticker.length > 6) {
        warnings.push(`Could not extract ticker from "${block[1]}" — row skipped`)
        continue
      }
      if (isNaN(shares) || shares <= 0) {
        warnings.push(`${ticker}: could not parse shares — row skipped`)
        continue
      }
      holdings.push({ ticker, shares, cost: isNaN(cost) || cost <= 0 ? 0 : cost })
    }

    // Handle trailing incomplete block
    const remaining = lines.length - headerEnd
    if (remaining % BLOCK_SIZE !== 0) {
      warnings.push(`${Math.floor(remaining / BLOCK_SIZE)} stocks fully parsed. Last partial block was skipped.`)
    }
    return { holdings, warnings }
  }

  // ── Step 3: Generic CSV / TSV / horizontal table format ─────────────────────
  const firstLine = lines[0]
  const tabCols   = firstLine.split('\t').length
  const commaCols = firstLine.split(',').length
  const delim     = tabCols > commaCols && tabCols > 1 ? '\t' : ','

  const rows = lines.map(l => l.split(delim).map(c => c.trim().replace(/^["']|["']$/g, '')))

  const TICKER_KEYS = ['symbol', 'ticker', 'stock', 'security']
  const SHARES_KEYS = ['quantity', 'shares', 'qty', 'units', '#']
  const COST_KEYS   = ['avg cost', 'average cost', 'cost basis', 'cost per share',
                       'price', 'avg price', 'average price', 'purchase price', 'cost/share']

  let headerIdx = -1
  let colTicker = -1, colShares = -1, colCost = -1

  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i].map(c => c.toLowerCase())
    const t = row.findIndex(c => TICKER_KEYS.some(k => c.includes(k)))
    const s = row.findIndex(c => SHARES_KEYS.some(k => c.includes(k)))
    const c = row.findIndex(c => COST_KEYS.some(k => c.includes(k)))
    if (t >= 0 || s >= 0 || c >= 0) {
      headerIdx = i; colTicker = t; colShares = s; colCost = c; break
    }
  }

  const dataRows = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows

  // Auto-detect columns from data if headers not found
  if (colTicker < 0 || colShares < 0 || colCost < 0) {
    for (const row of dataRows.slice(0, 5)) {
      for (let j = 0; j < row.length; j++) {
        const cellClean = row[j].replace(/[$,\s]/g, '')
        if (colTicker < 0 && /^[A-Z]{1,6}(\.A|\.B)?$/.test(row[j])) { colTicker = j; continue }
        if (colShares < 0 && j !== colTicker && !isNaN(parseFloat(cellClean)) && parseFloat(cellClean) > 0 && parseFloat(cellClean) < 1e6) { colShares = j; continue }
        if (colCost < 0 && j !== colTicker && j !== colShares && !isNaN(parseFloat(cellClean)) && parseFloat(cellClean) > 0) { colCost = j; continue }
      }
      if (colTicker >= 0 && colShares >= 0 && colCost >= 0) break
    }
  }
  if (colTicker < 0) colTicker = 0
  if (colShares < 0) colShares = 1
  if (colCost   < 0) colCost   = 2

  const extractTicker = (raw) => {
    if (!raw) return ''
    const paren = raw.match(/\(([A-Z]{1,6}(?:\.[AB])?)\)/)
    if (paren) return paren[1]
    const clean = raw.replace(/[^A-Za-z.]/g, '').toUpperCase()
    return /^[A-Z]{1,6}(\.A|\.B)?$/.test(clean) ? clean : ''
  }

  const SKIP = new Set(['TOTAL', 'CASH', 'NA', 'N/A', 'MONEY', 'FUND', 'OTHER', 'OPTIONS'])
  const holdings = [], warnings = []

  for (const row of dataRows) {
    if (!row.length || row.every(c => !c)) continue
    const ticker = extractTicker(row[colTicker] || '')
    if (!ticker || SKIP.has(ticker)) continue
    const shares = cleanNum(row[colShares])
    const cost   = cleanNum(row[colCost])
    if (isNaN(shares) || shares <= 0) { warnings.push(`${ticker}: could not parse shares — skipped`); continue }
    if (isNaN(cost) || cost <= 0)      warnings.push(`${ticker}: cost not found — set to 0 (edit below)`)
    holdings.push({ ticker, shares, cost: isNaN(cost) || cost <= 0 ? 0 : cost })
  }

  return { holdings, warnings }
}

// ── Portfolio insights engine ─────────────────────────────────────────────────
function buildInsights(holdings, marketData) {
  if (!holdings || !holdings.length) return null

  let totalValue = 0, totalCost = 0
  const enriched = holdings.map(h => {
    const live = marketData[h.ticker]?.price || 0
    const value = live * h.shares
    const cost  = h.cost * h.shares
    const pl    = value - cost
    const plPct = cost > 0 ? (pl / cost) * 100 : 0
    totalValue += value
    totalCost  += cost
    return { ...h, live, value, costTotal: cost, pl, plPct }
  })

  const totalPL    = totalValue - totalCost
  const totalPlPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0

  // Allocation %
  const withAlloc = enriched.map(h => ({
    ...h,
    allocPct: totalValue > 0 ? (h.value / totalValue) * 100 : 0,
  }))

  // Sort by allocation
  const byAlloc   = [...withAlloc].sort((a, b) => b.allocPct - a.allocPct)
  const byPL      = [...withAlloc].sort((a, b) => b.plPct - a.plPct)
  const winners   = byPL.filter(h => h.plPct > 0)
  const losers    = [...byPL].reverse().filter(h => h.plPct < 0)

  // Concentration risk
  const maxAlloc    = byAlloc[0]?.allocPct || 0
  const topHeavy    = byAlloc.slice(0, 3).reduce((s, h) => s + h.allocPct, 0)
  const concRisk    = maxAlloc > 30 ? 'High' : maxAlloc > 15 ? 'Medium' : 'Low'

  // Covered call candidates (≥100 shares in profit)
  const ccCandidates = withAlloc.filter(h => h.shares >= 100 && h.plPct > 0)

  // Repair candidates (underwater >10%)
  const repairCandidates = withAlloc.filter(h => h.plPct < -10)

  // Health score (0-100)
  let score = 50
  if (totalPlPct > 20)  score += 20; else if (totalPlPct > 5)  score += 10; else if (totalPlPct < -15) score -= 15
  if (holdings.length >= 8)  score += 10; else if (holdings.length <= 2) score -= 10
  if (concRisk === 'Low')    score += 15; else if (concRisk === 'High') score -= 15
  if (winners.length > losers.length) score += 5
  score = Math.max(0, Math.min(100, score))

  const grade = score >= 85 ? 'A' : score >= 70 ? 'B+' : score >= 55 ? 'B' : score >= 40 ? 'C' : 'D'

  // Smart insights list
  const insights = []
  if (maxAlloc > 30)
    insights.push({ type: 'warn', text: `⚠️ ${byAlloc[0]?.ticker} makes up ${maxAlloc.toFixed(0)}% of your portfolio — high concentration risk.` })
  if (topHeavy > 70 && holdings.length > 3)
    insights.push({ type: 'warn', text: `⚠️ Top 3 holdings = ${topHeavy.toFixed(0)}% of portfolio. Consider diversifying.` })
  if (ccCandidates.length > 0)
    insights.push({ type: 'tip', text: `💡 ${ccCandidates.length} position${ccCandidates.length > 1 ? 's' : ''} (${ccCandidates.map(h => h.ticker).join(', ')}) qualify for covered calls — 100+ shares in profit.` })
  if (repairCandidates.length > 0)
    insights.push({ type: 'warn', text: `📉 ${repairCandidates.map(h => h.ticker).join(', ')} ${repairCandidates.length > 1 ? 'are' : 'is'} down >10% — consider repair strategies.` })
  if (winners.length > 0 && winners[0].plPct > 50)
    insights.push({ type: 'tip', text: `🚀 ${winners[0].ticker} is up ${winners[0].plPct.toFixed(0)}% — consider taking partial profits.` })
  if (holdings.length < 5)
    insights.push({ type: 'tip', text: `💡 Only ${holdings.length} holdings. A 8–15 stock portfolio reduces single-stock risk significantly.` })
  if (totalPlPct < -10)
    insights.push({ type: 'warn', text: `🛡️ Portfolio is down ${Math.abs(totalPlPct).toFixed(1)}% overall. Review stop-loss levels.` })
  if (totalPlPct > 20)
    insights.push({ type: 'good', text: `✅ Strong overall return of +${totalPlPct.toFixed(1)}%. Portfolio is healthy.` })

  return {
    enriched: withAlloc, byAlloc, byPL, winners, losers,
    totalValue, totalCost, totalPL, totalPlPct,
    maxAlloc, concRisk, ccCandidates, repairCandidates,
    score, grade, insights,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
export default function PortfolioAnalyzer({ onAddTicker, holdings, setHoldings, portfolios, setPortfolios, activePortfolioId, setActivePortfolioId }) {
  
  // ── Live prices — owned by this component via priceService ──────────────────
  const [livePrices,   setLivePrices]   = useState(new Map())   // Map<ticker, {price,change,changePct,...}>
  const [priceLoading, setPriceLoading] = useState(false)
  const [lastUpdated,  setLastUpdated]  = useState(null)

  const fetchLivePrices = useCallback(async (force = false) => {
    if (!holdings || !holdings.length) {
      setLivePrices(new Map())
      return
    }
    if (force) invalidateCache(...holdings.map(h => h.ticker))
    setPriceLoading(true)
    try {
      const tickers = holdings.map(h => h.ticker)
      const priceMap = await fetchPrices(tickers)
      setLivePrices(priceMap)
      setLastUpdated(new Date())
    } finally {
      setPriceLoading(false)
    }
  }, [holdings])

  // Auto-fetch prices whenever holdings change
  useEffect(() => { fetchLivePrices(false) }, [fetchLivePrices])

  // Register tickers with parent for header tracking
  useEffect(() => {
    if (onAddTicker && holdings) holdings.forEach(h => onAddTicker(h.ticker))
  }, [holdings, onAddTicker])

  // ── Helper: get live price for a ticker ─────────────────────────────────────
  const getPrice = (ticker) => livePrices.get(ticker.toUpperCase())?.price ?? 0
  const fmtLive  = (ticker) => {
    const p = livePrices.get(ticker.toUpperCase())
    if (!p) return priceLoading ? '…' : '—'
    return `$${p.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // Portfolio Management
  const [isCreating, setIsCreating] = useState(false)
  const [newPortfolioName, setNewPortfolioName] = useState('')

  const createPortfolio = () => {
    if (!newPortfolioName.trim() || portfolios[newPortfolioName]) return
    setPortfolios(prev => ({ ...prev, [newPortfolioName]: [] }))
    setActivePortfolioId(newPortfolioName)
    setNewPortfolioName('')
    setIsCreating(false)
  }

  const deletePortfolio = (id) => {
    if (Object.keys(portfolios).length <= 1) return
    if (window.confirm(`Delete portfolio "${id}"?`)) {
      const updated = { ...portfolios }
      delete updated[id]
      setPortfolios(updated)
      if (activePortfolioId === id) setActivePortfolioId(Object.keys(updated)[0])
    }
  }

  // Manual add
  const [newTicker, setNewTicker] = useState('')
  const [newShares, setNewShares] = useState('')
  const [newCost,   setNewCost]   = useState('')

  // Paste import
  const [pasteOpen,    setPasteOpen]    = useState(false)
  const [pasteText,    setPasteText]    = useState('')
  const [pastePreview, setPastePreview] = useState(null)
  const [pasteErr,     setPasteErr]     = useState('')

  // ── Paste handlers ──────────────────────────────────────────────────────────
  const handleParsePaste = () => {
    setPasteErr('')
    if (!pasteText.trim()) { setPasteErr('Paste some data first.'); return }
    const result = parsePortfolioText(pasteText)
    if (!result.holdings.length) {
      setPasteErr('Could not detect any holdings. Make sure each row has a ticker symbol, number of shares, and average cost.')
      return
    }
    setPastePreview(result)
  }

  const handleConfirmImport = () => {
    if (!pastePreview?.holdings.length) return
    setHoldings(prev => {
      const merged = [...prev]
      pastePreview.holdings.forEach(nh => {
        const idx = merged.findIndex(h => h.ticker === nh.ticker)
        if (idx >= 0) merged[idx] = nh; else merged.push(nh)
      })
      return merged
    })
    setPasteText(''); setPastePreview(null); setPasteOpen(false)
  }

  const updatePreviewRow = (i, field, val) => {
    setPastePreview(prev => {
      const updated = [...prev.holdings]
      updated[i] = { ...updated[i], [field]: field === 'ticker' ? val.toUpperCase() : parseFloat(val) || 0 }
      return { ...prev, holdings: updated }
    })
  }

  const removePreviewRow = (i) => {
    setPastePreview(prev => ({
      ...prev,
      holdings: prev.holdings.filter((_, idx) => idx !== i),
    }))
  }

  // ── CSV upload ──────────────────────────────────────────────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = parsePortfolioText(ev.target.result)
      if (result.holdings.length) {
        setHoldings(prev => {
          const merged = [...prev]
          result.holdings.forEach(nh => {
            const idx = merged.findIndex(h => h.ticker === nh.ticker)
            if (idx >= 0) merged[idx] = nh; else merged.push(nh)
          })
          return merged
        })
      }
    }
    reader.readAsText(file)
  }

  // ── Manual add ──────────────────────────────────────────────────────────────
  const addHolding = () => {
    const t = newTicker.toUpperCase().trim()
    const s = parseFloat(newShares), c = parseFloat(newCost)
    if (!t || isNaN(s) || isNaN(c)) return
    setHoldings(prev => {
      const idx = prev.findIndex(h => h.ticker === t)
      if (idx >= 0) { const u = [...prev]; u[idx] = { ticker: t, shares: s, cost: c }; return u }
      return [...prev, { ticker: t, shares: s, cost: c }]
    })
    setNewTicker(''); setNewShares(''); setNewCost('')
  }

  const removeHolding = (ticker) => setHoldings(prev => prev.filter(h => h.ticker !== ticker))
  const resetPortfolio = () => { if (window.confirm('Clear current portfolio?')) setHoldings([]) }

  // ── Build a marketData-compatible map from livePrices for buildInsights ──────
  const marketDataCompat = useMemo(() => {
    const out = {}
    livePrices.forEach((v, k) => { out[k] = v })
    return out
  }, [livePrices])

  // ── Export to Excel (CSV) ────────────────────────────────────────────────────
  const exportToExcel = useCallback(() => {
    const ins2 = buildInsights(holdings, marketDataCompat)
    const now  = new Date().toLocaleString('en-US')
    const esc  = v => {
      if (v == null) return ''
      const s = String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }
    const row  = (...cells) => cells.map(esc).join(',')

    const lines = [
      row('Portfolio', activePortfolioId),
      row('Exported', now),
      row(''),
      row('── HOLDINGS ──'),
      row('Ticker', 'Shares', 'Avg Cost / Share', 'Live Price', 'Market Value', 'Cost Basis', 'P&L ($)', 'P&L (%)', 'Allocation %'),
    ]

    if (ins2) {
      ins2.enriched.forEach(h => {
        lines.push(row(
          h.ticker,
          h.shares,
          h.cost > 0 ? h.cost.toFixed(2) : '—',
          h.live > 0 ? h.live.toFixed(2) : '—',
          h.value > 0 ? h.value.toFixed(2) : '—',
          h.costTotal > 0 ? h.costTotal.toFixed(2) : '—',
          h.pl.toFixed(2),
          `${h.plPct.toFixed(2)}%`,
          `${h.allocPct.toFixed(2)}%`,
        ))
      })

      lines.push(row(''))
      lines.push(row('── SUMMARY ──'))
      lines.push(row('Total Market Value', `$${ins2.totalValue.toFixed(2)}`))
      lines.push(row('Total Cost Basis',   `$${ins2.totalCost.toFixed(2)}`))
      lines.push(row('Total P&L ($)',       `$${ins2.totalPL.toFixed(2)}`))
      lines.push(row('Total P&L (%)',       `${ins2.totalPlPct.toFixed(2)}%`))
      lines.push(row('Health Score',        `${ins2.score}/100 (${ins2.grade})`))
      lines.push(row('Concentration Risk',  ins2.concRisk))

      if (ins2.insights?.length) {
        lines.push(row(''))
        lines.push(row('── INSIGHTS ──'))
        ins2.insights.forEach(i => lines.push(row(i.text)))
      }
    } else {
      // No live prices yet — export raw holdings
      holdings.forEach(h => {
        lines.push(row(h.ticker, h.shares, h.cost > 0 ? h.cost.toFixed(2) : '—', '—', '—', '—', '—', '—', '—'))
      })
    }

    lines.push(row(''))
    lines.push(row('Note: Live prices as of export time. Not financial advice.'))

    const csv  = lines.join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${activePortfolioId.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [holdings, marketDataCompat, activePortfolioId])

  // ── Analytics ───────────────────────────────────────────────────────────────
  const ins = useMemo(() => buildInsights(holdings, marketDataCompat), [holdings, marketDataCompat])

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const pct = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
  const usd = (n) => `${n >= 0 ? '+' : '-'}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="max-w-full text-slate-900">

      {/* ── Portfolio Selector & Management ── */}
      <div className="flex items-center gap-3 mb-6 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex-wrap">
        <span className="text-xs font-black text-slate-400 uppercase ml-2">Portfolios:</span>
        {Object.keys(portfolios).map(id => (
          <div key={id} className="relative group">
            <button
              onClick={() => setActivePortfolioId(id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                activePortfolioId === id 
                  ? 'bg-slate-900 text-white shadow-lg' 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {id}
              <span className="text-[10px] opacity-60">({portfolios[id].length})</span>
            </button>
            {Object.keys(portfolios).length > 1 && (
              <button 
                onClick={(e) => { e.stopPropagation(); deletePortfolio(id); }}
                className="absolute -top-1 -right-1 bg-red-500 text-white w-4 h-4 rounded-full text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >✕</button>
            )}
          </div>
        ))}
        
        {isCreating ? (
          <div className="flex items-center gap-2 ml-2">
            <input 
              autoFocus
              value={newPortfolioName}
              onChange={e => setNewPortfolioName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createPortfolio()}
              placeholder="New name..."
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:border-indigo-400"
            />
            <button onClick={createPortfolio} className="text-emerald-600 font-bold text-sm">Add</button>
            <button onClick={() => setIsCreating(false)} className="text-slate-400 font-bold text-sm ml-1">✕</button>
          </div>
        ) : (
          <button 
            onClick={() => setIsCreating(true)}
            className="w-8 h-8 rounded-full border-2 border-dashed border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-600 flex items-center justify-center font-bold text-xl ml-2 transition-all"
          >+</button>
        )}
      </div>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-4 gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
            💼 {activePortfolioId}
          </h2>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Track Holdings · Optimize Yield · Risk Assessment</p>
            {priceLoading && (
              <span className="text-xs text-blue-500 font-semibold animate-pulse">⏳ Fetching live prices…</span>
            )}
            {!priceLoading && lastUpdated && (
              <span className="text-xs text-emerald-600 font-semibold">
                ✅ Live · {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {ins && (
            <div className="flex gap-5 text-right">
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase">Total Value</div>
                <div className="text-lg font-black">${ins.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase">Total P/L</div>
                <div className={`text-lg font-black ${ins.totalPL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {usd(ins.totalPL)} <span className="text-xs">({pct(ins.totalPlPct)})</span>
                </div>
              </div>
            </div>
          )}
          {holdings.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchLivePrices(true)}
                disabled={priceLoading}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors"
              >
                <span className={priceLoading ? 'animate-spin inline-block' : ''}>⟳</span>
                {priceLoading ? 'Refreshing…' : 'Refresh Prices'}
              </button>
              <button
                onClick={exportToExcel}
                title="Export portfolio to Excel (.csv)"
                className="flex items-center gap-1.5 bg-white hover:bg-green-50 border-2 border-green-300 hover:border-green-500 text-green-700 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors"
              >
                <span>📥</span>
                Export XL
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── PASTE IMPORT PANEL ── */}
      <div className="mb-5">
        <button
          onClick={() => { setPasteOpen(o => !o); setPastePreview(null); setPasteErr('') }}
          className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border-2 font-bold text-sm transition-all ${
            pasteOpen
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-slate-700 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">📋</span>
            <div className="text-left">
              <div className="font-black">Paste from Robinhood / Spreadsheet</div>
              <div className={`text-xs font-semibold ${pasteOpen ? 'text-indigo-200' : 'text-slate-400'}`}>
                Copy your portfolio table from Robinhood, Excel, or any brokerage and paste it here
              </div>
            </div>
          </div>
          <span className="text-lg">{pasteOpen ? '▲' : '▼'}</span>
        </button>

        {pasteOpen && (
          <div className="bg-white border-2 border-indigo-100 rounded-2xl mt-2 p-5 shadow-sm space-y-4">

            {!pastePreview ? (
              <>
                <div>
                  <div className="text-xs font-black text-slate-500 uppercase mb-1">
                    Robinhood: open your Portfolio page → select all the stock rows → Copy (Ctrl+C / Cmd+C) → paste below
                  </div>
                  <div className="text-xs text-slate-400 mb-2">
                    The parser auto-detects Robinhood, Excel, Google Sheets, and plain CSV. It reads <strong>Symbol</strong>, <strong>Shares</strong>, and <strong>Average Cost</strong> automatically.
                  </div>
                  <textarea
                    className="w-full h-52 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-mono outline-none focus:border-indigo-400 resize-none placeholder-slate-300"
                    placeholder={`Paste from Robinhood:\n  Go to Portfolio page → select all rows → Ctrl+C → paste here.\n\nAlso accepts plain CSV:\n  TSLA, 100, 428.70\n  ORCL, 300, 217.45\n\nOr tab-separated (Excel/Sheets):\n  TSLA\t100\t$428.70`}
                    value={pasteText}
                    onChange={e => { setPasteText(e.target.value); setPasteErr('') }}
                  />
                </div>
                {pasteErr && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠️ {pasteErr}</div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={handleParsePaste}
                    disabled={!pasteText.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black px-6 py-2.5 rounded-xl text-sm transition-colors"
                  >
                    🔍 Parse & Preview
                  </button>
                  <button onClick={() => setPasteText('')} className="text-slate-400 hover:text-slate-600 text-sm font-semibold px-3">Clear</button>
                </div>
              </>
            ) : (
              <>
                {/* Preview table */}
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-black text-slate-700">
                    ✅ Detected {pastePreview.holdings.length} holding{pastePreview.holdings.length !== 1 ? 's' : ''} — review and edit before importing
                  </div>
                  <button onClick={() => setPastePreview(null)} className="text-xs text-slate-400 hover:text-slate-600">← Back</button>
                </div>

                {pastePreview.warnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 space-y-0.5">
                    {pastePreview.warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        <th className="px-3 py-2 text-left">Ticker</th>
                        <th className="px-3 py-2 text-right">Shares</th>
                        <th className="px-3 py-2 text-right">Avg Cost</th>
                        <th className="px-3 py-2 text-center">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pastePreview.holdings.map((h, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <input
                              value={h.ticker}
                              onChange={e => updatePreviewRow(i, 'ticker', e.target.value)}
                              className="w-20 bg-white border border-slate-200 rounded px-2 py-0.5 text-xs font-black uppercase outline-none focus:border-indigo-400"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              value={h.shares}
                              onChange={e => updatePreviewRow(i, 'shares', e.target.value)}
                              className="w-24 bg-white border border-slate-200 rounded px-2 py-0.5 text-xs font-bold text-right outline-none focus:border-indigo-400"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              value={h.cost}
                              onChange={e => updatePreviewRow(i, 'cost', e.target.value)}
                              className="w-24 bg-white border border-slate-200 rounded px-2 py-0.5 text-xs font-bold text-right outline-none focus:border-indigo-400"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => removePreviewRow(i)} className="text-slate-300 hover:text-red-500 font-bold text-base">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-3 items-center">
                  <button
                    onClick={handleConfirmImport}
                    disabled={!pastePreview.holdings.length}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white font-black px-6 py-2.5 rounded-xl text-sm transition-colors"
                  >
                    ✅ Import {pastePreview.holdings.length} Holdings
                  </button>
                  <button onClick={() => { setPastePreview(null); setPasteText('') }} className="text-sm text-slate-400 hover:text-slate-600 font-semibold">Cancel</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* ── Left: Holdings (8/12) ── */}
        <div className="xl:col-span-8 space-y-5">

          {/* Manual add */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[80px]">
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Ticker</label>
                <input value={newTicker} onChange={e => setNewTicker(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && addHolding()}
                  placeholder="AAPL"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-indigo-400" />
              </div>
              <div className="w-20 sm:w-24">
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Shares</label>
                <input type="number" value={newShares} onChange={e => setNewShares(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addHolding()}
                  placeholder="100"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-indigo-400" />
              </div>
              <div className="w-24 sm:w-32">
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Avg Cost</label>
                <input type="number" value={newCost} onChange={e => setNewCost(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addHolding()}
                  placeholder="150.00"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-indigo-400" />
              </div>
              <button onClick={addHolding} className="bg-slate-900 text-white font-black px-5 py-2.5 rounded-xl text-sm hover:bg-slate-800 transition-all whitespace-nowrap">
                + Add
              </button>
            </div>
          </div>

          {/* CSV upload + clear */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs">
            <label className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 font-bold px-3 py-2 rounded-xl cursor-pointer hover:bg-slate-100 transition-all whitespace-nowrap">
              📁 Upload CSV
              <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
            </label>
            <span className="text-slate-400 font-semibold hidden sm:inline">Format: Ticker, Shares, Cost per row</span>
            <button onClick={resetPortfolio} className="text-red-500 font-black text-[10px] uppercase tracking-widest hover:underline ml-auto">✕ Clear</button>
          </div>

          {/* Holdings table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[480px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase">Asset</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-right">Position</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-right">Live Price</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-right">Alloc</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-right">P/L</th>
                  <th className="px-4 py-3 text-center">✕</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {!holdings || holdings.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400 font-bold italic text-sm">
                      No holdings yet in "{activePortfolioId}".
                    </td>
                  </tr>
                ) : (
                  (ins?.enriched || holdings.map(h => ({ ...h, live: 0, value: 0, pl: 0, plPct: 0, allocPct: 0 }))).map(h => (
                    <tr key={h.ticker} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-black text-slate-900">{h.ticker}</div>
                        <div className="text-[10px] font-bold text-slate-400">Equity</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-bold text-slate-700">{h.shares} sh</div>
                        <div className="text-[10px] text-slate-400">@ ${h.cost.toFixed(2)}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className={`text-sm font-black ${priceLoading && !livePrices.get(h.ticker) ? 'text-slate-300 animate-pulse' : ''}`}>{fmtLive(h.ticker)}</div>
                        <div className="text-[10px] text-slate-400">${h.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-bold text-slate-600">{h.allocPct?.toFixed(1) ?? '—'}%</div>
                        <div className="w-full bg-slate-100 rounded-full h-1 mt-1">
                          <div className="bg-indigo-400 h-1 rounded-full" style={{ width: `${Math.min(100, h.allocPct || 0)}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className={`text-sm font-black ${h.pl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {h.pl >= 0 ? '+' : ''}${Math.abs(h.pl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className={`text-[10px] font-bold ${h.pl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {pct(h.plPct)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => removeHolding(h.ticker)} className="text-slate-300 hover:text-red-500 transition-colors text-lg font-bold">✕</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Right: Insights (4/12) ── */}
        <div className="xl:col-span-4 space-y-4">

          {!ins ? (
            <div className="bg-slate-900 rounded-[28px] p-6 text-white shadow-2xl h-48 flex items-center justify-center">
              <div className="text-center opacity-30 italic text-sm">Add holdings to see insights</div>
            </div>
          ) : (
            <>
              {/* Health Score */}
              <div className="bg-slate-900 rounded-[28px] p-5 text-white shadow-2xl">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3">Portfolio Health</div>
                <div className="flex items-end gap-4 mb-3">
                  <div className="text-5xl font-black text-white">{ins.grade}</div>
                  <div className="mb-1">
                    <div className="text-xs font-bold text-slate-400">{ins.score}/100 score</div>
                    <div className="text-[10px] text-slate-500">{ins.concRisk} concentration risk</div>
                  </div>
                </div>
                {/* Score bar */}
                <div className="w-full bg-white/10 rounded-full h-1.5 mb-4">
                  <div className={`h-1.5 rounded-full transition-all ${ins.score >= 70 ? 'bg-emerald-400' : ins.score >= 45 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${ins.score}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-base font-black text-emerald-400">{ins.winners.length}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">Winners</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-base font-black text-red-400">{ins.losers.length}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">Losers</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-base font-black text-indigo-300">{ins.ccCandidates.length}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">CC Ready</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-base font-black text-amber-400">{ins.byAlloc[0]?.allocPct.toFixed(0)}%</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">Top Alloc</div>
                  </div>
                </div>
              </div>

              {/* Smart Insights */}
              {ins.insights.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">💡 Insights</div>
                  <div className="space-y-2">
                    {ins.insights.map((tip, i) => (
                      <div key={i} className={`text-xs font-semibold leading-relaxed px-3 py-2 rounded-lg ${
                        tip.type === 'warn' ? 'bg-amber-50 text-amber-800 border border-amber-100' :
                        tip.type === 'good' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' :
                        'bg-blue-50 text-blue-800 border border-blue-100'
                      }`}>
                        {tip.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Per-holding strategies */}
              <div className="bg-slate-900 rounded-[28px] p-5 text-white shadow-2xl">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Strategies</div>
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {ins.enriched.map(h => {
                    const cc  = h.shares >= 100 && h.plPct > 0
                    const rep = h.plPct < -10
                    const hold = !cc && !rep
                    return (
                      <div key={h.ticker} className="bg-white/5 border border-white/10 p-3 rounded-xl">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-black text-indigo-300 text-xs tracking-widest">{h.ticker}</span>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                            h.plPct > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {pct(h.plPct)}
                          </span>
                        </div>
                        {cc && (
                          <div className="text-[10px] text-slate-400 leading-relaxed">
                            <span className="text-white font-black">🏦 Covered Call:</span> You hold {h.shares} shares. Sell a ${Math.ceil(h.live * 1.08).toFixed(0)} call (30 DTE) to collect passive premium.
                          </div>
                        )}
                        {rep && (
                          <div className="text-[10px] text-slate-400 leading-relaxed">
                            <span className="text-white font-black">🛡️ Repair:</span> Down {Math.abs(h.plPct).toFixed(0)}%. Sell a ${(h.live * 0.92).toFixed(2)} cash-secured put to collect premium while waiting for recovery.
                          </div>
                        )}
                        {hold && h.shares < 100 && h.plPct >= 0 && (
                          <div className="text-[10px] text-slate-400 leading-relaxed">
                            <span className="text-white font-black">💎 Accumulate:</span> Need {100 - Math.floor(h.shares)} more shares to unlock covered calls. Consider DCA if conviction holds.
                          </div>
                        )}
                        {hold && h.plPct < 0 && h.plPct >= -10 && (
                          <div className="text-[10px] text-slate-400 leading-relaxed">
                            <span className="text-white font-black">⏳ Watch:</span> Down {Math.abs(h.plPct).toFixed(1)}% — within normal range. Set an alert at ${(h.cost * 0.85).toFixed(2)} as a stop.
                          </div>
                        )}
                        {hold && h.plPct > 25 && (
                          <div className="text-[10px] text-slate-400 leading-relaxed">
                            <span className="text-white font-black">🚀 Trim:</span> Up {h.plPct.toFixed(0)}%. Consider trimming 20–30% to lock in gains and reduce concentration.
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Top Winners / Losers */}
              {(ins.winners.length > 0 || ins.losers.length > 0) && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] font-black text-emerald-600 uppercase mb-2">🏆 Best</div>
                      {ins.winners.slice(0, 3).map(h => (
                        <div key={h.ticker} className="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
                          <span className="text-xs font-black text-slate-700">{h.ticker}</span>
                          <span className="text-xs font-bold text-emerald-600">{pct(h.plPct)}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-red-500 uppercase mb-2">📉 Worst</div>
                      {ins.losers.slice(0, 3).map(h => (
                        <div key={h.ticker} className="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
                          <span className="text-xs font-black text-slate-700">{h.ticker}</span>
                          <span className="text-xs font-bold text-red-500">{pct(h.plPct)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-5 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-400">
        ⚠️ For informational purposes only. Not financial advice. Data stays private in your browser — never sent to any server.
      </div>
    </div>
  )
}
