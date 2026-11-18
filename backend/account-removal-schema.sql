-- Additive prerequisite for account removal; retain business records and audit links.
begin;
alter table pikeo_private.profiles add column if not exists deleted_at timestamptz;
alter table pikeo_private.profiles add constraint profiles_owner_not_deleted check (not is_owner or deleted_at is null);
commit;
