# Campus Runner

In-campus gig delivery. Students post errands (food, printouts, stationery, anything); other students run them. One person can be both a buyer and a runner — the top switch flips between the two.

## Stack

- **Frontend:** React (Vite) + Tailwind. Design carried over from the prototype (amber = buying, green = running).
- **Backend:** Supabase — hosted Postgres, email + password auth, and realtime subscriptions. No server to run.
- **Money rules:** enforced server-side as Postgres functions (`SECURITY DEFINER`), so a tampered client can't fake balances, accept its own order, or skip the escrow hold.

## How the two sides share one order

A buyer's order and a runner's job are **the same `orders` row**. The buyer creates it; a runner claims it with an atomic update (so two runners can't grab the same task); both sides watch it over Supabase realtime, so the buyer's tracking timeline advances the moment the runner ticks a step.

## Lifecycle

`PLACED → ACCEPTED → SHOPPING → PURCHASED → DELIVERED → COMPLETED`
(plus `CANCELLED` / `DISPUTED`). Each transition is gated server-side — only the assigned runner can advance, and only one step at a time. The buyer's `confirm_order` releases escrow and pays the runner.

## Money model

All amounts stored in **paise** (integers) to avoid floating-point errors. Every balance change is an immutable row in `wallet_entries`; the cached `profiles.wallet_paise` is the running sum. Wallet orders hold the full total on placement and release to the runner on confirmation. COD/UPI orders only credit the runner's fee, since they collect the item cost directly.

## Setup

1. **Create a Supabase project** at supabase.com.
2. **Run the migrations** (Supabase dashboard → SQL Editor, run in order):
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_rls_and_logic.sql`
   - `supabase/seed.sql` (catalog data)
3. **Email auth is on by default** in Supabase — nothing to configure. For the fastest testing, go to Authentication → Providers → Email and turn **off** "Confirm email" so new accounts can sign in immediately without a confirmation link. (Turn it back on for production.)
4. **Add a profile-creation trigger** (so a `profiles` row is created on signup) — see `supabase/migrations/0003_profile_trigger.sql`.
5. **Configure env:**
   ```
   cp .env.example .env
   # fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from Project Settings → API
   ```
6. **Run:**
   ```
   npm install
   npm run dev
   ```

## Deploy

`npm run build` produces a static `dist/`. Host it on Vercel, Netlify, or Cloudflare Pages — set the two `VITE_` env vars in the host's dashboard. No backend deploy needed; Supabase is the backend.

## What's stubbed for v1 / next steps

- **Student verification** — deferred for now. Email + password lets anyone in; add a college-email-domain check, OTP, or ID verification before flipping `is_verified` for production.
- **Custom-request reconciliation** — the buyer enters an *estimated* budget; in production the runner should enter the *actual* bill and the difference settles against the wallet.
- **Disputes & cancellation** — the `DISPUTED`/`CANCELLED` states exist in the schema but have no UI yet.
- **Payouts** — "Cash out to UPI" is a stub; wire a real payout provider.
- **Catalog management** — prices are admin-seeded; add a vendor portal or admin screen to keep them current.
