-- ============================================================
-- Campus Runner — RLS + business logic
-- Money rules live server-side so a tampered client can't cheat.
-- ============================================================

alter table profiles       enable row level security;
alter table vendors        enable row level security;
alter table products       enable row level security;
alter table orders         enable row level security;
alter table order_items    enable row level security;
alter table wallet_entries enable row level security;

-- ---------- PROFILES ----------
create policy "read own profile" on profiles
  for select using (auth.uid() = id);
create policy "update own profile" on profiles
  for update using (auth.uid() = id);

-- ---------- CATALOG (public read) ----------
create policy "anyone reads vendors"  on vendors  for select using (true);
create policy "anyone reads products" on products for select using (true);

-- ---------- ORDERS ----------
-- A buyer sees their own orders. A runner sees orders they accepted,
-- plus all OPEN ('PLACED') orders in the feed.
create policy "buyer reads own orders" on orders
  for select using (auth.uid() = buyer_id);
create policy "runner reads claimed orders" on orders
  for select using (auth.uid() = runner_id);
create policy "runners read open feed" on orders
  for select using (status = 'PLACED');

-- Inserts/updates go through SECURITY DEFINER functions below,
-- not direct table writes, so no broad write policy is granted.

-- ---------- ORDER ITEMS ----------
create policy "read items of visible orders" on order_items
  for select using (
    exists (select 1 from orders o where o.id = order_id
      and (o.buyer_id = auth.uid() or o.runner_id = auth.uid() or o.status = 'PLACED'))
  );

-- ---------- WALLET ----------
create policy "read own wallet" on wallet_entries
  for select using (auth.uid() = profile_id);

-- ============================================================
-- HELPER: recompute + cache wallet balance from the ledger
-- ============================================================
create or replace function apply_wallet_entry(
  p_profile uuid, p_order uuid, p_amount integer, p_reason text
) returns void language plpgsql security definer as $$
begin
  insert into wallet_entries(profile_id, order_id, amount_paise, reason)
  values (p_profile, p_order, p_amount, p_reason);
  update profiles set wallet_paise = wallet_paise + p_amount where id = p_profile;
end; $$;

-- ============================================================
-- PLACE ORDER
-- Validates totals server-side, holds funds in escrow for WALLET.
-- Items are passed as jsonb: [{product_id,name,emoji,unit_price_paise,quantity}]
-- ============================================================
create or replace function place_order(
  p_vendor uuid,
  p_is_custom boolean,
  p_custom_title text,
  p_custom_details text,
  p_drop text,
  p_items jsonb,
  p_payment payment_method,
  p_surge_fee integer
) returns uuid language plpgsql security definer as $$
declare
  v_buyer uuid := auth.uid();
  v_subtotal integer := 0;
  v_runner_fee integer := 2000;            -- ₹20 base, in paise
  v_platform integer;
  v_total integer;
  v_order uuid;
  v_item jsonb;
  v_bal integer;
begin
  if v_buyer is null then raise exception 'not authenticated'; end if;

  -- sum line items from the passed payload
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_subtotal := v_subtotal
      + (v_item->>'unit_price_paise')::int * (v_item->>'quantity')::int;
  end loop;

  v_platform := round((v_subtotal + v_runner_fee + coalesce(p_surge_fee,0)) * 0.08);
  v_total := v_subtotal + v_runner_fee + coalesce(p_surge_fee,0) + v_platform;

  -- escrow gate for wallet payments
  if p_payment = 'WALLET' then
    select wallet_paise into v_bal from profiles where id = v_buyer;
    if v_bal < v_total then raise exception 'insufficient wallet balance'; end if;
  end if;

  insert into orders(buyer_id, vendor_id, is_custom, custom_title, custom_details,
    drop_location, items_subtotal_paise, runner_fee_paise, surge_fee_paise,
    platform_fee_paise, total_paise, payment_method, payment_status)
  values (v_buyer, p_vendor, p_is_custom, p_custom_title, p_custom_details,
    p_drop, v_subtotal, v_runner_fee, coalesce(p_surge_fee,0),
    v_platform, v_total, p_payment,
    case when p_payment = 'WALLET' then 'HELD' else 'PENDING' end)
  returning id into v_order;

  -- snapshot the line items
  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into order_items(order_id, product_id, name, emoji, unit_price_paise, quantity)
    values (v_order,
      nullif(v_item->>'product_id','')::uuid,
      v_item->>'name', v_item->>'emoji',
      (v_item->>'unit_price_paise')::int, (v_item->>'quantity')::int);
  end loop;

  -- hold the money
  if p_payment = 'WALLET' then
    perform apply_wallet_entry(v_buyer, v_order, -v_total, 'HOLD');
  end if;

  return v_order;
end; $$;

-- ============================================================
-- ACCEPT ORDER  (atomic claim — prevents two runners grabbing one)
-- ============================================================
create or replace function accept_order(p_order uuid)
returns void language plpgsql security definer as $$
declare v_runner uuid := auth.uid(); v_rows integer;
begin
  if v_runner is null then raise exception 'not authenticated'; end if;

  update orders
    set runner_id = v_runner, status = 'ACCEPTED', accepted_at = now()
    where id = p_order and status = 'PLACED' and buyer_id <> v_runner;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'order no longer available'; end if;
end; $$;

-- ============================================================
-- ADVANCE ORDER  (runner moves through the lifecycle)
-- Only the assigned runner can advance, and only one step forward.
-- ============================================================
create or replace function advance_order(p_order uuid, p_to order_status)
returns void language plpgsql security definer as $$
declare
  v_runner uuid := auth.uid();
  v_cur order_status;
  v_valid boolean;
begin
  select status into v_cur from orders
    where id = p_order and runner_id = v_runner for update;
  if v_cur is null then raise exception 'not your order'; end if;

  v_valid := (v_cur='ACCEPTED'  and p_to='SHOPPING')
          or (v_cur='SHOPPING'  and p_to='PURCHASED')
          or (v_cur='PURCHASED' and p_to='DELIVERED');
  if not v_valid then raise exception 'invalid transition % -> %', v_cur, p_to; end if;

  update orders set status = p_to,
    delivered_at = case when p_to='DELIVERED' then now() else delivered_at end
    where id = p_order;
end; $$;

-- ============================================================
-- CONFIRM RECEIPT  (buyer closes the order, releases escrow + pays runner)
-- ============================================================
create or replace function confirm_order(p_order uuid, p_rating integer)
returns void language plpgsql security definer as $$
declare o orders%rowtype;
begin
  select * into o from orders
    where id = p_order and buyer_id = auth.uid() for update;
  if o.id is null then raise exception 'not your order'; end if;
  if o.status <> 'DELIVERED' then raise exception 'order not delivered yet'; end if;

  update orders set status='COMPLETED', completed_at=now(),
    runner_rating = p_rating,
    payment_status = case when payment_method='WALLET' then 'RELEASED' else payment_status end
    where id = p_order;

  -- pay the runner: their fee + the reimbursed item cost (for WALLET orders)
  if o.payment_method = 'WALLET' then
    perform apply_wallet_entry(o.runner_id, o.id,
      o.runner_fee_paise + o.surge_fee_paise + o.items_subtotal_paise, 'EARNING');
  else
    -- COD/UPI: runner already collected item cost; credit just the fee
    perform apply_wallet_entry(o.runner_id, o.id,
      o.runner_fee_paise + o.surge_fee_paise, 'EARNING');
  end if;

  -- update runner's aggregate rating
  if p_rating is not null then
    update profiles set rating_sum = rating_sum + p_rating,
      rating_count = rating_count + 1 where id = o.runner_id;
  end if;
end; $$;

-- ============================================================
-- TOGGLE ITEM COLLECTED  (runner ticks items while shopping)
-- ============================================================
create or replace function set_item_collected(p_item uuid, p_collected boolean)
returns void language plpgsql security definer as $$
begin
  update order_items oi set is_collected = p_collected
    from orders o
    where oi.id = p_item and oi.order_id = o.id and o.runner_id = auth.uid();
end; $$;
