import React from 'react'
import StockCard from '../StockCard'
import { AGGRESSIVE_STOCKS } from '../../data/stocks'

export default function AggressivePicks({ fmtPrice, fmtChg, isUp }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-base font-bold text-slate-800 mb-3">
        🔥 Aggressive Growth Picks
        <span className="text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide bg-red-100 text-red-700">
          High Risk · High Reward
        </span>
      </div>

      <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4 text-sm text-yellow-800">
        ⚡ <div><strong>Catalyst Alert:</strong> AMAT earnings tonight (±8.7% move priced) will directly impact NVDA &amp; TSM Friday open. Trump-Xi summit outcome could swing all semiconductor names ±5% overnight.</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-3.5">
        {AGGRESSIVE_STOCKS.map(stock => (
          <StockCard key={stock.ticker} stock={stock} fmtPrice={fmtPrice} fmtChg={fmtChg} isUp={isUp} />
        ))}
      </div>
    </div>
  )
}
