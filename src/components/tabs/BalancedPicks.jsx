import React from 'react'
import StockCard from '../StockCard'
import { BALANCED_STOCKS } from '../../data/stocks'

export default function BalancedPicks({ fmtPrice, fmtChg, isUp }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-base font-bold text-slate-800 mb-4">
        ⚖️ Balanced Growth + Value Picks
        <span className="text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide bg-blue-100 text-blue-700">
          Moderate Risk
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-3.5">
        {BALANCED_STOCKS.map(stock => (
          <StockCard key={stock.ticker} stock={stock} fmtPrice={fmtPrice} fmtChg={fmtChg} isUp={isUp} />
        ))}
      </div>
    </div>
  )
}
