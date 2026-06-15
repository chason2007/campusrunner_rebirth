-- ============================================================
-- Campus Runner — Admin RLS Policies
-- Grants users with is_admin = true full write & delete access.
-- ============================================================

-- ---------- VENDORS ----------
create policy "admins insert vendors" on vendors for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);
create policy "admins update vendors" on vendors for update using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);
create policy "admins delete vendors" on vendors for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);

-- ---------- PRODUCTS ----------
create policy "admins insert products" on products for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);
create policy "admins update products" on products for update using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);
create policy "admins delete products" on products for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);

-- ---------- PROFILES ----------
-- Allow admins to read all profiles
create policy "admins read all profiles" on profiles for select using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);
create policy "admins update profiles" on profiles for update using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);
create policy "admins delete profiles" on profiles for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);

-- ---------- ORDERS ----------
create policy "admins read all orders" on orders for select using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);
create policy "admins update all orders" on orders for update using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);
create policy "admins delete all orders" on orders for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);

-- ---------- ORDER ITEMS ----------
create policy "admins read all order_items" on order_items for select using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);
create policy "admins insert all order_items" on order_items for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);
create policy "admins update all order_items" on order_items for update using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);
create policy "admins delete all order_items" on order_items for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);
