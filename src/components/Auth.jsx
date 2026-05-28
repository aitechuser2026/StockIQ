import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

// ── Diagnose the error and return a human-readable message ────────────────────
function diagnose(error) {
  const msg = error?.message || String(error)

  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('fetch')) {
    return {
      text: 'Cannot reach Supabase — network error.',
      hint: (
        <>
          Check that <code className="bg-red-100 px-1 rounded text-xs">VITE_SUPABASE_URL</code> in your <code className="bg-red-100 px-1 rounded text-xs">.env</code> file is correct.
          It should look like: <code className="bg-red-100 px-1 rounded text-xs">https://xxxx.supabase.co</code> (no trailing slash).
          After editing <code className="bg-red-100 px-1 rounded text-xs">.env</code>, restart <code className="bg-red-100 px-1 rounded text-xs">npm run dev</code>.
        </>
      ),
    }
  }
  if (msg.includes('Invalid API key') || msg.includes('apikey') || msg.includes('401')) {
    return {
      text: 'Invalid API key.',
      hint: 'Check that VITE_SUPABASE_ANON_KEY in .env matches the "anon public" key from Supabase → Settings → API.',
    }
  }
  if (msg.includes('Email not confirmed')) {
    return {
      text: 'Email not confirmed.',
      hint: 'Check your inbox for a confirmation email from Supabase and click the link, then sign in.',
    }
  }
  if (msg.includes('User already registered')) {
    return { text: 'This email is already registered. Try signing in instead.', hint: null }
  }
  if (msg.includes('Invalid login credentials')) {
    return { text: 'Wrong email or password.', hint: null }
  }
  if (msg.includes('Email logins are disabled')) {
    return {
      text: 'Email/password login is not enabled.',
      hint: 'In Supabase → Authentication → Providers → Email, make sure "Enable Email provider" is ON.',
    }
  }
  if (msg.includes('Signups not allowed')) {
    return {
      text: 'Signups are disabled on this project.',
      hint: 'In Supabase → Authentication → Settings, make sure "Enable email signups" is ON.',
    }
  }
  return { text: msg, hint: null }
}

export default function Auth() {
  const [mode, setMode]         = useState('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [message, setMessage]   = useState(null)   // { type, text, hint? }
  const [connOk, setConnOk]     = useState(null)   // null=checking, true, false

  // ── Connection check on mount ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function ping() {
      try {
        // Light call that doesn't require auth — just checks the URL is reachable
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        })
        if (!cancelled) setConnOk(res.ok || res.status === 401) // 401 = reached server, key mismatch
      } catch {
        if (!cancelled) setConnOk(false)
      }
    }
    ping()
    return () => { cancelled = true }
  }, [])

  const notify = (type, text, hint = null) => setMessage({ type, text, hint })

  // ── Submit handler ────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          const d = diagnose(error)
          notify('error', d.text, d.hint)
        }
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) {
          const d = diagnose(error)
          notify('error', d.text, d.hint)
        } else {
          notify('success', '✅ Account created! Check your email to confirm, then sign in.')
        }
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (error) {
          const d = diagnose(error)
          notify('error', d.text, d.hint)
        } else {
          notify('success', '📧 Password reset link sent — check your email.')
        }
      }
    } catch (err) {
      const d = diagnose(err)
      notify('error', d.text, d.hint)
    }

    setLoading(false)
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────
  async function handleGoogle() {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) {
        const d = diagnose(error)
        notify('error', d.text, d.hint)
      }
    } catch (err) {
      const d = diagnose(err)
      notify('error', d.text, d.hint)
    }
    setLoading(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center p-4"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
      <div className="w-full max-w-md">

        {/* Brand */}
        <div className="text-center mb-6 md:mb-8">
          <div className="text-4xl md:text-5xl mb-2 md:mb-3">📈</div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">StockIQ</h1>
          <p className="text-slate-400 text-sm mt-1">Your personal stock analysis dashboard</p>
        </div>

        {/* Connection status pill */}
        <div className="flex justify-center mb-4">
          {connOk === null && (
            <span className="text-xs bg-slate-700 text-slate-300 px-3 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" /> Checking Supabase connection…
            </span>
          )}
          {connOk === true && (
            <span className="text-xs bg-green-900/60 text-green-300 px-3 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400" /> Supabase connected ✓
            </span>
          )}
          {connOk === false && (
            <span className="text-xs bg-red-900/60 text-red-300 px-3 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400" /> Cannot reach Supabase — check your .env URL
            </span>
          )}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-5 md:p-8">

          {/* Tab switcher */}
          {mode !== 'reset' && (
            <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
              {['login', 'signup'].map(m => (
                <button key={m} onClick={() => { setMode(m); setMessage(null) }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    mode === m ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {m === 'login' ? '🔑 Sign In' : '🚀 Create Account'}
                </button>
              ))}
            </div>
          )}

          {/* Reset header */}
          {mode === 'reset' && (
            <div className="mb-6">
              <button onClick={() => { setMode('login'); setMessage(null) }}
                className="text-slate-500 hover:text-slate-800 text-sm flex items-center gap-1 mb-3">
                ← Back to sign in
              </button>
              <h2 className="text-lg font-bold text-slate-800">Reset password</h2>
              <p className="text-sm text-slate-500 mt-1">We'll send a reset link to your email.</p>
            </div>
          )}

          {/* Alert */}
          {message && (
            <div className={`rounded-xl px-4 py-3 mb-5 text-sm ${
              message.type === 'error'
                ? 'bg-red-50 border border-red-200 text-red-700'
                : 'bg-green-50 border border-green-200 text-green-700'
            }`}>
              <div className="font-semibold">{message.text}</div>
              {message.hint && (
                <div className="mt-1.5 text-xs opacity-90 leading-relaxed">{message.hint}</div>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Email address
              </label>
              <input type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Password
                </label>
                <input type="password" required value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Min 6 characters' : '••••••••'}
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
                />
              </div>
            )}

            <button type="submit" disabled={loading || connOk === false}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[.98] text-white font-bold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-indigo-200">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity=".25"/>
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
                  </svg>
                  Processing…
                </span>
              ) : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
            </button>
          </form>

          {mode === 'login' && (
            <button onClick={() => { setMode('reset'); setMessage(null) }}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-600 mt-3 transition-colors">
              Forgot password?
            </button>
          )}

          {mode !== 'reset' && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium">or</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <button onClick={handleGoogle} disabled={loading || connOk === false}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-all active:scale-[.98] disabled:opacity-60">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
            </>
          )}
        </div>

        {/* Debug info — only shown when connection fails */}
        {connOk === false && (
          <div className="mt-4 bg-slate-800 rounded-xl p-4 text-xs text-slate-300 space-y-1">
            <div className="font-bold text-white mb-2">🔧 Debug info</div>
            <div>URL set: <code className="text-yellow-300">{import.meta.env.VITE_SUPABASE_URL ? `${import.meta.env.VITE_SUPABASE_URL.substring(0, 30)}…` : '❌ NOT SET'}</code></div>
            <div>Key set: <code className="text-yellow-300">{import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ present' : '❌ NOT SET'}</code></div>
            <div className="pt-1 text-slate-400">
              Fix: edit <code className="text-green-300">.env</code>, save, then run <code className="text-green-300">npm run dev</code> again (Vite must restart to pick up env changes).
            </div>
          </div>
        )}

        <p className="text-center text-slate-500 text-xs mt-6">StockIQ · Supabase + Vercel · Free</p>
      </div>
    </div>
  )
}
