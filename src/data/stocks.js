export const FALLBACK = {
  '^GSPC': { price: 7432,   chg: 0.80 },
  '^IXIC': { price: 26635,  chg: 0.90 },
  '^DJI':  { price: 50124,  chg: 0.75 },
  '^VIX':  { price: 14.80,  chg: -0.50 },
  '^RUT':  { price: 2318,   chg: 1.10 },
  'NVDA':  { price: 235.74, chg: 1.38 },
  'AMZN':  { price: 250.56, chg: 0.82 },
  'META':  { price: 620.00, chg: 0.95 },
  'TSM':   { price: 185.40, chg: 0.60 },
  'SFM':   { price: 103.20, chg: 1.10 },
  'INTU':  { price: 601.50, chg: 0.45 },
  'BROS':  { price: 75.30,  chg: 0.70 },
  'NVO':   { price: 75.10,  chg: -0.30 },
  'COCO':  { price: 28.40,  chg: 1.80 },
}

export const ALL_SYMBOLS = ['^GSPC','^IXIC','^DJI','^VIX','^RUT','NVDA','AMZN','META','TSM','SFM','INTU','BROS','NVO','COCO']

export const INDICES = [
  { key: '^GSPC', label: 'S&P 500' },
  { key: '^IXIC', label: 'NASDAQ' },
  { key: '^DJI',  label: 'Dow Jones' },
  { key: '^VIX',  label: 'VIX Fear Index' },
  { key: '^RUT',  label: 'Russell 2000' },
]

export const AGGRESSIVE_STOCKS = [
  {
    ticker: 'NVDA', name: 'NVIDIA Corporation', verdict: 'STRONG BUY', verdictClass: 'buy',
    signals: [
      { label: '📈 MACD Bullish (May 8)', type: 'bull' },
      { label: '⚡ Momentum > 0 (May 6)', type: 'bull' },
      { label: '🤖 Blackwell AI Platform', type: 'bull' },
      { label: '37 Analysts: Strong Buy', type: 'options' },
    ],
    metrics: [
      { label: 'Data Center Rev', val: '$62B (+73%)' },
      { label: 'Analyst Target', val: '$272 (+15%)' },
      { label: 'Beta', val: '2.24 High Vol' },
      { label: 'Momentum Score', val: 'A+ Bullish' },
    ],
    buy: '✅ BUY: MACD bullish cross May 8. Blackwell AI platform driving data center revenue +73% to $62B. 37 analysts say Strong Buy with $272 target (15% upside). Momentum indicator crossed 0 on May 6. AMAT earnings are a near-term catalyst.',
    risk: '❌ RISK: High beta (2.24) = sharp swings. Trump-Xi breakdown on chip exports = significant downside. Valuation stretched at ~45× forward P/E.',
    riskScore: 85, riskLevel: 'high',
  },
  {
    ticker: 'SFM', name: 'Sprouts Farmers Market', verdict: 'BUY — Options Play', verdictClass: 'buy',
    signals: [
      { label: '🎯 10,970 Calls — 38× Avg!', type: 'options' },
      { label: '📊 June $105 Strike (8,700 calls)', type: 'options' },
      { label: '🛒 Comp Sales +8.3%', type: 'bull' },
    ],
    metrics: [
      { label: 'Call Volume', val: '10,970 (38× avg)' },
      { label: 'Target Strike', val: 'June 18 $105' },
      { label: 'Comp Sales', val: '+8.3% YoY' },
      { label: 'Expiry', val: 'June 18, 2026' },
    ],
    buy: '✅ BUY: 10,970 calls at 38× normal volume = institutional bet. 8,700 contracts at the June $105 strike alone. Smart money is positioning for a breakout above $105 by June 18. Comp sales +8.3% gives fundamental support.',
    risk: '❌ RISK: Could be institutional hedging rather than directional. Retail/grocery margins under pressure. This is a short-term catalyst trade, not a long-term hold.',
    riskScore: 80, riskLevel: 'high',
  },
  {
    ticker: 'META', name: 'Meta Platforms Inc.', verdict: 'BUY', verdictClass: 'buy',
    signals: [
      { label: '🏆 #1 Sector (Comm Services)', type: 'bull' },
      { label: '🤖 AI Advertising Engine', type: 'bull' },
      { label: '💰 Strong FCF >35%', type: 'neutral' },
    ],
    metrics: [
      { label: 'Sector Rank', val: '#1 in May 2026' },
      { label: 'FCF Margin', val: '>35%' },
      { label: 'AI Ad Growth', val: 'Accelerating' },
      { label: 'Buyback', val: 'Active Program' },
    ],
    buy: '✅ BUY: Communication Services is the #1 performing sector in May 2026. META dominates the space. AI-powered ad targeting expanding margins. Strong buyback program. Near ATH with momentum support.',
    risk: '❌ RISK: EU regulatory fines ongoing. Reality Labs burning cash. Heavy AI capex ($50B+/yr). Trump-Xi summit could affect global ad market.',
    riskScore: 70, riskLevel: 'high',
  },
  {
    ticker: 'COCO', name: 'Vita Coco Company', verdict: 'BUY — Momentum', verdictClass: 'buy',
    signals: [
      { label: '🏆 Momentum Score: A', type: 'bull' },
      { label: '📊 Driehaus #1 Pick', type: 'bull' },
      { label: '🥥 Consumer Brand', type: 'neutral' },
    ],
    metrics: [
      { label: 'Momentum Score', val: 'A (Top Tier)' },
      { label: 'Strategy', val: 'Driehaus Momentum' },
      { label: 'Cap', val: 'Small-Cap' },
      { label: 'Horizon', val: '1–2 Weeks' },
    ],
    buy: '✅ BUY: Top Momentum Score A under Driehaus strategy — one of 3 top momentum picks for May 2026. Consumer health beverage trend tailwind. Small-cap momentum can move fast.',
    risk: '❌ RISK: Small-cap = high volatility. Limited analyst coverage. Consumer discretionary sensitive to spending shifts.',
    riskScore: 90, riskLevel: 'high',
  },
]

export const BALANCED_STOCKS = [
  {
    ticker: 'AMZN', name: 'Amazon.com Inc.', verdict: 'STRONG BUY', verdictClass: 'buy',
    signals: [
      { label: '☁️ AWS +24% (Fastest in 13 Qtrs)', type: 'bull' },
      { label: '🤖 AI Revenue $15B Run Rate', type: 'bull' },
      { label: '💰 Reasonable Valuation', type: 'neutral' },
    ],
    metrics: [
      { label: 'AWS Growth', val: '+24% YoY' },
      { label: 'AI Revenue', val: '$15B Run Rate' },
      { label: 'Cloud Market', val: '2nd Largest' },
      { label: 'Retail Trend', val: 'Breakout ↑' },
    ],
    buy: '✅ BUY: AWS fastest growth in 13 quarters. AI cloud revenue $15B annualized and accelerating. Stock breaking out since April with fundamental backing. Best risk/reward balance on the list.',
    risk: '❌ RISK: Azure (Microsoft) competing aggressively. Antitrust scrutiny on retail side. If tech P/E multiples compress, AMZN falls with the tide.',
    riskScore: 55, riskLevel: 'med',
  },
  {
    ticker: 'TSM', name: 'Taiwan Semiconductor (TSMC)', verdict: 'BUY', verdictClass: 'buy',
    signals: [
      { label: '🏭 HPC Chip Demand Surging', type: 'bull' },
      { label: '📈 Q1 Revenue $35.9B (+35%)', type: 'bull' },
      { label: '🛡️ Beta 1.25 — Stable', type: 'neutral' },
    ],
    metrics: [
      { label: 'Q1 Revenue', val: '$35.9B (+35%)' },
      { label: 'HPC Mix', val: '61% of Revenue' },
      { label: 'Gross Margin', val: '66.2% (+7.4pp)' },
      { label: 'Beta', val: '1.25 (Moderate)' },
    ],
    buy: '✅ BUY: Manufactures chips for Apple, NVIDIA, AMD, Qualcomm. Revenue +35%, margins expanding. More stable than NVDA (beta 1.25 vs 2.24) but rides same AI wave.',
    risk: '❌ RISK: Geopolitical risk (Taiwan/China tensions). Customer concentration in Apple (~25%). US fab expansion costs rising.',
    riskScore: 50, riskLevel: 'med',
  },
  {
    ticker: 'INTU', name: 'Intuit Inc.', verdict: 'BUY — Value Play', verdictClass: 'buy',
    signals: [
      { label: '💰 Forward P/E: 15× (Cheap!)', type: 'bull' },
      { label: '🤖 AI in TurboTax + QuickBooks', type: 'bull' },
      { label: '🔄 Recovery Trade', type: 'bull' },
    ],
    metrics: [
      { label: 'Forward P/E', val: '15× (vs 30× peers)' },
      { label: 'Valuation Gap', val: '~30% Discount' },
      { label: 'Moat', val: 'High Switching Cost' },
      { label: 'Products', val: 'TurboTax/QuickBooks' },
    ],
    buy: '✅ BUY: Forward P/E of just 15× — enormous value discount vs. software peers at 30–40×. TurboTax + QuickBooks create sticky ecosystems. AI integration across all products accelerating.',
    risk: '❌ RISK: IRS free filing initiative threatens TurboTax. Seasonal revenue skew. If overall tech multiples compress, INTU follows.',
    riskScore: 40, riskLevel: 'low',
  },
  {
    ticker: 'BROS', name: 'Dutch Bros Inc.', verdict: 'BUY', verdictClass: 'buy',
    signals: [
      { label: '☕ Comp Sales +8.3%', type: 'bull' },
      { label: '📱 Mobile Orders Growing', type: 'bull' },
      { label: '🏗️ Best Expansion Opportunity', type: 'bull' },
    ],
    metrics: [
      { label: 'Comp Sales', val: '+8.3% YoY' },
      { label: 'Co-Owned Stores', val: '+10.6% comp' },
      { label: 'Expansion', val: 'Best in Restaurants' },
      { label: 'Growth Drivers', val: 'Mobile + Food Menu' },
    ],
    buy: '✅ BUY: Motley Fool: "Best expansion opportunity in the restaurant space." Comp sales +8.3% — exceptional. Mobile ordering + drink innovation + hot food = multiple revenue levers.',
    risk: '❌ RISK: Competition from Starbucks. Consumer spending slowdown risk. West-Coast geographic concentration.',
    riskScore: 55, riskLevel: 'med',
  },
  {
    ticker: 'NVO', name: 'Novo Nordisk A/S', verdict: 'HOLD / WATCH', verdictClass: 'hold',
    signals: [
      { label: '💊 GLP-1 Market Leader', type: 'bull' },
      { label: '🏥 Ozempic + Wegovy', type: 'bull' },
      { label: '⚠️ Eli Lilly Competition', type: 'neutral' },
      { label: '📉 Pullback = Entry Zone?', type: 'neutral' },
    ],
    metrics: [
      { label: 'Market Position', val: 'GLP-1 Leader' },
      { label: 'Valuation', val: 'Cheap vs. History' },
      { label: 'Sector', val: 'Healthcare (Strong)' },
      { label: 'Horizon', val: 'Better Long-Term' },
    ],
    buy: '✅ WATCH: Listed as "Absurdly Cheap Growth Stock" for May 2026. GLP-1 obesity/diabetes drugs are a multi-decade secular trend. Healthcare sector performing well.',
    risk: '❌ CAUTION: Eli Lilly (LLY) competing hard. US-based alternatives emerging. Volatile on pipeline news.',
    riskScore: 50, riskLevel: 'med',
  },
]

export const SUMMARY_ROWS = [
  { ticker: 'NVDA', name: 'NVIDIA',            style: 'agg', verdict: 'STRONG BUY', target: '$250–$265',   risk: 'HIGH',     riskColor: 'text-red-500',    catalyst: 'MACD cross, data center +73%, AMAT earnings' },
  { ticker: 'SFM',  name: 'Sprouts Farmers',   style: 'agg', verdict: 'BUY OPTIONS', target: '$105+',       risk: 'HIGH',     riskColor: 'text-red-500',    catalyst: '10,970 calls at 38× avg — institutional bet' },
  { ticker: 'META', name: 'Meta Platforms',    style: 'agg', verdict: 'BUY',         target: '$640–$655',   risk: 'MED-HIGH', riskColor: 'text-yellow-500', catalyst: '#1 Comm Services sector, AI ads, ATH momentum' },
  { ticker: 'COCO', name: 'Vita Coco',         style: 'agg', verdict: 'BUY',         target: '$30–$32',     risk: 'VERY HIGH',riskColor: 'text-red-500',    catalyst: 'Driehaus Momentum Score A' },
  { ticker: 'AMZN', name: 'Amazon',            style: 'bal', verdict: 'STRONG BUY', target: '$262–$272',   risk: 'MEDIUM',   riskColor: 'text-yellow-500', catalyst: 'AWS +24%, AI $15B run rate, breakout trend' },
  { ticker: 'TSM',  name: 'Taiwan Semi',       style: 'bal', verdict: 'BUY',         target: '$192–$200',   risk: 'MEDIUM',   riskColor: 'text-yellow-500', catalyst: 'Rev +35%, AMAT earnings read-through' },
  { ticker: 'INTU', name: 'Intuit',            style: 'bal', verdict: 'BUY VALUE',   target: '$625–$645',   risk: 'LOW-MED',  riskColor: 'text-green-600',  catalyst: 'Forward P/E 15×, deep discount vs. peers' },
  { ticker: 'BROS', name: 'Dutch Bros',        style: 'bal', verdict: 'BUY',         target: '$79–$83',     risk: 'MEDIUM',   riskColor: 'text-yellow-500', catalyst: 'Comp sales +8.3%, best restaurant expansion' },
  { ticker: 'NVO',  name: 'Novo Nordisk',      style: 'bal', verdict: 'HOLD/WATCH',  target: '$78–$81',     risk: 'MEDIUM',   riskColor: 'text-yellow-500', catalyst: 'GLP-1 leader, cheap, but LLY competition' },
]
