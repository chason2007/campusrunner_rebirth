-- ============================================================
-- Campus Runner — auto-create a profile row when a user signs up.
-- Supabase stores auth in auth.users; we mirror into public.profiles.
-- (Email + password auth — phone verification deferred.)
-- ============================================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Optional: give every new student a small starting wallet for testing.
-- Comment out for production.
update profiles set wallet_paise = 24000 where wallet_paise = 0;
