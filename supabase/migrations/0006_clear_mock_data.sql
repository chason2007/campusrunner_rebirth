-- ============================================================
-- Campus Runner — Clear Mock Data
-- Clears all mock/seed catalog items, orders, wallet entries,
-- and deletes all non-admin users from both auth.users and public.profiles.
-- ============================================================

-- Clear all order, transaction, and catalog tables
truncate table public.order_items cascade;
truncate table public.orders cascade;
truncate table public.wallet_entries cascade;
truncate table public.products cascade;
truncate table public.vendors cascade;

-- Delete all users from auth.users who are not marked as admin in public.profiles.
-- (This will cascade delete their rows in public.profiles via foreign keys).
delete from auth.users
where id in (
  select id from public.profiles where is_admin = false or is_admin is null
);
