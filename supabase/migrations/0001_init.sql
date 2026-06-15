-- ============================================================
-- Campus Runner — initial schema
-- Postgres / Supabase
-- ============================================================

-- ---------- ENUMS ----------
create type order_status as enum (
  'PLACED',     -- buyer placed, waiting for a runner
  'ACCEPTED',   -- a runner claimed it
  'SHOPPING',   -- runner is at the vendor collecting items
  'PURCHASED',  -- runner has bought everything
  'DELIVERED',  -- runner dropped it at the buyer
  'COMPLETED',  -- buyer confirmed receipt
  'CANCELLED',  -- cancelled before pickup
  'DISPUTED'    -- flagged for admin review
);

create type payment_method as enum ('WALLET', 'UPI', 'COD');
create type payment_status as enum ('PENDING', 'HELD', 'RELEASED', 'REFUNDED');

-- ---------- PROFILES ----------
-- Mirrors auth.users (Supabase manages auth). One row per student.
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  phone       text unique not null,
  full_name   text,
  is_verified boolean not null default false,   -- student status confirmed
  wallet_paise integer not null default 0,       -- store money in paise (avoid float)
  rating_sum   integer not null default 0,        -- for computing avg rating
  rating_count integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- VENDORS ----------
create table vendors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  emoji       text,
  tag         text,                  -- "Café · Block A"
  category    text,                  -- food | drinks | print | stationery | essentials
  eta_minutes integer default 10,
  rating      numeric(2,1) default 4.5,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- PRODUCTS ----------
create table products (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references vendors(id) on delete cascade,
  name        text not null,
  description text,
  emoji       text,
  category    text,
  price_paise integer not null,      -- catalog price in paise
  is_available boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- ORDERS ----------
-- The shared object. Buyer creates it; runner claims & advances it.
create table orders (
  id            uuid primary key default gen_random_uuid(),
  buyer_id      uuid not null references profiles(id) on delete cascade,
  runner_id     uuid references profiles(id),          -- null until accepted
  vendor_id     uuid references vendors(id),           -- null for custom requests
  is_custom     boolean not null default false,
  custom_title  text,
  custom_details text,

  status        order_status not null default 'PLACED',
  drop_location text not null,

  -- money, all in paise
  items_subtotal_paise integer not null default 0,  -- reimbursed to runner
  runner_fee_paise     integer not null default 0,  -- runner's earnings
  surge_fee_paise      integer not null default 0,
  platform_fee_paise   integer not null default 0,
  total_paise          integer not null default 0,

  payment_method payment_method not null,
  payment_status payment_status not null default 'PENDING',

  -- denormalized rating the buyer leaves for the runner
  runner_rating integer,  -- 1..5

  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  delivered_at  timestamptz,
  completed_at  timestamptz
);

create index orders_status_idx   on orders(status);
create index orders_buyer_idx    on orders(buyer_id);
create index orders_runner_idx   on orders(runner_id);

-- ---------- ORDER ITEMS ----------
-- Line items snapshot at order time (price copied so later catalog
-- edits don't rewrite history). Runner ticks `is_collected` while shopping.
create table order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  product_id   uuid references products(id),  -- null if free-text custom line
  name         text not null,
  emoji        text,
  unit_price_paise integer not null,
  quantity     integer not null default 1,
  is_collected boolean not null default false,
  created_at   timestamptz not null default now()
);

create index order_items_order_idx on order_items(order_id);

-- ---------- WALLET LEDGER ----------
-- Every balance change is an immutable row. Balance = sum of entries.
-- Keeps an auditable trail for escrow holds, releases, refunds, payouts.
create table wallet_entries (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  order_id    uuid references orders(id),
  amount_paise integer not null,             -- +credit / -debit
  reason      text not null,                 -- HOLD | RELEASE | EARNING | REFUND | TOPUP | PAYOUT
  created_at  timestamptz not null default now()
);

create index wallet_entries_profile_idx on wallet_entries(profile_id);
