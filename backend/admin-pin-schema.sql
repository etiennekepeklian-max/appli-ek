-- PREPARATION ONLY: additive migration. NOT DEPLOYED.
-- PIN: 4 digits, verified on the server as a second factor for signed admin devices.
-- The 256-bit secret PIKEO_PIN_PEPPER must be stored in Supabase Edge Function secrets.
-- Apply only after verifying a tested admin PIN enrollment/recovery flow and backups.
begin;
create table if not exists pikeo_private.admin_pins(
 device_id uuid primary key references pikeo_private.devices(id) on delete cascade,
 salt_hex text not null check(salt_hex ~ '^[0-9a-f]{32}$'),
 verifier_hex text not null check(verifier_hex ~ '^[0-9a-f]{64}$'),
 failed_attempts integer not null default 0 check(failed_attempts>=0),
 locked_until timestamptz,
 unlocked_until timestamptz,
 requires_reset boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table pikeo_private.admin_pins enable row level security;
revoke all on pikeo_private.admin_pins from public,anon,authenticated;
-- Only the secured Edge Function's backend may access PIN verifiers.
do $$begin
 if not exists (select 1 from pg_policies where schemaname='pikeo_private' and tablename='admin_pins' and policyname='deny_direct_access')
 then create policy deny_direct_access on pikeo_private.admin_pins for all to anon,authenticated using(false) with check(false);
 end if;
end$$;
commit;
