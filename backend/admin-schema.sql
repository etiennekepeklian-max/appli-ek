-- Additive upgrade: preserve all existing users, device keys and business data.
begin;
alter table pikeo_private.profiles add column if not exists active boolean not null default true;
alter table pikeo_private.profiles add column if not exists default_role text not null default 'operator' check(default_role in ('operator','viewer'));
alter table pikeo_private.profiles add column if not exists access_version integer not null default 0;
alter table pikeo_private.devices add column if not exists permissions jsonb default null check(permissions is null or jsonb_typeof(permissions)='array');
alter table pikeo_private.devices add column if not exists access_version integer not null default 0;
alter table pikeo_private.devices drop constraint if exists devices_role_check;
alter table pikeo_private.devices add constraint devices_role_check check(role in ('admin','operator','viewer'));
create table if not exists pikeo_private.access_audit(id uuid primary key default gen_random_uuid(),actor uuid not null,target uuid not null,action text not null,details jsonb not null default '{}',created_at timestamptz not null default now());
alter table pikeo_private.access_audit enable row level security;
revoke all on pikeo_private.access_audit from public,anon,authenticated;
create policy deny_direct_access on pikeo_private.access_audit for all to anon,authenticated using(false) with check(false);
commit;
