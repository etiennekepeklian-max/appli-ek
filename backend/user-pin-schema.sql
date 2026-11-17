begin;
create table if not exists pikeo_private.user_pins(
 profile_id uuid primary key references pikeo_private.profiles(id) on delete cascade,
 bootstrap_device_ids uuid[] not null default '{}',
 enroll_device_id uuid references pikeo_private.devices(id),
 salt_hex text check(salt_hex ~ '^[0-9a-f]{32}$'),
 verifier_hex text check(verifier_hex ~ '^[0-9a-f]{64}$'),
 failed_attempts integer not null default 0 check(failed_attempts>=0),
 locked_until timestamptz,
 requires_reset boolean not null default false,
 updated_at timestamptz not null default now(),
 check((salt_hex is null)=(verifier_hex is null))
);
create table if not exists pikeo_private.user_pin_sessions(
 device_id uuid primary key references pikeo_private.devices(id) on delete cascade,
 profile_id uuid not null references pikeo_private.profiles(id) on delete cascade,
 token_hash text not null check(token_hash ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz not null
);
alter table pikeo_private.user_pins enable row level security;
alter table pikeo_private.user_pin_sessions enable row level security;
revoke all on pikeo_private.user_pins,pikeo_private.user_pin_sessions from public,anon,authenticated;
-- Freeze pre-migration devices eligible to choose a first code. Registering a
-- new device twice must never turn it into a legacy trusted device.
insert into pikeo_private.user_pins(profile_id,bootstrap_device_ids)
 select p.id,array_agg(d.id) from pikeo_private.profiles p join pikeo_private.devices d on d.profile_id=p.id
 where d.active and p.active and (not p.is_owner or d.role='admin') group by p.id
 on conflict(profile_id) do nothing;
-- Only Étienne's privately activated owner devices can retain administrator rights.
update pikeo_private.devices d set role='operator',permissions=null,access_version=access_version+1
 from pikeo_private.profiles p where p.id=d.profile_id and not p.is_owner and d.role='admin';
commit;
