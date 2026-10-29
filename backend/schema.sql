-- Private server state. No browser role has direct table access.
create schema if not exists pikeo_private;
revoke all on schema pikeo_private from public, anon, authenticated;
create table pikeo_private.profiles (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 40),
 name_key text unique not null, is_owner boolean not null default false, share_achievements boolean not null default false,
 active boolean not null default true,
 default_role text not null default 'operator' check(default_role in ('operator','viewer')),
 access_version integer not null default 0,
 created_at timestamptz not null default now()
);
create unique index single_owner on pikeo_private.profiles(is_owner) where is_owner;
insert into pikeo_private.profiles(name,name_key,is_owner) values ('Étienne','etienne',true);
create table pikeo_private.devices (
 id uuid primary key, profile_id uuid not null references pikeo_private.profiles(id),
 signing_key jsonb not null, encryption_key jsonb not null,
 role text not null default 'operator' check(role in ('admin','operator','viewer')), permissions jsonb check(permissions is null or jsonb_typeof(permissions)='array'), access_version integer not null default 0, active boolean not null default true,
 created_at timestamptz not null default now(), last_seen timestamptz not null default now()
);
create index devices_profile on pikeo_private.devices(profile_id);
create table pikeo_private.access_audit(
 id uuid primary key default gen_random_uuid(), actor uuid,
 target uuid not null, action text not null, details jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create table pikeo_private.owner_keys(token_hash text primary key check(length(token_hash)=64),created_at timestamptz not null default now(),active boolean not null default true);
create table pikeo_private.nonces(device_id uuid not null references pikeo_private.devices(id) on delete cascade, nonce uuid not null, created_at timestamptz not null default now(), primary key(device_id,nonce));
create index nonces_expiry on pikeo_private.nonces(created_at);
create table pikeo_private.rate_limits(bucket text primary key,hits integer not null,expires_at timestamptz not null);
create index rate_limits_expiry on pikeo_private.rate_limits(expires_at);
create table pikeo_private.messages(
 id uuid not null, sender_device uuid not null references pikeo_private.devices(id),
 recipient_device uuid not null references pikeo_private.devices(id), sender_profile uuid not null references pikeo_private.profiles(id),
 recipient_profile uuid not null references pikeo_private.profiles(id), envelope jsonb not null check(octet_length(envelope::text)<16000),
 created_at timestamptz not null default now(), expires_at timestamptz not null default(now()+interval '24 hours'),
 primary key(id,recipient_device)
);
create index messages_inbox on pikeo_private.messages(recipient_device,created_at);
create index messages_expiry on pikeo_private.messages(expires_at);
create table pikeo_private.shared_config(id boolean primary key default true check(id),version integer not null default 0, data jsonb not null default '{"records":[]}',updated_at timestamptz not null default now());
insert into pikeo_private.shared_config(id) values(true);
create table pikeo_private.achievements(profile_id uuid not null references pikeo_private.profiles(id),day date not null,category text not null check(category in ('entraide','qualite','progres')),created_at timestamptz not null default now(),primary key(profile_id,day,category));
create index achievements_expiry on pikeo_private.achievements(day);
alter table pikeo_private.access_audit enable row level security;
alter table pikeo_private.profiles enable row level security;
alter table pikeo_private.devices enable row level security;
alter table pikeo_private.owner_keys enable row level security;
alter table pikeo_private.nonces enable row level security;
alter table pikeo_private.rate_limits enable row level security;
alter table pikeo_private.messages enable row level security;
alter table pikeo_private.shared_config enable row level security;
alter table pikeo_private.achievements enable row level security;
revoke all on all tables in schema pikeo_private from public,anon,authenticated;

-- Explicit deny policies document the intentional no-direct-browser-access model.
do $$declare t text; begin foreach t in array array['access_audit','profiles','devices','owner_keys','nonces','rate_limits','messages','shared_config','achievements'] loop execute format('create policy deny_direct_access on pikeo_private.%I for all to anon,authenticated using (false) with check(false)',t);end loop;end$$;
create extension if not exists pg_cron;
select cron.schedule('pikeo-retention','*/10 * * * *',$$delete from pikeo_private.messages where expires_at<now(); delete from pikeo_private.nonces where created_at<now()-interval '10 minutes'; delete from pikeo_private.rate_limits where expires_at<now(); delete from pikeo_private.achievements where day<(now() at time zone 'Europe/Paris')::date-6;$$);
