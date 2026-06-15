#!/usr/bin/env bash
# ============================================================
# Campus Runner — push to your GitHub repo with a clean history.
# Run this from inside the campusrunner/ folder after downloading.
#
# It creates logical commits instead of one big dump. Review each
# step; remove --no-verify if you have hooks you want to run.
# ============================================================
set -e

REPO="https://github.com/chason2007/campusrunner_rebirth.git"

git init
git branch -M main
git remote add origin "$REPO" 2>/dev/null || git remote set-url origin "$REPO"

# 1) project scaffold + tooling
git add package.json vite.config.js postcss.config.js tailwind.config.js index.html .gitignore .env.example
git commit -m "chore: project scaffold (Vite + React + Tailwind)"

# 2) database schema
git add supabase/migrations/0001_init.sql
git commit -m "feat(db): core schema — profiles, vendors, products, orders, wallet ledger"

# 3) security + business logic
git add supabase/migrations/0002_rls_and_logic.sql
git commit -m "feat(db): RLS policies and server-side order/escrow logic"

# 4) profile trigger + seed
git add supabase/migrations/0003_profile_trigger.sql supabase/migrations/0004_switch_to_email.sql supabase/seed.sql
git commit -m "feat(db): email auth — profile trigger, email-switch patch, catalog seed"

# 5) frontend foundation
git add src/index.css src/main.jsx src/lib/supabase.js src/lib/api.js src/lib/constants.js src/context/AuthContext.jsx src/components/UI.jsx
git commit -m "feat(app): supabase client, data layer, auth context, shared UI"

# 6) auth
git add src/screens/Login.jsx
git commit -m "feat(auth): phone OTP login screen"

# 7) buyer + runner + shell
git add src/App.jsx src/screens/BuyerApp.jsx src/screens/RunnerApp.jsx
git commit -m "feat(app): buyer storefront, runner flow, and buy/run mode switch"

# 8) docs
git add README.md setup-git.sh
git commit -m "docs: setup, deploy, and architecture notes"

echo ""
echo "All commits created. Now push:"
echo "  git push -u origin main"
echo ""
echo "(You may need to authenticate — GitHub no longer accepts passwords;"
echo " use a personal access token or 'gh auth login'.)"
