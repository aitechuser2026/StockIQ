/**
 * Utility functions for formatting stock data.
 */

export const formatNumber = (n, d = 2) =>
  n == null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

export const formatPrice = (sym, price) => {
  if (price == null) return '—'
  const isStock = !sym.startsWith('^')
  return (isStock ? '$' : '') + formatNumber(price)
}

export const formatChange = (chg) => {
  if (chg == null) return ''
  const arrow = chg >= 0 ? '▲' : '▼'
  return `${arrow} ${chg >= 0 ? '+' : ''}${formatNumber(chg)}%`
}

export const isChangePositive = (chg) => (chg ?? 0) >= 0
