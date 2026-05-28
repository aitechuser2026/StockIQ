/**
 * useLivePrices.js — Shared hook for any component that needs live stock/ETF/index prices.
 *
 * Uses the same multi-source pipeline as priceService:
 *   /api proxy → CNBC → Stooq → Yahoo v8 → allorigins
 *
 * @param {string[]} tickers  — e.g. ['NVDA','META'] or ['^GSPC','^VIX']
 * @param {number}   interval — refresh interval in ms (default 60 000 = 1 min)
 * @returns {{ prices, loading, lastUpdated, error, refresh }}
 *   prices: { [TICKER]: { price, change, changePct, dayHigh, dayLow, ... } }
 */
import { useState, useEffect, useCallback } from 'react'
import { fetchPrices } from '../services/priceService'

export function useLivePrices(tickers, interval = 60_000) {
  const [prices,      setPrices]      = useState({})
  const [loading,     setLoading]     = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [error,       setError]       = useState(false)

  // Stable key so useCallback only re-creates when tickers actually change
  const key = [...tickers].sort().join(',')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const map = await fetchPrices(tickers)
      if (map && map.size > 0) {
        const obj = {}
        map.forEach((v, k) => { obj[k] = v })
        setPrices(prev => ({ ...prev, ...obj }))   // keep stale values while new ones arrive
        setLastUpdated(new Date())
        setError(false)
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, interval)
    return () => clearInterval(id)
  }, [refresh, interval])

  return { prices, loading, lastUpdated, error, refresh }
}
