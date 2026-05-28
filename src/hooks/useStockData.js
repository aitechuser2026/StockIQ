import { useState, useEffect, useCallback, useRef } from 'react'
import { FALLBACK, ALL_SYMBOLS } from '../data/stocks'
import { formatPrice, formatChange, isChangePositive } from '../services/formatters'

// Yahoo Finance v8 chart — works directly from browser (permissive CORS)
async function fetchChartPrice(sym) {
  const hosts = [
    'https://query1.finance.yahoo.com',
    'https://query2.finance.yahoo.com',
  ]
  for (const host of hosts) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 6000)
      const res = await fetch(
        `${host}/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d&includePrePost=false`,
        { signal: ctrl.signal, headers: { Accept: 'application/json' } }
      )
      clearTimeout(t)
      if (!res.ok) continue
      const json = await res.json()
      const meta = json?.chart?.result?.[0]?.meta
      if (meta?.regularMarketPrice != null) {
        return { price: meta.regularMarketPrice, chg: meta.regularMarketChangePercent ?? 0 }
      }
    } catch (_) {}
  }
  return null
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// Batch quotes via our Backend proxy
async function fetchBatchQuotes(symbols) {
  const encoded = symbols.map(s => encodeURIComponent(s)).join(',')
  const url = `${API_BASE_URL}/api/quote?symbols=${encoded}`
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 7000)
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    clearTimeout(t)
    if (!res.ok) return null
    const json = await res.json()
    // Our backend returns the full Yahoo response
    const results = json?.quoteResponse?.result
    if (results?.length) return results
  } catch (_) {}
  return null
}

export function useStockData(refreshSeconds = 300, extraSymbols = []) {
  const [marketData, setMarketData] = useState({ ...FALLBACK })
  const [dataSource, setDataSource] = useState('loading')
  const [countdown, setCountdown]   = useState(refreshSeconds)
  const remainingRef = useRef(refreshSeconds)
  const timerRef     = useRef(null)

  const fetchData = useCallback(async () => {
    const symbolsToFetch = Array.from(new Set([...ALL_SYMBOLS, ...extraSymbols]))

    // Strategy 1: batch quote via proxy (fast, gets everything at once)
    const batchResults = await fetchBatchQuotes(symbolsToFetch)
    if (batchResults) {
      setMarketData(prev => {
        const updated = { ...prev }
        batchResults.forEach(q => {
          if (q.regularMarketPrice != null) {
            updated[q.symbol] = { price: q.regularMarketPrice, chg: q.regularMarketChangePercent ?? 0 }
          }
        })
        return updated
      })
      setDataSource('live')
      return
    }

    // Strategy 2: fetch key symbols individually via the chart API (CORS-friendly)
    const results = await Promise.allSettled(symbolsToFetch.map(fetchChartPrice))
    const anySucceeded = results.some(r => r.status === 'fulfilled' && r.value)

    if (anySucceeded) {
      setMarketData(prev => {
        const updated = { ...prev }
        results.forEach((r, i) => {
          if (r.status === 'fulfilled' && r.value) {
            updated[symbolsToFetch[i]] = r.value
          }
        })
        return updated
      })
      setDataSource('live')
      return
    }

    // All failed — keep showing last known values
    setDataSource('fallback')
  }, [extraSymbols])

  // Initial fetch
  useEffect(() => { fetchData() }, [fetchData])

  // Countdown + auto-refresh
  useEffect(() => {
    remainingRef.current = refreshSeconds
    setCountdown(refreshSeconds)
    timerRef.current = setInterval(() => {
      remainingRef.current -= 1
      setCountdown(remainingRef.current)
      if (remainingRef.current <= 0) {
        remainingRef.current = refreshSeconds
        setCountdown(refreshSeconds)
        fetchData()
      }
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [refreshSeconds, fetchData])

  // ── formatters ───────────────────────────────────────────────────────────────
  const fmtPrice = (sym) => {
    const d = marketData[sym]
    return formatPrice(sym, d?.price)
  }

  const fmtChg = (sym) => {
    const d = marketData[sym]
    return formatChange(d?.chg)
  }

  const isUp = (sym) => isChangePositive(marketData[sym]?.chg)

  return { marketData, dataSource, countdown, fmtPrice, fmtChg, isUp, refresh: fetchData }
}
