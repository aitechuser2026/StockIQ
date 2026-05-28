import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Flag checked by App.jsx — if false, show setup screen instead of crashing
export const isConfigured = Boolean(supabaseUrl && supabaseKey)

// Only create the client when both values are present
export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null
