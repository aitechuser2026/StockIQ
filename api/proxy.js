/**
 * /api/proxy.js  — Vercel serverless function
 *
 * Server-side CORS proxy. Handles Yahoo Finance's crumb requirement:
 *   1. Try direct crumb endpoint first (fast, works on fresh IPs)
 *   2. Fall back to cookie flow (visit homepage → get session → get crumb)
 *
 * Crumb is cached in module scope across warm Vercel invocations.
 */

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// Module-level session cache
let _session = null   // { crumb, cookie }
let _sessionTs = 0
const SESSION_TTL = 20 * 60 * 1000   // 20 minutes

function parseCookies(res) {
  try {
    if (typeof res.headers.getSetCookie === 'function') {
      return res.headers.getSetCookie()
        .map(h => h.split(';')[0].trim())
        .filter(Boolean)
        .join('; ')
    }
  } catch (_) {}
  // Fallback for older runtimes
  const raw = res.headers.get('set-cookie') || ''
  return raw.split(/,(?=[^;]+=[^;]+)/)
    .map(h => h.split(';')[0].trim())
    .filter(h => h.includes('='))
    .join('; ')
}

async function getSession(force = false) {
  if (!force && _session && Date.now() - _sessionTs < SESSION_TTL) {
    return _session
  }

  const baseHeaders = {
    'User-Agent': UA,
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://finance.yahoo.com/',
  }

  // Strategy A: try crumb endpoint directly (works without cookies on US IPs)
  for (const host of ['query2.finance.yahoo.com', 'query1.finance.yahoo.com']) {
    try {
      const r = await fetch(`https://${host}/v1/test/getcrumb`, {
        headers: { ...baseHeaders, Accept: 'text/plain, */*' },
      })
      if (r.ok) {
        const crumb = (await r.text()).trim()
        if (crumb && crumb.length > 2 && !crumb.includes('<') && !crumb.includes('{')) {
          _session   = { crumb, cookie: '' }
          _sessionTs = Date.now()
          console.log('[proxy] crumb via direct (no cookie)')
          return _session
        }
      }
    } catch (_) {}
  }

  // Strategy B: visit homepage first to establish cookie session
  let cookie = ''
  try {
    const home = await fetch('https://finance.yahoo.com/', {
      headers: { ...baseHeaders, Accept: 'text/html,application/xhtml+xml,*/*' },
      redirect: 'follow',
    })
    cookie = parseCookies(home)
  } catch (e) {
    console.warn('[proxy] homepage fetch failed:', e.message)
  }

  for (const host of ['query2.finance.yahoo.com', 'query1.finance.yahoo.com']) {
    try {
      const r = await fetch(`https://${host}/v1/test/getcrumb`, {
        headers: {
          ...baseHeaders,
          Accept: 'text/plain, */*',
          ...(cookie ? { Cookie: cookie } : {}),
        },
      })
      if (r.ok) {
        const crumb = (await r.text()).trim()
        if (crumb && crumb.length > 2 && !crumb.includes('<') && !crumb.includes('{')) {
          _session   = { crumb, cookie }
          _sessionTs = Date.now()
          console.log('[proxy] crumb via cookie flow')
          return _session
        }
      }
    } catch (_) {}
  }

  throw new Error('Could not obtain Yahoo Finance crumb')
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { url } = req.query
  if (!url) return res.status(400).json({ error: '`url` query param required' })

  let targetUrl
  try {
    targetUrl = decodeURIComponent(url)
    if (!/^https?:\/\//i.test(targetUrl)) {
      return res.status(400).json({ error: 'Only http/https URLs allowed' })
    }
  } catch {
    return res.status(400).json({ error: 'Invalid url encoding' })
  }

  const isYahoo = targetUrl.includes('finance.yahoo.com')
  const isFMP   = targetUrl.includes('financialmodelingprep.com')

  // ── FMP: inject API key server-side (key never sent to client) ───────────
  if (isFMP) {
    const fmpKey = process.env.FMP_KEY
    if (!fmpKey) return res.status(500).json({ error: 'FMP_KEY not configured on server' })
    targetUrl = targetUrl.includes('?')
      ? `${targetUrl}&apikey=${fmpKey}`
      : `${targetUrl}?apikey=${fmpKey}`
  }

  const baseHeaders = {
    'User-Agent':      UA,
    'Accept':          'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control':   'no-cache',
  }

  if (targetUrl.includes('nasdaq.com')) {
    baseHeaders['Referer'] = 'https://www.nasdaq.com/'
    baseHeaders['Origin']  = 'https://www.nasdaq.com'
  }

  // ── Yahoo: inject crumb ───────────────────────────────────────────────────
  async function buildYahooFetch(forceRefresh = false) {
    const session = await getSession(forceRefresh)
    const fetchUrl = targetUrl.includes('?')
      ? `${targetUrl}&crumb=${encodeURIComponent(session.crumb)}`
      : `${targetUrl}?crumb=${encodeURIComponent(session.crumb)}`
    const headers = {
      ...baseHeaders,
      'Referer': 'https://finance.yahoo.com/',
      ...(session.cookie ? { Cookie: session.cookie } : {}),
    }
    return { fetchUrl, headers }
  }

  try {
    let fetchUrl = targetUrl
    let headers  = baseHeaders

    if (isYahoo) {
      try {
        ;({ fetchUrl, headers } = await buildYahooFetch(false))
      } catch (e) {
        console.warn('[proxy] session error:', e.message, '— trying without crumb')
      }
    }

    let upstream = await fetch(fetchUrl, { headers })

    // On 429: 1) refresh crumb and retry, 2) try v11 endpoint as last resort
    if (upstream.status === 429 && isYahoo) {
      console.warn('[proxy] 429 — refreshing session and retrying')
      try {
        _session = null
        ;({ fetchUrl, headers } = await buildYahooFetch(true))
        upstream = await fetch(fetchUrl, { headers })
      } catch (retryErr) {
        console.error('[proxy] retry failed:', retryErr.message)
      }

      // Still 429? Try v11 endpoint (different rate-limit bucket)
      if (upstream.status === 429 && targetUrl.includes('/v10/finance/quoteSummary')) {
        console.warn('[proxy] still 429 — trying v11 endpoint')
        try {
          const v11Url = fetchUrl.replace('/v10/finance/quoteSummary', '/v11/finance/quoteSummary')
          const v11Res = await fetch(v11Url, { headers })
          if (v11Res.status !== 429) upstream = v11Res
        } catch (_) {}
      }
    }

    const body = await upstream.text()
    const ct   = upstream.headers.get('content-type') || 'application/json'
    res.setHeader('Content-Type', ct)
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=30, stale-while-revalidate=120')
    return res.status(upstream.status).send(body)

  } catch (err) {
    console.error('[proxy] error:', err.message)
    return res.status(502).json({ error: 'Upstream fetch failed', detail: err.message })
  }
}
