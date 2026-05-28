#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# StockIQ — one-command deploy to Vercel (free)
# Run this from inside the stock-hosted-app/ folder:
#   bash deploy.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo ""
echo "📈 StockIQ — Deploy to Vercel"
echo "────────────────────────────"

# 1. Check .env exists
if [ ! -f ".env" ]; then
  echo ""
  echo "❌ .env file not found!"
  echo "   Run:  cp .env.example .env"
  echo "   Then fill in your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"
  exit 1
fi

# 2. Check keys are filled in
if grep -q "xxxxxxxxxxxxxxxxxxxx" .env; then
  echo ""
  echo "❌ .env still has placeholder values!"
  echo "   Open .env and replace with your real Supabase URL and key."
  exit 1
fi

echo "✅ .env found"

# 3. Install deps
echo ""
echo "📦 Installing dependencies..."
npm install

# 4. Read env values
SUPABASE_URL=$(grep VITE_SUPABASE_URL .env | cut -d '=' -f2-)
SUPABASE_KEY=$(grep VITE_SUPABASE_ANON_KEY .env | cut -d '=' -f2-)

echo "✅ Vercel CLI ready (via npx)"

# 5. Deploy — use npx so it works regardless of PATH / global install location
echo ""
echo "🚀 Deploying to Vercel..."
echo "   (A browser window will open to log in if this is your first deploy)"
echo ""

npx vercel --yes --prod \
  --env VITE_SUPABASE_URL="$SUPABASE_URL" \
  --env VITE_SUPABASE_ANON_KEY="$SUPABASE_KEY"

echo ""
echo "✅ Deployed! Your app is live."
echo "   Copy the URL above and add it to Supabase:"
echo "   Authentication → URL Configuration → Site URL"
