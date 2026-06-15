-- ============================================================
-- Campus Runner — patch: switch profiles from phone to email.
-- ONLY run this if you already ran the original 0001 (with `phone`).
-- If you're setting up fresh, the updated 0001 already has `email`
-- and you can skip this file.
-- ============================================================

-- add email column if missing
alter table profiles add column if not exists email text;

-- drop the old NOT NULL + unique phone column if it exists
alter table profiles drop column if exists phone;

-- make email unique (ignore if already there)
do $$
begin
  alter table profiles add constraint profiles_email_key unique (email);
exception when duplicate_table or duplicate_object then null;
end $$;
