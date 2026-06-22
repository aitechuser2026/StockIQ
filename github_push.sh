#!/bin/bash
# Run this once from your terminal to push StockIQ to GitHub
# cd /Users/swamisai/Documents/Claude/Projects/StockAnalysis/stock-hosted-app
# bash github_push.sh

set -e

echo "🔧 Fixing git repo..."
rm -f .git/index.lock .git/HEAD.lock

echo "🔧 Setting up git..."
git config user.email "aitechuser2026@gmail.com"
git config user.name  "aitechuser2026"

# Start fresh on main branch
git checkout -b main 2>/dev/null || git checkout main

echo "📦 Staging all files..."
git add .

echo "💾 Committing..."
git commit -m "StockIQ: FMP data layer, StockDeepDive, CalendarPage" 2>/dev/null || \
  git commit --allow-empty -m "StockIQ: FMP data layer, StockDeepDive, CalendarPage"

echo "🔗 Setting remote..."
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/aitechuser2026/StockIQ.git

echo "🚀 Pushing to GitHub..."
git push -u origin main --force

echo ""
echo "✅ Done! Code is live at: https://github.com/aitechuser2026/StockIQ"
