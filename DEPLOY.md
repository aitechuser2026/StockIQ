# 🚀 Deploy StockIQ — Step-by-Step Guide
**Stack: Supabase (Auth + DB) + Vercel (Hosting) = $0/month**

---

## Step 1 — Create a Supabase Project (5 min)

1. Go to [supabase.com](https://supabase.com) → **Start your project** (free)
2. Sign in with GitHub
3. Click **New Project** → choose your org → fill in:
   - Project name: `stockiq`
   - Database password: (save this somewhere safe)
   - Region: pick the one closest to you
4. Wait ~2 min for project to spin up

### Run the database schema
5. In your Supabase dashboard → **SQL Editor** → **New Query**
6. Paste the entire contents of `supabase/schema.sql`
7. Click **Run** — you should see "Success, no rows returned"

### Copy your API keys
8. Go to **Settings → API**
9. Copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public** key (long JWT string)

### Enable Google OAuth (optional)
10. Go to **Authentication → Providers → Google**
11. Toggle **Enable**
12. Follow the link to create a Google OAuth app in Google Console
13. Paste Client ID + Secret back into Supabase

---

## Step 2 — Set up the Project Locally (2 min)

```bash
# In your terminal, go to this folder
cd stock-hosted-app

# Install dependencies
npm install

# Copy env file
cp .env.example .env
```

Open `.env` and fill in your keys:
```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Test it locally:
```bash
npm run dev
# Open http://localhost:3000
```

---

## Step 3 — Push to GitHub (2 min)

```bash
# In the stock-hosted-app folder
git init
git add .
git commit -m "Initial StockIQ app"

# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/stockiq.git
git push -u origin main
```

> ⚠️ Make sure `.env` is in `.gitignore` (it already is) — never push your keys to GitHub!

---

## Step 4 — Deploy to Vercel (3 min)

1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub (free)
2. Click **Add New Project** → Import your `stockiq` GitHub repo
3. Framework preset will auto-detect **Vite** ✅
4. Expand **Environment Variables** and add:
   ```
   VITE_SUPABASE_URL      = https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY = eyJ...
   ```
5. Click **Deploy** → wait ~60 seconds

Your app is now live at `https://stockiq-xxxx.vercel.app` 🎉

---

## Step 5 — Add your Vercel URL to Supabase (important!)

Supabase needs to know which URLs are allowed to redirect after OAuth login.

1. In Supabase → **Authentication → URL Configuration**
2. **Site URL**: set to your Vercel URL (e.g. `https://stockiq-xxxx.vercel.app`)
3. **Redirect URLs**: add `https://stockiq-xxxx.vercel.app/**`
4. Save

---

## Free Tier Limits (you're safe for a long time)

| Service | Free Limit |
|---------|------------|
| Vercel | 100 GB bandwidth/month, unlimited deploys |
| Supabase Auth | 50,000 monthly active users |
| Supabase Database | 500 MB |
| Supabase Bandwidth | 2 GB/month |

---

## Custom Domain (optional, still free on Vercel)

1. In Vercel → your project → **Domains**
2. Add your domain (e.g. `stockiq.yourdomain.com`)
3. Follow the DNS instructions (add a CNAME record at your registrar)
4. Update Supabase Site URL + Redirect URLs to your new domain

---

## What's Next

- Connect live stock prices from the existing `priceService.js`
- Add the Saved Picks tab (schema already created in Supabase)
- Add portfolio P&L tracking
- Deploy the full 14-page stock dashboard behind auth

That's it — your app is live and free! 🚀
