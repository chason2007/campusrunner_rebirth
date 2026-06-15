-- ============================================================
-- Campus Runner — SQL Schema Definition (PostgreSQL)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop everything first to start fresh (useful for development)
DROP TABLE IF EXISTS public.wallet_entries CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.vendors CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.universities CASCADE;

DROP TYPE IF EXISTS order_status CASCADE;
DROP TYPE IF EXISTS payment_method CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;

-- ---------- ENUMS ----------
CREATE TYPE order_status AS ENUM (
  'PLACED',     -- buyer placed, waiting for a runner
  'ACCEPTED',   -- a runner claimed it
  'SHOPPING',   -- runner is at the vendor collecting items
  'PURCHASED',  -- runner has bought everything
  'DELIVERED',  -- runner dropped it at the buyer
  'COMPLETED',  -- buyer confirmed receipt
  'CANCELLED',  -- cancelled before pickup
  'DISPUTED'    -- flagged for admin review
);

CREATE TYPE payment_method AS ENUM ('WALLET', 'UPI', 'COD');
CREATE TYPE payment_status AS ENUM ('PENDING', 'HELD', 'RELEASED', 'REFUNDED');

-- ---------- UNIVERSITIES ----------
CREATE TABLE public.universities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  domain      text UNIQUE NOT NULL,
  colors      jsonb NOT NULL DEFAULT '{"primary": "#f5a623", "dark": "#0f1117"}'::jsonb,
  locations   text[] NOT NULL DEFAULT '{}'::text[],
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- PROFILES (Users) ----------
CREATE TABLE public.profiles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  full_name     text,
  is_verified   boolean NOT NULL DEFAULT false,
  wallet_paise  integer NOT NULL DEFAULT 0,
  rating_sum    integer NOT NULL DEFAULT 0,
  rating_count  integer NOT NULL DEFAULT 0,
  is_admin      boolean NOT NULL DEFAULT false,
  university_id uuid REFERENCES public.universities(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------- VENDORS ----------
CREATE TABLE public.vendors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  emoji         text,
  tag           text,                  -- "Café · Block A"
  category      text,                  -- food | drinks | print | stationery | essentials
  eta_minutes   integer DEFAULT 10,
  rating        numeric(2,1) DEFAULT 4.5,
  is_active     boolean NOT NULL DEFAULT true,
  university_id uuid REFERENCES public.universities(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------- PRODUCTS ----------
CREATE TABLE public.products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  emoji         text,
  category      text,
  price_paise   integer NOT NULL,      -- catalog price in paise
  is_available  boolean NOT NULL DEFAULT true,
  university_id uuid REFERENCES public.universities(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------- ORDERS ----------
CREATE TABLE public.orders (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  runner_id            uuid REFERENCES public.profiles(id),          -- null until accepted
  vendor_id            uuid REFERENCES public.vendors(id),           -- null for custom requests
  is_custom            boolean NOT NULL DEFAULT false,
  custom_title         text,
  custom_details       text,
  status               order_status NOT NULL DEFAULT 'PLACED',
  drop_location        text NOT NULL,
  items_subtotal_paise integer NOT NULL DEFAULT 0,
  runner_fee_paise     integer NOT NULL DEFAULT 0,
  surge_fee_paise      integer NOT NULL DEFAULT 0,
  platform_fee_paise   integer NOT NULL DEFAULT 0,
  total_paise          integer NOT NULL DEFAULT 0,
  payment_method       payment_method NOT NULL,
  payment_status       payment_status NOT NULL DEFAULT 'PENDING',
  runner_rating        integer,  -- 1..5
  university_id        uuid REFERENCES public.universities(id) ON DELETE CASCADE,
  created_at           timestamptz NOT NULL DEFAULT now(),
  accepted_at          timestamptz,
  delivered_at         timestamptz,
  completed_at         timestamptz
);

CREATE INDEX orders_status_idx   ON public.orders(status);
CREATE INDEX orders_buyer_idx    ON public.orders(buyer_id);
CREATE INDEX orders_runner_idx   ON public.orders(runner_id);

-- ---------- ORDER ITEMS ----------
CREATE TABLE public.order_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id       uuid REFERENCES public.products(id),  -- null if custom free-text
  name             text NOT NULL,
  emoji            text,
  unit_price_paise integer NOT NULL,
  quantity         integer NOT NULL DEFAULT 1,
  is_collected     boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX order_items_order_idx ON public.order_items(order_id);

-- ---------- WALLET LEDGER ----------
CREATE TABLE public.wallet_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id     uuid REFERENCES public.orders(id),
  amount_paise integer NOT NULL,             -- +credit / -debit
  reason       text NOT NULL,                 -- HOLD | RELEASE | EARNING | REFUND | TOPUP | PAYOUT
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX wallet_entries_profile_idx ON public.wallet_entries(profile_id);

-- ============================================================
-- DB FUNCTIONS (BUSINESS LOGIC TRANSACTIONS)
-- ============================================================

-- Apply wallet entry and update cached profile balance
CREATE OR REPLACE FUNCTION public.apply_wallet_entry(
  p_profile uuid, p_order uuid, p_amount integer, p_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.wallet_entries(profile_id, order_id, amount_paise, reason)
  VALUES (p_profile, p_order, p_amount, p_reason);
  
  UPDATE public.profiles 
  SET wallet_paise = wallet_paise + p_amount 
  WHERE id = p_profile;
END; $$;

-- Place order (escrows wallet balance, snapshots items, returns order ID)
CREATE OR REPLACE FUNCTION public.place_order(
  p_buyer uuid,
  p_vendor uuid,
  p_is_custom boolean,
  p_custom_title text,
  p_custom_details text,
  p_drop text,
  p_items jsonb,
  p_payment public.payment_method,
  p_surge_fee integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_subtotal integer := 0;
  v_runner_fee integer := 2000;            -- ₹20 base fee in paise
  v_platform integer;
  v_total integer;
  v_order uuid;
  v_item jsonb;
  v_bal integer;
  v_uni_id uuid;
BEGIN
  -- Fetch buyer's university
  SELECT university_id INTO v_uni_id FROM public.profiles WHERE id = p_buyer;

  -- Sum line items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_subtotal := v_subtotal + (v_item->>'unit_price_paise')::int * (v_item->>'quantity')::int;
  END LOOP;

  v_platform := round((v_subtotal + v_runner_fee + coalesce(p_surge_fee, 0)) * 0.08);
  v_total := v_subtotal + v_runner_fee + coalesce(p_surge_fee, 0) + v_platform;

  -- Wallet escrow check
  IF p_payment = 'WALLET' THEN
    SELECT wallet_paise INTO v_bal FROM public.profiles WHERE id = p_buyer;
    IF v_bal < v_total THEN 
      RAISE EXCEPTION 'insufficient wallet balance'; 
    END IF;
  END IF;

  INSERT INTO public.orders(buyer_id, university_id, vendor_id, is_custom, custom_title, custom_details,
    drop_location, items_subtotal_paise, runner_fee_paise, surge_fee_paise,
    platform_fee_paise, total_paise, payment_method, payment_status)
  VALUES (p_buyer, v_uni_id, p_vendor, p_is_custom, p_custom_title, p_custom_details,
    p_drop, v_subtotal, v_runner_fee, coalesce(p_surge_fee, 0),
    v_platform, v_total, p_payment,
    CASE WHEN p_payment = 'WALLET' THEN 'HELD'::public.payment_status ELSE 'PENDING'::public.payment_status END)
  RETURNING id INTO v_order;

  -- Snapshot items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.order_items(order_id, product_id, name, emoji, unit_price_paise, quantity)
    VALUES (v_order,
      nullif(v_item->>'product_id', '')::uuid,
      v_item->>'name', v_item->>'emoji',
      (v_item->>'unit_price_paise')::int, (v_item->>'quantity')::int);
  END LOOP;

  -- Hold escrow if wallet
  IF p_payment = 'WALLET' THEN
    PERFORM public.apply_wallet_entry(p_buyer, v_order, -v_total, 'HOLD');
  END IF;

  RETURN v_order;
END; $$;

-- Claim/Accept order (prevents double grabbing)
CREATE OR REPLACE FUNCTION public.accept_order(p_runner uuid, p_order uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows integer;
BEGIN
  UPDATE public.orders
  SET runner_id = p_runner, status = 'ACCEPTED', accepted_at = now()
  WHERE id = p_order AND status = 'PLACED' AND buyer_id <> p_runner;
  
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN 
    RAISE EXCEPTION 'order no longer available'; 
  END IF;
END; $$;

-- Advance order through the workflow stages
CREATE OR REPLACE FUNCTION public.advance_order(p_runner uuid, p_order uuid, p_to public.order_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cur public.order_status;
  v_valid boolean;
BEGIN
  SELECT status INTO v_cur FROM public.orders
  WHERE id = p_order AND runner_id = p_runner FOR UPDATE;
  
  IF v_cur IS NULL THEN 
    RAISE EXCEPTION 'not your order'; 
  END IF;

  v_valid := (v_cur = 'ACCEPTED' AND p_to = 'SHOPPING')
          OR (v_cur = 'SHOPPING' AND p_to = 'PURCHASED')
          OR (v_cur = 'PURCHASED' AND p_to = 'DELIVERED');
          
  IF NOT v_valid THEN 
    RAISE EXCEPTION 'invalid transition % -> %', v_cur, p_to; 
  END IF;

  UPDATE public.orders 
  SET status = p_to,
      delivered_at = CASE WHEN p_to = 'DELIVERED' THEN now() ELSE delivered_at END
  WHERE id = p_order;
END; $$;

-- Confirm order delivery and dispatch payments
CREATE OR REPLACE FUNCTION public.confirm_order(p_buyer uuid, p_order uuid, p_rating integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE o public.orders%rowtype;
BEGIN
  SELECT * INTO o FROM public.orders
  WHERE id = p_order AND buyer_id = p_buyer FOR UPDATE;
  
  IF o.id IS NULL THEN 
    RAISE EXCEPTION 'not your order'; 
  END IF;
  
  IF o.status <> 'DELIVERED' THEN 
    RAISE EXCEPTION 'order not delivered yet'; 
  END IF;

  UPDATE public.orders 
  SET status = 'COMPLETED', 
      completed_at = now(),
      runner_rating = p_rating,
      payment_status = CASE WHEN payment_method = 'WALLET' THEN 'RELEASED'::public.payment_status ELSE payment_status END
  WHERE id = p_order;

  -- Pay runner
  IF o.payment_method = 'WALLET' THEN
    PERFORM public.apply_wallet_entry(o.runner_id, o.id,
      o.runner_fee_paise + o.surge_fee_paise + o.items_subtotal_paise, 'EARNING');
  ELSE
    PERFORM public.apply_wallet_entry(o.runner_id, o.id,
      o.runner_fee_paise + o.surge_fee_paise, 'EARNING');
  END IF;

  -- Update runner rating
  IF p_rating IS NOT NULL THEN
    UPDATE public.profiles 
    SET rating_sum = rating_sum + p_rating,
        rating_count = rating_count + 1 
    WHERE id = o.runner_id;
  END IF;
END; $$;

-- Set single item collected state by runner
CREATE OR REPLACE FUNCTION public.set_item_collected(p_runner uuid, p_item uuid, p_collected boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.order_items oi 
  SET is_collected = p_collected
  FROM public.orders o
  WHERE oi.id = p_item AND oi.order_id = o.id AND o.runner_id = p_runner;
END; $$;
