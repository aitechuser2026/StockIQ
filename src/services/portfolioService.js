/**
 * portfolioService.js — Supabase version
 *
 * Two-layer persistence:
 *   1. localStorage  — synchronous, instant, survives refresh
 *   2. Supabase DB   — async, survives device/browser change
 *
 * Supabase table: user_settings (user_id PK, settings jsonb, updated_at)
 */
import { supabase } from '../supabaseClient'

const LS_KEY = 'stock_dash_portfolio'

// ── localStorage — synchronous ────────────────────────────────────────────────
export function saveLocalNow(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)) } catch { /* quota full */ }
}

function lsLoad() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return data?.portfolios ? data : null
  } catch { return null }
}

// ── Supabase — async, best-effort ─────────────────────────────────────────────
async function dbLoad() {
  if (!supabase) return null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', user.id)
      .single()
    if (error || !data) return null
    return data.settings
  } catch (err) {
    console.warn('[portfolioService] Supabase load failed:', err.message)
    return null
  }
}

async function dbSave(payload) {
  if (!supabase) return
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('user_settings').upsert({
      user_id:    user.id,
      settings:   payload,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  } catch (err) {
    console.warn('[portfolioService] Supabase save failed:', err.message)
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function loadUserSettings() {
  const dbData = await dbLoad()
  if (dbData?.portfolios) {
    saveLocalNow(dbData)
    return dbData
  }
  return lsLoad()
}

export async function saveUserSettings(data) {
  saveLocalNow(data)
  await dbSave(data)
}
